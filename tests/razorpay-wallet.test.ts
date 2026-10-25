import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  createWalletTopupOrder,
  processRazorpayWebhookEvent,
  settleRazorpayPayment,
  settleWalletTopup,
} from "../src/lib/razorpay-settlement.ts";

const SECRET = "rzp_secret_test";
const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "33333333-3333-4333-8333-333333333333";
const BOOKING = "22222222-2222-4222-8222-222222222222";
const config = {
  supabaseUrl: "https://db.example",
  supabaseAnonKey: "anon",
  serviceRoleKey: "service",
  razorpayKeyId: "rzp_key",
  razorpayKeySecret: SECRET,
};
const hmac = async (m: string, s: string) => createHmac("sha256", s).update(m).digest("hex");
const sign = (o: string, p: string) =>
  createHmac("sha256", SECRET).update(`${o}|${p}`).digest("hex");

type World = {
  paymentStatus?: string;
  paymentAmount?: number;
  orderNotes?: Record<string, string>;
  orderAmount?: number;
  captureOk?: boolean;
};

function fake(w: World = {}) {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  let credited = 0;
  const f = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method || "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method, body });
    const json = (status: number, b: unknown) => new Response(JSON.stringify(b), { status });
    if (url.endsWith("/auth/v1/user")) return json(200, { id: USER });
    if (url === "https://api.razorpay.com/v1/orders" && method === "POST")
      return json(200, { id: "order_TOPUP1", amount: body.amount, notes: body.notes });
    if (url.startsWith("https://api.razorpay.com/v1/orders/"))
      return json(200, {
        id: "order_TOPUP1",
        amount: w.orderAmount ?? 50000,
        notes: w.orderNotes ?? { kind: "wallet_topup", user_id: USER },
      });
    if (url.endsWith("/capture"))
      return w.captureOk === false
        ? json(400, {})
        : json(200, {
            status: "captured",
            amount: w.paymentAmount ?? 50000,
            currency: "INR",
            order_id: "order_TOPUP1",
          });
    if (url.startsWith("https://api.razorpay.com/v1/payments/"))
      return json(200, {
        status: w.paymentStatus ?? "captured",
        amount: w.paymentAmount ?? 50000,
        currency: "INR",
        order_id: "order_TOPUP1",
      });
    if (url.endsWith("/rest/v1/rpc/credit_wallet_topup")) {
      credited += 1;
      return json(200, { success: true, new_balance: 500, already_credited: credited > 1 });
    }
    if (url.includes("/rest/v1/bookings?payment_intent_id=")) return json(200, []);
    if (url.includes("/rest/v1/bookings?id=eq.") && method === "GET")
      return json(200, [
        {
          id: BOOKING,
          customer_id: USER,
          status: "in_progress",
          estimated_fare: 400,
          final_fare: null,
          payment_status: "pending",
          payment_intent_id: null,
        },
      ]);
    if (url.includes("/rest/v1/bookings?id=eq.") && method === "PATCH")
      return json(200, [{ id: BOOKING }]);
    return json(500, {});
  }) as typeof fetch;
  return { calls, deps: { fetch: f, hmacSha256Hex: hmac } };
}

const settleInput = (over: Record<string, string> = {}) => ({
  razorpay_order_id: "order_TOPUP1",
  razorpay_payment_id: "pay_TOPUP1",
  razorpay_signature: sign("order_TOPUP1", "pay_TOPUP1"),
  accessToken: "jwt",
  ...over,
});

test("top-up order is tagged with the caller and amount-checked", async () => {
  const w = fake();
  const r = await createWalletTopupOrder({ accessToken: "jwt", amount: 500 }, config, w.deps);
  assert.equal(r.status, 200);
  assert.equal(r.body.amount, 50000);
  const post = w.calls.find((c) => c.method === "POST");
  assert.deepEqual((post?.body as { notes: unknown }).notes, {
    kind: "wallet_topup",
    user_id: USER,
  });
  assert.equal(
    (await createWalletTopupOrder({ accessToken: "jwt", amount: 50 }, config, fake().deps)).status,
    400,
  );
  assert.equal(
    (await createWalletTopupOrder({ accessToken: "jwt", amount: 99.5 }, config, fake().deps))
      .status,
    400,
  );
  assert.equal(
    (await createWalletTopupOrder({ accessToken: undefined, amount: 500 }, config, fake().deps))
      .status,
    401,
  );
});

test("top-up is credited once for a verified, captured payment of the caller's order", async () => {
  const w = fake();
  const r = await settleWalletTopup(settleInput(), config, w.deps);
  assert.equal(r.status, 200);
  assert.equal(r.body.settled, true);
  const rpc = w.calls.find((c) => c.url.endsWith("/rpc/credit_wallet_topup"));
  assert.deepEqual(rpc?.body, {
    _user_id: USER,
    _amount: 500,
    _payment_id: "pay_TOPUP1",
    _description: "Wallet top-up (Razorpay)",
  });
});

test("top-up rejects forged signatures, other users' orders and amount mismatches", async () => {
  assert.equal(
    (
      await settleWalletTopup(
        settleInput({ razorpay_signature: "ab".repeat(32) }),
        config,
        fake().deps,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await settleWalletTopup(
        settleInput(),
        config,
        fake({ orderNotes: { kind: "wallet_topup", user_id: OTHER } }).deps,
      )
    ).status,
    403,
  );
  assert.equal(
    (await settleWalletTopup(settleInput(), config, fake({ paymentAmount: 100 }).deps)).status,
    402,
  );
  assert.equal(
    (await settleWalletTopup(settleInput(), config, fake({ paymentStatus: "failed" }).deps)).status,
    402,
  );
});

test("authorized payments are captured before being treated as paid", async () => {
  const w = fake({ paymentStatus: "authorized" });
  assert.equal((await settleWalletTopup(settleInput(), config, w.deps)).status, 200);
  assert.ok(w.calls.some((c) => c.url.endsWith("/capture")));
  assert.equal(
    (
      await settleWalletTopup(
        settleInput(),
        config,
        fake({ paymentStatus: "authorized", captureOk: false }).deps,
      )
    ).status,
    502,
  );
});

test("webhook payment.captured credits top-ups and settles tagged bookings; ignores others", async () => {
  const event = {
    event: "payment.captured",
    payload: { payment: { entity: { id: "pay_TOPUP1", order_id: "order_TOPUP1", amount: 50000 } } },
  };
  const w = fake();
  assert.equal((await processRazorpayWebhookEvent(event, config, w.deps)).body.settled, true);
  const b = fake({
    orderNotes: { kind: "booking", booking_id: BOOKING },
    orderAmount: 40000,
    paymentAmount: 40000,
  });
  assert.equal((await processRazorpayWebhookEvent(event, config, b.deps)).body.settled, true);
  assert.ok(b.calls.some((c) => c.method === "PATCH"));
  assert.equal(
    (await processRazorpayWebhookEvent({ event: "order.paid" }, config, fake().deps)).body.settled,
    false,
  );
  assert.equal(
    (await processRazorpayWebhookEvent(event, config, fake({ orderNotes: {} }).deps)).body.settled,
    false,
  );
});

test("booking settlement still requires the caller to own the booking", async () => {
  const r = await settleRazorpayPayment(
    { ...settleInput(), bookingId: BOOKING },
    config,
    fake({ paymentAmount: 40000 }).deps,
  );
  assert.equal(r.status, 200);
});
