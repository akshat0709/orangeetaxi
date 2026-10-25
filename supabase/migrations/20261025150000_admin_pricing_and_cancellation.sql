-- ============================================================================
-- Orange Taxi — admin-controlled pricing and the cancellation fee rule (2026-10-25)
--
-- Owner decisions (2026-10-25):
--   * Admins set every price from the admin panel: per-vehicle base fare / per-km / minimum fare,
--     tax %, platform fee, surge (on/off + multiplier), cancellation fee and its free window, and
--     the waiting charge shown to riders. The website, the apps and the server all use these values.
--   * Cancellation: a passenger who cancels within 3 minutes of the driver accepting, while the
--     driver has moved no more than 1.5 km, pays nothing; otherwise the cancellation fee (₹50).
--
-- One fare formula everywhere (server: fn_fare_quote; web: calcFare; rider app: fareFor):
--   distance = round(per_km * km)
--   ride     = max(minimum, base + distance)
--   surged   = round(ride * surge)          surge = multiplier when enabled, else 1
--   tax      = round(surged * tax% / 100)
--   total    = surged + tax + round(platform fee)
--
-- Idempotent. Verified in scripts/db-tests (chain and CATCHUP modes).
-- ============================================================================

-- Settings ------------------------------------------------------------------------------------
-- Columns the repo's base schema has and the live pricing/vehicle tables lack. Also in the
-- catch-up; repeated here for projects that already ran an earlier catch-up.
ALTER TABLE public.pricing_settings ADD COLUMN IF NOT EXISTS waiting_charge_per_min numeric NOT NULL DEFAULT 2;
ALTER TABLE public.pricing_settings ADD COLUMN IF NOT EXISTS waiting_free_minutes integer NOT NULL DEFAULT 3;
ALTER TABLE public.pricing_settings ADD COLUMN IF NOT EXISTS cancellation_charge numeric NOT NULL DEFAULT 50;
ALTER TABLE public.pricing_settings ADD COLUMN IF NOT EXISTS surge_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.pricing_settings ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'INR';
ALTER TABLE public.vehicle_categories ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.pricing_settings ADD COLUMN IF NOT EXISTS cancellation_free_minutes integer NOT NULL DEFAULT 3;
ALTER TABLE public.pricing_settings ADD COLUMN IF NOT EXISTS cancellation_free_km numeric NOT NULL DEFAULT 1.5;
INSERT INTO public.pricing_settings (id) SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM public.pricing_settings WHERE id = 1);

-- Keep admin typos from producing absurd fares.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pricing_settings_sane') THEN
    ALTER TABLE public.pricing_settings ADD CONSTRAINT pricing_settings_sane CHECK (
      tax_percent BETWEEN 0 AND 28
      AND platform_fee BETWEEN 0 AND 500
      AND surge_multiplier BETWEEN 1 AND 3
      AND cancellation_charge BETWEEN 0 AND 1000
      AND cancellation_free_minutes BETWEEN 0 AND 60
      AND cancellation_free_km BETWEEN 0 AND 50
      AND waiting_charge_per_min BETWEEN 0 AND 100
      AND waiting_free_minutes BETWEEN 0 AND 60);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_categories_sane') THEN
    ALTER TABLE public.vehicle_categories ADD CONSTRAINT vehicle_categories_sane CHECK (
      base_fare BETWEEN 0 AND 10000 AND per_km BETWEEN 0 AND 1000 AND minimum_fare BETWEEN 0 AND 10000);
  END IF;
END $$;

-- Surge is whatever the admin set (it used to be guessed from demand on the client).
CREATE OR REPLACE FUNCTION public.get_surge_multiplier()
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT CASE WHEN surge_enabled THEN surge_multiplier ELSE 1 END
                   FROM public.pricing_settings WHERE id = 1), 1)
$$;
GRANT EXECUTE ON FUNCTION public.get_surge_multiplier() TO anon, authenticated;

