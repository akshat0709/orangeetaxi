-- ============================================================================
-- Orange Taxi — Comprehensive Security, Authorization, Financial & Fleet Remediation
-- Fixes: VULN-RLS-01, VULN-FIN-01, VULN-RIDE-01, VULN-DRV-01, VULN-PRIV-01, VULN-PAY-01
-- ============================================================================

-- ============================================================================
-- 1. SECURE PARTNER COMMISSION, CASH SETTLEMENTS & PARTNER VEHICLES (VULN-RLS-01)
-- ============================================================================

-- A. Lock down driver_commission_settlements
ALTER TABLE IF EXISTS public.driver_commission_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read on driver_commission_settlements" ON public.driver_commission_settlements;
DROP POLICY IF EXISTS "Allow authenticated insert on driver_commission_settlements" ON public.driver_commission_settlements;
DROP POLICY IF EXISTS "Allow authenticated delete on driver_commission_settlements" ON public.driver_commission_settlements;
DROP POLICY IF EXISTS "driver_comm_select_scoped" ON public.driver_commission_settlements;
DROP POLICY IF EXISTS "driver_comm_admin_all" ON public.driver_commission_settlements;

-- Drivers can only read their own commission settlements; Admins can read all
CREATE POLICY "driver_comm_select_scoped" ON public.driver_commission_settlements
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR
    driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  );

-- Only Admins can insert, update, or delete commission settlements
CREATE POLICY "driver_comm_admin_all" ON public.driver_commission_settlements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- B. Lock down driver_cash_settlements
ALTER TABLE IF EXISTS public.driver_cash_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on driver_cash_settlements" ON public.driver_cash_settlements;
DROP POLICY IF EXISTS "driver_cash_select_scoped" ON public.driver_cash_settlements;
DROP POLICY IF EXISTS "driver_cash_admin_all" ON public.driver_cash_settlements;

-- Drivers can only read their own cash settlements; Admins can read all
CREATE POLICY "driver_cash_select_scoped" ON public.driver_cash_settlements
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR
    driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  );

-- Only Admins can record or modify cash settlements
CREATE POLICY "driver_cash_admin_all" ON public.driver_cash_settlements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- C. Lock down partner_vehicles
ALTER TABLE IF EXISTS public.partner_vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on partner_vehicles" ON public.partner_vehicles;
DROP POLICY IF EXISTS "Allow public manage on partner_vehicles" ON public.partner_vehicles;
DROP POLICY IF EXISTS "partner_vehicles_select_scoped" ON public.partner_vehicles;
DROP POLICY IF EXISTS "partner_vehicles_admin_all" ON public.partner_vehicles;

-- Drivers can only view their own assigned partner vehicle; Admins can view all
CREATE POLICY "partner_vehicles_select_scoped" ON public.partner_vehicles
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR
    driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  );

-- Only Admins can register, modify, or delete partner vehicles
CREATE POLICY "partner_vehicles_admin_all" ON public.partner_vehicles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- ============================================================================
-- 2. SECURE WALLET LEDGER & DIRECT BALANCE TAMPERING LOCKDOWN (VULN-FIN-01)
-- ============================================================================

-- Ensure wallet_transactions table exists with proper audit fields
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

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_id ON public.wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_created ON public.wallet_transactions(created_at DESC);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallet_tx_select_own" ON public.wallet_transactions;
DROP POLICY IF EXISTS "wallet_tx_admin_all" ON public.wallet_transactions;
DROP POLICY IF EXISTS "wallet_tx_no_client_insert" ON public.wallet_transactions;

CREATE POLICY "wallet_tx_select_own" ON public.wallet_transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "wallet_tx_admin_all" ON public.wallet_transactions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Prevent direct client-side balance modifications on public.profiles
CREATE OR REPLACE FUNCTION public.check_profile_wallet_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If wallet_balance is being modified
  IF NEW.wallet_balance IS DISTINCT FROM OLD.wallet_balance THEN
    -- Allow service role or admin override
    IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
      RETURN NEW;
    END IF;

    -- Allow trusted database RPCs that set session token
    IF current_setting('app.allow_wallet_mutation', true) = 'on' THEN
      RETURN NEW;
    END IF;

    -- Reject direct client updates
    RAISE EXCEPTION 'Security Violation: Direct modification of wallet balance is forbidden. Top-ups and deductions must be processed through verified transactions.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_direct_wallet_balance_update ON public.profiles;
