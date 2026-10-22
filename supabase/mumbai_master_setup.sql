-- ============================================================================
-- ORANGE TAXI — MASTER PRODUCTION DATABASE SETUP (MUMBAI AP-SOUTH-1)
-- Complete hardened schema, RLS policies, triggers, RPC functions, and seed data
-- Run this in the Supabase SQL Editor of orange-taxi-mumbai (qcrpzrrzjddwqebaktyu)
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS & CORE ROLES
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'driver', 'customer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  role text DEFAULT 'customer',
  wallet_balance numeric NOT NULL DEFAULT 0 CHECK (wallet_balance >= 0),
  push_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- 4. USER ROLES TABLE
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL DEFAULT 'customer',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
CREATE POLICY "user_roles_select" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Helper: has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  RETURN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
END;
$$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;

-- 5. SECURITY AUDIT LOGS TABLE
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

-- 6. USER CONSENTS TABLE (DPDP Act, 2023)
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

-- 7. VEHICLE CATEGORIES (Orange Signature Only)
CREATE TABLE IF NOT EXISTS public.vehicle_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  tagline text,
  seats int NOT NULL DEFAULT 4,
  base_fare numeric NOT NULL DEFAULT 99,
  per_km numeric NOT NULL DEFAULT 18,
  minimum_fare numeric NOT NULL DEFAULT 149,
  sort_order int NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vehicle_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_read_public" ON public.vehicle_categories;
