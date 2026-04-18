DROP POLICY IF EXISTS "Anyone can submit a booking inquiry" ON public.bookings;
CREATE POLICY "Anyone can submit a booking inquiry"
  ON public.bookings
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can attach add-ons to a booking" ON public.booking_addons;
CREATE POLICY "Anyone can attach add-ons to a booking"
  ON public.booking_addons
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);