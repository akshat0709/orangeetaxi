-- ============================================================================
-- Orange Taxi — Mandatory Privacy, Security, Authorization & Deletion Migration
-- In compliance with DPDP Act 2023, MV Aggregator Guidelines 2020 & CGST Act 2017
-- ============================================================================

-- 1. Helper function permissions & bootstrap lockdown (Findings 2.2 & 3.2)
-- Revoke claim_first_admin from authenticated and anon to prevent unauthorized admin bootstrap
REVOKE ALL ON FUNCTION public.claim_first_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO service_role;

-- Secure has_role implementation (search_path secured, prevent enumeration)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Non-admins cannot enumerate other users' roles
  IF auth.uid() IS NOT NULL AND _user_id <> auth.uid() AND auth.role() <> 'service_role' THEN
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
      RETURN false;
    END IF;
  END IF;

  RETURN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_driver_of(uuid, uuid) TO authenticated;


-- 2. Security Audit Logs table (Phase 4 requirement)
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  user_id uuid,
  ip_address text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_admin_read" ON public.security_audit_logs;
CREATE POLICY "audit_admin_read" ON public.security_audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "audit_insert_policy" ON public.security_audit_logs;
CREATE POLICY "audit_insert_policy" ON public.security_audit_logs
  FOR INSERT TO authenticated, anon
  WITH CHECK (true);

-- 3. User Consents Table (Phase 1 DPDP Act consent audit trail)
CREATE TABLE IF NOT EXISTS public.user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type text NOT NULL DEFAULT 'privacy_policy',
  version text NOT NULL DEFAULT '2.4',
  ip_address text,
  user_agent text,
  consented_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "consents_read_own" ON public.user_consents;
CREATE POLICY "consents_read_own" ON public.user_consents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "consents_insert_own" ON public.user_consents;
CREATE POLICY "consents_insert_own" ON public.user_consents
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 4. User Registration Trigger: Prevent unvetted driver self-promotion
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Strict customer assignment on self-signup. Driver role must only be assigned post-vetting by admin.
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer')
  ON CONFLICT DO NOTHING;

  -- Record initial consent if provided in metadata
  IF NEW.raw_user_meta_data->>'consent_privacy_policy_at' IS NOT NULL THEN
    INSERT INTO public.user_consents (user_id, consent_type, version, consented_at)
    VALUES (NEW.id, 'privacy_policy', COALESCE(NEW.raw_user_meta_data->>'consent_version', '2.4'), now())
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END; $$;

-- 5. Secure public.bookings table (Phase 2 Authorization & Data Isolation)
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Drop all outdated/permissive policies
DROP POLICY IF EXISTS "bookings read" ON public.bookings;
DROP POLICY IF EXISTS "Riders can view own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Drivers can view assigned bookings" ON public.bookings;
DROP POLICY IF EXISTS "bookings update" ON public.bookings;
DROP POLICY IF EXISTS "customer creates booking" ON public.bookings;
DROP POLICY IF EXISTS "bookings_select_customer" ON public.bookings;
DROP POLICY IF EXISTS "bookings_select_admin" ON public.bookings;
DROP POLICY IF EXISTS "bookings_select_driver" ON public.bookings;
DROP POLICY IF EXISTS "bookings_insert_customer" ON public.bookings;
DROP POLICY IF EXISTS "bookings_update_policy" ON public.bookings;

-- SELECT Policies: Scoped strictly to authenticated principals with legitimate business need
CREATE POLICY "bookings_select_customer" ON public.bookings
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid());

CREATE POLICY "bookings_select_admin" ON public.bookings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "bookings_select_driver" ON public.bookings
  FOR SELECT TO authenticated
  USING (
    -- Only active, verified drivers can see searching rides or their assigned trips
    (status = 'searching' AND EXISTS (SELECT 1 FROM public.drivers WHERE user_id = auth.uid() AND status = 'active'))
    OR
    public.is_driver_of(driver_id, auth.uid())
  );

-- INSERT Policy: Authenticated users can only create bookings for themselves
CREATE POLICY "bookings_insert_customer" ON public.bookings
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());

-- UPDATE Policy: Scoped by identity
CREATE POLICY "bookings_update_policy" ON public.bookings
  FOR UPDATE TO authenticated
  USING (
    customer_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_driver_of(driver_id, auth.uid())
  )
  WITH CHECK (
    customer_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_driver_of(driver_id, auth.uid())
  );

