CREATE TABLE IF NOT EXISTS public.restaurant_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  guest_name TEXT NOT NULL,
  guest_email TEXT,
  guest_phone TEXT NOT NULL,
  payment_preference TEXT NOT NULL DEFAULT 'bill_later',
  order_status TEXT NOT NULL DEFAULT 'new',
  total_kes INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT restaurant_orders_total_positive CHECK (total_kes > 0),
  CONSTRAINT restaurant_orders_name_len CHECK (char_length(trim(guest_name)) BETWEEN 2 AND 120),
  CONSTRAINT restaurant_orders_payment_preference_check CHECK (payment_preference IN ('pay_now', 'bill_later')),
  CONSTRAINT restaurant_orders_status_check CHECK (order_status IN ('new', 'acknowledged', 'prepared', 'served', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_restaurant_orders_booking_id ON public.restaurant_orders(booking_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_status ON public.restaurant_orders(order_status);

ALTER TABLE public.restaurant_orders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admins can view restaurant orders"
    ON public.restaurant_orders FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can insert restaurant orders"
    ON public.restaurant_orders FOR INSERT
    TO authenticated
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can update restaurant orders"
    ON public.restaurant_orders FOR UPDATE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can delete restaurant orders"
    ON public.restaurant_orders FOR DELETE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER restaurant_orders_touch
    BEFORE UPDATE ON public.restaurant_orders
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.restaurant_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.restaurant_orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES public.restaurant_menu_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_kes INTEGER NOT NULL DEFAULT 0,
  line_total_kes INTEGER NOT NULL DEFAULT 0,
  special_request TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT restaurant_order_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT restaurant_order_items_unit_price_nonnegative CHECK (unit_price_kes >= 0),
  CONSTRAINT restaurant_order_items_line_total_nonnegative CHECK (line_total_kes >= 0)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_order_items_order_id ON public.restaurant_order_items(order_id);

ALTER TABLE public.restaurant_order_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admins can view restaurant order items"
    ON public.restaurant_order_items FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can insert restaurant order items"
    ON public.restaurant_order_items FOR INSERT
    TO authenticated
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can update restaurant order items"
    ON public.restaurant_order_items FOR UPDATE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can delete restaurant order items"
    ON public.restaurant_order_items FOR DELETE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.guest_charge_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  guest_name TEXT NOT NULL,
  guest_email TEXT,
  guest_phone TEXT NOT NULL,
  description TEXT NOT NULL,
  total_kes INTEGER NOT NULL,
  charge_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  batch_status TEXT NOT NULL DEFAULT 'draft',
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
  CONSTRAINT guest_charge_batches_total_positive CHECK (total_kes > 0),
  CONSTRAINT guest_charge_batches_name_len CHECK (char_length(trim(guest_name)) BETWEEN 2 AND 120),
  CONSTRAINT guest_charge_batches_status_check CHECK (batch_status IN ('draft', 'requested', 'paid', 'failed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_guest_charge_batches_booking_id ON public.guest_charge_batches(booking_id);
CREATE INDEX IF NOT EXISTS idx_guest_charge_batches_status ON public.guest_charge_batches(batch_status);

ALTER TABLE public.guest_charge_batches ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admins can view guest charge batches"
    ON public.guest_charge_batches FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can insert guest charge batches"
    ON public.guest_charge_batches FOR INSERT
    TO authenticated
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can update guest charge batches"
    ON public.guest_charge_batches FOR UPDATE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can delete guest charge batches"
    ON public.guest_charge_batches FOR DELETE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER guest_charge_batches_touch
    BEFORE UPDATE ON public.guest_charge_batches
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.guest_charges
  ADD COLUMN IF NOT EXISTS source_kind TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_order_id UUID REFERENCES public.restaurant_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_batch_id UUID REFERENCES public.guest_charge_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_guest_charges_source_order_id ON public.guest_charges(source_order_id);
CREATE INDEX IF NOT EXISTS idx_guest_charges_payment_batch_id ON public.guest_charges(payment_batch_id);

DO $$ BEGIN
  ALTER TABLE public.guest_charges
    ADD CONSTRAINT guest_charges_source_kind_check CHECK (source_kind IN ('manual', 'restaurant_order', 'stay_balance'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
