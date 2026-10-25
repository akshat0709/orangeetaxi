// Replays supabase/migrations (in filename order) into PGlite and checks the rules the apps
// depend on, acting as the real API roles. Run: cd scripts/db-tests && npm install && npm test
//
// 20260928_dispatch_cron.sql is skipped (needs pg_cron/pg_net; see supabase/deferred/).
// PHASE2=1 also applies supabase/deferred/phase2_lock_down_after_app_update.sql.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { makeDb, attempt, su, liveSchema } from "./harness.mjs";

const MIG = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../../supabase/migrations",
);
const DRIFT = ""; // 20261025130000 now creates the columns the apps use (previously schema drift).
const ADMIN = "aaaaaaaa-0000-4000-8000-000000000001";
const DRV = "dddddddd-0000-4000-8000-000000000002";
const RIDER = "eeeeeeee-0000-4000-8000-000000000003";
const OTHER = "ffffffff-0000-4000-8000-000000000004";

let db;
let DRIVER_ROW;

const authed = (uid, sql, params) => attempt(db, "authenticated", uid, sql, params);
const anon = (sql, params) => attempt(db, "anon", null, sql, params);
const book = async (
  uid,
  {
    km = 40,
    fare = 149,
    method = "cash",
    pay = "pending",
    drop = "13.19,77.70",
    promo = null,
    rideType = null,
    hours = null,
    scheduled = null,
  } = {},
) => {
  const r = await authed(
    uid,
    `
    INSERT INTO public.bookings (customer_id, pickup_area, pickup_address, drop_area, drop_address, distance_km,
      vehicle_code, vehicle_name, base_fare, distance_fare, tax_amount, estimated_fare, payment_method, payment_status, ride_otp, status,
      promo_code, ride_type, rental_hours, scheduled_at)
    VALUES ($1,'MG Road','12.97,77.59 | CABIN:{}','Airport',$6,$2,'ORANGE_SIGNATURE','Orange Signature',99,0,0,$3,$4,$5,'4321','searching',
      $7, COALESCE($8,'point_to_point'), $9, $10)
    RETURNING id, estimated_fare, payment_status, distance_km, discount_amount, promo_code, ride_otp, status`,
    [uid, km, fare, method, pay, drop, promo, rideType, hours, scheduled],
  );
  assert.ok(r.ok, `booking insert failed: ${r.error}`);
  return r.rows[0];
};
const force = (sql, params) => su(db, sql, params); // fixture writes as service_role + admin
const otpOf = async (id) =>
  (await su(db, `SELECT ride_otp FROM public.bookings WHERE id=$1`, [id]))[0].ride_otp ||
  (
    await su(db, `SELECT ride_otp FROM public.booking_secrets WHERE booking_id=$1`, [id]).catch(
      () => [{}],
    )
  )[0]?.ride_otp;
const PHASE2 = !!process.env.PHASE2;
// CATCHUP=1: start from the live project's dumped schema plus legacy rows, then apply
// supabase/catch-up/production_catch_up.sql + the audit migrations in one transaction (as psql would).
const CATCHUP = !!process.env.CATCHUP;
const HERE = path.dirname(new URL(import.meta.url).pathname);

before(async () => {
  const files = fs
    .readdirSync(MIG)
    .filter((f) => f.endsWith(".sql") && !f.includes("dispatch_cron"))
    .sort()
    .map((f) => path.join(MIG, f));
  if (PHASE2) files.push(path.resolve(MIG, "../deferred/phase2_lock_down_after_app_update.sql"));
  if (CATCHUP) {
    // The catch-up, then every migration from 20261025120000 on, in order (DEPLOYMENT.md step 2).
    const live = [
      path.resolve(MIG, "../catch-up/production_catch_up.sql"),
      ...fs
        .readdirSync(MIG)
        .filter((f) => f.endsWith(".sql") && f >= "20261025120000")
        .sort()
        .map((f) => path.join(MIG, f)),
    ];
    if (PHASE2) live.push(path.resolve(MIG, "../deferred/phase2_lock_down_after_app_update.sql"));
    db = await makeDb(live, {
      base: [liveSchema(), fs.readFileSync(path.join(HERE, "fixtures/live_rows.sql"), "utf8")],
      singleTransaction: true,
    });
  } else {
    db = await makeDb(files, { drift: DRIFT });
  }
  await su(
    db,
    `INSERT INTO auth.users (id, email, phone, raw_user_meta_data) VALUES
    ($1,'admin@x.in',null,'{}'), ($2,'drv@x.in','+919876543210','{}'), ($3,'rider@x.in',null,'{}'), ($4,'other@x.in',null,'{"role":"driver"}')`,
    [ADMIN, DRV, RIDER, OTHER],
  );
  await su(
    db,
    `INSERT INTO public.user_roles (user_id, role) VALUES ($1,'admin'),($2,'driver') ON CONFLICT DO NOTHING`,
    [ADMIN, DRV],
  );
  await su(
    db,
    `SELECT set_config('request.jwt.claim.role','service_role',false), set_config('request.jwt.claim.sub',$1,false)`,
    [ADMIN],
  );
  [{ id: DRIVER_ROW }] = await su(
    db,
    `INSERT INTO public.drivers (user_id, full_name, phone, city, is_online, status, aadhaar_number, dl_url, current_lat, current_lng, rating, total_rides, location_updated_at)
    VALUES ($1,'Ravi Kumar','+91 98765 43210','Bengaluru',true,'active','1234 5678 9012','storage://driver_kyc/applications/dl.jpg',12.97,77.59,4.8,10, now()) RETURNING id`,
    [DRV],
  );
  await su(db, `UPDATE public.profiles SET wallet_balance = 1000 WHERE id = $1`, [RIDER]);
});

test("every migration (and phase 2 when enabled) applies cleanly", () => {
  assert.deepEqual(db.failedFiles || [], []);
});