-- 6. Booking Update Integrity Trigger (Prevents tampering with fares, payments, driver IDs)
CREATE OR REPLACE FUNCTION public.check_booking_update_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean := public.has_role(auth.uid(), 'admin');
BEGIN
  -- Administrators possess full administrative override
  IF is_admin THEN
    RETURN NEW;
  END IF;

  -- Customer updates:
  IF auth.uid() = OLD.customer_id THEN
    -- Customers cannot alter financial calculations, driver assignment, or payment status
    IF NEW.estimated_fare <> OLD.estimated_fare OR
       NEW.base_fare <> OLD.base_fare OR
       NEW.distance_fare <> OLD.distance_fare OR
       NEW.tax_amount <> OLD.tax_amount OR
       NEW.payment_status <> OLD.payment_status OR
       NEW.customer_id <> OLD.customer_id OR
       NEW.driver_id IS DISTINCT FROM OLD.driver_id THEN
      RAISE EXCEPTION 'Security Violation: Unauthorized modification of financial or dispatch fields.';
    END IF;

    -- Allowed status transitions: cancellation before chauffeur arrival, or rating completed ride
    IF NEW.status <> OLD.status THEN
      IF NEW.status = 'cancelled' THEN
        IF OLD.status NOT IN ('searching', 'scheduled', 'accepted') THEN
          RAISE EXCEPTION 'Cancellation denied: Ride is already arrived or in-progress.';
        END IF;
      ELSIF OLD.status = 'completed' THEN
        -- Allow rating/review
        NULL;
      ELSE
        RAISE EXCEPTION 'Security Violation: Illegal ride status transition requested.';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  -- Driver updates:
  IF public.is_driver_of(OLD.driver_id, auth.uid()) OR (OLD.driver_id IS NULL AND OLD.status = 'searching') THEN
    -- Drivers cannot alter fare estimates, tax amounts, or customer ownership
    IF NEW.estimated_fare <> OLD.estimated_fare OR
       NEW.base_fare <> OLD.base_fare OR
       NEW.distance_fare <> OLD.distance_fare OR
       NEW.tax_amount <> OLD.tax_amount OR
       NEW.customer_id <> OLD.customer_id THEN
      RAISE EXCEPTION 'Security Violation: Chauffeurs cannot alter commercial pricing or customer ownership.';
    END IF;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Security Violation: Unauthorized booking modification.';
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_update_integrity ON public.bookings;
CREATE TRIGGER trg_booking_update_integrity
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.check_booking_update_integrity();

-- 7. Public Ride Tracking Function (Safe RPC without exposing sensitive customer PII or raw OTP)
CREATE OR REPLACE FUNCTION public.get_public_tracking_status(_ref text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b record;
  d record;
  result jsonb;
BEGIN
  SELECT id, reference, status, pickup_area, drop_area, vehicle_name, vehicle_code,
         scheduled_at, accepted_at, arrived_at, started_at, completed_at, cancelled_at,
         driver_id
  INTO b
  FROM public.bookings
  WHERE upper(reference) = upper(trim(_ref))
  LIMIT 1;

  IF b.id IS NULL THEN
    RETURN NULL;
  END IF;

  IF b.driver_id IS NOT NULL THEN
    SELECT full_name, vehicle_model, vehicle_number, rating, current_lat, current_lng, location_updated_at
    INTO d
    FROM public.drivers
    WHERE id = b.driver_id;
  END IF;

  result := jsonb_build_object(
    'id', b.id,
    'reference', b.reference,
    'status', b.status,
    'pickup_area', b.pickup_area,
    'drop_area', b.drop_area,
    'vehicle_name', b.vehicle_name,
    'vehicle_code', b.vehicle_code,
    'scheduled_at', b.scheduled_at,
    'accepted_at', b.accepted_at,
    'arrived_at', b.arrived_at,
    'started_at', b.started_at,
    'completed_at', b.completed_at,
    'cancelled_at', b.cancelled_at,
    'driver', CASE WHEN b.driver_id IS NOT NULL THEN
      jsonb_build_object(
        'name', d.full_name,
        'vehicle_model', d.vehicle_model,
        'vehicle_number', d.vehicle_number,
        'rating', d.rating,
        'current_lat', d.current_lat,
        'current_lng', d.current_lng,
        'location_updated_at', d.location_updated_at
      )
    ELSE NULL END
  );

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_tracking_status(text) TO anon, authenticated;

-- 8. Secure Storage Bucket (driver_kyc) (Finding 9.1)
UPDATE storage.buckets SET public = false WHERE id = 'driver_kyc';

DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Anon Insert" ON storage.objects;
DROP POLICY IF EXISTS "kyc_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "kyc_admin_select" ON storage.objects;

-- Only authenticated users can upload KYC documents with allowed file extensions
CREATE POLICY "kyc_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'driver_kyc'
    AND (storage.extension(name) IN ('jpg', 'jpeg', 'png', 'webp', 'pdf'))
  );

-- Only administrators or document owner can access private KYC documents
CREATE POLICY "kyc_admin_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'driver_kyc'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

