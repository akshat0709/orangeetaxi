-- ============================================================================
-- Orange Taxi — every booking gets a ride OTP (2026-10-26)
--
-- Bug: check_booking_insert_integrity() returns early for trusted callers (admins and the
-- service role) before it generates the OTP, so a booking made while signed in as an admin had
-- no OTP: the page showed none and the driver could never start the ride.
--
-- Fix: a second BEFORE INSERT trigger fills in a server OTP whenever the row has none. Triggers
-- fire in name order: trg_booking_insert_integrity → trg_booking_insert_zz_otp →
-- trg_move_ride_otp (phase 2), so the phase-2 move still sees the OTP.
-- Also backfills OTPs for open bookings that were created without one.
-- Idempotent.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ensure_booking_ride_otp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(NEW.ride_otp, '') !~ '^\d{4}$' THEN
    NEW.ride_otp := lpad((floor(random() * 10000))::int::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_insert_zz_otp ON public.bookings;
CREATE TRIGGER trg_booking_insert_zz_otp BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.ensure_booking_ride_otp();

-- Open rides created without an OTP (before this fix). Runs as the trusted server role so the
-- booking integrity rules allow it. After the phase-2 lockdown OTPs live in booking_secrets and
-- the column is blank on purpose, so rides that already have a secret are left alone.
DO $$
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  IF to_regclass('public.booking_secrets') IS NULL THEN
    UPDATE public.bookings
       SET ride_otp = lpad((floor(random() * 10000))::int::text, 4, '0')
     WHERE status IN ('searching', 'scheduled', 'accepted', 'arrived')
       AND COALESCE(ride_otp, '') !~ '^\d{4}$';
  ELSE
    EXECUTE $q$
      UPDATE public.bookings b
         SET ride_otp = lpad((floor(random() * 10000))::int::text, 4, '0')
       WHERE b.status IN ('searching', 'scheduled', 'accepted', 'arrived')
         AND COALESCE(b.ride_otp, '') !~ '^\d{4}$'
         AND NOT EXISTS (SELECT 1 FROM public.booking_secrets s WHERE s.booking_id = b.id)
    $q$;
  END IF;
END $$;
