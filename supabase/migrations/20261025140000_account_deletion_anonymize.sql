-- ============================================================================
-- Orange Taxi — account deletion keeps anonymised ride and wallet records (2026-10-25)
--
-- Owner decision (2026-10-25): when a user deletes their account, keep their past rides and wallet
-- ledger for tax/GST purposes, anonymised, instead of deleting them or blocking the deletion.
--
-- Before: delete_user_account() failed for anyone who had ever booked a ride (bookings.customer_id
-- blocked deleting the auth user), and on the repo schema the cascade would have deleted the rides
-- and wallet ledger. Its own updates were also rejected by the integrity triggers.
--
-- Idempotent: safe to run more than once. Verified in scripts/db-tests (chain and CATCHUP modes).
-- ============================================================================

-- Re-point a foreign key on (tbl.col) -> auth.users to ON DELETE SET NULL, whatever it is named.
CREATE OR REPLACE FUNCTION pg_temp.fk_set_null(_tbl regclass, _col text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname FROM pg_constraint con
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
    WHERE con.contype = 'f' AND con.conrelid = _tbl AND con.confrelid = 'auth.users'::regclass
      AND a.attname = _col
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', _tbl, c.conname);
  END LOOP;
  EXECUTE format('ALTER TABLE %s ALTER COLUMN %I DROP NOT NULL', _tbl, _col);
  EXECUTE format(
    'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE SET NULL',
    _tbl, replace(_tbl::text, 'public.', '') || '_' || _col || '_fkey', _col);
END;
$$;

SELECT pg_temp.fk_set_null('public.bookings', 'customer_id');
SELECT pg_temp.fk_set_null('public.wallet_transactions', 'user_id');
SELECT pg_temp.fk_set_null('public.drivers', 'user_id');

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
  _balance numeric;
  _driver_ids uuid[];
  _booking_ids uuid[];
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required to process account deletion.';
  END IF;

  SELECT array_agg(id) INTO _driver_ids FROM public.drivers WHERE user_id = _uid;

  SELECT count(*) INTO _active_count
  FROM public.bookings
  WHERE (customer_id = _uid OR driver_id = ANY (COALESCE(_driver_ids, '{}')))
    AND status IN ('searching', 'accepted', 'arrived', 'in_progress');
  IF _active_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete account with an active trip in progress. Please complete or cancel your active ride first.';
  END IF;

  -- Money the user still holds would be lost with the account.
  SELECT COALESCE(wallet_balance, 0) INTO _balance FROM public.profiles WHERE id = _uid;
  IF COALESCE(_balance, 0) > 0 THEN
    RAISE EXCEPTION 'Your wallet still holds ₹%. Please contact support for a refund before deleting your account.', _balance;
  END IF;

  SELECT email INTO _user_email FROM auth.users WHERE id = _uid;

  -- Everything below is this function's own, fixed set of changes: run it as the trusted server
  -- role so the booking/driver/wallet integrity triggers accept it. Local to this transaction.
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  INSERT INTO public.security_audit_logs (event_type, severity, user_id, metadata)
  VALUES ('account.deletion_completed', 'medium', _uid, jsonb_build_object(
    'action', 'User self-service account erasure under DPDP Act 2023',
    'statutory_notice', 'Financial and tax receipts retained, anonymised, per CGST Act Section 36'));

  -- Future scheduled rides can't go ahead without a passenger.
  UPDATE public.bookings
     SET status = 'cancelled', cancelled_at = now(), cancel_reason = 'Account deleted by user'
   WHERE customer_id = _uid AND status = 'scheduled';

  -- Rides keep fares, tax, payment and dates for invoices; personal details are removed.
  SELECT array_agg(id) INTO _booking_ids FROM public.bookings WHERE customer_id = _uid;
  UPDATE public.bookings
     SET pickup_address = '[Redacted on Account Deletion]',
         drop_address = '[Redacted on Account Deletion]',
         pickup_area = 'Redacted Area',
         drop_area = 'Redacted Area',
         ride_otp = '',
         review = '',
         customer_id = NULL
   WHERE customer_id = _uid;
  IF to_regclass('public.booking_secrets') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.booking_secrets WHERE booking_id = ANY ($1)' USING COALESCE(_booking_ids, '{}');
  END IF;

  UPDATE public.wallet_transactions SET user_id = NULL WHERE user_id = _uid;

  IF to_regclass('public.sos_alerts') IS NOT NULL THEN
    UPDATE public.sos_alerts SET guardian_phone = NULL, user_id = NULL WHERE user_id = _uid;
  END IF;

  -- A driver's past trips stay linked to an anonymised driver record.
  UPDATE public.drivers
     SET full_name = 'Former Chauffeur',
         phone = '',
         vehicle_number = 'REDACTED',
         vehicle_model = 'REDACTED',
         aadhaar_number = '',
         dl_url = '',
         photo_url = '',
         push_token = NULL,
         is_online = false,
         status = 'deleted',
         user_id = NULL
   WHERE id = ANY (COALESCE(_driver_ids, '{}'));
  IF to_regclass('public.driver_kyc_private') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.driver_kyc_private WHERE driver_id = ANY ($1)' USING COALESCE(_driver_ids, '{}');
  END IF;

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

  -- Profile, roles, consents and promo records go with the login (ON DELETE CASCADE).
  DELETE FROM auth.users WHERE id = _uid;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Your account, profile, and personal identifiers have been permanently erased in compliance with the DPDP Act, 2023. Anonymized tax and invoicing ledgers are archived per statutory requirements.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;