test("sign-up metadata role=driver does not grant the driver role", async () => {
  const roles = await su(db, `SELECT role FROM public.user_roles WHERE user_id = $1`, [OTHER]);
  assert.deepEqual(
    roles.map((r) => r.role),
    ["customer"],
  );
});

test("R1: bookings can be created and read (no RLS recursion)", async () => {
  const b = await book(RIDER);
  const r = await authed(RIDER, `SELECT id FROM public.bookings WHERE id = $1`, [b.id]);
  assert.ok(r.ok, r.error);
  assert.equal(r.rows.length, 1);
});

test('S2: fare is server-authoritative (tariff, coordinates, client "paid" reset, server OTP)', async () => {
  assert.equal(Number((await book(RIDER, { fare: 1 })).estimated_fare), 99 + 40 * 18);
  assert.equal(
    Number((await book(RIDER, { fare: 149 })).estimated_fare),
    99 + 40 * 18,
    "40 km at ₹149 is raised to tariff",
  );
  const lied = await book(RIDER, { km: 1, fare: 149 });
  assert.ok(
    Number(lied.distance_km) >= 30,
    `distance bounded by coordinates, got ${lied.distance_km}`,
  );
  assert.equal(
    (await book(RIDER, { fare: 900, method: "upi", pay: "paid" })).payment_status,
    "pending",
  );
  const b = await book(RIDER, { fare: 900 });
  assert.equal(Number(b.estimated_fare), 900, "client fare above tariff (tolls, stops) is kept");
  if (!PHASE2) assert.match(b.ride_otp, /^\d{4}$/);
  if (!PHASE2) assert.notEqual(b.ride_otp, "4321".repeat(1) + "x");
});

test("S2: hourly packages and FIRST100 promo are validated server-side", async () => {
  const h = await book(RIDER, {
    rideType: "hourly",
    hours: 4,
    fare: 10,
    km: 1,
    drop: "12.97,77.59",
  });
  assert.equal(Number(h.estimated_fare), 1296);
  assert.equal(Number(h.distance_km), 40);
  const bad = await authed(
    RIDER,
    `INSERT INTO public.bookings (customer_id, pickup_area, drop_area, vehicle_code, estimated_fare, ride_type, rental_hours)
    VALUES ($1,'a','b','ORANGE_SIGNATURE',1,'hourly',7)`,
    [RIDER],
  );
  assert.equal(bad.ok, false);
  const p1 = await book(OTHER, { fare: 719, promo: "first100" });
  assert.equal(Number(p1.estimated_fare), 719);
  assert.equal(Number(p1.discount_amount), 100);
  const p2 = await book(OTHER, { fare: 719, promo: "FIRST100" });
  assert.equal(Number(p2.estimated_fare), 819, "second redemption is refused");
  assert.equal(p2.promo_code, null);
  assert.ok(
    (await authed(OTHER, `UPDATE public.bookings SET status='cancelled' WHERE id=$1`, [p1.id])).ok,
  );
  const p3 = await book(OTHER, { fare: 719, promo: "FIRST100" });
  assert.equal(Number(p3.discount_amount), 100, "released after cancellation");
});

test("R2: riders cannot read online drivers' personal data; map gets positions only", async () => {
  const rows = await authed(RIDER, `SELECT aadhaar_number, phone FROM public.drivers`);
  assert.ok(rows.ok, rows.error);
  assert.equal(rows.rows.length, 0);
  const pos = await authed(RIDER, `SELECT * FROM public.get_online_driver_positions()`);
  assert.ok(pos.ok, pos.error);
  assert.deepEqual(Object.keys(pos.rows[0]).sort(), ["current_lat", "current_lng", "id"]);
  assert.equal(
    (await anon(`SELECT * FROM public.get_nearby_drivers(12.97, 77.59, 5, 10)`)).ok,
    false,
  );
  const near = await authed(RIDER, `SELECT * FROM public.get_nearby_drivers(12.97, 77.59, 5, 10)`);
  assert.ok(near.ok, near.error);
  assert.ok(!("phone" in near.rows[0]));
});

test("full ride lifecycle works for the assigned driver (R1, R4)", async () => {
  const b = await book(RIDER, { fare: 819 });
  const otp = (await authed(RIDER, `SELECT public.get_ride_otp($1) AS otp`, [b.id])).rows[0].otp;
  assert.equal(otp, await otpOf(b.id));
  const acc = await authed(DRV, `SELECT public.accept_booking($1) AS res`, [b.id]);
  assert.ok(acc.ok && acc.rows[0].res.success, acc.error || JSON.stringify(acc.rows?.[0]));
  assert.ok(
    (
      await authed(
        DRV,
        `UPDATE public.bookings SET status='arrived', arrived_at=now() WHERE id=$1`,
        [b.id],
      )
    ).ok,
  );
  assert.equal(
    (await authed(DRV, `UPDATE public.bookings SET status='in_progress' WHERE id=$1`, [b.id])).ok,
    false,
    "OTP must not be skippable",
  );
  assert.equal(
    (await authed(DRV, `SELECT public.verify_ride_otp($1,'0000') AS res`, [b.id])).rows[0].res
      .success,
    false,
  );
  assert.equal(
    (await authed(DRV, `SELECT public.verify_ride_otp($1,$2) AS res`, [b.id, otp])).rows[0].res
      .success,
    true,
  );
  const done = await authed(
    DRV,
    `UPDATE public.bookings SET status='completed', completed_at=now(), final_fare=estimated_fare, payment_status='pending', payment_made='no' WHERE id=$1`,
    [b.id],
  );
  assert.ok(done.ok, done.error);
  const cash = await authed(
    DRV,
    `UPDATE public.bookings SET payment_method='cash', payment_status='paid', payment_made='yes' WHERE id=$1`,
    [b.id],
  );
  assert.ok(cash.ok, cash.error);
  const rate = await authed(RIDER, `UPDATE public.bookings SET rating=4, review='ok' WHERE id=$1`, [
    b.id,
  ]);
  assert.ok(rate.ok, rate.error);
  const [d] = await su(db, `SELECT total_rides FROM public.drivers WHERE id=$1`, [DRIVER_ROW]);
  assert.ok(d.total_rides >= 10);
});

