-- ============================================================================
-- Orange Taxi — driver application fields (2026-10-26, code review)
--
-- The Drive page sends the applicant's type and vehicle details, but driver_applications had no
-- columns for them: every submission failed once and was retried without them (details squeezed
-- into admin_notes JSON), and Admin / the driver console read fields that never existed.
-- Idempotent.
-- ============================================================================
ALTER TABLE public.driver_applications ADD COLUMN IF NOT EXISTS driver_type text NOT NULL DEFAULT 'company';
ALTER TABLE public.driver_applications DROP CONSTRAINT IF EXISTS driver_applications_driver_type_check;
ALTER TABLE public.driver_applications ADD CONSTRAINT driver_applications_driver_type_check
  CHECK (driver_type IN ('company', 'partner'));
ALTER TABLE public.driver_applications ADD COLUMN IF NOT EXISTS vehicle_model text;
ALTER TABLE public.driver_applications ADD COLUMN IF NOT EXISTS vehicle_number text;
ALTER TABLE public.driver_applications ADD COLUMN IF NOT EXISTS chassis_number text;
ALTER TABLE public.driver_applications ADD COLUMN IF NOT EXISTS vehicle_year text;
