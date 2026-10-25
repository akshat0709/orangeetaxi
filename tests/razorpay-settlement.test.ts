import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { settleRazorpayPayment, safeEqualHex } from "../src/lib/razorpay-settlement.ts";

const SECRET = "rzp_secret_test";
const USER = "11111111-1111-4111-8111-111111111111";
const BOOKING = "22222222-2222-4222-8222-222222222222";
const config = {
  supabaseUrl: "https://db.example",
  supabaseAnonKey: "anon",
  serviceRoleKey: "service",
  razorpayKeyId: "rzp_key",
  razorpayKeySecret: SECRET,
};
const hmac = async (m: string, s: string) => createHmac("sha256", s).update(m).digest("hex");
const sign = (order: string, pay: string) =>
  createHmac("sha256", SECRET).update(`${order}|${pay}`).digest("hex");

type Booking = {
  id: string;
  customer_id: string;
  status: string;
  estimated_fare: number;
  final_fare: number | null;
  payment_status: string;
  payment_intent_id: string | null;
};

function world(
  opts: {
    booking?: Partial<Booking>;
    payment?: Record<string, unknown>;
    reused?: boolean;
    userOk?: boolean;
  } = {},
) {
  const booking: Booking = {
    id: BOOKING,
    customer_id: USER,
    status: "in_progress",
    estimated_fare: 300,
    final_fare: null,
    payment_status: "pending",
    payment_intent_id: null,
    ...opts.booking,
  };
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  const fetchFake = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method || "GET";
    calls.push({ url, method, body: init?.body as string | undefined });
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
    if (url.endsWith("/auth/v1/user"))
      return opts.userOk === false ? json(401, {}) : json(200, { id: USER });
    if (url.includes("/rest/v1/bookings?payment_intent_id="))
      return json(200, opts.reused ? [{ id: "other" }] : []);
    if (url.includes("/rest/v1/bookings?id=eq.") && method === "GET") return json(200, [booking]);
    if (url.includes("/rest/v1/bookings?id=eq.") && method === "PATCH")
      return json(200, [{ ...booking, payment_status: "paid" }]);
    if (url.startsWith("https://api.razorpay.com/v1/payments/"))
      return json(200, {
        status: "captured",
        amount: 30000,
        currency: "INR",
        order_id: "order_ABC123",
        ...opts.payment,
      });
    return json(500, {});
  }) as typeof fetch;
  return { calls, deps: { fetch: fetchFake, hmacSha256Hex: hmac } };
}

const input = (over: Record<string, string | undefined> = {}) => ({
  bookingId: BOOKING,
  razorpay_order_id: "order_ABC123",
  razorpay_payment_id: "pay_XYZ789",
  razorpay_signature: sign("order_ABC123", "pay_XYZ789"),
  accessToken: "user-jwt",
  ...over,
});

test("settles a verified, captured, full-amount payment with the service role", async () => {
  const w = world();
  const r = await settleRazorpayPayment(input(), config, w.deps);
  assert.equal(r.status, 200);
  assert.equal(r.body.settled, true);
  const patch = w.calls.find((c) => c.method === "PATCH");
  assert.ok(patch);
  assert.deepEqual(JSON.parse(patch.body || "{}"), {
    payment_status: "paid",
    payment_made: "yes",
    payment_intent_id: "pay_XYZ789",
  });
});

test("rejects a forged signature without touching the booking", async () => {
  const w = world();
  const r = await settleRazorpayPayment(
    input({ razorpay_signature: "00".repeat(32) }),
    config,
    w.deps,
  );
  assert.equal(r.status, 400);
  assert.ok(!w.calls.some((c) => c.method === "PATCH"));
});

test("rejects someone else's booking", async () => {
  const w = world({ booking: { customer_id: "99999999-9999-4999-8999-999999999999" } });
  assert.equal((await settleRazorpayPayment(input(), config, w.deps)).status, 404);
});

test("rejects an underpaid or uncaptured payment", async () => {
  assert.equal(
    (await settleRazorpayPayment(input(), config, world({ payment: { amount: 100 } }).deps)).status,
    402,
  );
  assert.equal(
    (await settleRazorpayPayment(input(), config, world({ payment: { status: "failed" } }).deps))
      .status,
    402,
  );
  assert.equal(
    (await settleRazorpayPayment(input(), config, world({ booking: { final_fare: 450 } }).deps))
      .status,
    402,
  );
});

test("rejects a payment from a different order or reused on another booking", async () => {
  assert.equal(
    (
      await settleRazorpayPayment(
        input(),
        config,
        world({ payment: { order_id: "order_OTHER1" } }).deps,
      )
    ).status,
    400,
  );
  assert.equal(
    (await settleRazorpayPayment(input(), config, world({ reused: true }).deps)).status,
    409,
  );
});

test("requires a valid session and server configuration", async () => {
  assert.equal(
    (await settleRazorpayPayment(input({ accessToken: undefined }), config, world().deps)).status,
    401,
  );
  assert.equal(
    (await settleRazorpayPayment(input(), config, world({ userOk: false }).deps)).status,
    401,
  );
  assert.equal(
    (await settleRazorpayPayment(input(), { ...config, serviceRoleKey: undefined }, world().deps))
      .status,
    503,
  );
  assert.equal(
    (await settleRazorpayPayment(input({ bookingId: "1 or 1=1" }), config, world().deps)).status,
    400,
  );
});

test("is idempotent for the same payment and refuses a different one on a paid booking", async () => {
  const same = await settleRazorpayPayment(
    input(),
    config,
    world({ booking: { payment_status: "paid", payment_intent_id: "pay_XYZ789" } }).deps,
  );
  assert.equal(same.status, 200);
  assert.equal(same.body.alreadySettled, true);
  const other = await settleRazorpayPayment(
    input(),
    config,
    world({ booking: { payment_status: "paid", payment_intent_id: "pay_OTHER1" } }).deps,
  );
  assert.equal(other.status, 409);
});

test("safeEqualHex compares case-insensitively and rejects length mismatch", () => {
  assert.equal(safeEqualHex("ABcd", "abCD"), true);
  assert.equal(safeEqualHex("abcd", "abce"), false);
  assert.equal(safeEqualHex("abcd", "abcde"), false);
});

test("new sb_ keys go only in apikey; legacy JWT keys also get a Bearer header", async () => {
  const { supabaseKeyHeaders } = await import("../src/lib/razorpay-settlement.ts");
  assert.deepEqual(supabaseKeyHeaders("sb_secret_abc"), { apikey: "sb_secret_abc" });
  assert.deepEqual(supabaseKeyHeaders("eyJhbGc.x.y"), {
    apikey: "eyJhbGc.x.y",
    Authorization: "Bearer eyJhbGc.x.y",
  });
});
