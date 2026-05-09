ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS pod_allocations JSONB;

UPDATE public.bookings
SET pod_allocations = jsonb_build_array(
  jsonb_build_object(
    'pod_id', pod_id,
    'rooms', rooms
  )
)
WHERE pod_allocations IS NULL;

CREATE OR REPLACE FUNCTION public.booking_allocations_json(
  _pod_id UUID,
  _rooms INTEGER,
  _pod_allocations JSONB
)
RETURNS TABLE(pod_id UUID, rooms INTEGER)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    (item->>'pod_id')::UUID AS pod_id,
    GREATEST(COALESCE((item->>'rooms')::INTEGER, 0), 0) AS rooms
  FROM jsonb_array_elements(
    CASE
      WHEN _pod_allocations IS NOT NULL
        AND jsonb_typeof(_pod_allocations) = 'array'
        AND jsonb_array_length(_pod_allocations) > 0
      THEN _pod_allocations
      ELSE jsonb_build_array(
        jsonb_build_object(
          'pod_id', _pod_id,
          'rooms', _rooms
        )
      )
    END
  ) AS item;
$$;

CREATE OR REPLACE FUNCTION public.enforce_pod_room_inventory()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _allocation RECORD;
  _total_units INTEGER;
  _overlapping_rooms INTEGER;
  _pod_name TEXT;
  _remaining_rooms INTEGER;
  _normalized_allocations JSONB;
  _total_requested_rooms INTEGER;
BEGIN
  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'pod_id', allocation.pod_id,
          'rooms', allocation.rooms
        )
      ) FILTER (WHERE allocation.rooms > 0),
      '[]'::JSONB
    ),
    COALESCE(SUM(allocation.rooms), 0)::INTEGER
  INTO _normalized_allocations, _total_requested_rooms
  FROM public.booking_allocations_json(NEW.pod_id, NEW.rooms, NEW.pod_allocations) AS allocation;

  IF _total_requested_rooms <= 0 THEN
    RAISE EXCEPTION 'Please select at least one room.';
  END IF;

  NEW.pod_allocations := _normalized_allocations;
  NEW.rooms := _total_requested_rooms;

  IF NEW.status NOT IN ('pending', 'confirmed') THEN
    RETURN NEW;
  END IF;

  FOR _allocation IN
    SELECT *
    FROM public.booking_allocations_json(NEW.pod_id, NEW.rooms, NEW.pod_allocations)
    WHERE rooms > 0
  LOOP
    SELECT total_units, name
    INTO _total_units, _pod_name
    FROM public.pods
    WHERE id = _allocation.pod_id;

    IF _total_units IS NULL THEN
      RAISE EXCEPTION 'Selected pod does not exist.';
    END IF;

    SELECT COALESCE(SUM(existing_allocation.rooms), 0)::INTEGER
    INTO _overlapping_rooms
    FROM public.bookings AS booking
    CROSS JOIN LATERAL public.booking_allocations_json(
      booking.pod_id,
      booking.rooms,
      booking.pod_allocations
    ) AS existing_allocation
    WHERE existing_allocation.pod_id = _allocation.pod_id
      AND booking.status IN ('pending', 'confirmed')
      AND booking.id <> NEW.id
      AND booking.check_in < NEW.check_out
      AND booking.check_out > NEW.check_in;

    _remaining_rooms := GREATEST(_total_units - _overlapping_rooms, 0);

    IF _allocation.rooms > _remaining_rooms THEN
      RAISE EXCEPTION
        '% only has % room(s) left for those dates.',
        COALESCE(_pod_name, 'This pod'),
        _remaining_rooms;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_pod_room_inventory ON public.bookings;

CREATE TRIGGER trg_enforce_pod_room_inventory
BEFORE INSERT OR UPDATE OF pod_id, pod_allocations, check_in, check_out, rooms, status
ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.enforce_pod_room_inventory();
