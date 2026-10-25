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
