CREATE OR REPLACE FUNCTION public.enforce_pod_room_inventory()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _total_units INTEGER;
  _overlapping_rooms INTEGER;
  _pod_name TEXT;
  _remaining_rooms INTEGER;
BEGIN
  IF NEW.status NOT IN ('pending', 'confirmed') THEN
    RETURN NEW;
  END IF;

  SELECT total_units, name
  INTO _total_units, _pod_name
  FROM public.pods
  WHERE id = NEW.pod_id;

  IF _total_units IS NULL THEN
    RAISE EXCEPTION 'Selected pod does not exist.';
  END IF;

  SELECT COALESCE(SUM(rooms), 0)::INTEGER
  INTO _overlapping_rooms
  FROM public.bookings
  WHERE pod_id = NEW.pod_id
    AND status IN ('pending', 'confirmed')
    AND id <> NEW.id
    AND check_in < NEW.check_out
    AND check_out > NEW.check_in;

  _remaining_rooms := GREATEST(_total_units - _overlapping_rooms, 0);

  IF NEW.rooms > _remaining_rooms THEN
    RAISE EXCEPTION
      '% only has % room(s) left for those dates.',
      COALESCE(_pod_name, 'This pod'),
      _remaining_rooms;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_pod_room_inventory ON public.bookings;

CREATE TRIGGER trg_enforce_pod_room_inventory
BEFORE INSERT OR UPDATE OF pod_id, check_in, check_out, rooms, status
ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.enforce_pod_room_inventory();
