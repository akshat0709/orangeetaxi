-- Migration: Create partner commission settlements, partner vehicles, and cash settlements
-- Ensures live backend storage for Commission Ledger and Partner Fleet management

-- 1. Commission Settlements Table (for Partner 15% Platform Commission)
CREATE TABLE IF NOT EXISTS public.driver_commission_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES public.drivers(id) ON DELETE CASCADE,
  driver_name text,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_mode text NOT NULL DEFAULT 'upi',
  reference_no text,
  collected_by text DEFAULT 'Admin',
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_comm_settle_driver_id ON public.driver_commission_settlements(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_comm_settle_created ON public.driver_commission_settlements(created_at DESC);

ALTER TABLE public.driver_commission_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read on driver_commission_settlements"
ON public.driver_commission_settlements FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Allow authenticated insert on driver_commission_settlements"
ON public.driver_commission_settlements FOR INSERT
TO authenticated, anon
WITH CHECK (true);

CREATE POLICY "Allow authenticated delete on driver_commission_settlements"
ON public.driver_commission_settlements FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- 2. Partner Vehicles Table (for Driver Owner-Operators bringing their EV)
CREATE TABLE IF NOT EXISTS public.partner_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_number text UNIQUE NOT NULL,
  chassis_number text,
  model text NOT NULL,
  year text DEFAULT '2024',
  color text DEFAULT 'Signature Orange',
  owner_name text NOT NULL,
  owner_phone text NOT NULL,
  owner_email text,
  status text DEFAULT 'active',
  certified_standard boolean DEFAULT true,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_vehicles_plate ON public.partner_vehicles(plate_number);
CREATE INDEX IF NOT EXISTS idx_partner_vehicles_driver_id ON public.partner_vehicles(driver_id);

ALTER TABLE public.partner_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on partner_vehicles"
ON public.partner_vehicles FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Allow public manage on partner_vehicles"
ON public.partner_vehicles FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);

-- 3. Driver Cash Settlements Table (for Company Fleet Cash Surrender)
CREATE TABLE IF NOT EXISTS public.driver_cash_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES public.drivers(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  collected_by text DEFAULT 'Admin',
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_cash_settle_driver_id ON public.driver_cash_settlements(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_cash_settle_created ON public.driver_cash_settlements(created_at DESC);

ALTER TABLE public.driver_cash_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on driver_cash_settlements"
ON public.driver_cash_settlements FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);
