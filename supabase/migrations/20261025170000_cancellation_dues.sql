-- ============================================================================
-- Orange Taxi — stuck-driver free cancellation, and cancellation fees added to the next ride
-- (2026-10-26)
--
-- Owner decisions (2026-10-26):
--   * Cancelling is also free when, 5+ minutes after accepting, the driver has moved less than
--     0.5 km (stuck or not coming). Both numbers are editable in Admin → Pricing.
--   * A cancellation fee is not charged on the spot. It is saved as an unpaid fee on the rider's
--     account and added, as a separate line, to their next ride. It is settled when that ride is
--     paid (cash, UPI, online or wallet). If that ride is cancelled, the fee waits for the next one.
--
-- Fee rule (fn_cancellation_fee), for a passenger cancelling an accepted ride:
--   free  if  minutes ≤ free_minutes AND moved ≤ free_km
--   free  if  minutes ≥ stuck_minutes AND moved < stuck_km
--   else  cancellation_charge
-- Unknown driver position counts as "not moved".
--
-- Idempotent. Verified in scripts/db-tests (chain and CATCHUP modes).
-- ============================================================================

-- Settings ------------------------------------------------------------------------------------
ALTER TABLE public.pricing_settings ADD COLUMN IF NOT EXISTS cancellation_stuck_minutes integer NOT NULL DEFAULT 5;
ALTER TABLE public.pricing_settings ADD COLUMN IF NOT EXISTS cancellation_stuck_km numeric NOT NULL DEFAULT 0.5;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pricing_settings_stuck_sane') THEN
    ALTER TABLE public.pricing_settings ADD CONSTRAINT pricing_settings_stuck_sane CHECK (
      cancellation_stuck_minutes BETWEEN 1 AND 120 AND cancellation_stuck_km BETWEEN 0 AND 20);
  END IF;
END $$;

-- Fee rule ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_cancellation_fee(_booking_id uuid, _by text)
RETURNS TABLE (fee numeric, reason text, minutes_since_accept numeric, driver_moved_km numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b record; d record; s record;
  v_charge numeric := 50; v_free_min numeric := 3; v_free_km numeric := 1.5;
  v_stuck_min numeric := 5; v_stuck_km numeric := 0.5;
  moved numeric;
BEGIN
  SELECT id, status, driver_id, accepted_at, accepted_driver_lat, accepted_driver_lng
    INTO b FROM public.bookings WHERE id = _booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found.';
  END IF;
  SELECT cancellation_charge, cancellation_free_minutes, cancellation_free_km,
         cancellation_stuck_minutes, cancellation_stuck_km
    INTO s FROM public.pricing_settings WHERE id = 1;
  IF FOUND THEN
    v_charge := COALESCE(s.cancellation_charge, 0);
    v_free_min := COALESCE(s.cancellation_free_minutes, 0);
    v_free_km := COALESCE(s.cancellation_free_km, 0);
    v_stuck_min := COALESCE(s.cancellation_stuck_minutes, 5);
    v_stuck_km := COALESCE(s.cancellation_stuck_km, 0.5);
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
  moved := COALESCE(driver_moved_km, 0);

  IF minutes_since_accept <= v_free_min AND moved <= v_free_km THEN
    reason := format('No fee: cancelled within %s min of acceptance.', v_free_min);
  ELSIF minutes_since_accept >= v_stuck_min AND moved < v_stuck_km THEN
    reason := 'No fee: your driver hasn''t moved.';
  ELSE
    fee := v_charge;
    reason := CASE
      WHEN minutes_since_accept > v_free_min
        THEN format('More than %s min since the driver accepted, and they are on the way.', v_free_min)
      ELSE format('The driver has already travelled more than %s km towards you.', v_free_km) END
      || ' The fee is added to your next ride.';
  END IF;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_cancellation_fee(uuid, text) FROM PUBLIC, anon, authenticated;

-- Unpaid fees -------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cancellation_dues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  booking_id uuid NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,  -- the cancelled ride
  amount numeric NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'due' CHECK (status IN ('due', 'settled', 'waived')),
  carried_by uuid REFERENCES public.bookings(id) ON DELETE SET NULL,                    -- the ride it was added to
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz,
  waived_by uuid,
  note text
);
CREATE INDEX IF NOT EXISTS cancellation_dues_customer_open
  ON public.cancellation_dues (customer_id) WHERE status = 'due';
CREATE INDEX IF NOT EXISTS cancellation_dues_carried_by ON public.cancellation_dues (carried_by);

ALTER TABLE public.cancellation_dues ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cancellation_dues FROM anon;
GRANT SELECT, UPDATE ON public.cancellation_dues TO authenticated;
DROP POLICY IF EXISTS "dues_select_own_or_admin" ON public.cancellation_dues;
CREATE POLICY "dues_select_own_or_admin" ON public.cancellation_dues FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "dues_admin_update" ON public.cancellation_dues;
CREATE POLICY "dues_admin_update" ON public.cancellation_dues FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins may only waive (or un-waive) a fee; amounts and links are system-owned.
CREATE OR REPLACE FUNCTION public.check_cancellation_dues_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' OR current_setting('app.dues_system', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF NEW.amount IS DISTINCT FROM OLD.amount OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.booking_id IS DISTINCT FROM OLD.booking_id OR NEW.carried_by IS DISTINCT FROM OLD.carried_by
     OR NEW.status NOT IN ('due', 'waived') OR OLD.status = 'settled' THEN
    RAISE EXCEPTION 'Only waiving an unpaid cancellation fee is allowed.';
  END IF;
  IF NEW.status = 'waived' AND OLD.status <> 'waived' THEN
    NEW.waived_by := auth.uid();
    NEW.settled_at := now();
  ELSIF NEW.status = 'due' THEN
    NEW.waived_by := NULL;
    NEW.settled_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_cancellation_dues_update ON public.cancellation_dues;
