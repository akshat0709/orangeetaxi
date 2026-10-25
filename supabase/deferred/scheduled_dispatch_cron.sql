-- ============================================================================
-- Scheduled-ride dispatch cron, without a key in source control.
--
-- 20260928_dispatch_cron.sql scheduled the job with the literal header
-- "Bearer YOUR_SERVICE_ROLE_KEY", so every call to dispatch-scheduled-rides was
-- rejected and scheduled rides were never dispatched.
--
-- One-time setup (SQL editor, run as postgres) — store the key in Vault:
--   SELECT vault.create_secret('<service role key>', 'dispatch_service_role_key');
-- Then run this file.
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$ BEGIN
  PERFORM cron.unschedule('dispatch-scheduled-rides');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'dispatch-scheduled-rides',
  '*/5 * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://ndaollycrvlawemhwvky.supabase.co/functions/v1/dispatch-scheduled-rides',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'dispatch_service_role_key')
    ),
    body := '{}'::jsonb
  );
  $job$
);
