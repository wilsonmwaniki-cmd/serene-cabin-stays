ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_provider TEXT,
  ADD COLUMN IF NOT EXISTS payment_phone TEXT,
  ADD COLUMN IF NOT EXISTS payment_amount_kes INTEGER,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS payment_request_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_request_location TEXT,
  ADD COLUMN IF NOT EXISTS payment_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_received_at TIMESTAMPTZ;

UPDATE public.bookings
SET
  payment_status = COALESCE(NULLIF(payment_status, ''), 'unpaid'),
  payment_provider = COALESCE(payment_provider, 'kopokopo'),
  payment_phone = COALESCE(payment_phone, guest_phone),
  payment_amount_kes = COALESCE(payment_amount_kes, total_kes)
WHERE payment_status IS NULL
   OR payment_provider IS NULL
   OR payment_phone IS NULL
   OR payment_amount_kes IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_payment_status_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_payment_status_check
      CHECK (payment_status IN ('unpaid', 'requested', 'paid', 'failed', 'refunded'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON public.bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_reference ON public.bookings(payment_reference);
