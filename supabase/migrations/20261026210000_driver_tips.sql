-- ============================================================================
-- Orange Taxi — tips paid through Razorpay (2026-10-26)
--
-- Why: the tip buttons after a ride only added "Chauffeur Tip: ₹50" to the review text; no
-- money moved. Now a tip opens a Razorpay payment link (payment_qr_codes kind 'tip'), and once
-- Razorpay confirms it the server records it here. The tip belongs 100% to the chauffeur;
-- paid_out_at is set when Orange Taxi passes it on.
-- Idempotent.
-- ============================================================================

ALTER TABLE public.payment_qr_codes DROP CONSTRAINT IF EXISTS payment_qr_codes_kind_check;
ALTER TABLE public.payment_qr_codes ADD CONSTRAINT payment_qr_codes_kind_check
  CHECK (kind IN ('ride', 'cash_deposit', 'commission', 'ride_link', 'tip'));

CREATE TABLE IF NOT EXISTS public.driver_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  customer_id uuid,
  amount numeric NOT NULL CHECK (amount > 0),
  razorpay_payment_id text NOT NULL UNIQUE,
  paid_out_at timestamptz,
  paid_out_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS driver_tips_driver ON public.driver_tips (driver_id, created_at DESC);

ALTER TABLE public.driver_tips ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.driver_tips FROM anon, authenticated;
GRANT SELECT ON public.driver_tips TO authenticated;
GRANT UPDATE (paid_out_at, paid_out_by) ON public.driver_tips TO authenticated;

DROP POLICY IF EXISTS "driver_tips_read" ON public.driver_tips;
CREATE POLICY "driver_tips_read" ON public.driver_tips FOR SELECT TO authenticated
  USING (
    customer_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "driver_tips_admin_payout" ON public.driver_tips;
CREATE POLICY "driver_tips_admin_payout" ON public.driver_tips FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
