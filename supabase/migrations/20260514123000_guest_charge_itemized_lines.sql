ALTER TABLE public.guest_charges
  ADD COLUMN IF NOT EXISTS itemized_lines JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.guest_charges
SET itemized_lines = '[]'::jsonb
WHERE itemized_lines IS NULL;

DO $$ BEGIN
  ALTER TABLE public.guest_charges
    ADD CONSTRAINT guest_charges_itemized_lines_array_check CHECK (jsonb_typeof(itemized_lines) = 'array');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
