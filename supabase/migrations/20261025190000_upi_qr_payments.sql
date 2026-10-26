-- ============================================================================
-- Orange Taxi — Razorpay UPI QR payments (2026-10-26)
--
-- Owner request (2026-10-26):
--   * At the end of a "pay the chauffeur" ride the driver picks Cash or UPI. UPI shows a one-time
--     Razorpay QR for the fare; the money goes to Orange Taxi's account, the ride is marked paid
--     online (payment_method 'upi_qr'), and it never counts as cash the driver is holding.
--   * When a driver hands in money (Cash Settlements) or a commission driver pays commission
--     (Commission Ledger), the admin can pick Cash or UPI; UPI shows a QR and the deposit is
--     recorded automatically once Razorpay confirms it.
--
--   * Rider app: a passenger who picked online payment pays through a Razorpay payment link
--     (kind 'ride_link'); the ride is then marked paid online (payment_method 'upi').
--   * Drivers can also show themselves a QR to hand in cash / pay commission (capped by the server
--     at what they owe), instead of typing in a UPI reference that nobody could verify.
--
-- payment_qr_codes tracks every QR / link the server creates. Only the server (service role) writes it;
-- admins can read it. Settlement happens when the poll or the Razorpay webhook (qr_code.credited)
-- sees the payment, whichever comes first (the row's status guards against doing it twice).
-- Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payment_qr_codes (
  id text PRIMARY KEY,                                  -- Razorpay qr_… (QR) or plink_… (payment link) id
  kind text NOT NULL CHECK (kind IN ('ride', 'cash_deposit', 'commission', 'ride_link')),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'closed')),
  image_url text NOT NULL,
  payment_id text UNIQUE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  close_by timestamptz,
  paid_at timestamptz
);
CREATE INDEX IF NOT EXISTS payment_qr_codes_booking ON public.payment_qr_codes (booking_id) WHERE status = 'pending';

ALTER TABLE public.payment_qr_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_qr_codes FROM anon, authenticated;
GRANT SELECT ON public.payment_qr_codes TO authenticated;
DROP POLICY IF EXISTS "qr_admin_read" ON public.payment_qr_codes;
CREATE POLICY "qr_admin_read" ON public.payment_qr_codes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Deposits recorded from a QR keep the Razorpay payment id (also prevents double recording).
ALTER TABLE public.driver_cash_settlements ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'cash';
ALTER TABLE public.driver_cash_settlements ADD COLUMN IF NOT EXISTS razorpay_payment_id text;
CREATE UNIQUE INDEX IF NOT EXISTS driver_cash_settlements_rzp_unique
  ON public.driver_cash_settlements (razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;
ALTER TABLE public.driver_commission_settlements ADD COLUMN IF NOT EXISTS razorpay_payment_id text;
CREATE UNIQUE INDEX IF NOT EXISTS driver_commission_settlements_rzp_unique
  ON public.driver_commission_settlements (razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;
