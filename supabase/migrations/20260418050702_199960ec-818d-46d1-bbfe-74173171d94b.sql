-- Pods (cabin types)
CREATE TABLE public.pods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price_kes INTEGER NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 2,
  size_sqft INTEGER,
  amenities TEXT[] NOT NULL DEFAULT '{}',
  image_url TEXT,
  total_units INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pods are viewable by everyone"
  ON public.pods FOR SELECT
  USING (true);

-- Bookings (inquiries with availability check)
CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'cancelled');

CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE RESTRICT,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  adults INTEGER NOT NULL DEFAULT 1,
  children INTEGER NOT NULL DEFAULT 0,
  rooms INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  status public.booking_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_dates CHECK (check_out > check_in),
  CONSTRAINT valid_rooms CHECK (rooms > 0),
  CONSTRAINT valid_guests CHECK (adults > 0)
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Anyone can create an inquiry (public booking form)
CREATE POLICY "Anyone can submit a booking inquiry"
  ON public.bookings FOR INSERT
  WITH CHECK (true);

-- No public SELECT — bookings are private. Owner views via Cloud dashboard.

CREATE INDEX idx_bookings_pod_dates ON public.bookings(pod_id, check_in, check_out)
  WHERE status IN ('pending', 'confirmed');

-- Availability function: returns booked units for a pod over a date range
CREATE OR REPLACE FUNCTION public.pod_availability(
  _pod_id UUID,
  _check_in DATE,
  _check_out DATE
)
RETURNS TABLE(units_booked INTEGER, units_total INTEGER, units_available INTEGER)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total INTEGER;
  _booked INTEGER;
BEGIN
  SELECT total_units INTO _total FROM public.pods WHERE id = _pod_id;
  IF _total IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(rooms), 0)::INTEGER INTO _booked
  FROM public.bookings
  WHERE pod_id = _pod_id
    AND status IN ('pending', 'confirmed')
    AND check_in < _check_out
    AND check_out > _check_in;

  RETURN QUERY SELECT _booked, _total, GREATEST(_total - _booked, 0);
END;
$$;

-- Seed initial pods
INSERT INTO public.pods (slug, name, description, price_kes, capacity, size_sqft, amenities, total_units, display_order) VALUES
  ('glamping-pod-1', 'Glamping Pod 1', 'A set of 3 glamping pods with views of Soysambu Conservancy to the back, and Lake Elementaita to the front. Wake to the sound of birdsong and the warm glow of sunrise through the triangular glass facade.', 4250, 2, 90, ARRAY['Breakfast included','Private deck','Lake view','Heater','Eco-toilet'], 3, 1),
  ('glamping-pod-2', 'Glamping Pod 2', 'A set of 2 glamping pods with views of Soysambu Conservancy and Lake Elementaita to the front, and The Sleeping Warrior Hill to the back. Larger footprint with a fuller breakfast experience.', 5000, 2, 99, ARRAY['Full breakfast','Private deck','Hill & lake view','Heater','Eco-toilet','Outdoor shower'], 2, 2);