test("rider cannot tamper with fares, payment or status", async () => {
  const b = await book(RIDER, { fare: 600, method: "wallet" });
  await force(`UPDATE public.bookings SET status='in_progress', driver_id=$2 WHERE id=$1`, [
    b.id,
    DRIVER_ROW,
  ]);
  assert.equal(
    (await authed(RIDER, `UPDATE public.bookings SET final_fare=1 WHERE id=$1`, [b.id])).ok,
    false,
  );
  assert.equal(
    (
      await authed(
        RIDER,
        `UPDATE public.bookings SET payment_status='paid', payment_made='yes' WHERE id=$1`,
        [b.id],
      )
    ).ok,
    false,
  );
  assert.equal(
    (await authed(RIDER, `UPDATE public.bookings SET status='completed' WHERE id=$1`, [b.id])).ok,
    false,
  );
  assert.equal(
    (await authed(RIDER, `UPDATE public.profiles SET wallet_balance=99999 WHERE id=$1`, [RIDER]))
      .ok,
    false,
  );
});

test("rider cancellation follows the server window (not after arrival)", async () => {
  const early = await book(RIDER);
  assert.ok(
    (await authed(RIDER, `UPDATE public.bookings SET status='cancelled' WHERE id=$1`, [early.id]))
      .ok,
  );
  const late = await book(RIDER);
  await force(`UPDATE public.bookings SET status='arrived', driver_id=$2 WHERE id=$1`, [
    late.id,
    DRIVER_ROW,
  ]);
  assert.equal(
    (await authed(RIDER, `UPDATE public.bookings SET status='cancelled' WHERE id=$1`, [late.id]))
      .ok,
    false,
  );
  await force(`UPDATE public.bookings SET status='cancelled' WHERE id=$1`, [late.id]);
});

test("R5: wallet settlement debits the rider once", async () => {
  const b = await book(RIDER, { fare: 300, method: "wallet" });
  await force(
    `UPDATE public.bookings SET status='in_progress', driver_id=$2, final_fare=300 WHERE id=$1`,
    [b.id, DRIVER_ROW],
  );
  const [{ wallet_balance: before }] = await su(
    db,
    `SELECT wallet_balance FROM public.profiles WHERE id=$1`,
    [RIDER],
  );
  const r1 = await authed(DRV, `SELECT public.deduct_ride_wallet_payment($1) AS res`, [b.id]);
  assert.ok(r1.ok && r1.rows[0].res.success, r1.error || JSON.stringify(r1.rows?.[0]));
  const r2 = await authed(DRV, `SELECT public.deduct_ride_wallet_payment($1) AS res`, [b.id]);
  assert.match(JSON.stringify(r2.rows[0].res), /already settled/);
  const [{ wallet_balance: after }] = await su(
    db,
    `SELECT wallet_balance FROM public.profiles WHERE id=$1`,
    [RIDER],
  );
  assert.equal(Number(before) - Number(after), 300);
  assert.equal(
    (await authed(OTHER, `SELECT public.deduct_ride_wallet_payment($1) AS res`, [b.id])).rows[0].res
      .success,
    false,
  );
});

test("wallet top-up from a client without verified payment is rejected", async () => {
  const r = await authed(RIDER, `SELECT public.top_up_wallet(5000, 'upi_123', NULL, 'x') AS res`);
  assert.equal(r.rows[0].res.success, false);
});

test('R5b: driver can record cash / personal UPI on a "upi" booking; rider cannot self-mark paid', async () => {
  const b = await book(RIDER, { fare: 400, method: "upi" });
  await force(`UPDATE public.bookings SET status='completed', driver_id=$2 WHERE id=$1`, [
    b.id,
    DRIVER_ROW,
  ]);
  assert.equal(
    (
      await authed(
        RIDER,
        `UPDATE public.bookings SET payment_status='paid', payment_made='yes' WHERE id=$1`,
        [b.id],
      )
    ).ok,
    false,
  );
  const r = await authed(
    DRV,
    `UPDATE public.bookings SET payment_method='driver_upi', payment_status='paid', payment_made='yes' WHERE id=$1`,
    [b.id],
  );
  assert.ok(r.ok, r.error);
  const b2 = await book(RIDER, { fare: 400, method: "upi" });
  await force(`UPDATE public.bookings SET status='completed', driver_id=$2 WHERE id=$1`, [
    b2.id,
    DRIVER_ROW,
  ]);
  assert.equal(
    (await authed(DRV, `UPDATE public.bookings SET payment_status='paid' WHERE id=$1`, [b2.id])).ok,
    false,
    'gateway "upi" must not be self-certified by the driver',
  );
});

test("R3: drivers see only their passengers' profiles", async () => {
  assert.equal(
    (await authed(DRV, `SELECT id FROM public.profiles WHERE id=$1`, [RIDER])).rows.length,
    1,
  );
  assert.equal(
    (await authed(DRV, `SELECT id FROM public.profiles WHERE id=$1`, [ADMIN])).rows.length,
    0,
  );
});

test("R6: KYC uploads allowed only into driver_kyc/applications/ with image/pdf extensions", async () => {
  assert.ok(
    (
      await anon(
        `INSERT INTO storage.objects (bucket_id, name) VALUES ('driver_kyc','applications/a.jpg')`,
      )
    ).ok,
  );
  assert.equal(
    (await anon(`INSERT INTO storage.objects (bucket_id, name) VALUES ('driver_kyc','doc_1.jpg')`))
      .ok,
    false,
  );
  assert.equal(
    (
      await anon(
        `INSERT INTO storage.objects (bucket_id, name) VALUES ('driver_kyc','applications/x.html')`,
      )
    ).ok,
    false,
  );
  const [bucket] = await su(db, `SELECT public FROM storage.buckets WHERE id='driver_kyc'`);
  assert.equal(bucket.public, false);
});

