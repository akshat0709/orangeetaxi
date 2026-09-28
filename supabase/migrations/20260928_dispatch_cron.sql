-- Run this in Supabase dashboard SQL editor to enable scheduled dispatch
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'dispatch-scheduled-rides',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ndaollycrvlawemhwvky.supabase.co/functions/v1/dispatch-scheduled-rides',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
