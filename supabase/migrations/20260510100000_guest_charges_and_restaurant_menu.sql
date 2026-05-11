CREATE TABLE IF NOT EXISTS public.guest_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  business_area public.business_area NOT NULL DEFAULT 'cabins',
  guest_name TEXT NOT NULL,
  guest_email TEXT,
  guest_phone TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_kes INTEGER NOT NULL,
  notes TEXT,
  charge_status TEXT NOT NULL DEFAULT 'draft',
  payment_provider TEXT,
  payment_phone TEXT,
  payment_amount_kes INTEGER,
  payment_reference TEXT,
  payment_request_id TEXT,
  payment_request_location TEXT,
  payment_requested_at TIMESTAMPTZ,
  payment_received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT guest_charges_amount_positive CHECK (amount_kes > 0),
  CONSTRAINT guest_charges_status_check CHECK (charge_status IN ('draft', 'requested', 'paid', 'failed', 'cancelled')),
  CONSTRAINT guest_charges_name_len CHECK (char_length(trim(guest_name)) BETWEEN 2 AND 120),
  CONSTRAINT guest_charges_description_len CHECK (char_length(trim(description)) BETWEEN 2 AND 500)
);

CREATE INDEX IF NOT EXISTS idx_guest_charges_booking_id ON public.guest_charges(booking_id);
CREATE INDEX IF NOT EXISTS idx_guest_charges_status ON public.guest_charges(charge_status);
CREATE INDEX IF NOT EXISTS idx_guest_charges_area ON public.guest_charges(business_area);

ALTER TABLE public.guest_charges ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admins can view guest charges"
    ON public.guest_charges FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can insert guest charges"
    ON public.guest_charges FOR INSERT
    TO authenticated
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can update guest charges"
    ON public.guest_charges FOR UPDATE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can delete guest charges"
    ON public.guest_charges FOR DELETE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER guest_charges_touch
    BEFORE UPDATE ON public.guest_charges
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.restaurant_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  section TEXT NOT NULL DEFAULT 'Seasonal Menu',
  price_kes INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT restaurant_menu_items_title_len CHECK (char_length(trim(title)) BETWEEN 2 AND 120),
  CONSTRAINT restaurant_menu_items_section_len CHECK (char_length(trim(section)) BETWEEN 2 AND 80),
  CONSTRAINT restaurant_menu_items_price_nonnegative CHECK (price_kes >= 0)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_menu_items_active_order
  ON public.restaurant_menu_items(is_active, section, display_order, title);

ALTER TABLE public.restaurant_menu_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Active restaurant menu items are viewable by everyone"
    ON public.restaurant_menu_items FOR SELECT
    TO public
    USING (is_active = true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can view all restaurant menu items"
    ON public.restaurant_menu_items FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can insert restaurant menu items"
    ON public.restaurant_menu_items FOR INSERT
    TO authenticated
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can update restaurant menu items"
    ON public.restaurant_menu_items FOR UPDATE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can delete restaurant menu items"
    ON public.restaurant_menu_items FOR DELETE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER restaurant_menu_items_touch
    BEFORE UPDATE ON public.restaurant_menu_items
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