CREATE POLICY "categories_read_public" ON public.vehicle_categories
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "categories_admin_all" ON public.vehicle_categories;
CREATE POLICY "categories_admin_all" ON public.vehicle_categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.vehicle_categories (code, name, tagline, seats, base_fare, per_km, minimum_fare, sort_order, is_active)
VALUES 
  ('signature', 'Orange Signature', 'Spotless, Pre-Cooled Mahindra BE 6 EV', 4, 99, 18, 149, 1, true),
  ('ORANGE_SIGNATURE', 'Orange Signature', 'Spotless, Pre-Cooled Mahindra BE 6 EV', 4, 99, 18, 149, 2, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  seats = EXCLUDED.seats,
  base_fare = EXCLUDED.base_fare,
  per_km = EXCLUDED.per_km,
  minimum_fare = EXCLUDED.minimum_fare,
  is_active = true;

-- 8. DRIVERS TABLE
CREATE TABLE IF NOT EXISTS public.drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT 'Bengaluru Hub',
  vehicle_code text NOT NULL DEFAULT 'signature',
  vehicle_model text NOT NULL DEFAULT 'Mahindra BE 6 EV',
  vehicle_number text NOT NULL DEFAULT '',
  driver_type text NOT NULL DEFAULT 'company',
  photo_url text,
  dl_url text,
  chassis_number text,
  is_online boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending', 'deleted')),
  rating numeric NOT NULL DEFAULT 5.0,
  total_rides int NOT NULL DEFAULT 0,
  current_lat numeric,
  current_lng numeric,
  heading numeric DEFAULT 0,
  location_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_driver_of(_booking_driver uuid, _user uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _booking_driver IS NULL OR _user IS NULL THEN RETURN false; END IF;
  RETURN EXISTS (SELECT 1 FROM public.drivers WHERE id = _booking_driver AND user_id = _user);
END;
$$;
GRANT EXECUTE ON FUNCTION public.is_driver_of(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "drivers_select_scoped" ON public.drivers;
CREATE POLICY "drivers_select_scoped" ON public.drivers
  FOR SELECT TO authenticated, anon
  USING (
    is_online = true OR
    user_id = auth.uid() OR
    public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "drivers_admin_insert" ON public.drivers;
CREATE POLICY "drivers_admin_insert" ON public.drivers
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "drivers_update_scoped" ON public.drivers;
CREATE POLICY "drivers_update_scoped" ON public.drivers
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "drivers_admin_delete" ON public.drivers;
CREATE POLICY "drivers_admin_delete" ON public.drivers
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 9. PARTNER FLEET & SETTLEMENTS
CREATE TABLE IF NOT EXISTS public.partner_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_number text UNIQUE NOT NULL,
  chassis_number text,
  model text NOT NULL DEFAULT 'Mahindra BE 6 EV',
  year text DEFAULT '2025',
  color text DEFAULT 'Signature Orange',
  owner_name text NOT NULL,
  owner_phone text NOT NULL,
  owner_email text,
  status text DEFAULT 'active',
  certified_standard boolean DEFAULT true,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.partner_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner_vehicles_select_scoped" ON public.partner_vehicles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

CREATE POLICY "partner_vehicles_admin_all" ON public.partner_vehicles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.driver_cash_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES public.drivers(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  collected_by text DEFAULT 'Admin',
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.driver_cash_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver_cash_select_scoped" ON public.driver_cash_settlements
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

CREATE POLICY "driver_cash_admin_all" ON public.driver_cash_settlements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.driver_commission_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES public.drivers(id) ON DELETE CASCADE NOT NULL,
  driver_name text,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_mode text NOT NULL DEFAULT 'upi',
  reference_no text,
  collected_by text DEFAULT 'Admin',
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.driver_commission_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver_comm_select_scoped" ON public.driver_commission_settlements
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

CREATE POLICY "driver_comm_admin_all" ON public.driver_commission_settlements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 10. DRIVER APPLICATIONS
CREATE TABLE IF NOT EXISTS public.driver_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  aadhaar_number text,
  city text NOT NULL,
  licence_number text NOT NULL DEFAULT '',
  experience_years int NOT NULL DEFAULT 0,
  owns_vehicle boolean NOT NULL DEFAULT false,
  vehicle_model text,
  vehicle_number text,
  chassis_number text,
  vehicle_year text,
  message text NOT NULL DEFAULT '',
  photo_url text,
  dl_url text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'approved', 'rejected', 'contacted')),
  admin_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.driver_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "applications_insert_public" ON public.driver_applications
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "applications_admin_all" ON public.driver_applications
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 11. BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text UNIQUE NOT NULL DEFAULT ('OT' || upper(substring(md5(random()::text) from 1 for 6))),
  customer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  pickup_area text NOT NULL,
  pickup_address text,
  drop_area text NOT NULL,
  drop_address text,
  distance_km numeric NOT NULL DEFAULT 5.0,
  duration_min int NOT NULL DEFAULT 15,
  vehicle_code text NOT NULL DEFAULT 'signature',
  vehicle_name text NOT NULL DEFAULT 'Orange Signature',
  vehicle_number text,
  base_fare numeric NOT NULL DEFAULT 99,
  distance_fare numeric NOT NULL DEFAULT 90,
  tax_amount numeric NOT NULL DEFAULT 10,
  estimated_fare numeric NOT NULL DEFAULT 199,
  final_fare numeric,
  payment_method text NOT NULL DEFAULT 'cash',
  payment_status text NOT NULL DEFAULT 'pending',
  payment_made text DEFAULT 'no',
  payment_intent_id text,
  ride_otp text NOT NULL DEFAULT (floor(1000 + random() * 9000)::text),
  status text NOT NULL DEFAULT 'searching' CHECK (status IN ('searching', 'scheduled', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled')),
  scheduled_at timestamptz,
  accepted_at timestamptz,
  arrived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  rating numeric,
  review text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookings_select_customer" ON public.bookings
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid());

CREATE POLICY "bookings_select_admin" ON public.bookings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "bookings_select_driver" ON public.bookings
  FOR SELECT TO authenticated
  USING (
    (status = 'searching' AND EXISTS (SELECT 1 FROM public.drivers WHERE user_id = auth.uid() AND status = 'active'))
    OR public.is_driver_of(driver_id, auth.uid())
  );

CREATE POLICY "bookings_insert_customer" ON public.bookings
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "bookings_update_scoped" ON public.bookings
  FOR UPDATE TO authenticated
  USING (
    customer_id = auth.uid() OR
    public.has_role(auth.uid(), 'admin') OR
    public.is_driver_of(driver_id, auth.uid()) OR
    (driver_id IS NULL AND status = 'searching')
  )
  WITH CHECK (
    customer_id = auth.uid() OR
    public.has_role(auth.uid(), 'admin') OR
    public.is_driver_of(driver_id, auth.uid()) OR
    (driver_id IS NULL AND status = 'searching')
  );

-- 12. WALLET TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL,
  type text NOT NULL CHECK (type IN ('credit', 'debit')),
  description text NOT NULL DEFAULT '',
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  reference_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallet_tx_select_own" ON public.wallet_transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "wallet_tx_admin_all" ON public.wallet_transactions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 13. SUPPORT TICKETS & CORPORATE ENQUIRIES
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

CREATE POLICY "support_tickets_insert" ON public.support_tickets FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "support_tickets_select" ON public.support_tickets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "support_tickets_admin" ON public.support_tickets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.corporate_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  city text NOT NULL,
  team_size text NOT NULL DEFAULT '1-10',
  requirement text NOT NULL DEFAULT 'Daily Employee Commute',
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.corporate_enquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "corp_enquiry_insert" ON public.corporate_enquiries FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "corp_enquiry_admin" ON public.corporate_enquiries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 14. AUTH USER SIGNUP TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone', 'customer')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer')
  ON CONFLICT DO NOTHING;

  IF NEW.raw_user_meta_data->>'consent_privacy_policy_at' IS NOT NULL THEN
    INSERT INTO public.user_consents (user_id, consent_type, version, consented_at)
    VALUES (NEW.id, 'privacy_policy', COALESCE(NEW.raw_user_meta_data->>'consent_version', '2.4'), now())
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 15. ATOMIC DISPATCH LOCK FUNCTION (accept_booking)
CREATE OR REPLACE FUNCTION public.accept_booking(_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller_uid uuid := auth.uid();
  _drv record;
  _claimed_booking record;
BEGIN
  IF _caller_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  SELECT id, full_name, vehicle_number, vehicle_model, status
  INTO _drv
  FROM public.drivers
  WHERE user_id = _caller_uid;

  IF _drv.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No chauffeur record linked to your account.');
  END IF;

  IF _drv.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Your chauffeur account is not active.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE driver_id = _drv.id AND status IN ('accepted', 'arrived', 'in_progress')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have an active ride in progress.');
  END IF;

  UPDATE public.bookings
  SET status = 'accepted',
      driver_id = _drv.id,
      accepted_at = now(),
      updated_at = now()
  WHERE id = _booking_id
    AND status = 'searching'
    AND driver_id IS NULL
  RETURNING * INTO _claimed_booking;

  IF _claimed_booking.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ride already claimed by another chauffeur or cancelled by passenger.'
    );
  END IF;

  INSERT INTO public.security_audit_logs (event_type, severity, user_id, metadata)
  VALUES (
    'booking.accepted',
    'low',
    _caller_uid,
    jsonb_build_object('booking_id', _booking_id, 'driver_id', _drv.id, 'reference', _claimed_booking.reference)
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Ride successfully accepted.',
    'booking', row_to_json(_claimed_booking)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.accept_booking(uuid) TO authenticated;

-- 16. SERVER-SIDE OTP VERIFICATION (verify_ride_otp)
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

  IF NOT (public.is_driver_of(b.driver_id, auth.uid()) OR public.has_role(auth.uid(), 'admin')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: You are not the assigned chauffeur.');
  END IF;

  IF b.status <> 'arrived' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ride must be in arrived state before verifying OTP.');
  END IF;

  IF b.ride_otp IS NULL OR clean_otp = '' OR b.ride_otp <> clean_otp THEN
    INSERT INTO public.security_audit_logs (event_type, severity, user_id, metadata)
    VALUES ('booking.otp_verification_failed', 'medium', auth.uid(), jsonb_build_object('booking_id', _booking_id));
    RETURN jsonb_build_object('success', false, 'error', 'Incorrect OTP. Please confirm with passenger.');
  END IF;

  UPDATE public.bookings
  SET status = 'in_progress',
      started_at = now(),
      updated_at = now()
  WHERE id = _booking_id;

  RETURN jsonb_build_object('success', true, 'message', 'OTP verified. Trip started successfully.');
END;
$$;
GRANT EXECUTE ON FUNCTION public.verify_ride_otp(uuid, text) TO authenticated;

-- 17. ATOMIC WALLET TOP-UP & FARE DEDUCTION
CREATE OR REPLACE FUNCTION public.top_up_wallet(
  _amount numeric,
  _payment_id text,
  _order_id text DEFAULT NULL,
  _description text DEFAULT 'Wallet Recharge'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _current_bal numeric;
  _new_bal numeric;
  _clean_amt numeric := ROUND(COALESCE(_amount, 0), 2);
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  IF _clean_amt <= 0 OR _clean_amt > 25000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be between ₹1 and ₹25,000.');
  END IF;

  IF _payment_id IS NULL OR trim(_payment_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment ID required.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.wallet_transactions WHERE reference_id = trim(_payment_id)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction already credited.');
  END IF;

  SELECT COALESCE(wallet_balance, 0) INTO _current_bal
  FROM public.profiles
  WHERE id = _uid
  FOR UPDATE;

  _new_bal := _current_bal + _clean_amt;

  UPDATE public.profiles
  SET wallet_balance = _new_bal,
      updated_at = now()
  WHERE id = _uid;

  INSERT INTO public.wallet_transactions (user_id, amount, type, description, reference_id)
  VALUES (_uid, _clean_amt, 'credit', _description, trim(_payment_id));

  RETURN jsonb_build_object('success', true, 'new_balance', _new_bal, 'amount_credited', _clean_amt);
END;
$$;
GRANT EXECUTE ON FUNCTION public.top_up_wallet(numeric, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.deduct_ride_wallet_payment(_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b record;
  _current_bal numeric;
  _deduct_amt numeric;
  _new_bal numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  SELECT id, customer_id, driver_id, status, payment_method, payment_status, final_fare, estimated_fare
  INTO b
  FROM public.bookings
  WHERE id = _booking_id;

  IF b.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking record not found.');
  END IF;

  IF b.payment_method <> 'wallet' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking payment method is not wallet.');
  END IF;

  IF b.payment_status = 'paid' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Payment already settled.');
  END IF;

  _deduct_amt := ROUND(COALESCE(b.final_fare, b.estimated_fare, 0), 2);

  SELECT COALESCE(wallet_balance, 0) INTO _current_bal
  FROM public.profiles
  WHERE id = b.customer_id
  FOR UPDATE;

  IF _current_bal < _deduct_amt THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient customer wallet balance.');
  END IF;

  _new_bal := _current_bal - _deduct_amt;

  UPDATE public.profiles
  SET wallet_balance = _new_bal,
      updated_at = now()
  WHERE id = b.customer_id;

  INSERT INTO public.wallet_transactions (user_id, amount, type, description, booking_id)
  VALUES (b.customer_id, _deduct_amt, 'debit', 'Fare payment for Ride #' || b.id, b.id);

  UPDATE public.bookings
  SET payment_status = 'paid',
      payment_made = 'yes',
      updated_at = now()
  WHERE id = b.id;

  RETURN jsonb_build_object('success', true, 'amount_deducted', _deduct_amt, 'remaining_balance', _new_bal);
END;
$$;
GRANT EXECUTE ON FUNCTION public.deduct_ride_wallet_payment(uuid) TO authenticated;

-- 18. ACCOUNT DELETION RPC (DPDP Act, 2023)
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  UPDATE public.profiles
  SET full_name = 'Deleted User', phone = NULL, updated_at = now()
  WHERE id = _uid;

  UPDATE public.bookings
  SET pickup_address = '[Redacted]', drop_address = '[Redacted]', ride_otp = ''
  WHERE customer_id = _uid;

  UPDATE public.drivers
  SET status = 'deleted', is_online = false, user_id = NULL
  WHERE user_id = _uid;

  DELETE FROM public.user_roles WHERE user_id = _uid;
  DELETE FROM auth.users WHERE id = _uid;

  RETURN jsonb_build_object('success', true, 'message', 'Account permanently deleted.');
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

-- 19. PUBLIC TRACKING STATUS RPC
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
BEGIN
  SELECT id, reference, status, pickup_area, drop_area, vehicle_name, vehicle_code, driver_id
  INTO b
  FROM public.bookings
  WHERE upper(reference) = upper(trim(_ref))
  LIMIT 1;

  IF b.id IS NULL THEN RETURN NULL; END IF;

  IF b.driver_id IS NOT NULL THEN
    SELECT full_name, vehicle_model, vehicle_number, rating, current_lat, current_lng, location_updated_at
    INTO d FROM public.drivers WHERE id = b.driver_id;
  END IF;

  RETURN jsonb_build_object(
    'id', b.id,
    'reference', b.reference,
    'status', b.status,
    'pickup_area', b.pickup_area,
    'drop_area', b.drop_area,
    'vehicle_name', b.vehicle_name,
    'driver', CASE WHEN b.driver_id IS NOT NULL THEN jsonb_build_object(
      'name', d.full_name,
      'vehicle_model', d.vehicle_model,
      'vehicle_number', d.vehicle_number,
      'rating', d.rating,
      'current_lat', d.current_lat,
      'current_lng', d.current_lng
    ) ELSE NULL END
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_tracking_status(text) TO anon, authenticated;

-- 20. REALTIME CONFIGURATION
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- 21. SEED DEFAULT FLEET / CHAUFFEUR
INSERT INTO public.drivers (
  full_name, phone, city, vehicle_code, vehicle_model, vehicle_number, is_online, status, rating, total_rides, current_lat, current_lng
) VALUES (
  'Naman', '+91 98765 43210', 'Bengaluru Hub', 'signature', 'Mahindra BE 6 EV', 'KA 01 BE 6001', true, 'active', 4.95, 342, 12.9716, 77.5946
) ON CONFLICT DO NOTHING;
