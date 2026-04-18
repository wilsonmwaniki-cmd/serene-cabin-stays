-- Pricing unit enum
CREATE TYPE public.addon_pricing_unit AS ENUM ('per_night', 'per_night_per_adult', 'one_time');

-- Add-ons table
CREATE TABLE public.addons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price_kes INTEGER NOT NULL,
  pricing_unit public.addon_pricing_unit NOT NULL DEFAULT 'per_night',
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Addons are viewable by everyone"
ON public.addons FOR SELECT
USING (is_active = true);

-- Booking add-ons join
CREATE TABLE public.booking_addons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  addon_id UUID NOT NULL REFERENCES public.addons(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_kes INTEGER NOT NULL,
  pricing_unit public.addon_pricing_unit NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can attach add-ons to a booking"
ON public.booking_addons FOR INSERT
WITH CHECK (true);

CREATE INDEX idx_booking_addons_booking ON public.booking_addons(booking_id);

-- Seed initial add-ons
INSERT INTO public.addons (slug, name, description, price_kes, pricing_unit, display_order) VALUES
  ('room-clean', 'Room Clean', 'Daily housekeeping during your stay.', 1000, 'per_night', 1),
  ('full-meals', 'Full Meals', 'Breakfast, lunch and dinner from our restaurants.', 4000, 'per_night_per_adult', 2);