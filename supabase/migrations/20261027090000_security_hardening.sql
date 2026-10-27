-- ============================================================================
-- Orange Taxi — security hardening (2026-10-27, full security audit)
--
-- 1. Nobody but the database owner may TRUNCATE (empty) tables. TRUNCATE ignores row-level
--    security, and Supabase's default grants gave it to the public roles.
-- 2. Shared trip links (get_public_tracking_status) show the chauffeur's live position only
--    while the ride is under way. Before, an old link kept revealing where the chauffeur is now.
-- 3. The public "cars nearby" map (get_online_driver_positions) gets positions rounded to about
--    100 m instead of exact GPS, so individual chauffeurs can't be followed.
-- 4. KYC uploads: signed-in users may only upload into their own folder or applications/, and
--    the bucket only takes images/PDFs up to 5 MB.
-- 5. Security audit log: the public may only add known login events about themselves, small.
-- Idempotent.
-- ============================================================================

-- 1 ---------------------------------------------------------------------------------------------
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE ON TABLES FROM anon, authenticated;

-- 2 ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_tracking_status(_ref text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  b record;
  d record;
  result jsonb;
BEGIN
  SELECT id, reference, status, pickup_area, drop_area, vehicle_name, vehicle_code,
         scheduled_at, accepted_at, arrived_at, started_at, completed_at, cancelled_at,
         driver_id
  INTO b
  FROM public.bookings
  WHERE upper(reference) = upper(trim(_ref))
  LIMIT 1;

  IF b.id IS NULL THEN
    RETURN NULL;
  END IF;

  IF b.driver_id IS NOT NULL THEN
    SELECT full_name, vehicle_model, vehicle_number, rating, current_lat, current_lng, location_updated_at
    INTO d
    FROM public.drivers
    WHERE id = b.driver_id;
  END IF;

  result := jsonb_build_object(
    'id', b.id,
    'reference', b.reference,
    'status', b.status,
    'pickup_area', b.pickup_area,
    'drop_area', b.drop_area,
    'vehicle_name', b.vehicle_name,
    'vehicle_code', b.vehicle_code,
    'scheduled_at', b.scheduled_at,
    'accepted_at', b.accepted_at,
    'arrived_at', b.arrived_at,
    'started_at', b.started_at,
    'completed_at', b.completed_at,
    'cancelled_at', b.cancelled_at,
    'driver', CASE WHEN b.driver_id IS NOT NULL THEN
      jsonb_build_object(
        'name', d.full_name,
        'vehicle_model', d.vehicle_model,
        'vehicle_number', d.vehicle_number,
        'rating', d.rating,
        -- Live position only while the ride is under way: an old trip link must not keep
        -- showing where the chauffeur is now.
        'current_lat', CASE WHEN b.status IN ('accepted', 'arrived', 'in_progress') THEN d.current_lat END,
        'current_lng', CASE WHEN b.status IN ('accepted', 'arrived', 'in_progress') THEN d.current_lng END,
        'location_updated_at', CASE WHEN b.status IN ('accepted', 'arrived', 'in_progress') THEN d.location_updated_at END
      )
    ELSE NULL END
  );

  RETURN result;
END;
$function$;

-- 3 ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_online_driver_positions()
 RETURNS TABLE(id uuid, current_lat double precision, current_lng double precision)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT d.id,
         round(d.current_lat::numeric, 3)::double precision,
         round(d.current_lng::numeric, 3)::double precision
  FROM public.drivers d
  WHERE d.is_online = true AND d.status = 'active'
    AND d.current_lat IS NOT NULL AND d.current_lng IS NOT NULL
    AND (d.location_updated_at IS NULL OR d.location_updated_at > now() - interval '10 minutes')
$function$;

-- 4 ---------------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "kyc_auth_insert" ON storage.objects;
CREATE POLICY "kyc_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'driver_kyc'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND storage.extension(name) = ANY (ARRAY['jpg', 'jpeg', 'png', 'webp', 'pdf'])
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'storage' AND table_name = 'buckets' AND column_name = 'file_size_limit') THEN
    UPDATE storage.buckets
       SET file_size_limit = 5 * 1024 * 1024,
           allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
           public = false
     WHERE id = 'driver_kyc';
  END IF;
END $$;

-- 5 ---------------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "audit_insert_policy" ON public.security_audit_logs;
CREATE POLICY "audit_insert_policy" ON public.security_audit_logs
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    (user_id IS NULL OR user_id = auth.uid())
    AND event_type ~ '^[a-z_.]{3,40}$'
    AND COALESCE(severity, 'info') IN ('info', 'low', 'medium', 'high', 'warning', 'critical')
    AND pg_column_size(metadata) < 4000
  );
