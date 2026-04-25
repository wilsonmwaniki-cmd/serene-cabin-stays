DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'promo_code_kind') THEN
    CREATE TYPE public.promo_code_kind AS ENUM ('discount', 'affiliate');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'promo_discount_type') THEN
    CREATE TYPE public.promo_discount_type AS ENUM ('fixed', 'percentage');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  kind public.promo_code_kind NOT NULL DEFAULT 'discount',
  discount_type public.promo_discount_type NOT NULL DEFAULT 'fixed',
  amount_kes INTEGER NOT NULL DEFAULT 0,
  percent_off NUMERIC(5,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT promo_codes_code_uppercase CHECK (code = UPPER(code)),
  CONSTRAINT promo_codes_amount_nonnegative CHECK (amount_kes >= 0),
  CONSTRAINT promo_codes_percent_valid CHECK (
    discount_type <> 'percentage'
    OR (percent_off IS NOT NULL AND percent_off > 0 AND percent_off <= 100)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS promo_codes_code_upper_idx ON public.promo_codes (upper(code));

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Active promo codes are viewable by everyone"
    ON public.promo_codes FOR SELECT
    USING (
      is_active = true
      AND (starts_at IS NULL OR starts_at <= now())
      AND (ends_at IS NULL OR ends_at >= now())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can view all promo codes"
    ON public.promo_codes FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can insert promo codes"
    ON public.promo_codes FOR INSERT
    TO authenticated
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can update promo codes"
    ON public.promo_codes FOR UPDATE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can delete promo codes"
    ON public.promo_codes FOR DELETE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER promo_codes_touch
    BEFORE UPDATE ON public.promo_codes
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS subtotal_kes INTEGER,
  ADD COLUMN IF NOT EXISTS discount_kes INTEGER,
  ADD COLUMN IF NOT EXISTS total_kes INTEGER,
  ADD COLUMN IF NOT EXISTS promo_code_id UUID REFERENCES public.promo_codes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promo_code_text TEXT,
  ADD COLUMN IF NOT EXISTS promo_code_kind public.promo_code_kind;

CREATE INDEX IF NOT EXISTS idx_bookings_promo_code_id ON public.bookings(promo_code_id);
