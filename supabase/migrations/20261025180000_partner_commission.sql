-- ============================================================================
-- Orange Taxi — commission (partner) drivers in one place (2026-10-26)
--
-- Owner request (2026-10-26): everything about a commission driver belongs in the Commission
-- Ledger, and nowhere else (not in company cash settlements).
--
--   * drivers.driver_type is the single source of truth ('partner' = commission driver). Until now
--     the admin "switch type" button only changed the plate/model and kept the choice in one
--     browser's storage, so different screens (and different admins) disagreed.
--   * The commission rate is an admin setting (Admin → Pricing), not a hard-coded 15%.
--   * Commission settlements record a direction: the driver paying the company its commission
--     (cash rides), or the company paying the driver their share (online / wallet rides).
-- Idempotent.
-- ============================================================================

ALTER TABLE public.pricing_settings ADD COLUMN IF NOT EXISTS partner_commission_percent numeric NOT NULL DEFAULT 15;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pricing_settings_commission_sane') THEN
    ALTER TABLE public.pricing_settings ADD CONSTRAINT pricing_settings_commission_sane
      CHECK (partner_commission_percent BETWEEN 0 AND 60);
  END IF;
END $$;

ALTER TABLE public.drivers DROP CONSTRAINT IF EXISTS drivers_driver_type_check;
ALTER TABLE public.drivers ADD CONSTRAINT drivers_driver_type_check CHECK (driver_type IN ('company', 'partner'));

ALTER TABLE public.driver_commission_settlements
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'driver_to_company';
ALTER TABLE public.driver_commission_settlements DROP CONSTRAINT IF EXISTS driver_commission_settlements_direction_check;
ALTER TABLE public.driver_commission_settlements ADD CONSTRAINT driver_commission_settlements_direction_check
  CHECK (direction IN ('driver_to_company', 'company_to_driver'));

-- Drivers already marked as partners the old ways become partners in the database.
DO $$
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  UPDATE public.drivers d SET driver_type = 'partner'
   WHERE d.driver_type <> 'partner'
     AND (COALESCE(d.vehicle_code, '') LIKE '%"type":"partner"%'
          OR EXISTS (SELECT 1 FROM public.partner_vehicles pv WHERE pv.driver_id = d.id));
END $$;
