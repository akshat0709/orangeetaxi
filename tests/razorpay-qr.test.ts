import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createDepositQr,
  createRideLink,
  createRideQr,
  qrStatus,
  settleQrFromWebhook,
} from "../src/lib/razorpay-qr.ts";

const DRIVER_USER = "11111111-1111-4111-8111-111111111111";
const RIDER_USER = "55555555-5555-4555-8555-555555555555";
const ADMIN_USER = "33333333-3333-4333-8333-333333333333";
const DRIVER = "44444444-4444-4444-8444-444444444444";
const BOOKING = "22222222-2222-4222-8222-222222222222";
const config = {
  supabaseUrl: "https://db.example",
  supabaseAnonKey: "anon",
  serviceRoleKey: "service",
  razorpayKeyId: "rzp_key",
  razorpayKeySecret: "rzp_secret",
};
const hmac = async () => "";

function world(opts: { paymentStatus?: string; paidAmount?: number; driverType?: string } = {}) {
  const booking: Record<string, unknown> = {
    id: BOOKING,
    customer_id: RIDER_USER,
    driver_id: DRIVER,
    status: "completed",
    reference: "OT-1",
    estimated_fare: 250,
    final_fare: 250,
    payment_status: "pending",
    payment_method: "cash",
  };
  const qrs: Array<Record<string, any>> = [];
  const cashSettlements: unknown[] = [];
  const commission: unknown[] = [];
  let rzpPayments: unknown[] = [];
  let created = 0;
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
  const fetchFake = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method || "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const auth = (init?.headers as Record<string, string> | undefined)?.["Authorization"] || "";
    if (url.endsWith("/auth/v1/user")) {
      if (auth === "Bearer driver") return json(200, { id: DRIVER_USER });
      if (auth === "Bearer admin") return json(200, { id: ADMIN_USER });
      if (auth === "Bearer rider") return json(200, { id: RIDER_USER });
      return json(401, {});
    }
    if (url.includes("/rest/v1/user_roles"))
      return json(200, url.includes(ADMIN_USER) ? [{ user_id: ADMIN_USER }] : []);
    if (url.includes("/rest/v1/drivers?user_id=eq."))
      return json(200, url.includes(DRIVER_USER) ? [{ id: DRIVER }] : []);
    if (url.includes("/rest/v1/drivers?id=eq."))
      return json(200, [
        { id: DRIVER, full_name: "Ravi", driver_type: opts.driverType ?? "company" },
      ]);
    if (url.includes("/rest/v1/bookings?id=eq.") && method === "GET")
      return json(200, [
        url.includes("driver:drivers")
          ? { ...booking, driver: booking.driver_id === DRIVER ? { user_id: DRIVER_USER } : null }
          : booking,
      ]);
    if (url.includes("/rest/v1/bookings?driver_id=eq."))
      return json(200, [
        { final_fare: 600, payment_method: "cash" },
        { final_fare: 400, payment_method: "driver_upi" },
        { final_fare: 1000, payment_method: "upi_qr" },
      ]);
    if (url.includes("/rest/v1/pricing_settings"))
      return json(200, [{ partner_commission_percent: 10 }]);
    if (url.includes("/rest/v1/bookings?id=eq.") && method === "PATCH") {
      if (booking.payment_status === "paid") return json(200, []);
      Object.assign(booking, body);
      return json(200, [booking]);
    }
    if (url.includes("/rest/v1/payment_qr_codes")) {
      if (method === "POST") {
        qrs.push({ ...body });
        return json(201, [body]);
      }
      const id = /[?&]id=eq\.([^&]+)/.exec(url)?.[1];
      const pendingOnly = url.includes("status=eq.pending");
      const match = (r: Record<string, any>) =>
        (id ? r.id === id : r.booking_id === BOOKING) && (!pendingOnly || r.status === "pending");
      if (method === "PATCH") {
        const rows = qrs.filter(match);
        rows.forEach((r) => Object.assign(r, body));
        return json(200, rows);
      }
      return json(200, qrs.filter(match));
    }
    if (url.includes("/rest/v1/driver_cash_settlements") && method === "GET")
      return json(200, [{ amount: 100 }]);
    if (url.includes("/rest/v1/driver_commission_settlements") && method === "GET")
      return json(200, []);
    if (url.includes("/rest/v1/driver_cash_settlements")) {
      cashSettlements.push(body);
      return json(201, null);
    }
    if (url.includes("/rest/v1/driver_commission_settlements")) {
      commission.push(body);
      return json(201, null);
    }
    if (url === "https://api.razorpay.com/v1/payments/qr_codes" && method === "POST") {
      created++;
      return json(200, { id: `qr_TEST${created}AAAA`, image_url: "https://rzp.io/i/x" });
    }
    if (url === "https://api.razorpay.com/v1/payment_links" && method === "POST") {
      created++;
      return json(200, { id: `plink_TEST${created}AAAA`, short_url: "https://rzp.io/l/x" });
    }
    if (/\/v1\/payment_links\/plink_\w+$/.test(url))
      return json(200, {
        payments: (rzpPayments as Array<Record<string, unknown>>).map((p) => ({
          payment_id: p["id"],
          amount: p["amount"],
          status: p["status"],
        })),
      });
    if (/\/v1\/payments\/qr_codes\/qr_\w+\/payments$/.test(url))
      return json(200, { items: rzpPayments });
    throw new Error(`unexpected ${method} ${url}`);
  }) as typeof fetch;
  return {
    deps: { fetch: fetchFake, hmacSha256Hex: hmac },
    booking,
    qrs,
    cashSettlements,
    commission,
    pay: (amountPaise: number, status = "captured") => {
      rzpPayments = [{ id: "pay_QR1234", status, amount: amountPaise, currency: "INR" }];
    },
    created: () => created,
  };
}

