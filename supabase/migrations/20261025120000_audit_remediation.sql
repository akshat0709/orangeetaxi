-- ============================================================================
-- Orange Taxi — Audit remediation (2026-10-25)
--
-- NOT YET APPLIED. Review, then apply to a staging project first.
-- Verified by replaying the full migration chain + this file in PGlite (see
-- scripts/db-tests/README.md). Idempotent: safe to run more than once.
--
-- Fixes
--   R1  "infinite recursion detected in policy" between drivers <-> bookings,
--       which makes every booking insert/select/update fail under the chain's
--       own policies.
--   R2  Online drivers' full rows (phone, Aadhaar, licence URL, push token)
--       were readable by every signed-in user; get_nearby_drivers leaked names
--       and phones to anonymous callers and errored at runtime (type mismatch).
--   R3  Any user with the driver role could read every customer profile.
--   R4  Driver stats trigger collided with the driver integrity trigger, so
--       completing a ride and rating a ride were rejected.
--   R5  deduct_ride_wallet_payment always failed (missing record field, and
--       its own booking update was blocked by the integrity trigger).
--       Service-role settlement (verified online payments) was also blocked.
--   R5b A booking made with payment_method 'upi' (rider app has no gateway) could never be
--       settled: the driver's "cash received" / "personal UPI" update was rejected.
--   R6  KYC uploads from the driver application forms (before sign-up) were
--       rejected; allow anonymous uploads ONLY into driver_kyc/applications/.
-- ============================================================================

-- R1 ---------------------------------------------------------------------------
-- SECURITY DEFINER helpers read drivers/bookings without re-entering RLS.
CREATE OR REPLACE FUNCTION public.current_active_driver_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.drivers WHERE user_id = auth.uid() AND status = 'active' LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_customer_of_driver(_driver_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE driver_id = _driver_id
      AND customer_id = auth.uid()
      AND status IN ('accepted', 'arrived', 'in_progress', 'completed')
  )
$$;

CREATE OR REPLACE FUNCTION public.driver_can_view_customer(_customer_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.customer_id = _customer_id
      AND (
        b.driver_id = public.current_active_driver_id()
        OR (b.status = 'searching' AND public.current_active_driver_id() IS NOT NULL)
      )
  )
$$;