CREATE TRIGGER trg_cancellation_dues_update BEFORE UPDATE ON public.cancellation_dues
  FOR EACH ROW EXECUTE FUNCTION public.check_cancellation_dues_update();

-- What the signed-in rider owes right now (shown on the booking screen before they book).
CREATE OR REPLACE FUNCTION public.get_my_dues()
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(amount), 0) FROM public.cancellation_dues
  WHERE customer_id = auth.uid() AND status = 'due' AND carried_by IS NULL
$$;
REVOKE ALL ON FUNCTION public.get_my_dues() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_dues() TO authenticated;

-- Bookings: the unpaid fees a ride carries -----------------------------------------------------
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS dues_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS dues_ids uuid[] NOT NULL DEFAULT '{}';

-- BEFORE INSERT, after trg_booking_insert_integrity (name order): add the rider's unpaid fees to
-- the new ride and make sure the booked fare covers them.
CREATE OR REPLACE FUNCTION public.booking_add_dues()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ids uuid[];
  total numeric;
  q record;
  floor_fare numeric;
BEGIN
  NEW.dues_amount := 0;
  NEW.dues_ids := '{}';
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Lock the rider's open fees so two bookings made at the same moment can't both take them.
  SELECT COALESCE(array_agg(id), '{}'), COALESCE(SUM(amount), 0) INTO ids, total
  FROM (SELECT id, amount FROM public.cancellation_dues
        WHERE customer_id = NEW.customer_id AND status = 'due' AND carried_by IS NULL
        FOR UPDATE) x;
  IF total <= 0 THEN
    RETURN NEW;
  END IF;

  NEW.dues_amount := total;
  NEW.dues_ids := ids;

  -- The fare must cover the ride (as already checked) plus these fees.
  IF NEW.ride_type = 'hourly' THEN
    floor_fare := COALESCE(public.fn_hourly_package_price(NEW.rental_hours), 0);
  ELSE
    SELECT * INTO q FROM public.fn_fare_quote(NEW.vehicle_code, NEW.distance_km);
    floor_fare := q.total - COALESCE(NEW.discount_amount, 0);
  END IF;
  NEW.estimated_fare := GREATEST(COALESCE(NEW.estimated_fare, 0), floor_fare + total);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_booking_insert_zy_dues ON public.bookings;
CREATE TRIGGER trg_booking_insert_zy_dues BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.booking_add_dues();

-- AFTER INSERT: link the fees to the ride that now carries them.
CREATE OR REPLACE FUNCTION public.booking_link_dues()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF cardinality(NEW.dues_ids) > 0 THEN
    PERFORM set_config('app.dues_system', 'on', true);
    UPDATE public.cancellation_dues SET carried_by = NEW.id
     WHERE id = ANY (NEW.dues_ids) AND status = 'due';
    PERFORM set_config('app.dues_system', 'off', true);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_booking_link_dues ON public.bookings;
CREATE TRIGGER trg_booking_link_dues AFTER INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.booking_link_dues();

-- AFTER UPDATE: record a new fee, settle carried fees when the ride is paid, release them when
-- the carrying ride is cancelled.
CREATE OR REPLACE FUNCTION public.booking_dues_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config('app.dues_system', 'on', true);

  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    UPDATE public.cancellation_dues SET carried_by = NULL
     WHERE carried_by = NEW.id AND status = 'due';
    IF COALESCE(NEW.cancellation_fee, 0) > 0 AND NEW.customer_id IS NOT NULL THEN
      INSERT INTO public.cancellation_dues (customer_id, booking_id, amount)
      VALUES (NEW.customer_id, NEW.id, NEW.cancellation_fee)
      ON CONFLICT (booking_id) DO NOTHING;
    END IF;
  END IF;

  IF NEW.payment_status = 'paid' AND OLD.payment_status IS DISTINCT FROM 'paid' THEN
    UPDATE public.cancellation_dues SET status = 'settled', settled_at = now()
     WHERE carried_by = NEW.id AND status = 'due';
  END IF;

  PERFORM set_config('app.dues_system', 'off', true);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_booking_dues_events ON public.bookings;
CREATE TRIGGER trg_booking_dues_events AFTER UPDATE OF status, payment_status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.booking_dues_events();

-- Clients can't write the dues fields themselves (trg_bookings_zz_fare_events runs last).
CREATE OR REPLACE FUNCTION public.booking_lock_dues_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin')) THEN
    NEW.dues_amount := OLD.dues_amount;
    NEW.dues_ids := OLD.dues_ids;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_bookings_zz_lock_dues ON public.bookings;
CREATE TRIGGER trg_bookings_zz_lock_dues BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.booking_lock_dues_fields();

-- Fees already recorded on cancelled rides before this change become unpaid fees.
INSERT INTO public.cancellation_dues (customer_id, booking_id, amount, created_at)
SELECT customer_id, id, cancellation_fee, COALESCE(cancelled_at, updated_at, now())
FROM public.bookings
WHERE status = 'cancelled' AND COALESCE(cancellation_fee, 0) > 0 AND customer_id IS NOT NULL
ON CONFLICT (booking_id) DO NOTHING;
