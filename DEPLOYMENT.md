# Deploying Orange Taxi (web + Supabase)

The website is a TanStack Start app built by Vite/Nitro for Cloudflare Workers (`wrangler.json`).
The Rider and Driver apps (separate repos) use the same Supabase project.

## 1. Server environment variables

Set these as Worker secrets/vars (never in source):

| Variable                                             | Used for                                                                                               | Required                |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser + server Supabase access                                                                       | yes                     |
| `SUPABASE_SERVICE_ROLE_KEY`                          | Payment settlement and wallet credits (`/api/settle-razorpay-payment`, `/api/wallet-topup/*`, webhook) | yes for online payments |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`             | Creating orders, verifying and capturing payments                                                      | yes for online payments |
| `RAZORPAY_WEBHOOK_SECRET`                            | Verifying `/api/razorpay-webhook` (the endpoint refuses to run without it)                             | yes                     |
| `RESEND_API_KEY`                                     | Invoice emails (`/api/send-invoice`)                                                                   | for invoice email       |
| `VITE_GOOGLE_MAPS_API_KEY`                           | Maps in the browser                                                                                    | yes                     |

Without the Razorpay variables, online payment is shown as unavailable (cash still works). There is no
test-key fallback.

## 2. Database (Supabase)

Order matters. Back up first (`supabase db dump`).

1. `supabase db pull` and compare with `supabase/migrations/` — the repo had drifted from production.
2. Run `npm run test:db` (replays every migration in PGlite and checks RLS, triggers and RPCs).
3. Apply to **staging**, test, then production: `supabase db push` applies
   - `20261025120000_audit_remediation.sql`
   - `20261025130000_audit_remediation_2.sql`
4. Deploy the edge function: `supabase functions deploy dispatch-scheduled-rides`.
5. Scheduled dispatch cron: store the service-role key in Vault, then run
   `supabase/deferred/scheduled_dispatch_cron.sql` (the old cron sent a placeholder key).

### Dashboard settings (not expressible as migrations)

- **Realtime → Settings:** turn off "Allow public access" once the updated apps are live (ride chat
  now uses private channels).
- **Auth → Rate limits:** keep sign-in / OTP limits enabled; the apps' lockout counters are cosmetic.
- **Storage:** `driver_kyc` must stay private.
- **Razorpay dashboard:** webhook URL `https://orange-taxi.com/api/razorpay-webhook`, event
  `payment.captured`, same secret as `RAZORPAY_WEBHOOK_SECRET`.
- **Google Cloud:** restrict the Maps keys (Android package + SHA-1 for the SDK key; API and HTTP
  referrer restrictions for web keys).

## 3. Rollout order

1. Database migrations (backwards-compatible with current app builds).
2. Website (`npm run build`, deploy `.output`).
3. Rider and Driver app builds (EAS). Set `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` and `EXPO_PUBLIC_WEB_URL`
   as EAS secrets.
4. When old app builds are retired (force update), apply
   `supabase/deferred/phase2_lock_down_after_app_update.sql`: moves the ride OTP out of `bookings`,
   limits riders to `get_assigned_driver()`, and clears Aadhaar from the operational driver record
   (copied to `driver_kyc_private` first). Verify with `npm run test:db:phase2`.

## 4. Known accepted advisory

`npm audit --omit=dev` reports one high advisory: zod < 4.6.6 (GHSA-mrhx-c7xc-m3w5, memory use when
validating oversized constrained collections). zod 3 is used only for browser-side form validation and
nested zod 4 copies are build-time TanStack tooling; neither validates untrusted server input. The fix is
a major upgrade (zod 4) — schedule it with the TanStack update. CI fails on critical advisories.

## 5. Checks before every deploy (also run in CI)

```bash
npm ci
npx eslint .                   # 0 errors required
npx tsc --noEmit -p tsconfig.json
npm test                       # payment settlement unit tests
npm run test:db                # database behaviour (PGlite)
npm run build
```
