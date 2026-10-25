-- ============================================================================
-- PHASE 2 — apply ONLY after the updated Rider and Driver apps (and website) are
-- live and old builds are retired (force-update). Not in supabase/migrations on
-- purpose: `supabase db push` must not apply it early.
--
-- Old app builds read these directly; the updated apps use the narrow RPCs added
-- in 20261025130000 (get_ride_otp, get_assigned_driver, private chat channels).
--
--   P1  Ride OTP moves out of bookings, so drivers can no longer read it.
--   P2  Riders read their chauffeur only through get_assigned_driver()
--       (no Aadhaar / licence / push token).
--   P3  drivers.aadhaar_number is no longer kept on the operational record
--       (it stays in driver_applications for KYC review). Data is copied first.
-- Verified with scripts/db-tests (PHASE2=1).
-- ============================================================================

-- P1 ---------------------------------------------------------------------------
-- No FK to bookings: secrets are written in a BEFORE INSERT trigger, before the booking row exists.
CREATE TABLE IF NOT EXISTS public.booking_secrets (
  booking_id uuid PRIMARY KEY,
  ride_otp text NOT NULL
);
ALTER TABLE public.booking_secrets ENABLE ROW LEVEL SECURITY; -- no policies: RPC access only
REVOKE ALL ON public.booking_secrets FROM anon, authenticated;

INSERT INTO public.booking_secrets (booking_id, ride_otp)
SELECT id, ride_otp FROM public.bookings WHERE COALESCE(ride_otp, '') <> ''
ON CONFLICT (booking_id) DO NOTHING;
UPDATE public.bookings SET ride_otp = '' WHERE ride_otp <> '';

-- Runs after trg_booking_insert_integrity (trigger names fire alphabetically), which generates the OTP.
CREATE OR REPLACE FUNCTION public.move_ride_otp_to_secrets()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(NEW.ride_otp, '') <> '' THEN
    INSERT INTO public.booking_secrets (booking_id, ride_otp) VALUES (NEW.id, NEW.ride_otp)
    ON CONFLICT (booking_id) DO UPDATE SET ride_otp = EXCLUDED.ride_otp;
    NEW.ride_otp := '';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_move_ride_otp ON public.bookings;
CREATE TRIGGER trg_move_ride_otp BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.move_ride_otp_to_secrets();

CREATE OR REPLACE FUNCTION public.cleanup_booking_secret()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.booking_secrets WHERE booking_id = OLD.id;
  RETURN OLD;
END; $$;
DROP TRIGGER IF EXISTS trg_cleanup_booking_secret ON public.bookings;
CREATE TRIGGER trg_cleanup_booking_secret AFTER DELETE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_booking_secret();

CREATE OR REPLACE FUNCTION public.get_ride_otp(_booking_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.ride_otp FROM public.booking_secrets s JOIN public.bookings b ON b.id = s.booking_id
  WHERE b.id = _booking_id AND b.customer_id = auth.uid()
    AND b.status IN ('searching', 'scheduled', 'accepted', 'arrived')
$$;

CREATE OR REPLACE FUNCTION public.verify_ride_otp(_booking_id uuid, _otp text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b record; secret text; clean_otp text := trim(COALESCE(_otp, ''));
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Authentication required.'); END IF;
  SELECT id, driver_id, status INTO b FROM public.bookings WHERE id = _booking_id;
  IF b.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Ride not found.'); END IF;
  IF NOT (public.is_driver_of(b.driver_id, auth.uid()) OR public.has_role(auth.uid(), 'admin')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: You are not the assigned chauffeur for this ride.');
  END IF;
  IF b.status <> 'arrived' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ride must be in arrived state before verifying OTP.');
  END IF;
  SELECT ride_otp INTO secret FROM public.booking_secrets WHERE booking_id = _booking_id;
  IF secret IS NULL OR clean_otp = '' OR secret <> clean_otp THEN
    INSERT INTO public.security_audit_logs (event_type, severity, user_id, metadata)
    VALUES ('booking.otp_verification_failed', 'medium', auth.uid(), jsonb_build_object('booking_id', _booking_id));
    RETURN jsonb_build_object('success', false, 'error', 'Incorrect OTP. Please confirm with the passenger.');
  END IF;
  PERFORM set_config('app.otp_verified', 'on', true);
  UPDATE public.bookings SET status = 'in_progress', started_at = now(), updated_at = now() WHERE id = _booking_id;
  PERFORM set_config('app.otp_verified', 'off', true);
  DELETE FROM public.booking_secrets WHERE booking_id = _booking_id;
  INSERT INTO public.security_audit_logs (event_type, severity, user_id, metadata)
  VALUES ('booking.trip_started', 'low', auth.uid(), jsonb_build_object('booking_id', _booking_id));
  RETURN jsonb_build_object('success', true, 'message', 'OTP verified. Trip started successfully.');
END; $$;
GRANT EXECUTE ON FUNCTION public.verify_ride_otp(uuid, text) TO authenticated;

-- P2 ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "drivers_select_scoped" ON public.drivers;
CREATE POLICY "drivers_select_scoped" ON public.drivers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

-- P3 ---------------------------------------------------------------------------
-- Copy any Aadhaar numbers that only exist on drivers into a private table before clearing them.
CREATE TABLE IF NOT EXISTS public.driver_kyc_private (
  driver_id uuid PRIMARY KEY REFERENCES public.drivers(id) ON DELETE CASCADE,
  aadhaar_number text,
  copied_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.driver_kyc_private ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "driver_kyc_admin" ON public.driver_kyc_private;
CREATE POLICY "driver_kyc_admin" ON public.driver_kyc_private FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.driver_kyc_private (driver_id, aadhaar_number)
SELECT id, aadhaar_number FROM public.drivers WHERE COALESCE(aadhaar_number, '') <> ''
ON CONFLICT (driver_id) DO NOTHING;
UPDATE public.drivers SET aadhaar_number = '' WHERE COALESCE(aadhaar_number, '') <> '';
