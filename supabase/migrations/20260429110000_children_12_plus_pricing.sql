ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS children_12_plus INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_children_12_plus_max'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_children_12_plus_max CHECK (children_12_plus BETWEEN 0 AND 10);
  END IF;
END $$;
