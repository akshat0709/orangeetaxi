-- ======================================================================
-- Leftover live-only policies (the live base schema used other names; the repo chain never drops them)
-- ======================================================================
-- Wide-open fleet policies: anyone, signed in or not, could read and change fleet_vehicles.
DROP POLICY IF EXISTS "Allow all on fleet_vehicles" ON public.fleet_vehicles;
DROP POLICY IF EXISTS "Allow authenticated users to insert" ON public.fleet_vehicles;
DROP POLICY IF EXISTS "Allow authenticated users to update" ON public.fleet_vehicles;
DROP POLICY IF EXISTS "Allow public read access" ON public.fleet_vehicles;
-- Any driver could read every customer's profile.
DROP POLICY IF EXISTS "profiles read" ON public.profiles;
DROP POLICY IF EXISTS "profiles update" ON public.profiles;
-- Replaced by the repo's base policies below (same intent, plus the integrity triggers).
DROP POLICY IF EXISTS "Drivers can update own record" ON public.drivers;
DROP POLICY IF EXISTS "drivers self update" ON public.drivers;
DROP POLICY IF EXISTS "admin manage drivers" ON public.drivers;
DROP POLICY IF EXISTS "Admin manage enquiries" ON public.corporate_enquiries;
DROP POLICY IF EXISTS "Anyone can insert enquiries" ON public.corporate_enquiries;
DROP POLICY IF EXISTS "Admin manage applications" ON public.driver_applications;
DROP POLICY IF EXISTS "Anyone can insert applications" ON public.driver_applications;
DROP POLICY IF EXISTS "admin manage pricing" ON public.pricing_settings;
DROP POLICY IF EXISTS "pricing readable by all" ON public.pricing_settings;
DROP POLICY IF EXISTS "admin manage areas" ON public.service_areas;
DROP POLICY IF EXISTS "areas readable by all" ON public.service_areas;
DROP POLICY IF EXISTS "roles readable by self and admin" ON public.user_roles;
DROP POLICY IF EXISTS "admin manage vehicles" ON public.vehicle_categories;
DROP POLICY IF EXISTS "vehicles readable by all" ON public.vehicle_categories;

-- Base-schema policies and updated_at triggers (copied from 20260907032549)
-- @@BASE@@

-- ======================================================================
-- Column compatibility: inserts from the apps omit these, so give them the repo's defaults
-- ======================================================================
ALTER TABLE public.drivers ALTER COLUMN phone SET DEFAULT '';
ALTER TABLE public.drivers ALTER COLUMN city SET DEFAULT '';
ALTER TABLE public.drivers ALTER COLUMN vehicle_model SET DEFAULT '';
ALTER TABLE public.drivers ALTER COLUMN vehicle_number SET DEFAULT '';
ALTER TABLE public.vehicle_categories ALTER COLUMN seats SET DEFAULT 4;
-- delete_user_account() sets profiles.phone to NULL when anonymising.
ALTER TABLE public.profiles ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN full_name DROP NOT NULL;
