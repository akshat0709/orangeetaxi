import { test } from "node:test";
import assert from "node:assert/strict";
import { createRefund, emailStatus } from "../src/lib/support-refunds.ts";

const ADMIN = "33333333-3333-4333-8333-333333333333";
const BOOKING = "22222222-2222-4222-8222-222222222222";
const RIDER = "55555555-5555-4555-8555-555555555555";
const config = {
  supabaseUrl: "https://db.example",
  supabaseAnonKey: "anon",
  serviceRoleKey: "service",
  razorpayKeyId: "rzp_key",
  razorpayKeySecret: "rzp_secret",
};

function world(booking: Record<string, unknown>, opts: { admin?: boolean; prior?: number } = {}) {
  const calls: Array<{ url: string; method: string; body?: any }> = [];
  const saved: any[] = [];
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
  const fetchFake = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method || "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method, body });
    if (url.endsWith("/auth/v1/user")) return json(200, { id: ADMIN });
    if (url.includes("/rest/v1/user_roles"))
      return json(200, opts.admin === false ? [] : [{ user_id: ADMIN }]);
    if (url.includes("/rest/v1/bookings?id=eq."))
      return json(200, [{ id: BOOKING, reference: "OT1", customer_id: RIDER, ...booking }]);
    if (url.includes("/rest/v1/refunds?booking_id=eq."))
      return json(200, opts.prior ? [{ amount: opts.prior, status: "processed" }] : []);
    if (url.endsWith("/rest/v1/refunds") && method === "POST") {
      saved.push(body);
      return json(201, [{ id: "r1" }]);
    }
    if (url.includes("/rest/v1/rpc/credit_wallet_topup")) return json(200, { success: true });
    if (url.includes("/rest/v1/support_tickets")) return json(200, []);
    if (url.includes("/rest/v1/rpc/auth_email_status"))
      return json(200, body._email === "new@x.in" ? "none" : "exists");
    if (/razorpay\.com\/v1\/payments\/pay_\w+\/refund$/.test(url))
      return json(200, { id: "rfnd_1", status: "processed" });
    throw new Error(`unexpected ${method} ${url}`);
  }) as typeof fetch;
  return { deps: { fetch: fetchFake, hmacSha256Hex: async () => "" }, calls, saved };
}

const paidOnline = {
  status: "completed",
  payment_status: "paid",
  payment_method: "upi",
  payment_intent_id: "pay_ABC123",
  final_fare: 300,
  estimated_fare: 300,
};

test("refunds an online payment through Razorpay, capped at what was paid", async () => {
  const w = world(paidOnline, { prior: 100 });
  const tooMuch = await createRefund(
    { accessToken: "t", bookingId: BOOKING, amount: 250, reason: "Driver no-show" },
    config,
    w.deps,
  );
  assert.equal(tooMuch.status, 409);
  assert.equal(tooMuch.body.refundable, 200);
  const ok = await createRefund(
    {
      accessToken: "t",
      bookingId: BOOKING,
      amount: 200,
      reason: "Driver no-show",
      ticketId: "44444444-4444-4444-8444-444444444444",
    },
    config,
    w.deps,
  );
  assert.equal(ok.status, 200);
  const rz = w.calls.find((c) => c.url.includes("/refund") && c.method === "POST");
  assert.equal(rz?.body.amount, 20000);
  assert.equal(w.saved[0].method, "razorpay");
  assert.equal(w.saved[0].razorpay_refund_id, "rfnd_1");
  assert.ok(w.calls.some((c) => c.url.includes("support_tickets") && c.method === "PATCH"));
});

test("wallet rides go back to the wallet; cash rides are recorded as manual", async () => {
  const wallet = world({ ...paidOnline, payment_method: "wallet", payment_intent_id: null });
  const r1 = await createRefund(
    { accessToken: "t", bookingId: BOOKING, amount: 50, reason: "Overcharge" },
    config,
    wallet.deps,
  );
  assert.equal(r1.body.refund?.method, "wallet");
  assert.ok(wallet.calls.some((c) => c.url.includes("credit_wallet_topup")));
  const cash = world({ ...paidOnline, payment_method: "cash", payment_intent_id: null });
  const r2 = await createRefund(
    { accessToken: "t", bookingId: BOOKING, amount: 50, reason: "Overcharge" },
    config,
    cash.deps,
  );
  assert.equal(r2.body.refund?.method, "manual");
  assert.ok(!cash.calls.some((c) => c.url.includes("razorpay.com")));
});

test("refunds are admin-only and need a paid booking and a reason", async () => {
  assert.equal(
    (
      await createRefund(
        { accessToken: "t", bookingId: BOOKING, amount: 10, reason: "x y z" },
        config,
        world(paidOnline, { admin: false }).deps,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await createRefund(
        { accessToken: "t", bookingId: BOOKING, amount: 10, reason: "" },
        config,
        world(paidOnline).deps,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await createRefund(
        { accessToken: "t", bookingId: BOOKING, amount: 10, reason: "abc" },
        config,
        world({ ...paidOnline, payment_status: "pending" }).deps,
      )
    ).status,
    409,
  );
});

test("sign-in account check", async () => {
  const w = world(paidOnline);
  assert.equal((await emailStatus("new@x.in", config, w.deps)).body.status, "none");
  assert.equal((await emailStatus("old@x.in", config, w.deps)).body.status, "exists");
  assert.equal((await emailStatus("not-an-email", config, w.deps)).status, 400);
});
