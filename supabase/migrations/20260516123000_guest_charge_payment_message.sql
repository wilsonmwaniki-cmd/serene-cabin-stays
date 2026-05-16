ALTER TABLE public.guest_charges
  ADD COLUMN IF NOT EXISTS payment_message TEXT;
