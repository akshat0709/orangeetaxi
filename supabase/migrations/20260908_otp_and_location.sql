-- Ride OTP (6-digit code shown to customer, entered by driver to start ride)
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS ride_otp text NOT NULL DEFAULT '';

-- Driver live location (updated by driver app every ~15 sec)
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS current_lat numeric;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS current_lng numeric;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;

-- Enable realtime for drivers table (so customer can subscribe to location updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;
