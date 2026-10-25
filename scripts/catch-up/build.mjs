// Builds supabase/catch-up/production_catch_up.sql: the repo migrations that the live project never
// received, made safe to run on the live schema (idempotent, no price/seed changes). Run: node scripts/catch-up/build.mjs
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const migDir = path.join(root, "supabase/migrations");

// Not replayed: 20260907032549 is the base schema the live project already has; dispatch_cron needs
// pg_cron + a Vault secret (supabase/deferred/scheduled_dispatch_cron.sql); migrations from
// 20261025120000 on are applied after this file, unchanged.
// Migrations from AFTER_CATCHUP on are applied after this file, unchanged (see DEPLOYMENT.md).
export const AFTER_CATCHUP = "20261025120000";
const SKIP = [/^20260907032549_/, /^20260928_dispatch_cron/];

function patch(name, sql) {
  let out = sql;
  // Realtime publication membership: the live project already publishes bookings/drivers.
  out = out.replace(
    /ALTER PUBLICATION supabase_realtime ADD TABLE (public\.\w+);/g,
    (_, t) =>
      `DO $pub$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname||'.'||tablename='${t}') THEN ALTER PUBLICATION supabase_realtime ADD TABLE ${t}; END IF; END $pub$;`,
  );
  // Policies may already exist under the same name on the live project: replace them.
  out = out.replace(
    /CREATE POLICY\s+("[^"]+"|\w+)\s+ON\s+([\w."]+)/g,
    (m, pol, tbl) => `DROP POLICY IF EXISTS ${pol} ON ${tbl};\n${m}`,
  );
  if (name.startsWith("20261015_mandatory_privacy_and_security")) {
    // The live has_role() names its first parameter _user; Postgres can't rename it in place
    // (policies depend on the function), so keep the live parameter name.
    out = out.replace(
      /CREATE OR REPLACE FUNCTION public\.has_role\(_user_id uuid[\s\S]*?\n\$\$;/,
      (fn) => fn.replace(/_user_id/g, "_user"),
    );
    if (!/has_role\(_user uuid/.test(out)) throw new Error("has_role patch did not apply");
    // Business data, not schema: leave the live vehicle categories and prices exactly as they are.
    const a = out.indexOf("-- 10. Commercial Pricing & Fleet Synchronization");
    const b = out.indexOf("-- 11. Booking Insertion Integrity Trigger");
    if (a < 0 || b < 0) throw new Error("pricing block markers not found in " + name);
    out =
      out.slice(0, a) +
      "-- (catch-up: vehicle category seed/deactivation skipped; live prices are kept)\n\n" +
      out.slice(b);
  }
  return out;
}

const files = fs
  .readdirSync(migDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();
let body = "";
for (const f of files) {
  if (SKIP.some((r) => r.test(f)) || f >= AFTER_CATCHUP) continue;
  const sql = fs.readFileSync(path.join(migDir, f), "utf8");
  body += `\n-- ======================================================================\n-- ${f}\n-- ======================================================================\n${patch(f, sql)}\n`;
}

const header = fs.readFileSync(path.join(root, "scripts/catch-up/header.sql"), "utf8");
// Base-schema policies/triggers from 20260907032549 that the live project has under other names.
const base = fs.readFileSync(
  fs
    .readdirSync(migDir)
    .filter((f) => f.startsWith("20260907032549_"))
    .map((f) => path.join(migDir, f))[0],
  "utf8",
);
const BASE_POLICIES = [
  "own profile write",
  "own profile update",
  "read own roles",
  "categories public read",
  "categories admin write",
  "areas public read",
  "areas admin write",
  "pricing public read",
  "pricing admin write",
  "driver updates own",
  "admin deletes drivers",
  "anyone can apply",
  "admin reads applications",
  "admin updates applications",
  "admin deletes applications",
  "anyone can enquire",
  "admin reads enquiries",
  "admin updates enquiries",
  "admin deletes enquiries",
];
const BASE_TRIGGERS = [
  "profiles_updated",
  "vc_updated",
  "ps_updated",
  "drivers_updated",
  "da_updated",
  "ce_updated",
  "bookings_updated",
];
const pick = (re, what) => {
  const m = base.match(re);
  if (!m) throw new Error("base statement not found: " + what);
  return m[0];
};
let baseSql = "";
for (const n of BASE_POLICIES) {
  const stmt = pick(new RegExp(`CREATE POLICY "${n}" ON ([\\w.]+)[\\s\\S]*?;`), n);
  const tbl = stmt.match(/ON ([\w.]+)/)[1];
  baseSql += `DROP POLICY IF EXISTS "${n}" ON ${tbl};\n${stmt}\n`;
}
for (const t of BASE_TRIGGERS) {
  const stmt = pick(new RegExp(`CREATE TRIGGER ${t} [\\s\\S]*?;`), t);
  const tbl = stmt.match(/ON ([\w.]+)/)[1];
  baseSql += `DROP TRIGGER IF EXISTS ${t} ON ${tbl};\n${stmt}\n`;
}
const footer = fs
  .readFileSync(path.join(root, "scripts/catch-up/footer.sql"), "utf8")
  .replace("-- @@BASE@@", baseSql);
const outPath = path.join(root, "supabase/catch-up/production_catch_up.sql");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, header + body + "\n" + footer);
console.log("wrote", path.relative(root, outPath));
