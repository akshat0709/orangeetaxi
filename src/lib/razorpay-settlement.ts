// Server-side Razorpay settlement for ride bookings and wallet top-ups.
//
// Why: the browser used to mark bookings `payment_status = 'paid'` itself after checkout. The
// database integrity trigger rejects that (customers may not change payment fields), the error was
// ignored, and the chauffeur was told to collect cash for a ride the passenger had already paid.
// The rider app's wallet "top-up" called top_up_wallet with a made-up payment id (rejected by the
// database, so the feature never worked). Everything now settles here, with the service-role key,
// only after Razorpay itself confirms the payment.
//
// Requires migrations 20261025120000 and 20261025130000 (service-role booking updates and
// credit_wallet_topup). Dependencies are injected so the logic is unit-testable offline.

export interface SettlementInput {
  bookingId?: string | undefined;
  razorpay_order_id?: string | undefined;
  razorpay_payment_id?: string | undefined;
  razorpay_signature?: string | undefined;
  accessToken?: string | undefined;
}

export interface SettlementConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  serviceRoleKey?: string | undefined;
  razorpayKeyId?: string | undefined;
  razorpayKeySecret?: string | undefined;
}

export interface SettlementDeps {
  fetch: typeof fetch;
  hmacSha256Hex: (message: string, secret: string) => Promise<string>;
}

export interface SettlementResult {
  status: number;
  body: {
    settled: boolean;
    error?: string;
    alreadySettled?: boolean;
    newBalance?: number;
    orderId?: string;
    amount?: number;
    currency?: string;
    keyId?: string;
  };
}

type RazorpayPayment = {
  id?: string;
  status?: string;
  amount?: number;
  order_id?: string;
  currency?: string;
};
type RazorpayOrder = { id?: string; amount?: number; notes?: Record<string, string> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RZP_ID_RE = /^[A-Za-z0-9_]{6,64}$/;
export const TOPUP_MIN_RUPEES = 100;
export const TOPUP_MAX_RUPEES = 25000;

function fail(status: number, error: string): SettlementResult {
  return { status, body: { settled: false, error } };
}

/** Constant-time comparison of two hex strings. */
export function safeEqualHex(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

function configured(config: SettlementConfig): config is SettlementConfig & {
  serviceRoleKey: string;
  razorpayKeyId: string;
  razorpayKeySecret: string;
} {
  return Boolean(config.serviceRoleKey && config.razorpayKeyId && config.razorpayKeySecret);
}

/** Headers for a Supabase key: new `sb_…` keys go only in `apikey` (they are not JWTs);
 * legacy JWT keys also need `Authorization: Bearer`. */
export function supabaseKeyHeaders(key: string): Record<string, string> {
  return key.startsWith("sb_") ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` };
}

function adminHeaders(config: { serviceRoleKey: string }) {
  return { ...supabaseKeyHeaders(config.serviceRoleKey), "Content-Type": "application/json" };
}

function rzpAuth(config: { razorpayKeyId: string; razorpayKeySecret: string }) {
  return `Basic ${btoa(`${config.razorpayKeyId}:${config.razorpayKeySecret}`)}`;
}

async function getUserId(
  accessToken: string | undefined,
  config: SettlementConfig,
  deps: SettlementDeps,
): Promise<string | null> {
  if (!accessToken) return null;
  const res = await deps.fetch(`${config.supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${accessToken}`, apikey: config.supabaseAnonKey },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string };
  return user?.id ?? null;
}

/**
 * Loads the payment and makes sure it is captured. An "authorized" payment is captured here:
 * Razorpay refunds authorized-but-uncaptured payments automatically, so it is not money yet.
 */
async function loadCapturedPayment(
  paymentId: string,
  orderId: string,
  config: { razorpayKeyId: string; razorpayKeySecret: string },
  deps: SettlementDeps,
): Promise<{ payment?: RazorpayPayment; error?: SettlementResult }> {
  const res = await deps.fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    headers: { Authorization: rzpAuth(config) },
  });
  if (!res.ok) return { error: fail(502, "Could not confirm payment with Razorpay.") };
  let payment = (await res.json()) as RazorpayPayment;
  if (payment.order_id !== orderId)
    return { error: fail(400, "Payment does not belong to this order.") };
  if (payment.currency !== "INR") return { error: fail(400, "Unexpected payment currency.") };
  if (payment.status === "authorized") {
    const cap = await deps.fetch(`https://api.razorpay.com/v1/payments/${paymentId}/capture`, {
      method: "POST",
      headers: { Authorization: rzpAuth(config), "Content-Type": "application/json" },
      body: JSON.stringify({ amount: payment.amount, currency: "INR" }),
    });
    if (!cap.ok) return { error: fail(502, "Payment is authorized but could not be captured.") };
    payment = (await cap.json()) as RazorpayPayment;
  }
  if (payment.status !== "captured") {
    return { error: fail(402, `Payment not completed (status: ${payment.status ?? "unknown"}).`) };
  }
  return { payment };
}

