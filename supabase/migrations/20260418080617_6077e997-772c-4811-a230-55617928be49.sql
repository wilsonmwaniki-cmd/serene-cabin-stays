-- Bookings: admin can read all and update status
CREATE POLICY "Admins can view all bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update bookings"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Booking add-ons: admin can read
CREATE POLICY "Admins can view booking addons"
  ON public.booking_addons FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Pods: admin can update
CREATE POLICY "Admins can update pods"
  ON public.pods FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Add-ons: admin can read inactive ones too, plus full CRUD
CREATE POLICY "Admins can view all addons"
  ON public.addons FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert addons"
  ON public.addons FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update addons"
  ON public.addons FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete addons"
  ON public.addons FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Editable site content
CREATE TABLE public.site_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site content is viewable by everyone"
  ON public.site_content FOR SELECT USING (true);

CREATE POLICY "Admins can insert site content"
  ON public.site_content FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update site content"
  ON public.site_content FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER site_content_touch
  BEFORE UPDATE ON public.site_content
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed initial blocks
INSERT INTO public.site_content (key, label, value) VALUES
  ('home.hero.eyebrow', 'Home – hero eyebrow', 'A retreat in the wild'),
  ('home.hero.title', 'Home – hero title', 'Wild by LERA'),
  ('home.hero.subtitle', 'Home – hero subtitle', 'Hand-built glamping pods in the Kenyan landscape.'),
  ('restaurant.intro.title', 'Restaurant – intro title', 'A table in the wild'),
  ('restaurant.intro.body', 'Restaurant – intro body', 'Seasonal Kenyan cooking served by the fire.'),
  ('contact.address', 'Contact – address', 'Naivasha, Kenya'),
  ('contact.email', 'Contact – email', 'hello@wildbylera.com'),
  ('contact.phone', 'Contact – phone', '+254 700 000 000');