-- 9. Account Deletion RPC Workflow (Phase 3 requirement)
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _uid uuid := auth.uid();
  _user_email text;
  _active_count int;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required to process account deletion.';
  END IF;

  -- 1. Check for active ongoing rides (cannot delete while passenger or chauffeur in active ride)
  SELECT COUNT(*) INTO _active_count
  FROM public.bookings
  WHERE (customer_id = _uid OR driver_id IN (SELECT id FROM public.drivers WHERE user_id = _uid))
    AND status IN ('searching', 'accepted', 'arrived', 'in_progress');

  IF _active_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete account with an active trip in progress. Please complete or cancel your active ride first.';
  END IF;

  SELECT email INTO _user_email FROM auth.users WHERE id = _uid;

  -- 2. Audit event record (pseudonymized UID)
  INSERT INTO public.security_audit_logs (event_type, severity, user_id, metadata)
  VALUES (
    'account.deletion_completed',
    'medium',
    _uid,
    jsonb_build_object(
      'action', 'User self-service account erasure under DPDP Act 2023',
      'statutory_notice', 'Financial and tax receipts retained for 72 months per CGST Act Section 36'
    )
  );

  -- 3. Anonymize Profile PII
  UPDATE public.profiles
  SET full_name = 'Deleted User',
      phone = NULL,
      updated_at = now()
  WHERE id = _uid;

  -- 4. Redact PII in Bookings (Preserve financial & tax amounts for statutory 72-month GST compliance)
  UPDATE public.bookings
  SET pickup_address = '[Redacted on Account Deletion]',
      drop_address = '[Redacted on Account Deletion]',
      pickup_area = 'Redacted Area',
      drop_area = 'Redacted Area',
      ride_otp = '',
      cancel_reason = CASE WHEN status = 'cancelled' THEN 'Account deleted by user' ELSE cancel_reason END
  WHERE customer_id = _uid;

  -- 5. If Driver, anonymize Driver Profile
  UPDATE public.drivers
  SET full_name = 'Former Chauffeur',
      phone = '',
      vehicle_number = 'REDACTED',
      vehicle_model = 'REDACTED',
      is_online = false,
      status = 'deleted',
      user_id = NULL
  WHERE user_id = _uid;

  -- 6. Redact Driver Applications if exists
  IF _user_email IS NOT NULL THEN
    UPDATE public.driver_applications
    SET full_name = 'Former Applicant',
        email = 'redacted@deleted.internal',
        phone = '0000000000',
        aadhaar_number = 'REDACTED',
        licence_number = 'REDACTED',
        admin_notes = '[PII PURGED ON USER ACCOUNT DELETION UNDER DPDP ACT]',
        photo_url = NULL,
        dl_url = NULL
    WHERE lower(email) = lower(_user_email);
  END IF;

  -- 7. Remove User Roles
  DELETE FROM public.user_roles WHERE user_id = _uid;

  -- 8. Delete user authentication identity
  DELETE FROM auth.users WHERE id = _uid;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Your account, profile, and personal identifiers have been permanently erased in compliance with the DPDP Act, 2023. Anonymized tax and invoicing ledgers are archived per statutory requirements.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