async function loadOrder(
  orderId: string,
  config: { razorpayKeyId: string; razorpayKeySecret: string },
  deps: SettlementDeps,
): Promise<RazorpayOrder | null> {
  const res = await deps.fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
    headers: { Authorization: rzpAuth(config) },
  });
  return res.ok ? ((await res.json()) as RazorpayOrder) : null;
}

/**
 * Marks a booking paid once Razorpay confirms a captured payment covering the fare.
 * `expectedCustomerId` is the signed-in caller (client path) or null (verified webhook path).
 */
export async function settleBookingCore(
  bookingId: string,
  paymentId: string,
  orderId: string,
  expectedCustomerId: string | null,
  config: SettlementConfig,
  deps: SettlementDeps,
): Promise<SettlementResult> {
  if (!configured(config)) return fail(503, "Payment settlement is not configured on the server.");
  const rest = `${config.supabaseUrl}/rest/v1/bookings`;
  const headers = adminHeaders(config);

  const bRes = await deps.fetch(
    `${rest}?id=eq.${bookingId}&select=id,customer_id,status,estimated_fare,final_fare,payment_status,payment_intent_id`,
    { headers },
  );
  if (!bRes.ok) return fail(502, "Could not load booking.");
  const [booking] = (await bRes.json()) as Array<{
    id: string;
    customer_id: string;
    status: string;
    estimated_fare: number | string;
    final_fare: number | string | null;
    payment_status: string;
    payment_intent_id: string | null;
  }>;
  if (!booking || (expectedCustomerId && booking.customer_id !== expectedCustomerId)) {
    return fail(404, "Booking not found.");
  }
  if (booking.payment_status === "paid") {
    return booking.payment_intent_id === paymentId
      ? { status: 200, body: { settled: true, alreadySettled: true } }
      : fail(409, "Booking is already paid.");
  }
  if (booking.status === "cancelled") return fail(409, "Booking was cancelled.");

  const dupRes = await deps.fetch(
    `${rest}?payment_intent_id=eq.${paymentId}&id=neq.${bookingId}&select=id`,
    { headers },
  );
  if (!dupRes.ok) return fail(502, "Could not check payment reuse.");
  if (((await dupRes.json()) as unknown[]).length > 0) {
    return fail(409, "Payment already used for another booking.");
  }

  const { payment, error } = await loadCapturedPayment(paymentId, orderId, config, deps);
  if (error || !payment) return error ?? fail(502, "Payment lookup failed.");
  const fare = Number(booking.final_fare ?? booking.estimated_fare) || 0;
  if (!(Number(payment.amount) >= Math.round(fare * 100))) {
    return fail(402, "Paid amount is lower than the booking fare.");
  }

  const uRes = await deps.fetch(`${rest}?id=eq.${bookingId}&payment_status=neq.paid`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({
      payment_status: "paid",
      payment_made: "yes",
      payment_intent_id: paymentId,
    }),
  });
  if (!uRes.ok) return fail(502, "Could not record the payment on the booking.");
  const updated = (await uRes.json()) as unknown[];
  if (updated.length !== 1) return fail(409, "Booking changed while settling; please refresh.");
  return { status: 200, body: { settled: true } };
}

/** Client path: signed-in passenger, signature-verified checkout response. */
export async function settleRazorpayPayment(
  input: SettlementInput,
  config: SettlementConfig,
  deps: SettlementDeps,
): Promise<SettlementResult> {
  const { bookingId, razorpay_order_id: orderId, razorpay_payment_id: paymentId } = input;
  const signature = input.razorpay_signature;
  if (!input.accessToken) return fail(401, "Authentication required.");
  if (!bookingId || !UUID_RE.test(bookingId)) return fail(400, "Invalid booking id.");
  if (
    !orderId ||
    !paymentId ||
    !signature ||
    !RZP_ID_RE.test(orderId) ||
    !RZP_ID_RE.test(paymentId)
  ) {
    return fail(400, "Missing or malformed Razorpay order/payment/signature.");
  }
  if (!configured(config)) return fail(503, "Payment settlement is not configured on the server.");

  const userId = await getUserId(input.accessToken, config, deps);
  if (!userId) return fail(401, "Session invalid or expired.");
  const expected = await deps.hmacSha256Hex(`${orderId}|${paymentId}`, config.razorpayKeySecret);
  if (!safeEqualHex(expected, signature)) return fail(400, "Payment signature mismatch.");
  return settleBookingCore(bookingId, paymentId, orderId, userId, config, deps);
}