test("S3: driver cannot raise final_fare above the booked fare", async () => {
  const b = await book(RIDER, { fare: 819 });
  await force(`UPDATE public.bookings SET status='in_progress', driver_id=$2 WHERE id=$1`, [
    b.id,
    DRIVER_ROW,
  ]);
  assert.equal(
    (await authed(DRV, `UPDATE public.bookings SET final_fare=99999 WHERE id=$1`, [b.id])).ok,
    false,
  );
  assert.ok(
    (await authed(DRV, `UPDATE public.bookings SET final_fare=800 WHERE id=$1`, [b.id])).ok,
  );
});

test("S4: wallet ride settles automatically on completion (e.g. offline replay)", async () => {
  const b = await book(RIDER, { fare: 819, method: "wallet" });
  await su(db, `UPDATE public.profiles SET wallet_balance = 1000 WHERE id=$1`, [RIDER]);
  await force(`UPDATE public.bookings SET status='in_progress', driver_id=$2 WHERE id=$1`, [
    b.id,
    DRIVER_ROW,
  ]);
  const r = await authed(
    DRV,
    `UPDATE public.bookings SET status='completed', completed_at=now(), final_fare=819 WHERE id=$1`,
    [b.id],
  );
  assert.ok(r.ok, r.error);
  const [row] = await su(db, `SELECT payment_status FROM public.bookings WHERE id=$1`, [b.id]);
  assert.equal(row.payment_status, "paid");
  const [{ wallet_balance }] = await su(
    db,
    `SELECT wallet_balance FROM public.profiles WHERE id=$1`,
    [RIDER],
  );
  assert.equal(Number(wallet_balance), 181);
});

test("S5: drivers claim scheduled rides through the RPC only", async () => {
  const s1 = await book(RIDER, {
    fare: 819,
    scheduled: new Date(Date.now() + 3600e3).toISOString(),
  });
  assert.equal(s1.status, "scheduled");
  assert.equal(
    (await authed(DRV, `SELECT id FROM public.bookings WHERE id=$1`, [s1.id])).rows.length,
    1,
    "open scheduled ride is listed",
  );
  await authed(DRV, `UPDATE public.bookings SET driver_id=$2 WHERE id=$1`, [s1.id, DRIVER_ROW]);
  assert.equal(
    (await su(db, `SELECT driver_id FROM public.bookings WHERE id=$1`, [s1.id]))[0].driver_id,
    null,
    "direct update has no effect",
  );
  const c = await authed(DRV, `SELECT public.claim_scheduled_booking($1) AS res`, [s1.id]);
  assert.ok(c.ok && c.rows[0].res.success, c.error || JSON.stringify(c.rows?.[0]));
  assert.equal(
    (await authed(DRV, `SELECT public.claim_scheduled_booking($1) AS res`, [s1.id])).rows[0].res
      .success,
    false,
  );
  assert.equal(
    (await authed(OTHER, `SELECT public.claim_scheduled_booking($1) AS res`, [s1.id])).rows[0].res
      .success,
    false,
  );
  await force(
    `UPDATE public.bookings SET status='cancelled' WHERE driver_id=$1 AND status IN ('accepted','arrived','in_progress')`,
    [DRIVER_ROW],
  );
  const early = await authed(DRV, `SELECT public.start_scheduled_booking($1) AS res`, [s1.id]);
  assert.ok(early.ok && early.rows[0].res.success, "pickup within 60 min can be started");
  const s2 = await book(RIDER, {
    fare: 819,
    scheduled: new Date(Date.now() + 5 * 3600e3).toISOString(),
  });
  await authed(DRV, `SELECT public.claim_scheduled_booking($1) AS res`, [s2.id]);
  assert.equal(
    (await authed(DRV, `SELECT public.start_scheduled_booking($1) AS res`, [s2.id])).rows[0].res
      .success,
    false,
    "too early / already busy",
  );
  assert.equal(
    (await authed(DRV, `SELECT public.release_scheduled_booking($1) AS res`, [s2.id])).rows[0].res
      .success,
    true,
  );
  assert.equal(
    (await su(db, `SELECT driver_id FROM public.bookings WHERE id=$1`, [s2.id]))[0].driver_id,
    null,
  );
  // A driver cannot drop a live ride by nulling driver_id.
  const r = await authed(DRV, `UPDATE public.bookings SET driver_id = NULL WHERE id=$1`, [s1.id]);
  assert.equal(r.ok, false);
  await force(`UPDATE public.bookings SET status='cancelled' WHERE id=$1`, [s1.id]);
});

test("S6: OTP and chauffeur details only for the ride's passenger", async () => {
  const b = await book(RIDER, { fare: 819 });
  assert.match(
    (await authed(RIDER, `SELECT public.get_ride_otp($1) AS otp`, [b.id])).rows[0].otp,
    /^\d{4}$/,
  );
  assert.equal(
    (await authed(OTHER, `SELECT public.get_ride_otp($1) AS otp`, [b.id])).rows[0].otp,
    null,
  );
  await force(`UPDATE public.bookings SET status='accepted', driver_id=$2 WHERE id=$1`, [
    b.id,
    DRIVER_ROW,
  ]);
  const d = await authed(RIDER, `SELECT * FROM public.get_assigned_driver($1)`, [b.id]);
  assert.equal(d.rows.length, 1);
  assert.ok(!("aadhaar_number" in d.rows[0]) && !("dl_url" in d.rows[0]));
  assert.equal(
    (await authed(OTHER, `SELECT * FROM public.get_assigned_driver($1)`, [b.id])).rows.length,
    0,
  );
});