-- The one fare formula. Unknown or inactive vehicle codes fall back to the Signature tariff.
CREATE OR REPLACE FUNCTION public.fn_fare_quote(_vehicle_code text, _distance_km numeric)
RETURNS TABLE (base_fare numeric, distance_fare numeric, minimum_fare numeric, surge numeric,
               ride_fare numeric, tax numeric, platform_fee numeric, total numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_base numeric := 99; v_per_km numeric := 18; v_min numeric := 149;
  v_tax numeric := 0; v_platform numeric := 0; v_surge numeric := 1;
  c record; s record;
BEGIN
  SELECT vc.base_fare, vc.per_km, vc.minimum_fare INTO c
  FROM public.vehicle_categories vc WHERE vc.code = _vehicle_code AND vc.is_active = true LIMIT 1;
  IF FOUND THEN v_base := c.base_fare; v_per_km := c.per_km; v_min := c.minimum_fare; END IF;
  SELECT ps.tax_percent, ps.platform_fee, ps.surge_enabled, ps.surge_multiplier INTO s
  FROM public.pricing_settings ps WHERE ps.id = 1;
  IF FOUND THEN
    v_tax := COALESCE(s.tax_percent, 0);
    v_platform := COALESCE(s.platform_fee, 0);
    v_surge := CASE WHEN s.surge_enabled THEN COALESCE(s.surge_multiplier, 1) ELSE 1 END;
  END IF;

  base_fare := v_base;
  distance_fare := ROUND(v_per_km * GREATEST(COALESCE(_distance_km, 0), 0));
  minimum_fare := v_min;
  surge := v_surge;
  ride_fare := ROUND(GREATEST(v_min, v_base + distance_fare) * v_surge);
  tax := ROUND(ride_fare * v_tax / 100.0);
  platform_fee := ROUND(v_platform);
  total := ride_fare + tax + platform_fee;
  RETURN NEXT;
END;
$$;
GRANT EXECUTE ON FUNCTION public.fn_fare_quote(text, numeric) TO anon, authenticated;

-- Bookings: surge used, driver position at acceptance, cancellation outcome -------------------
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS surge_multiplier numeric NOT NULL DEFAULT 1;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS accepted_driver_lat double precision;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS accepted_driver_lng double precision;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cancellation_fee numeric NOT NULL DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cancelled_by text;

-- Server-authoritative fare on insert (same rules as 20261025130000, now with surge + fn_fare_quote).
CREATE OR REPLACE FUNCTION public.check_booking_insert_integrity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_trusted boolean := public.has_role(auth.uid(), 'admin') OR auth.role() = 'service_role';
  q record;
  v_min numeric;
  straight double precision;
  dist numeric;
  floor_fare numeric;
  pkg numeric;
  promo_disc numeric := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.role() <> 'service_role' THEN
    NEW.customer_id := auth.uid();
  END IF;

  IF is_trusted THEN
    RETURN NEW;
  END IF;

  NEW.status := CASE WHEN NEW.scheduled_at IS NOT NULL THEN 'scheduled' ELSE 'searching' END;
  NEW.driver_id := NULL;
  NEW.final_fare := NULL;
  NEW.started_at := NULL; NEW.completed_at := NULL; NEW.accepted_at := NULL; NEW.arrived_at := NULL;
  NEW.payment_status := 'pending';
  NEW.payment_made := 'no';
  NEW.discount_amount := 0;
  NEW.cancellation_fee := 0;
  NEW.cancelled_by := NULL;
  NEW.accepted_driver_lat := NULL;
  NEW.accepted_driver_lng := NULL;
  -- Ride OTP comes from the server, never from the client.
  NEW.ride_otp := lpad((floor(random() * 10000))::int::text, 4, '0');

  IF NEW.ride_type = 'hourly' THEN
    pkg := public.fn_hourly_package_price(NEW.rental_hours);
    IF pkg IS NULL THEN
      RAISE EXCEPTION 'Unknown hourly rental package.';
    END IF;
    NEW.distance_km := NEW.rental_hours * 10;
    NEW.duration_min := NEW.rental_hours * 60;
    NEW.surge_multiplier := 1;
    floor_fare := pkg;
    IF COALESCE(NEW.estimated_fare, 0) < floor_fare THEN
      NEW.estimated_fare := floor_fare;
      NEW.base_fare := floor_fare;
      NEW.distance_fare := 0;
      NEW.tax_amount := 0;
    END IF;
  ELSE
    NEW.ride_type := 'point_to_point';
    NEW.rental_hours := NULL;
    -- Distance can't be shorter than the straight line between the trip's own coordinates (+15% for roads).
    straight := public.fn_trip_straight_km(NEW.pickup_address, NEW.drop_address);
    dist := ROUND(GREATEST(COALESCE(NEW.distance_km, 0), COALESCE((straight * 1.15)::numeric, 0)), 1);
    NEW.distance_km := dist;
    SELECT * INTO q FROM public.fn_fare_quote(NEW.vehicle_code, dist);
    v_min := q.minimum_fare;
    NEW.surge_multiplier := q.surge;
    floor_fare := q.total;

    -- One-time promo, validated and recorded here.
    IF NEW.promo_code IS NOT NULL THEN
      NEW.promo_code := upper(trim(NEW.promo_code));
      IF NEW.promo_code = 'FIRST100'
         AND floor_fare >= 180
         AND NOT EXISTS (SELECT 1 FROM public.promo_redemptions WHERE user_id = NEW.customer_id AND code = 'FIRST100') THEN
        promo_disc := LEAST(100, floor_fare - v_min);
      ELSE
        NEW.promo_code := NULL;
      END IF;
    END IF;
    floor_fare := floor_fare - promo_disc;

    IF COALESCE(NEW.estimated_fare, 0) < floor_fare THEN
      NEW.estimated_fare := floor_fare;
      NEW.base_fare := q.base_fare;
      NEW.distance_fare := q.distance_fare;
      NEW.tax_amount := q.tax;
    END IF;
  END IF;
  NEW.discount_amount := promo_disc;
  RETURN NEW;
END;
$$;

-- Cancellation fee -----------------------------------------------------------------------------
-- What a cancellation by `_by` ('passenger' | 'driver' | 'admin') would cost right now.
CREATE OR REPLACE FUNCTION public.fn_cancellation_fee(_booking_id uuid, _by text)
RETURNS TABLE (fee numeric, reason text, minutes_since_accept numeric, driver_moved_km numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b record; d record; s record;
  v_charge numeric := 50; v_free_min numeric := 3; v_free_km numeric := 1.5;
BEGIN
  SELECT id, status, driver_id, accepted_at, accepted_driver_lat, accepted_driver_lng
    INTO b FROM public.bookings WHERE id = _booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found.';
  END IF;
  SELECT cancellation_charge, cancellation_free_minutes, cancellation_free_km INTO s
  FROM public.pricing_settings WHERE id = 1;
  IF FOUND THEN
    v_charge := COALESCE(s.cancellation_charge, 0);
    v_free_min := COALESCE(s.cancellation_free_minutes, 0);
    v_free_km := COALESCE(s.cancellation_free_km, 0);
  END IF;

  fee := 0;
  minutes_since_accept := NULL;
  driver_moved_km := NULL;

  IF _by <> 'passenger' THEN
    reason := 'Cancelled by ' || _by || ': no fee for the passenger.';
    RETURN NEXT; RETURN;
  END IF;
  IF b.status IN ('searching', 'scheduled') OR b.driver_id IS NULL THEN
    reason := 'No driver assigned yet: free cancellation.';
    RETURN NEXT; RETURN;
  END IF;

  minutes_since_accept := ROUND(EXTRACT(EPOCH FROM (now() - COALESCE(b.accepted_at, now()))) / 60.0, 1);
  SELECT current_lat, current_lng INTO d FROM public.drivers WHERE id = b.driver_id;
  IF b.accepted_driver_lat IS NOT NULL AND d.current_lat IS NOT NULL THEN
    driver_moved_km := ROUND(public.fn_km_between(b.accepted_driver_lat, b.accepted_driver_lng,
                                                  d.current_lat::double precision, d.current_lng::double precision)::numeric, 2);
  END IF;

  -- Free only if BOTH: within the free minutes AND the driver hasn't moved past the free distance.
  -- Unknown driver position counts as not moved (benefit of the doubt to the passenger).
  IF minutes_since_accept <= v_free_min AND COALESCE(driver_moved_km, 0) <= v_free_km THEN
    reason := format('Cancelled within %s min of acceptance and driver moved under %s km: free.', v_free_min, v_free_km);
  ELSE
    fee := v_charge;
    reason := CASE
      WHEN minutes_since_accept > v_free_min THEN format('More than %s min since the driver accepted.', v_free_min)
      ELSE format('The driver has already travelled more than %s km towards you.', v_free_km) END;
  END IF;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_cancellation_fee(uuid, text) FROM PUBLIC, anon, authenticated;

-- Preview for the cancel button: passenger of the ride (or admin) only.
CREATE OR REPLACE FUNCTION public.get_cancellation_fee(_booking_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.bookings WHERE id = _booking_id
                 AND (customer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))) THEN
    RAISE EXCEPTION 'Not your booking.';
  END IF;
  SELECT * INTO r FROM public.fn_cancellation_fee(_booking_id, 'passenger');
  RETURN jsonb_build_object('fee', r.fee, 'reason', r.reason,
                            'minutes_since_accept', r.minutes_since_accept, 'driver_moved_km', r.driver_moved_km);
END;
$$;
REVOKE ALL ON FUNCTION public.get_cancellation_fee(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_cancellation_fee(uuid) TO authenticated;

-- Runs after trg_bookings_integrity_guard (triggers fire in name order), so the integrity rules
-- judge the caller's own change and this only adds server-computed fields.
CREATE OR REPLACE FUNCTION public.booking_fare_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  trusted boolean := auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin');
  r record;
  by_whom text;
  d record;
BEGIN
  -- Server-owned fields: clients can't write them.
  IF NOT trusted THEN
    NEW.surge_multiplier := OLD.surge_multiplier;
    NEW.cancellation_fee := OLD.cancellation_fee;
    NEW.cancelled_by := OLD.cancelled_by;
    NEW.accepted_driver_lat := OLD.accepted_driver_lat;
    NEW.accepted_driver_lng := OLD.accepted_driver_lng;
  END IF;

  -- Where the driver was when they accepted (for the free-cancellation distance check).
  IF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' AND NEW.driver_id IS NOT NULL THEN
    SELECT current_lat, current_lng INTO d FROM public.drivers WHERE id = NEW.driver_id;
    NEW.accepted_driver_lat := d.current_lat;
    NEW.accepted_driver_lng := d.current_lng;
    NEW.accepted_at := COALESCE(NEW.accepted_at, now());
  END IF;

  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    by_whom := CASE
      WHEN auth.uid() IS NOT NULL AND auth.uid() = OLD.customer_id THEN 'passenger'
      WHEN public.is_driver_of(OLD.driver_id, auth.uid()) THEN 'driver'
      WHEN public.has_role(auth.uid(), 'admin') THEN 'admin'
      ELSE 'system' END;
    NEW.cancelled_by := by_whom;
    NEW.cancelled_at := COALESCE(NEW.cancelled_at, now());
    -- An admin can set the fee by hand; everyone else gets the rule.
    IF NOT (by_whom IN ('admin', 'system') AND NEW.cancellation_fee IS DISTINCT FROM OLD.cancellation_fee) THEN
      SELECT * INTO r FROM public.fn_cancellation_fee(OLD.id, by_whom);
      NEW.cancellation_fee := r.fee;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_bookings_zz_fare_events ON public.bookings;
CREATE TRIGGER trg_bookings_zz_fare_events BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.booking_fare_events();
