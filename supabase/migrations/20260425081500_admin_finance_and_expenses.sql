DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'business_area') THEN
    CREATE TYPE public.business_area AS ENUM ('cabins', 'restaurant', 'shared');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  business_area public.business_area NOT NULL DEFAULT 'cabins',
  category TEXT NOT NULL,
  vendor TEXT,
  description TEXT NOT NULL,
  amount_kes INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT expenses_amount_nonnegative CHECK (amount_kes >= 0),
  CONSTRAINT expenses_category_len CHECK (char_length(trim(category)) BETWEEN 2 AND 120),
  CONSTRAINT expenses_description_len CHECK (char_length(trim(description)) BETWEEN 2 AND 200)
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses (expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_area ON public.expenses (business_area);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses (category);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admins can view expenses"
    ON public.expenses FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can insert expenses"
    ON public.expenses FOR INSERT
    TO authenticated
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can update expenses"
    ON public.expenses FOR UPDATE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can delete expenses"
    ON public.expenses FOR DELETE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER expenses_touch
    BEFORE UPDATE ON public.expenses
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