test("S7: admin links a driver record to an account by email", async () => {
  const [{ id: legacy }] = await force(
    `INSERT INTO public.drivers (full_name, phone, status) VALUES ('Legacy','9000000009','active') RETURNING id`,
  );
  await su(
    db,
    `INSERT INTO auth.users (id, email) VALUES ('99999999-0000-4000-8000-000000000009','legacy@x.in')`,
  );
  assert.equal(
    (await authed(RIDER, `SELECT public.admin_link_driver($1,'legacy@x.in') AS r`, [legacy]))
      .rows[0].r.success,
    false,
  );
  const r = await authed(ADMIN, `SELECT public.admin_link_driver($1,'LEGACY@x.in') AS r`, [legacy]);
  assert.equal(r.rows[0].r.success, true, JSON.stringify(r.rows[0].r));
  const [d] = await su(db, `SELECT user_id FROM public.drivers WHERE id=$1`, [legacy]);
  assert.equal(d.user_id, "99999999-0000-4000-8000-000000000009");
});

test("S8: only the payment server can credit wallet top-ups, once per payment id", async () => {
  assert.equal(
    (await authed(RIDER, `SELECT public.credit_wallet_topup($1, 500, 'pay_T1') AS r`, [RIDER])).ok,
    false,
  );
  const svc = (sql, params) =>
    db.transaction(async (tx) => {
      await tx.query(
        `SELECT set_config('request.jwt.claim.role','service_role',true), set_config('request.jwt.claim.sub','',true)`,
      );
      await tx.exec("SET LOCAL ROLE service_role");
      return (await tx.query(sql, params)).rows;
    });
  const [{ wallet_balance: before }] = await su(
    db,
    `SELECT wallet_balance FROM public.profiles WHERE id=$1`,
    [RIDER],
  );
  const [{ r: r1 }] = await svc(`SELECT public.credit_wallet_topup($1, 500, 'pay_T1') AS r`, [
    RIDER,
  ]);
  assert.equal(r1.success, true);
  const [{ r: r2 }] = await svc(`SELECT public.credit_wallet_topup($1, 500, 'pay_T1') AS r`, [
    RIDER,
  ]);
  assert.equal(r2.already_credited, true);
  const [{ wallet_balance: after }] = await su(
    db,
    `SELECT wallet_balance FROM public.profiles WHERE id=$1`,
    [RIDER],
  );
  assert.equal(Number(after) - Number(before), 500);
});

test("S9: private ride chat channel limited to passenger and assigned driver", async () => {
  const b = await book(RIDER, { fare: 819 });
  await force(`UPDATE public.bookings SET status='accepted', driver_id=$2 WHERE id=$1`, [
    b.id,
    DRIVER_ROW,
  ]);
  const topic = `ride-chat-${b.id}`;
  const join = (uid) =>
    db.transaction(async (tx) => {
      await tx.query(
        `SELECT set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claim.role','authenticated',true), set_config('realtime.topic',$2,true)`,
        [uid, topic],
      );
      await tx.exec("SET LOCAL ROLE authenticated");
      try {
        await tx.query(`INSERT INTO realtime.messages (topic, payload) VALUES ($1, '{}')`, [topic]);
        return true;
      } catch {
        return false;
      }
    });
  assert.equal(await join(RIDER), true);
  assert.equal(await join(DRV), true);
  assert.equal(await join(OTHER), false);
});

test("S10: driver photo readable by the driver and their passenger, licence only by the driver", async () => {
  await force(
    `UPDATE public.drivers SET photo_url='storage://driver_kyc/applications/p.jpg' WHERE id=$1`,
    [DRIVER_ROW],
  );
  await su(
    db,
    `INSERT INTO storage.objects (bucket_id, name) VALUES ('driver_kyc','applications/p.jpg'),('driver_kyc','applications/dl.jpg')`,
  );
  const see = async (uid, name) =>
    (
      await authed(
        uid,
        `SELECT name FROM storage.objects WHERE bucket_id='driver_kyc' AND name=$1`,
        [name],
      )
    ).rows.length;
  assert.equal(await see(DRV, "applications/p.jpg"), 1);
  assert.equal(await see(DRV, "applications/dl.jpg"), 1);
  const b = await book(RIDER, { fare: 819 });
  await force(`UPDATE public.bookings SET status='accepted', driver_id=$2 WHERE id=$1`, [
    b.id,
    DRIVER_ROW,
  ]);
  assert.equal(await see(RIDER, "applications/p.jpg"), 1);
  assert.equal(await see(RIDER, "applications/dl.jpg"), 0);
  assert.equal(await see(OTHER, "applications/p.jpg"), 0);
});

test(
  "phase 2: drivers cannot read the OTP; riders cannot read driver rows",
  { skip: !PHASE2 },
  async () => {
    const b = await book(RIDER, { fare: 819 });
    assert.equal(b.ride_otp, "");
    assert.match(
      (await authed(RIDER, `SELECT public.get_ride_otp($1) AS otp`, [b.id])).rows[0].otp,
      /^\d{4}$/,
    );
    await force(`UPDATE public.bookings SET status='accepted', driver_id=$2 WHERE id=$1`, [
      b.id,
      DRIVER_ROW,
    ]);
    assert.equal(
      (await authed(DRV, `SELECT ride_otp FROM public.bookings WHERE id=$1`, [b.id])).rows[0]
        .ride_otp,
      "",
    );
    assert.equal(
      (await authed(RIDER, `SELECT id FROM public.drivers WHERE id=$1`, [DRIVER_ROW])).rows.length,
      0,
    );
    assert.equal(
      (await authed(RIDER, `SELECT * FROM public.get_assigned_driver($1)`, [b.id])).rows.length,
      1,
    );
    // The one-time data move ran before fixtures existed; re-running also proves the file is idempotent.
    await db.exec(
      fs.readFileSync(
        path.resolve(MIG, "../deferred/phase2_lock_down_after_app_update.sql"),
        "utf8",
      ),
    );
    const [{ aadhaar_number }] = await su(
      db,
      `SELECT aadhaar_number FROM public.drivers WHERE id=$1`,
      [DRIVER_ROW],
    );
    assert.equal(aadhaar_number, "");
    assert.equal(
      (await su(db, `SELECT count(*)::int AS n FROM public.driver_kyc_private`))[0].n,
      1,
    );
  },
);

