-- Migration: Add payment_made column to public.bookings
-- Connects the payment settlement workflow between Rider and Driver
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_made text NOT NULL DEFAULT 'no';
COMMENT ON COLUMN public.bookings.payment_made IS 'Indicates whether the customer has completed payment (yes/no)';
