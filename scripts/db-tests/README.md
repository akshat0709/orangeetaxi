# Database behaviour tests

Replays every file in `supabase/migrations/` (in filename order) into [PGlite](https://pglite.dev)
— Postgres compiled to WebAssembly — with a small stand-in for Supabase's `auth`, `storage` and
API roles (`supabase_shim.sql`). Each test then acts as `anon`, a rider or a driver under RLS and
checks the rules the apps rely on.

```bash
npm run test:db          # from the repo root
```

Limits: this is the repo's migration chain, not a dump of the live project (they differ — some
columns the apps use are added in `DRIFT` because no migration creates them). Re-baseline with
`supabase db pull` and re-run before applying anything to production.

## Live-project catch-up (`CATCHUP=1`)

`fixtures/live_schema_2026-10-25.sql` is the live project's `supabase db dump` (structure only, no
data). `fixtures/live_rows.sql` adds synthetic rows shaped like live data. With `CATCHUP=1` the suite
starts from those, applies `supabase/catch-up/production_catch_up.sql` plus the two audit migrations
in a single transaction (as `psql --single-transaction` would), then runs every test, plus checks
that legacy rows survive, prices are untouched, legacy rides can be rated and legacy drivers can work.