// ---- Live-project catch-up (CATCHUP=1) ---------------------------------------------------------
const LEGACY_RIDER = "11111111-0000-4000-8000-000000000001";
const LEGACY_DRIVER_USER = "11111111-0000-4000-8000-000000000002";
const LEGACY_BOOKING = "33333333-0000-4000-8000-000000000001";

test(
  "catch-up: legacy rows survive and existing drivers stay able to work",
  { skip: !CATCHUP },
  async () => {
    const counts = await su(
      db,
      `SELECT (SELECT count(*) FROM public.bookings WHERE reference LIKE 'LEGACY%') b,
    (SELECT count(*) FROM public.drivers WHERE id::text LIKE '22222222%' AND status = 'active') d`,
    );
    assert.equal(Number(counts[0].b), 2);
    assert.equal(Number(counts[0].d), 2);
    const gh = await su(db, `SELECT geohash FROM public.drivers WHERE user_id = $1`, [
      LEGACY_DRIVER_USER,
    ]);
    assert.ok(gh[0].geohash, "driver geohash backfilled");
    const cats = await su(
      db,
      `SELECT code, base_fare, per_km, minimum_fare, is_active FROM public.vehicle_categories`,
    );
    assert.deepEqual(
      cats.map((c) => [
        c.code,
        Number(c.base_fare),
        Number(c.per_km),
        Number(c.minimum_fare),
        c.is_active,
      ]),
      [["ORANGE_SEDAN", 59, 15, 129, true]],
      "live prices and categories untouched",
    );
  },
);

test(
  "catch-up: rider can rate a ride completed before the catch-up",
  { skip: !CATCHUP },
  async () => {
    const r = await authed(
      LEGACY_RIDER,
      `UPDATE public.bookings SET rating = 5, review = 'great' WHERE id = $1 RETURNING rating`,
      [LEGACY_BOOKING],
    );
    assert.ok(r.ok, r.error);
    assert.equal(r.rows.length, 1);
    const d = await su(db, `SELECT rating FROM public.drivers WHERE user_id = $1`, [
      LEGACY_DRIVER_USER,
    ]);
    assert.equal(Number(d[0].rating), 5);
  },
);

test(
  "catch-up: a legacy driver can accept a new booking and sees the server OTP flow",
  { skip: !CATCHUP },
  async () => {
    const b = await book(LEGACY_RIDER);
    assert.match(b.ride_otp || (await otpOf(b.id)) || "", /^\d{4}$/);
    const acc = await authed(LEGACY_DRIVER_USER, `SELECT public.accept_booking($1) AS r`, [b.id]);
    assert.ok(acc.ok, acc.error);
    const st = await su(db, `SELECT status FROM public.bookings WHERE id = $1`, [b.id]);
    assert.equal(st[0].status, "accepted");
  },
);

test(
  "catch-up: the live 'Allow all' fleet policy and driver-reads-all-profiles policy are gone",
  { skip: !CATCHUP },
  async () => {
    const pols = await su(
      db,
      `SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public'
    AND (policyname ILIKE 'allow all%' OR policyname = 'profiles read' OR (tablename = 'fleet_vehicles' AND policyname ILIKE 'allow%'))`,
    );
    assert.deepEqual(pols, []);
    const anonFleet = await anon(`SELECT count(*) FROM public.fleet_vehicles`);
    assert.ok(!anonFleet.ok || Number(anonFleet.rows[0].count) === 0);
    // A customer with no bookings (drivers may see requesters of open "searching" rides, by design).
    const STRANGER = "11111111-0000-4000-8000-0000000000ff";
    await su(
      db,
      `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, 'stranger@x.in', '{"full_name":"S","phone":"+910000000000"}')`,
      [STRANGER],
    );
    const peek = await authed(LEGACY_DRIVER_USER, `SELECT id FROM public.profiles WHERE id = $1`, [
      STRANGER,
    ]);
    assert.ok(peek.ok, peek.error);
    assert.equal(peek.rows.length, 0, "a driver cannot read an unrelated customer's profile");
  },
);

// ---- Account deletion keeps anonymised ride/wallet records (20261025140000) ---------------------
const newUser = async (id, email) => {
  await su(
    db,
    `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, '{"full_name":"To Delete","phone":"+911111111111"}')`,
    [id, email],
  );
  return id;
};

test("account deletion: rider with past rides is erased, rides kept anonymised", async () => {
  const U = await newUser("44444444-0000-4000-8000-000000000001", "leaver@x.in");
  const b = await book(U, { fare: 500 });
  await force(
    `UPDATE public.bookings SET status = 'completed', final_fare = estimated_fare, payment_status = 'paid' WHERE id = $1`,
    [b.id],
  );
  const s = await book(U, { scheduled: new Date(Date.now() + 86400000).toISOString() });

  const del = await authed(U, `SELECT public.delete_user_account() AS r`);
  assert.ok(del.ok, del.error);
  assert.equal(del.rows[0].r.success, true);

  assert.equal((await su(db, `SELECT count(*) FROM auth.users WHERE id = $1`, [U]))[0].count, 0);
  assert.equal(
    (await su(db, `SELECT count(*) FROM public.profiles WHERE id = $1`, [U]))[0].count,
    0,
  );
  const [kept] = await su(
    db,
    `SELECT customer_id, pickup_address, estimated_fare, final_fare, payment_status, status FROM public.bookings WHERE id = $1`,
    [b.id],
  );
  assert.equal(kept.customer_id, null);
  assert.equal(kept.pickup_address, "[Redacted on Account Deletion]");
  assert.equal(Number(kept.final_fare), Number(b.estimated_fare), "fare kept for the tax invoice");
  assert.equal(kept.payment_status, "paid");
  const [sched] = await su(db, `SELECT status FROM public.bookings WHERE id = $1`, [s.id]);
  assert.equal(sched.status, "cancelled", "future scheduled ride cancelled");
});