/** Creates a Razorpay order for a wallet top-up, tagged with the caller's user id. */
export async function createWalletTopupOrder(
  input: { accessToken?: string | undefined; amount?: unknown },
  config: SettlementConfig,
  deps: SettlementDeps,
): Promise<SettlementResult> {
  if (!configured(config)) return fail(503, "Wallet top-up is not configured on the server.");
  const userId = await getUserId(input.accessToken, config, deps);
  if (!userId) return fail(401, "Session invalid or expired.");
  const rupees = Number(input.amount);
  if (!Number.isInteger(rupees) || rupees < TOPUP_MIN_RUPEES || rupees > TOPUP_MAX_RUPEES) {
    return fail(
      400,
      `Top-up must be a whole amount between ₹${TOPUP_MIN_RUPEES} and ₹${TOPUP_MAX_RUPEES}.`,
    );
  }
  const res = await deps.fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: rzpAuth(config), "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: rupees * 100,
      currency: "INR",
      receipt: `topup_${userId.slice(0, 8)}_${Date.now()}`,
      notes: { kind: "wallet_topup", user_id: userId },
    }),
  });
  if (!res.ok) return fail(502, "Could not create the payment order.");
  const order = (await res.json()) as RazorpayOrder & { currency?: string };
  return {
    status: 200,
    body: {
      settled: false,
      orderId: order.id ?? "",
      amount: Number(order.amount),
      currency: "INR",
      keyId: config.razorpayKeyId,
    },
  };
}

async function creditTopup(
  userId: string,
  payment: RazorpayPayment,
  paymentId: string,
  config: SettlementConfig & { serviceRoleKey: string },
  deps: SettlementDeps,
): Promise<SettlementResult> {
  const res = await deps.fetch(`${config.supabaseUrl}/rest/v1/rpc/credit_wallet_topup`, {
    method: "POST",
    headers: adminHeaders(config),
    body: JSON.stringify({
      _user_id: userId,
      _amount: Number(payment.amount) / 100,
      _payment_id: paymentId,
      _description: "Wallet top-up (Razorpay)",
    }),
  });
  if (!res.ok) return fail(502, "Could not credit the wallet.");
  const out = (await res.json()) as {
    success?: boolean;
    error?: string;
    new_balance?: number;
    already_credited?: boolean;
  };
  if (!out?.success) return fail(409, out?.error || "Wallet credit rejected.");
  return {
    status: 200,
    body: {
      settled: true,
      alreadySettled: Boolean(out.already_credited),
      newBalance: Number(out.new_balance),
    },
  };
}

/** Client path for top-ups: verifies signature, order ownership and capture, then credits once. */
export async function settleWalletTopup(
  input: SettlementInput,
  config: SettlementConfig,
  deps: SettlementDeps,
): Promise<SettlementResult> {
  const {
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
  } = input;
  if (
    !orderId ||
    !paymentId ||
    !signature ||
    !RZP_ID_RE.test(orderId) ||
    !RZP_ID_RE.test(paymentId)
  ) {
    return fail(400, "Missing or malformed Razorpay order/payment/signature.");
  }
  if (!configured(config)) return fail(503, "Wallet top-up is not configured on the server.");
  const userId = await getUserId(input.accessToken, config, deps);
  if (!userId) return fail(401, "Session invalid or expired.");
  const expected = await deps.hmacSha256Hex(`${orderId}|${paymentId}`, config.razorpayKeySecret);
  if (!safeEqualHex(expected, signature)) return fail(400, "Payment signature mismatch.");

  const order = await loadOrder(orderId, config, deps);
  if (!order) return fail(502, "Could not load the payment order.");
  if (order.notes?.["kind"] !== "wallet_topup" || order.notes?.["user_id"] !== userId) {
    return fail(403, "This payment order does not belong to your wallet.");
  }
  const { payment, error } = await loadCapturedPayment(paymentId, orderId, config, deps);
  if (error || !payment) return error ?? fail(502, "Payment lookup failed.");
  if (Number(payment.amount) !== Number(order.amount))
    return fail(402, "Paid amount does not match the order.");
  return creditTopup(userId, payment, paymentId, config, deps);
}

/**
 * Verified webhook path (signature checked by the caller). Settles `payment.captured` events so a
 * payment still lands if the customer closed the tab before the client call. Idempotent.
 */
export async function processRazorpayWebhookEvent(
  event: { event?: string; payload?: { payment?: { entity?: RazorpayPayment } } },
  config: SettlementConfig,
  deps: SettlementDeps,
): Promise<SettlementResult> {
  if (event?.event !== "payment.captured") return { status: 200, body: { settled: false } };
  const payment = event.payload?.payment?.entity;
  if (!payment?.id || !payment.order_id) return fail(400, "Malformed payment event.");
  if (!configured(config)) return fail(503, "Payment settlement is not configured on the server.");
  const order = await loadOrder(payment.order_id, config, deps);
  if (!order) return fail(502, "Could not load the payment order.");
  const kind = order.notes?.["kind"];
  if (kind === "wallet_topup" && order.notes?.["user_id"] && UUID_RE.test(order.notes["user_id"])) {
    if (Number(payment.amount) !== Number(order.amount))
      return fail(402, "Paid amount does not match the order.");
    return creditTopup(order.notes["user_id"], payment, payment.id, config, deps);
  }
  if (
    kind === "booking" &&
    order.notes?.["booking_id"] &&
    UUID_RE.test(order.notes["booking_id"])
  ) {
    return settleBookingCore(
      order.notes["booking_id"],
      payment.id,
      payment.order_id,
      null,
      config,
      deps,
    );
  }
  return { status: 200, body: { settled: false } };
}
