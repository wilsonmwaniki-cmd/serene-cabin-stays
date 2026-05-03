DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'statement_entry_kind') THEN
    CREATE TYPE public.statement_entry_kind AS ENUM ('income', 'expense', 'transfer', 'reversal', 'balance', 'other');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.statement_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL DEFAULT 'Kopo Kopo',
  original_filename TEXT NOT NULL,
  business_area public.business_area NOT NULL DEFAULT 'cabins',
  statement_from DATE,
  statement_to DATE,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  imported_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT statement_imports_filename_len CHECK (char_length(trim(original_filename)) BETWEEN 3 AND 255),
  CONSTRAINT statement_imports_source_len CHECK (char_length(trim(source_name)) BETWEEN 2 AND 80),
  CONSTRAINT statement_imports_transaction_count_nonnegative CHECK (transaction_count >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_statement_imports_source_filename
  ON public.statement_imports (source_name, original_filename);

CREATE TABLE IF NOT EXISTS public.statement_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES public.statement_imports(id) ON DELETE CASCADE,
  linked_expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  business_area public.business_area NOT NULL DEFAULT 'cabins',
  transaction_at TIMESTAMPTZ NOT NULL,
  description TEXT NOT NULL,
  account_number TEXT,
  reference TEXT,
  debit_kes INTEGER NOT NULL DEFAULT 0,
  credit_kes INTEGER NOT NULL DEFAULT 0,
  balance_kes INTEGER,
  entry_kind public.statement_entry_kind NOT NULL DEFAULT 'other',
  raw_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT statement_transactions_description_len CHECK (char_length(trim(description)) BETWEEN 2 AND 500),
  CONSTRAINT statement_transactions_debit_nonnegative CHECK (debit_kes >= 0),
  CONSTRAINT statement_transactions_credit_nonnegative CHECK (credit_kes >= 0),
  CONSTRAINT statement_transactions_direction CHECK (debit_kes > 0 OR credit_kes > 0)
);

CREATE INDEX IF NOT EXISTS idx_statement_transactions_import_id
  ON public.statement_transactions (import_id);

CREATE INDEX IF NOT EXISTS idx_statement_transactions_at
  ON public.statement_transactions (transaction_at DESC);

CREATE INDEX IF NOT EXISTS idx_statement_transactions_area
  ON public.statement_transactions (business_area);

CREATE INDEX IF NOT EXISTS idx_statement_transactions_kind
  ON public.statement_transactions (entry_kind);

CREATE UNIQUE INDEX IF NOT EXISTS idx_statement_transactions_dedupe
  ON public.statement_transactions (import_id, transaction_at, COALESCE(reference, ''), debit_kes, credit_kes, description);

ALTER TABLE public.statement_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admins can view statement imports"
    ON public.statement_imports FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can insert statement imports"
    ON public.statement_imports FOR INSERT
    TO authenticated
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can update statement imports"
    ON public.statement_imports FOR UPDATE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can delete statement imports"
    ON public.statement_imports FOR DELETE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can view statement transactions"
    ON public.statement_transactions FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can insert statement transactions"
    ON public.statement_transactions FOR INSERT
    TO authenticated
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can update statement transactions"
    ON public.statement_transactions FOR UPDATE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can delete statement transactions"
    ON public.statement_transactions FOR DELETE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER statement_imports_touch
    BEFORE UPDATE ON public.statement_imports
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