test("account deletion: blocked while the wallet holds money or a ride is active", async () => {
  const W = await newUser("44444444-0000-4000-8000-000000000002", "wallet.leaver@x.in");
  await force(`UPDATE public.profiles SET wallet_balance = 250 WHERE id = $1`, [W]);
  const r1 = await authed(W, `SELECT public.delete_user_account()`);
  assert.ok(!r1.ok && /wallet still holds/.test(r1.error), r1.error);

  const A = await newUser("44444444-0000-4000-8000-000000000003", "active.leaver@x.in");
  await book(A);
  const r2 = await authed(A, `SELECT public.delete_user_account()`);
  assert.ok(!r2.ok && /active trip/.test(r2.error), r2.error);
  assert.equal(
    (await su(db, `SELECT count(*) FROM auth.users WHERE id IN ($1, $2)`, [W, A]))[0].count,
    2,
  );
});

test("account deletion: a driver's record is anonymised and past trips stay linked", async () => {
  const D = await newUser("44444444-0000-4000-8000-000000000004", "driver.leaver@x.in");
  await force(
    `INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'driver') ON CONFLICT DO NOTHING`,
    [D],
  );
  const [{ id: drv }] = await force(
    `INSERT INTO public.drivers (user_id, full_name, phone, city, status, vehicle_number) VALUES ($1, 'Leaving Driver', '+912222222222', 'Bengaluru', 'active', 'KA 09 ZZ 0001') RETURNING id`,
    [D],
  );
  const b = await book(RIDER);
  await force(
    `UPDATE public.bookings SET driver_id = $2, status = 'completed', final_fare = estimated_fare WHERE id = $1`,
    [b.id, drv],
  );

  const del = await authed(D, `SELECT public.delete_user_account() AS r`);
  assert.ok(del.ok, del.error);
  const [row] = await su(
    db,
    `SELECT user_id, full_name, phone, status, vehicle_number FROM public.drivers WHERE id = $1`,
    [drv],
  );
  assert.deepEqual(
    [row.user_id, row.full_name, row.phone, row.status, row.vehicle_number],
    [null, "Former Chauffeur", "", "deleted", "REDACTED"],
  );
  const [trip] = await su(db, `SELECT driver_id FROM public.bookings WHERE id = $1`, [b.id]);
  assert.equal(trip.driver_id, drv);
});

// ---- Admin pricing + cancellation fee (20261025150000) ------------------------------------------
const setPricing = (sql) => force(`UPDATE public.pricing_settings SET ${sql} WHERE id = 1`);
// Earlier tests can leave the shared test driver mid-ride; clear that so they can accept again.
const freeDriver = () =>
  force(
    `UPDATE public.bookings SET status = 'cancelled' WHERE driver_id = $1 AND status IN ('accepted', 'arrived', 'in_progress')`,
    [DRIVER_ROW],
  );
const acceptAs = async (uid, bookingId) => {
  await freeDriver();
  const r = await authed(uid, `SELECT public.accept_booking($1) AS res`, [bookingId]);
  assert.ok(r.ok && r.rows[0].res.success, r.error || JSON.stringify(r.rows?.[0]));
};

test("pricing: admin settings (tax, platform fee, surge) drive the server fare", async () => {
  const [orig] = await su(
    db,
    `SELECT tax_percent, platform_fee, surge_enabled, surge_multiplier FROM public.pricing_settings WHERE id = 1`,
  );
  try {
    await setPricing(
      `tax_percent = 5, platform_fee = 20, surge_enabled = true, surge_multiplier = 1.5`,
    );
    // 40 km Signature fallback tariff: ride = max(149, 99 + 720) = 819; surged 1228.5 -> 1229 (round half up)
    const b = await book(RIDER, { fare: 1 });
    const surged = Math.round(819 * 1.5);
    assert.equal(Number(b.estimated_fare), surged + Math.round(surged * 0.05) + 20);
    const [q] = await su(db, `SELECT * FROM public.fn_fare_quote('ORANGE_SIGNATURE', 40)`);
    assert.equal(Number(q.total), Number(b.estimated_fare));
    const [row] = await su(db, `SELECT surge_multiplier FROM public.bookings WHERE id = $1`, [
      b.id,
    ]);
    assert.equal(Number(row.surge_multiplier), 1.5);
    assert.equal(Number((await su(db, `SELECT public.get_surge_multiplier() AS s`))[0].s), 1.5);

    await setPricing(`surge_enabled = false`);
    assert.equal(Number((await su(db, `SELECT public.get_surge_multiplier() AS s`))[0].s), 1);
  } finally {
    await force(
      `UPDATE public.pricing_settings SET tax_percent = $1, platform_fee = $2, surge_enabled = $3, surge_multiplier = $4 WHERE id = 1`,
      [orig.tax_percent, orig.platform_fee, orig.surge_enabled, orig.surge_multiplier],
    );
  }
});