test("driver gets a ride QR for the fare, reused when reopened", async () => {
  const w = world();
  const r = await createRideQr({ accessToken: "driver", bookingId: BOOKING }, config, w.deps);
  assert.equal(r.status, 200);
  assert.equal(r.body.qr?.amount, 250);
  assert.equal(w.qrs[0].kind, "ride");
  const again = await createRideQr({ accessToken: "driver", bookingId: BOOKING }, config, w.deps);
  assert.equal(again.body.qr?.id, r.body.qr?.id);
  assert.equal(w.created(), 1);
});

test("someone else's ride is refused", async () => {
  const w = world();
  const r = await createRideQr({ accessToken: "admin", bookingId: BOOKING }, config, w.deps);
  assert.equal(r.status, 403);
});

test("paying the ride QR marks the booking paid online (not cash), once", async () => {
  const w = world();
  const r = await createRideQr({ accessToken: "driver", bookingId: BOOKING }, config, w.deps);
  const id = r.body.qr!.id;
  let s = await qrStatus({ accessToken: "driver", qrId: id }, config, w.deps);
  assert.equal(s.body.qr?.status, "pending");
  w.pay(25000);
  s = await qrStatus({ accessToken: "driver", qrId: id }, config, w.deps);
  assert.equal(s.body.qr?.status, "paid");
  assert.equal(w.booking.payment_method, "upi_qr");
  assert.equal(w.booking.payment_status, "paid");
  assert.equal(w.booking.payment_intent_id, "pay_QR1234");
  const hook = await settleQrFromWebhook(
    { event: "qr_code.credited", payload: { qr_code: { entity: { id } } } },
    config,
    w.deps,
  );
  assert.equal(hook.status, 200);
  assert.equal(w.qrs.filter((q) => q.status === "paid").length, 1);
});

test("an underpayment does not settle", async () => {
  const w = world();
  const r = await createRideQr({ accessToken: "driver", bookingId: BOOKING }, config, w.deps);
  w.pay(10000);
  const s = await qrStatus({ accessToken: "driver", qrId: r.body.qr!.id }, config, w.deps);
  assert.equal(s.body.qr?.status, "pending");
  assert.equal(w.booking.payment_status, "pending");
});

