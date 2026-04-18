ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_guest_name_len CHECK (char_length(guest_name) BETWEEN 1 AND 120),
  ADD CONSTRAINT bookings_guest_email_len CHECK (char_length(guest_email) BETWEEN 3 AND 255),
  ADD CONSTRAINT bookings_guest_phone_len CHECK (guest_phone IS NULL OR char_length(guest_phone) BETWEEN 5 AND 40),
  ADD CONSTRAINT bookings_notes_len CHECK (notes IS NULL OR char_length(notes) <= 1000),
  ADD CONSTRAINT bookings_adults_max CHECK (adults BETWEEN 1 AND 10),
  ADD CONSTRAINT bookings_children_max CHECK (children BETWEEN 0 AND 10),
  ADD CONSTRAINT bookings_rooms_max CHECK (rooms BETWEEN 1 AND 5);