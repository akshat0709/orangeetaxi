-- ============================================================================
-- Orange Taxi — Support desk, refunds, and "no account" sign-in message (2026-10-26)
--
-- Owner requests (2026-10-26):
--   * Support section in Admin: work through support tickets (status, notes, refunds).
--   * A refund procedure for fees and ride payments: admins refund through Razorpay (online
--     payments), to the passenger's Orange Wallet, or record a manual cash/UPI refund.
--   * Sign-in should say "no account with this email — create one first" instead of always
--     "invalid credentials".
-- Idempotent.
-- ============================================================================

-- 1. Sign-in: does an account exist for this email? -------------------------------------------
-- Only the website server (service role) may call it; it rate-limits callers. Exposing it to
-- anon would let anyone test which emails have accounts at full speed.
CREATE OR REPLACE FUNCTION public.auth_email_status(_email text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE r record;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Only the website server can check accounts.';
  END IF;
  SELECT u.id, (to_jsonb(u) ->> 'email_confirmed_at') AS confirmed INTO r
  FROM auth.users u
  WHERE lower(u.email) = lower(trim(COALESCE(_email, '')))
    AND (to_jsonb(u) ->> 'deleted_at') IS NULL
  LIMIT 1;
  IF r.id IS NULL THEN RETURN 'none'; END IF;
  IF r.confirmed IS NULL THEN RETURN 'unconfirmed'; END IF;
  RETURN 'exists';
END; $$;
REVOKE ALL ON FUNCTION public.auth_email_status(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_email_status(text) TO service_role;

-- 2. Support tickets: people can open tickets, not edit or impersonate ----------------------
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL;
DROP POLICY IF EXISTS "support_tickets_insert" ON public.support_tickets;
CREATE POLICY "support_tickets_insert" ON public.support_tickets
  FOR INSERT TO authenticated, anon
  WITH CHECK (
    (user_id IS NULL OR user_id = auth.uid())
    AND status = 'open'
    AND admin_notes IS NULL
    AND resolution_at IS NULL
  );
CREATE INDEX IF NOT EXISTS support_tickets_status_created ON public.support_tickets (status, created_at DESC);

CREATE OR REPLACE FUNCTION public.support_tickets_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status IN ('resolved', 'closed') AND OLD.status NOT IN ('resolved', 'closed') THEN
    NEW.resolution_at := now();
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_support_tickets_touch ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_touch BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.support_tickets_touch();

-- 3. Refunds -----------------------------------------------------------------------------------
-- Written only by the website server (service role) after the refund is made.
CREATE TABLE IF NOT EXISTS public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  customer_id uuid,
  ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  method text NOT NULL CHECK (method IN ('razorpay', 'wallet', 'manual')),
  status text NOT NULL DEFAULT 'processed' CHECK (status IN ('pending', 'processed', 'failed')),
  razorpay_refund_id text UNIQUE,
  reason text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS refunds_booking ON public.refunds (booking_id);
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.refunds FROM anon, authenticated;
GRANT SELECT ON public.refunds TO authenticated;
DROP POLICY IF EXISTS "refunds_read_own_or_admin" ON public.refunds;
CREATE POLICY "refunds_read_own_or_admin" ON public.refunds FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