REVOKE ALL ON FUNCTION public.current_active_driver_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_customer_of_driver(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.driver_can_view_customer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_active_driver_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_customer_of_driver(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_can_view_customer(uuid) TO authenticated;

DROP POLICY IF EXISTS "bookings_select_driver" ON public.bookings;
CREATE POLICY "bookings_select_driver" ON public.bookings
  FOR SELECT TO authenticated
  USING (
    (status = 'searching' AND public.current_active_driver_id() IS NOT NULL)
    OR public.is_driver_of(driver_id, auth.uid())
  );

-- R2 ---------------------------------------------------------------------------
-- Rows a user may read in full: their own, their assigned chauffeur, or admin.
-- The live map uses get_online_driver_positions() (position only) instead.
DROP POLICY IF EXISTS "drivers read scoped" ON public.drivers;
DROP POLICY IF EXISTS "drivers_select_scoped" ON public.drivers;
CREATE POLICY "drivers_select_scoped" ON public.drivers
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR user_id = auth.uid()
    OR public.is_customer_of_driver(id)
  );

CREATE OR REPLACE FUNCTION public.get_online_driver_positions()
RETURNS TABLE (id uuid, current_lat double precision, current_lng double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.id, d.current_lat::double precision, d.current_lng::double precision
  FROM public.drivers d
  WHERE d.is_online = true AND d.status = 'active'
    AND d.current_lat IS NOT NULL AND d.current_lng IS NOT NULL
    AND (d.location_updated_at IS NULL OR d.location_updated_at > now() - interval '10 minutes')
$$;
REVOKE ALL ON FUNCTION public.get_online_driver_positions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_online_driver_positions() TO anon, authenticated;

DROP FUNCTION IF EXISTS public.get_nearby_drivers(double precision, double precision, double precision, integer);
CREATE FUNCTION public.get_nearby_drivers(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision DEFAULT 5.0,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  vehicle_model text,
  current_lat double precision,
  current_lng double precision,
  rating numeric,
  distance_km double precision
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM (
    SELECT d.id, d.vehicle_model,
           d.current_lat::double precision, d.current_lng::double precision, d.rating,
           ROUND((6371 * acos(LEAST(1.0, GREATEST(-1.0,
             cos(radians(p_lat)) * cos(radians(d.current_lat::double precision)) *
             cos(radians(d.current_lng::double precision) - radians(p_lng)) +
             sin(radians(p_lat)) * sin(radians(d.current_lat::double precision))))))::numeric, 2)::double precision AS distance_km
    FROM public.drivers d
    WHERE d.is_online = true AND d.status = 'active'
      AND d.current_lat IS NOT NULL AND d.current_lng IS NOT NULL
  ) n
  WHERE n.distance_km <= LEAST(GREATEST(p_radius_km, 0), 25)
  ORDER BY n.distance_km
  LIMIT LEAST(GREATEST(p_limit, 1), 50)
$$;
REVOKE ALL ON FUNCTION public.get_nearby_drivers(double precision, double precision, double precision, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_nearby_drivers(double precision, double precision, double precision, integer) TO authenticated;

-- R3 ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "own profile read" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_scoped" ON public.profiles;
CREATE POLICY "profiles_select_scoped" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.driver_can_view_customer(id)
  );

-- R4 ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_booking_driver_stats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_driver_id uuid := NEW.driver_id;
  v_total_rides int;
  v_avg_rating numeric(3,1);
BEGIN
  IF v_driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_total_rides FROM public.bookings
  WHERE driver_id = v_driver_id AND status = 'completed';

  SELECT ROUND(AVG(rating)::numeric, 1) INTO v_avg_rating FROM public.bookings
  WHERE driver_id = v_driver_id AND rating IS NOT NULL;

  -- Trusted, system-computed aggregate: let check_driver_update_integrity allow it.
  PERFORM set_config('app.driver_stats_update', 'on', true);
  UPDATE public.drivers
  SET total_rides = GREATEST(COALESCE(total_rides, 0), v_total_rides),
      rating = COALESCE(v_avg_rating, rating, 5.0),
      updated_at = now()
  WHERE id = v_driver_id;
  PERFORM set_config('app.driver_stats_update', 'off', true);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_driver_update_integrity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- System aggregate written by handle_booking_driver_stats(): only rating/total_rides may change.
  IF current_setting('app.driver_stats_update', true) = 'on' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.driver_type IS DISTINCT FROM OLD.driver_type
       OR NEW.id <> OLD.id THEN
      RAISE EXCEPTION 'Security Violation: stats update may only change rating and trip counts.';
    END IF;
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.user_id THEN
    IF NEW.status <> OLD.status OR
       NEW.rating <> OLD.rating OR
       NEW.total_rides <> OLD.total_rides OR
       NEW.driver_type IS DISTINCT FROM OLD.driver_type OR
       NEW.user_id IS DISTINCT FROM OLD.user_id OR
       NEW.id <> OLD.id THEN
      RAISE EXCEPTION 'Security Violation: Chauffeurs cannot alter rating, trip counts, account status, or credentials.';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Security Violation: Unauthorized driver record update.';
END;
$$;

-- R5 ---------------------------------------------------------------------------
-- Same rules as 20261022, plus two trusted paths at the top.
CREATE OR REPLACE FUNCTION public.check_booking_update_integrity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_admin boolean := public.has_role(auth.uid(), 'admin');
  is_assigned_driver boolean := public.is_driver_of(OLD.driver_id, auth.uid());
BEGIN
  IF is_admin OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- deduct_ride_wallet_payment(): may only mark the booking paid.
  IF current_setting('app.wallet_settlement', true) = 'on' THEN
    IF (to_jsonb(NEW) - ARRAY['payment_status', 'payment_made', 'updated_at'])
       IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['payment_status', 'payment_made', 'updated_at']) THEN
      RAISE EXCEPTION 'Security Violation: wallet settlement may only change payment fields.';
    END IF;
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.customer_id THEN
    IF NEW.estimated_fare <> OLD.estimated_fare OR
       NEW.base_fare <> OLD.base_fare OR
       NEW.distance_fare <> OLD.distance_fare OR
       NEW.tax_amount <> OLD.tax_amount OR
       NEW.final_fare IS DISTINCT FROM OLD.final_fare OR
       NEW.payment_status <> OLD.payment_status OR
       NEW.payment_made IS DISTINCT FROM OLD.payment_made OR
       NEW.customer_id <> OLD.customer_id OR
       NEW.driver_id IS DISTINCT FROM OLD.driver_id THEN
      RAISE EXCEPTION 'Security Violation: Unauthorized customer modification of financial, payment, or dispatch fields.';
    END IF;

    IF NEW.status <> OLD.status THEN
      IF NEW.status = 'cancelled' THEN
        IF OLD.status NOT IN ('searching', 'scheduled', 'accepted') THEN
          RAISE EXCEPTION 'Cancellation denied: Ride is already arrived or in-progress.';
        END IF;
      ELSE
        RAISE EXCEPTION 'Security Violation: Illegal ride status transition requested by passenger.';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF is_assigned_driver THEN
    IF NEW.estimated_fare <> OLD.estimated_fare OR
       NEW.base_fare <> OLD.base_fare OR
       NEW.distance_fare <> OLD.distance_fare OR
       NEW.tax_amount <> OLD.tax_amount OR
       NEW.customer_id <> OLD.customer_id OR
       NEW.driver_id <> OLD.driver_id THEN
      RAISE EXCEPTION 'Security Violation: Chauffeurs cannot alter commercial pricing, passenger ownership, or reassign trips.';
    END IF;

    IF NEW.status <> OLD.status THEN
      IF OLD.status = 'accepted' AND NEW.status NOT IN ('arrived', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid status transition: Accepted ride can only transition to arrived or cancelled.';
      ELSIF OLD.status = 'arrived' AND NEW.status = 'in_progress' THEN
        IF current_setting('app.otp_verified', true) IS DISTINCT FROM 'on' THEN
          RAISE EXCEPTION 'Invalid status transition: Arrived ride can only transition to in_progress via OTP verification (verify_ride_otp).';
        END IF;
      ELSIF OLD.status = 'arrived' AND NEW.status NOT IN ('in_progress', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid status transition: Arrived ride can only transition to in_progress (via OTP) or cancelled.';
      ELSIF OLD.status = 'in_progress' AND NEW.status NOT IN ('completed') THEN
        RAISE EXCEPTION 'Invalid status transition: In-progress ride can only transition to completed.';
      ELSIF OLD.status IN ('completed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid status transition: Closed ride cannot change status.';
      END IF;
    END IF;

    -- A chauffeur may record money they collected themselves (cash / their own UPI), including
    -- when the passenger had picked 'upi' or 'wallet' but paid directly. Gateway ('upi') and wallet
    -- payments are only marked paid by service_role settlement or deduct_ride_wallet_payment().
    IF NEW.payment_status <> OLD.payment_status
       AND NEW.payment_status = 'paid'
       AND NEW.payment_method NOT IN ('cash', 'driver_upi') THEN
      RAISE EXCEPTION 'Security Violation: Online gateway payments must be verified by payment gateway settlement.';
    END IF;

    RETURN NEW;
  END IF;

  IF OLD.status = 'searching' AND OLD.driver_id IS NULL
     AND NEW.status = 'accepted'
     AND NEW.driver_id = public.current_active_driver_id() THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Security Violation: Unauthorized booking modification.';
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_ride_wallet_payment(_booking_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b record;
  _current_bal numeric;
  _deduct_amt numeric;
  _new_bal numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  SELECT id, customer_id, driver_id, status, payment_method, payment_status, payment_made, final_fare, estimated_fare
  INTO b
  FROM public.bookings
  WHERE id = _booking_id
  FOR UPDATE;

  IF b.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking record not found.');
  END IF;

  IF NOT (public.is_driver_of(b.driver_id, auth.uid()) OR b.customer_id = auth.uid() OR public.has_role(auth.uid(), 'admin')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: You cannot settle this ride.');
  END IF;

  IF b.payment_method <> 'wallet' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking payment method is not wallet.');
  END IF;

  IF b.status NOT IN ('in_progress', 'completed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ride must be in progress or completed to settle fare.');
  END IF;

  IF b.payment_status = 'paid' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Payment already settled.');
  END IF;

  _deduct_amt := ROUND(COALESCE(b.final_fare, b.estimated_fare, 0), 2);

  SELECT COALESCE(wallet_balance, 0) INTO _current_bal
  FROM public.profiles WHERE id = b.customer_id FOR UPDATE;

  IF _current_bal < _deduct_amt THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient customer wallet balance. Please collect cash or alternate UPI.');
  END IF;

  _new_bal := _current_bal - _deduct_amt;

  PERFORM set_config('app.allow_wallet_mutation', 'on', true);
  UPDATE public.profiles SET wallet_balance = _new_bal, updated_at = now() WHERE id = b.customer_id;
  PERFORM set_config('app.allow_wallet_mutation', 'off', true);

  INSERT INTO public.wallet_transactions (user_id, amount, type, description, booking_id)
  VALUES (b.customer_id, _deduct_amt, 'debit', 'Fare payment for Ride #' || b.id, b.id);

  PERFORM set_config('app.wallet_settlement', 'on', true);
  UPDATE public.bookings SET payment_status = 'paid', payment_made = 'yes', updated_at = now() WHERE id = b.id;
  PERFORM set_config('app.wallet_settlement', 'off', true);

  RETURN jsonb_build_object('success', true, 'amount_deducted', _deduct_amt, 'remaining_balance', _new_bal);
END;
$$;
GRANT EXECUTE ON FUNCTION public.deduct_ride_wallet_payment(uuid) TO authenticated;

-- R6 ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "kyc_application_insert" ON storage.objects;
CREATE POLICY "kyc_application_insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'driver_kyc'
    AND (storage.foldername(name))[1] = 'applications'
    AND storage.extension(name) IN ('jpg', 'jpeg', 'png', 'webp', 'pdf')
  );