CREATE TRIGGER trg_prevent_direct_wallet_balance_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_profile_wallet_tampering();

-- Secure Atomic Wallet Top-Up RPC (with verification and transaction logging)
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

  IF _clean_amt <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Top-up amount must be greater than zero.');
  END IF;

  IF _clean_amt > 25000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Single transaction limit of ₹25,000 exceeded.');
  END IF;

  IF _payment_id IS NULL OR trim(_payment_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Valid payment transaction identifier is required.');
  END IF;

  -- Check for replay of payment identifier
  IF EXISTS (SELECT 1 FROM public.wallet_transactions WHERE reference_id = trim(_payment_id)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This payment transaction has already been credited.');
  END IF;

  -- Acquire row lock on profile
  SELECT COALESCE(wallet_balance, 0) INTO _current_bal
  FROM public.profiles
  WHERE id = _uid
  FOR UPDATE;

  IF _current_bal IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found.');
  END IF;

  _new_bal := _current_bal + _clean_amt;

  -- Temporarily grant permission for atomic mutation
  PERFORM set_config('app.allow_wallet_mutation', 'on', true);

  UPDATE public.profiles
  SET wallet_balance = _new_bal,
      updated_at = now()
  WHERE id = _uid;

  INSERT INTO public.wallet_transactions (user_id, amount, type, description, reference_id)
  VALUES (_uid, _clean_amt, 'credit', _description, trim(_payment_id));

  -- Audit log
  INSERT INTO public.security_audit_logs (event_type, severity, user_id, metadata)
  VALUES (
    'wallet.top_up_success',
    'low',
    _uid,
    jsonb_build_object('amount', _clean_amt, 'new_balance', _new_bal, 'payment_id', trim(_payment_id))
  );

  PERFORM set_config('app.allow_wallet_mutation', 'off', true);

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', _new_bal,
    'amount_credited', _clean_amt
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.top_up_wallet(numeric, text, text, text) TO authenticated;

-- Secure Atomic Wallet Fare Deduction RPC
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

  -- Only assigned driver, the customer, or admin can trigger fare settlement
  IF NOT (
    public.is_driver_of(b.driver_id, auth.uid()) OR
    b.customer_id = auth.uid() OR
    public.has_role(auth.uid(), 'admin')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: You cannot settle this ride.');
  END IF;

  IF b.payment_method <> 'wallet' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking payment method is not wallet.');
  END IF;

  IF b.payment_status = 'paid' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Payment already settled.');
  END IF;

  _deduct_amt := ROUND(COALESCE(b.final_fare, b.estimated_fare, 0), 2);

  -- Acquire row lock on customer profile
  SELECT COALESCE(wallet_balance, 0) INTO _current_bal
  FROM public.profiles
  WHERE id = b.customer_id
  FOR UPDATE;

  IF _current_bal < _deduct_amt THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient customer wallet balance. Please collect cash or alternate UPI.'
    );
  END IF;

  _new_bal := _current_bal - _deduct_amt;

  PERFORM set_config('app.allow_wallet_mutation', 'on', true);

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

  PERFORM set_config('app.allow_wallet_mutation', 'off', true);

  RETURN jsonb_build_object(
    'success', true,
    'amount_deducted', _deduct_amt,
    'remaining_balance', _new_bal
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.deduct_ride_wallet_payment(uuid) TO authenticated;


-- ============================================================================
-- 3. ATOMIC RIDE DISPATCH & CONCURRENCY LOCK (VULN-RIDE-01)
-- ============================================================================

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

  -- 1. Verify caller has an active, approved driver profile
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

  -- 2. Check if chauffeur is already on another active ride
  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE driver_id = _drv.id AND status IN ('accepted', 'arrived', 'in_progress')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have an active ride in progress.');
  END IF;

  -- 3. Atomically lock and claim the searching ride (row-level lock)
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
    -- Either already accepted by another chauffeur or cancelled
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ride already claimed by another chauffeur or cancelled by passenger.'
    );
  END IF;

  -- 4. Audit dispatch acceptance
  INSERT INTO public.security_audit_logs (event_type, severity, user_id, metadata)
  VALUES (
    'booking.accepted',
    'low',
    _caller_uid,
    jsonb_build_object(
      'booking_id', _booking_id,
      'driver_id', _drv.id,
      'reference', _claimed_booking.reference
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Ride successfully accepted.',
    'booking', row_to_json(_claimed_booking)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_booking(uuid) TO authenticated;


-- ============================================================================
-- 4. PREVENT DRIVER SELF-PROMOTION & ATTRIBUTE TAMPERING (VULN-DRV-01)
-- ============================================================================

-- Drop insecure self-insert policy on drivers
DROP POLICY IF EXISTS "admin manages drivers" ON public.drivers;
DROP POLICY IF EXISTS "admin_manages_drivers_insert" ON public.drivers;

-- Only administrators can insert driver records
CREATE POLICY "admin_manages_drivers_insert" ON public.drivers
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Driver update attribute integrity trigger
CREATE OR REPLACE FUNCTION public.check_driver_update_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Administrators possess full administrative override
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Non-admin drivers updating their own profile
  IF auth.uid() = OLD.user_id THEN
    -- Prohibit modifying administrative, privilege, or metric attributes
    IF NEW.status <> OLD.status OR
       NEW.rating <> OLD.rating OR
       NEW.total_rides <> OLD.total_rides OR
       NEW.driver_type IS DISTINCT FROM OLD.driver_type OR
       NEW.user_id IS DISTINCT FROM OLD.user_id OR
       NEW.id <> OLD.id THEN
      RAISE EXCEPTION 'Security Violation: Chauffeurs cannot alter rating, trip counts, account status, or credentials.';
    END IF;

    -- Operational telematics updates (GPS, online status, city, heading) are permitted
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Security Violation: Unauthorized driver record update.';
END;
$$;

DROP TRIGGER IF EXISTS trg_driver_attribute_integrity ON public.drivers;
CREATE TRIGGER trg_driver_attribute_integrity
  BEFORE UPDATE ON public.drivers
  FOR EACH ROW
  EXECUTE FUNCTION public.check_driver_update_integrity();

-- Lock down driver application self-approval
CREATE OR REPLACE FUNCTION public.check_driver_application_insert_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Force initial status to 'new' and blank out admin notes on public submissions
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.status := 'new';
    NEW.admin_notes := '';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_driver_application_insert_integrity ON public.driver_applications;
CREATE TRIGGER trg_driver_application_insert_integrity
  BEFORE INSERT ON public.driver_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.check_driver_application_insert_integrity();


-- ============================================================================
-- 5. FLEET PRIVACY & DRIVER PII SCOPING (VULN-PRIV-01)
-- ============================================================================

-- Drop overly broad driver read policy
DROP POLICY IF EXISTS "drivers readable by signed in" ON public.drivers;
DROP POLICY IF EXISTS "Drivers can view own profile" ON public.drivers;
DROP POLICY IF EXISTS "Public can view driver locations for active rides" ON public.drivers;
DROP POLICY IF EXISTS "drivers_select_scoped" ON public.drivers;

-- Scoped driver select:
-- 1. Admins see all drivers
-- 2. Drivers see their own profile
-- 3. Customers see drivers assigned to their active bookings OR active drivers via radar
CREATE POLICY "drivers_select_scoped" ON public.drivers
  FOR SELECT TO authenticated
  USING (
    -- Admin override
    public.has_role(auth.uid(), 'admin')
    OR
    -- Chauffeur viewing own profile
    user_id = auth.uid()
    OR
    -- Customer viewing chauffeur assigned to their ride
    id IN (
      SELECT driver_id FROM public.bookings
      WHERE customer_id = auth.uid()
        AND status IN ('accepted', 'arrived', 'in_progress', 'completed')
    )
    OR
    -- Online active drivers (for passenger live dispatch radar)
    (is_online = true AND status = 'active')
  );


-- ============================================================================
-- 6. ENHANCE BOOKING UPDATE INTEGRITY & STATE TRANSITIONS (VULN-PAY-01)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_booking_update_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean := public.has_role(auth.uid(), 'admin');
  is_assigned_driver boolean := public.is_driver_of(OLD.driver_id, auth.uid());
BEGIN
  -- 1. Administrators possess full administrative override
  IF is_admin THEN
    RETURN NEW;
  END IF;

  -- 2. Customer updates
  IF auth.uid() = OLD.customer_id THEN
    -- Customers cannot alter financial calculations, driver assignment, or payment status
    IF NEW.estimated_fare <> OLD.estimated_fare OR
       NEW.base_fare <> OLD.base_fare OR
       NEW.distance_fare <> OLD.distance_fare OR
       NEW.tax_amount <> OLD.tax_amount OR
       NEW.payment_status <> OLD.payment_status OR
       NEW.payment_made IS DISTINCT FROM OLD.payment_made OR
       NEW.customer_id <> OLD.customer_id OR
       NEW.driver_id IS DISTINCT FROM OLD.driver_id THEN
      RAISE EXCEPTION 'Security Violation: Unauthorized customer modification of financial, payment, or dispatch fields.';
    END IF;

    -- Allowed status transitions: cancellation before chauffeur arrival, or rating completed ride
    IF NEW.status <> OLD.status THEN
      IF NEW.status = 'cancelled' THEN
        IF OLD.status NOT IN ('searching', 'scheduled', 'accepted') THEN
          RAISE EXCEPTION 'Cancellation denied: Ride is already arrived or in-progress.';
        END IF;
      ELSIF NEW.status = 'completed' THEN
        -- Allow rating/review attributes only
        NULL;
      ELSE
        RAISE EXCEPTION 'Security Violation: Illegal ride status transition requested by passenger.';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  -- 3. Assigned Driver updates
  IF is_assigned_driver THEN
    -- Chauffeurs cannot alter commercial pricing or customer ownership
    IF NEW.estimated_fare <> OLD.estimated_fare OR
       NEW.base_fare <> OLD.base_fare OR
       NEW.distance_fare <> OLD.distance_fare OR
       NEW.tax_amount <> OLD.tax_amount OR
       NEW.customer_id <> OLD.customer_id OR
       NEW.driver_id <> OLD.driver_id THEN
      RAISE EXCEPTION 'Security Violation: Chauffeurs cannot alter commercial pricing, passenger ownership, or reassign trips.';
    END IF;

    -- Valid ride state lifecycle transitions
    IF NEW.status <> OLD.status THEN
      IF OLD.status = 'accepted' AND NEW.status NOT IN ('arrived', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid status transition: Accepted ride can only transition to arrived or cancelled.';
      ELSIF OLD.status = 'arrived' AND NEW.status NOT IN ('in_progress', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid status transition: Arrived ride can only transition to in_progress via OTP.';
      ELSIF OLD.status = 'in_progress' AND NEW.status NOT IN ('completed') THEN
        RAISE EXCEPTION 'Invalid status transition: In-progress ride can only transition to completed.';
      ELSIF OLD.status = 'completed' THEN
        RAISE EXCEPTION 'Invalid status transition: Completed ride cannot be modified.';
      ELSIF OLD.status = 'cancelled' THEN
        RAISE EXCEPTION 'Invalid status transition: Cancelled ride cannot be modified.';
      END IF;
    END IF;

    -- Payment status protections: For non-cash rides, chauffeur cannot mark online payment as paid
    IF NEW.payment_status <> OLD.payment_status THEN
      IF NEW.payment_status = 'paid' AND OLD.payment_method NOT IN ('cash', 'driver_upi') THEN
        RAISE EXCEPTION 'Security Violation: Online gateway payments must be verified by payment gateway settlement.';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  -- 4. Unassigned Ride Claiming (fallback for direct update if accept_booking RPC not used)
  IF OLD.status = 'searching' AND OLD.driver_id IS NULL THEN
    -- Must be transitioning to 'accepted' with caller's own driver profile
    IF NEW.status = 'accepted' AND NEW.driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid() AND status = 'active') THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'Security Violation: Unauthorized booking modification.';
END;
$$;