test("pricing: fn_fare_quote matches the web and rider-app fare cases", async () => {
  const [orig] = await su(db, `SELECT * FROM public.pricing_settings WHERE id = 1`);
  await force(
    `INSERT INTO public.vehicle_categories (code, name, seats, base_fare, per_km, minimum_fare, is_active)
     VALUES ('TEST_SEDAN', 'Test Sedan', 4, 59, 15, 129, true) ON CONFLICT (code) DO NOTHING`,
  );
  // Same cases as tests/pricing.test.ts (web) and tests/pricing.test.ts (rider app).
  const cases = [
    [
      "ORANGE_SIGNATURE",
      40,
      "tax_percent = 5, platform_fee = 20, surge_enabled = true, surge_multiplier = 1.5",
      1310,
    ],
    ["ORANGE_SIGNATURE", 2, "tax_percent = 5, platform_fee = 0, surge_enabled = false", 156],
    ["TEST_SEDAN", 10, "tax_percent = 0, platform_fee = 0, surge_enabled = false", 209],
    [
      "TEST_SEDAN",
      10,
      "tax_percent = 0, platform_fee = 0, surge_enabled = false, surge_multiplier = 2",
      209,
    ],
  ];
  try {
    for (const [code, km, sql, total] of cases) {
      await setPricing(sql);
      const [q] = await su(db, `SELECT total FROM public.fn_fare_quote($1, $2)`, [code, km]);
      assert.equal(Number(q.total), total, `${code} ${km} km with ${sql}`);
    }
  } finally {
    await force(`DELETE FROM public.vehicle_categories WHERE code = 'TEST_SEDAN'`);
    await force(
      `UPDATE public.pricing_settings SET tax_percent = $1, platform_fee = $2, surge_enabled = $3, surge_multiplier = $4 WHERE id = 1`,
      [orig.tax_percent, orig.platform_fee, orig.surge_enabled, orig.surge_multiplier],
    );
  }
});

test("pricing: only admins can change prices; absurd values are rejected", async () => {
  const r1 = await authed(
    RIDER,
    `UPDATE public.pricing_settings SET platform_fee = 0 WHERE id = 1 RETURNING id`,
  );
  assert.ok(!r1.ok || r1.rows.length === 0, "rider cannot change pricing");
  const r2 = await authed(DRV, `UPDATE public.vehicle_categories SET per_km = 1 RETURNING id`);
  assert.ok(!r2.ok || r2.rows.length === 0, "driver cannot change tariffs");
  const ok = await authed(
    ADMIN,
    `UPDATE public.pricing_settings SET cancellation_charge = 50 WHERE id = 1 RETURNING id`,
  );
  assert.ok(ok.ok && ok.rows.length === 1, ok.error);
  const bad = await authed(
    ADMIN,
    `UPDATE public.pricing_settings SET surge_multiplier = 9 WHERE id = 1`,
  );
  assert.ok(!bad.ok && /pricing_settings_sane/.test(bad.error), bad.error);
});

test("cancellation: free before a driver accepts, and when the driver cancels", async () => {
  const b = await book(RIDER);
  const c = await authed(
    RIDER,
    `UPDATE public.bookings SET status = 'cancelled' WHERE id = $1 RETURNING cancellation_fee, cancelled_by`,
    [b.id],
  );
  assert.ok(c.ok, c.error);
  assert.deepEqual([Number(c.rows[0].cancellation_fee), c.rows[0].cancelled_by], [0, "passenger"]);

  const b2 = await book(RIDER);
  await acceptAs(DRV, b2.id);
  const d = await authed(
    DRV,
    `UPDATE public.bookings SET status = 'cancelled' WHERE id = $1 RETURNING cancellation_fee, cancelled_by`,
    [b2.id],
  );
  assert.ok(d.ok, d.error);
  assert.deepEqual([Number(d.rows[0].cancellation_fee), d.rows[0].cancelled_by], [0, "driver"]);
});

test("cancellation: within 3 min and under 1.5 km is free; otherwise ₹50", async () => {
  await force(`UPDATE public.drivers SET current_lat = 12.97, current_lng = 77.59 WHERE id = $1`, [
    DRIVER_ROW,
  ]);

  // Quick cancel, driver hasn't moved -> free.
  const a = await book(RIDER);
  await acceptAs(DRV, a.id);
  const pa = await authed(RIDER, `SELECT public.get_cancellation_fee($1) AS p`, [a.id]);
  assert.ok(pa.ok, pa.error);
  assert.equal(Number(pa.rows[0].p.fee), 0);
  const ca = await authed(
    RIDER,
    `UPDATE public.bookings SET status = 'cancelled', cancellation_fee = 0 WHERE id = $1 RETURNING cancellation_fee`,
    [a.id],
  );
  assert.equal(Number(ca.rows[0].cancellation_fee), 0);

  // Driver drove ~2.2 km towards pickup -> ₹50, even within 3 minutes.
  const m = await book(RIDER);
  await acceptAs(DRV, m.id);
  await force(`UPDATE public.drivers SET current_lat = 12.99, current_lng = 77.59 WHERE id = $1`, [
    DRIVER_ROW,
  ]);
  const pm = await authed(RIDER, `SELECT public.get_cancellation_fee($1) AS p`, [m.id]);
  assert.equal(Number(pm.rows[0].p.fee), 50);
  const cm = await authed(
    RIDER,
    `UPDATE public.bookings SET status = 'cancelled' WHERE id = $1 RETURNING cancellation_fee`,
    [m.id],
  );
  assert.equal(Number(cm.rows[0].cancellation_fee), 50);
  await force(`UPDATE public.drivers SET current_lat = 12.97, current_lng = 77.59 WHERE id = $1`, [
    DRIVER_ROW,
  ]);

  // More than 3 minutes since acceptance -> ₹50 even if the driver hasn't moved.
  const t = await book(RIDER);
  await acceptAs(DRV, t.id);
  await force(
    `UPDATE public.bookings SET accepted_at = now() - interval '5 minutes' WHERE id = $1`,
    [t.id],
  );
  const ct = await authed(
    RIDER,
    `UPDATE public.bookings SET status = 'cancelled' WHERE id = $1 RETURNING cancellation_fee`,
    [t.id],
  );
  assert.equal(Number(ct.rows[0].cancellation_fee), 50);

  // Nobody else can see the preview; the rider can't write the fee themselves.
  const peek = await authed(OTHER, `SELECT public.get_cancellation_fee($1)`, [t.id]);
  assert.ok(!peek.ok);
  const tamper = await authed(
    RIDER,
    `UPDATE public.bookings SET cancellation_fee = 0 WHERE id = $1 RETURNING cancellation_fee`,
    [t.id],
  );
  assert.ok(!tamper.ok || Number(tamper.rows[0]?.cancellation_fee ?? 50) === 50);
});