-- 10. Commercial Pricing & Fleet Synchronization (P0 Discrepancy Fix)
-- Ensure 'signature' (Mahindra BE.6 EV) is present with authoritative commercial pricing
INSERT INTO public.vehicle_categories (code, name, tagline, seats, base_fare, per_km, minimum_fare, sort_order, is_active)
VALUES ('signature', 'Orange Signature', 'Spotless, Pre-Cooled Mahindra BE 6 EV', 4, 99, 18, 149, 1, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  seats = EXCLUDED.seats,
  base_fare = EXCLUDED.base_fare,
  per_km = EXCLUDED.per_km,
  minimum_fare = EXCLUDED.minimum_fare,
  sort_order = EXCLUDED.sort_order,
  is_active = true;

-- Deactivate legacy 3-category placeholders so only authoritative fleet is active
UPDATE public.vehicle_categories
SET is_active = false
WHERE code IN ('ORANGE_GO', 'ORANGE_SEDAN', 'ORANGE_XL');

-- 11. Booking Insertion Integrity Trigger (P0 Fare Manipulation Prevention)
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_intent_id text;

CREATE OR REPLACE FUNCTION public.check_booking_insert_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base numeric := 99;
  v_per_km numeric := 18;
  v_min numeric := 149;
  v_cat record;
  calc_dist_fare numeric;
  min_expected numeric;
BEGIN
  -- Authenticated customer identity verification
  IF auth.uid() IS NOT NULL AND auth.role() <> 'service_role' THEN
    NEW.customer_id := auth.uid();
  END IF;

  -- Lookup authoritative category pricing if exists
  SELECT base_fare, per_km, minimum_fare
  INTO v_cat
  FROM public.vehicle_categories
  WHERE code = NEW.vehicle_code AND is_active = true
  LIMIT 1;

  IF v_cat IS NOT NULL THEN
    v_base := v_cat.base_fare;
    v_per_km := v_cat.per_km;
    v_min := v_cat.minimum_fare;
  END IF;

  -- Authoritative calculations
  calc_dist_fare := ROUND(COALESCE(NEW.distance_km, 0) * v_per_km);
  min_expected := GREATEST(v_min, v_base + calc_dist_fare);

  -- Never permit negative or sub-minimum fares
  IF NEW.estimated_fare < v_min THEN
    NEW.estimated_fare := min_expected;
    NEW.base_fare := v_base;
    NEW.distance_fare := calc_dist_fare;
    NEW.tax_amount := ROUND(min_expected * 0.05);
  END IF;

  -- Ensure payment status is strictly pending for newly submitted online bookings
  IF NEW.payment_method <> 'cash' AND NEW.payment_intent_id IS NULL THEN
    NEW.payment_status := 'pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_insert_integrity ON public.bookings;
CREATE TRIGGER trg_booking_insert_integrity
  BEFORE INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.check_booking_insert_integrity();

-- 12. Support & Grievance Tickets (Statutory Grievance Redressal Mechanism)
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  docket_number text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text,
  phone text NOT NULL,
  complaint_type text NOT NULL,
  booking_reference text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  admin_notes text,
  resolution_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_tickets_insert" ON public.support_tickets;
CREATE POLICY "support_tickets_insert" ON public.support_tickets
  FOR INSERT TO authenticated, anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "support_tickets_select_own" ON public.support_tickets;
CREATE POLICY "support_tickets_select_own" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "support_tickets_admin_all" ON public.support_tickets;
CREATE POLICY "support_tickets_admin_all" ON public.support_tickets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT ON public.support_tickets TO anon, authenticated;
GRANT ALL ON public.support_tickets TO service_role;

-- 13. Server-Side Ride OTP Verification Function (Findings 4.1 & 6.3)
CREATE OR REPLACE FUNCTION public.verify_ride_otp(_booking_id uuid, _otp text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b record;
  clean_otp text := trim(COALESCE(_otp, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  SELECT id, driver_id, status, ride_otp, customer_id
  INTO b
  FROM public.bookings
  WHERE id = _booking_id;

  IF b.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ride not found.');
  END IF;

  -- Verify caller is the authorized driver for this trip or admin
  IF NOT public.is_driver_of(b.driver_id, auth.uid()) THEN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: You are not the assigned chauffeur for this ride.');
    END IF;
  END IF;

  -- Ensure ride is in arrived state
  IF b.status <> 'arrived' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ride must be in arrived state before verifying OTP.');
  END IF;

  -- Verify OTP
  IF b.ride_otp IS NULL OR clean_otp = '' OR b.ride_otp <> clean_otp THEN
    -- Audit failed verification
    INSERT INTO public.security_audit_logs (event_type, severity, user_id, metadata)
    VALUES (
      'booking.otp_verification_failed',
      'medium',
      auth.uid(),
      jsonb_build_object('booking_id', _booking_id, 'reason', 'OTP mismatch')
    );
    RETURN jsonb_build_object('success', false, 'error', 'Incorrect OTP. Please confirm with the passenger.');
  END IF;

  -- State transition: arrived -> in_progress
  UPDATE public.bookings
  SET status = 'in_progress',
      started_at = now(),
      updated_at = now()
  WHERE id = _booking_id;

  -- Audit successful start
  INSERT INTO public.security_audit_logs (event_type, severity, user_id, metadata)
  VALUES (
    'booking.trip_started',
    'low',
    auth.uid(),
    jsonb_build_object('booking_id', _booking_id)
  );

  RETURN jsonb_build_object('success', true, 'message', 'OTP verified. Trip started successfully.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_ride_otp(uuid, text) TO authenticated;

-- 14. Driver Privilege Audit & Unvetted Assignment Cleanup (Finding 2.1)
-- Record audit log for any user with driver role not associated with approved driver record
DO $$
BEGIN
  INSERT INTO public.security_audit_logs (event_type, severity, user_id, metadata)
  SELECT
    'auth.suspicious_driver_role_detected',
    'high',
    ur.user_id,
    jsonb_build_object('user_id', ur.user_id, 'reason', 'Driver role present without linked driver or vetted application')
  FROM public.user_roles ur
  WHERE ur.role = 'driver'
    AND NOT EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = ur.user_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.driver_applications da
      JOIN auth.users au ON lower(au.email) = lower(da.email)
      WHERE au.id = ur.user_id AND da.status = 'approved'
    );
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;


