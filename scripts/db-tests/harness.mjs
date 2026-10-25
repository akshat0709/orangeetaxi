// Replays an Orange Taxi backend schema in PGlite and exercises it as real app roles.
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);

export async function makeDb(sqlFiles, { drift = "" } = {}) {
  const db = new PGlite();
  await db.exec(fs.readFileSync(path.join(here, "supabase_shim.sql"), "utf8"));
  for (const f of sqlFiles) {
    try {
      await db.exec(
        fs
          .readFileSync(f, "utf8")
          .replace(
            /CREATE EXTENSION IF NOT EXISTS "(uuid-ossp|pgcrypto)";/g,
            "-- (extension not needed: gen_random_uuid is core)",
          ),
      );
    } catch (e) {
      // Record and continue: mirrors a file that failed (and was rolled back) on the live project.
      db.failedFiles = [...(db.failedFiles || []), `${path.basename(f)}: ${e.message}`];
      console.log(`SKIP ${path.basename(f)} -> ${e.message}`);
    }
  }
  if (drift) await db.exec(drift);
  return db;
}

/** Run `sql` as a Supabase API caller: role 'anon' | 'authenticated', with JWT sub = uid. */
export async function as(db, role, uid, sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.query(
      `SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', $2, true)`,
      [uid || "", role],
    );
    await tx.exec(`SET LOCAL ROLE ${role}`);
    const res = await tx.query(sql, params);
    return res.rows;
  });
}

/** Same as `as` but returns {ok, rows|error} instead of throwing. */
export async function attempt(db, role, uid, sql, params = []) {
  try {
    return { ok: true, rows: await as(db, role, uid, sql, params) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function su(db, sql, params = []) {
  return (await db.query(sql, params)).rows;
}