test("a driver can show themselves a hand-in QR only up to the cash they hold", async () => {
  const w = world();
  // Held: 600 cash + 400 own UPI (the 1000 QR ride is not cash) - 100 handed in = 900
  const tooMuch = await createDepositQr(
    { accessToken: "driver", driverId: DRIVER, amount: 901, kind: "cash_deposit" },
    config,
    w.deps,
  );
  assert.equal(tooMuch.status, 409);
  assert.match(tooMuch.body.error!, /900/);
  const ok = await createDepositQr(
    { accessToken: "driver", driverId: DRIVER, amount: 900, kind: "cash_deposit" },
    config,
    w.deps,
  );
  assert.equal(ok.status, 200);
  const other = await createDepositQr(
    { accessToken: "rider", driverId: DRIVER, amount: 10, kind: "cash_deposit" },
    config,
    w.deps,
  );
  assert.equal(other.status, 403);
});

test("a commission driver can pay their commission by QR, capped at what they owe", async () => {
  const w = world({ driverType: "partner" });
  // 10%: commission on driver-collected 1000 = 100; company owes 90% of 1000 online = 900
  // => balance -800, nothing owed.
  const r = await createDepositQr(
    { accessToken: "driver", driverId: DRIVER, amount: 50, kind: "commission" },
    config,
    w.deps,
  );
  assert.equal(r.status, 409);
});

test("passenger pays a ride online with a payment link (marked paid online, 'upi')", async () => {
  const w = world();
  w.booking["status"] = "accepted";
  const denied = await createRideLink(
    { accessToken: "driver", bookingId: BOOKING },
    config,
    w.deps,
  );
  assert.equal(denied.status, 403);
  const r = await createRideLink({ accessToken: "rider", bookingId: BOOKING }, config, w.deps);
  assert.equal(r.status, 200);
  assert.equal(r.body.qr?.image_url, "https://rzp.io/l/x");
  w.pay(25000);
  const hook = await settleQrFromWebhook(
    { event: "payment_link.paid", payload: { payment_link: { entity: { id: r.body.qr!.id } } } },
    config,
    w.deps,
  );
  assert.equal(hook.settled, true);
  assert.equal(w.booking["payment_method"], "upi");
  assert.equal(w.booking["payment_status"], "paid");
  const again = await createRideLink({ accessToken: "rider", bookingId: BOOKING }, config, w.deps);
  assert.equal(again.status, 409);
});

test("cash hand-in QR made by an admin records a settlement when paid (webhook)", async () => {
  const w = world();
  const r = await createDepositQr(
    { accessToken: "admin", driverId: DRIVER, amount: 900, kind: "cash_deposit" },
    config,
    w.deps,
  );
  assert.equal(r.status, 200);
  w.pay(90000);
  const hook = await settleQrFromWebhook(
    { event: "qr_code.credited", payload: { qr_code: { entity: { id: r.body.qr!.id } } } },
    config,
    w.deps,
  );
  assert.equal(hook.settled, true);
  assert.equal(w.cashSettlements.length, 1);
  assert.equal((w.cashSettlements[0] as any).payment_mode, "upi_qr");
  assert.equal((w.cashSettlements[0] as any).amount, 900);
});

test("commission QR only for commission drivers; records driver_to_company", async () => {
  const w = world();
  const refused = await createDepositQr(
    { accessToken: "admin", driverId: DRIVER, amount: 300, kind: "commission" },
    config,
    w.deps,
  );
  assert.equal(refused.status, 409);
  const p = world({ driverType: "partner" });
  const r = await createDepositQr(
    { accessToken: "admin", driverId: DRIVER, amount: 300, kind: "commission" },
    config,
    p.deps,
  );
  p.pay(30000);
  await qrStatus({ accessToken: "admin", qrId: r.body.qr!.id }, config, p.deps);
  assert.equal(p.commission.length, 1);
  assert.equal((p.commission[0] as any).direction, "driver_to_company");
});

test("a driver paying from their phone gets a payment link, recorded as a hand-in when paid", async () => {
  const w = world();
  const r = await createDepositQr(
    { accessToken: "driver", driverId: DRIVER, amount: 500, kind: "cash_deposit", link: true },
    config,
    w.deps,
  );
  assert.equal(r.status, 200);
  assert.match(r.body.qr!.id, /^plink_/);
  w.pay(50000);
  const s = await qrStatus({ accessToken: "driver", qrId: r.body.qr!.id }, config, w.deps);
  assert.equal(s.body.qr?.status, "paid");
  assert.equal(w.cashSettlements.length, 1);
});
