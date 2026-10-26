// Server-side helpers for the sign-in "no account" message and admin refunds.
// Dependencies are injected so the logic is unit-testable offline (see tests/support-refunds.test.ts).
import {
  adminHeaders,
  configured,
  getUserId,
  rzpAuth,
  type SettlementConfig,
  type SettlementDeps,
} from "./razorpay-settlement.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Ready = SettlementConfig & {
  serviceRoleKey: string;
  razorpayKeyId: string;
  razorpayKeySecret: string;
};

async function db<T>(
  config: Ready,
  deps: SettlementDeps,
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await deps.fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: { ...adminHeaders(config), ...(init.headers as Record<string, string> | undefined) },
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data: data as T };
}

// ---- Sign-in ------------------------------------------------------------------------------------

export type EmailStatus = "none" | "unconfirmed" | "exists";

/** Whether an account exists for this email (asked only after a failed sign-in). */
export async function emailStatus(
  email: unknown,
  config: SettlementConfig,
  deps: SettlementDeps,
): Promise<{ status: number; body: { status?: EmailStatus; error?: string } }> {
  const e = String(email || "").trim();
  if (!EMAIL_RE.test(e) || e.length > 254)
    return { status: 400, body: { error: "Invalid email." } };
  if (!config.serviceRoleKey) return { status: 503, body: { error: "Not configured." } };
  const r = await db<string>(config as Ready, deps, "rpc/auth_email_status", {
    method: "POST",
    body: JSON.stringify({ _email: e }),
  });
  if (!r.ok || !["none", "unconfirmed", "exists"].includes(String(r.data))) {
    return { status: 502, body: { error: "Could not check the account." } };
  }
  return { status: 200, body: { status: r.data as EmailStatus } };
}

// ---- Refunds -----------------------------------------------------------------------------------

export interface RefundInput {
  accessToken?: string | undefined;
  bookingId?: unknown;
  amount?: unknown;
  reason?: unknown;
  /** 'auto' (default): Razorpay for online payments, wallet for wallet rides, else manual. */
  method?: unknown;
  ticketId?: unknown;
}

export interface RefundResult {
  status: number;
  body: {
    ok: boolean;
    error?: string;
    refund?: { id: string; amount: number; method: string; status: string };
    refundable?: number;
  };
}

type BookingRow = {
  id: string;
  reference: string | null;
  customer_id: string | null;
  status: string;
  payment_method: string | null;
  payment_status: string | null;
  payment_intent_id: string | null;
  estimated_fare: number | string | null;
  final_fare: number | string | null;
  cancellation_fee: number | string | null;
};

const fail = (status: number, error: string, refundable?: number): RefundResult => ({
  status,
  body: { ok: false, error, ...(refundable !== undefined ? { refundable } : {}) },
});

/** What was actually paid for this booking (a paid ride, or a cancellation fee). */
// A cancellation fee is collected as part of the passenger's next ride, so it is refunded from that
// ride. Unpaid fees are waived in Admin → Pricing instead.
export function paidAmount(b: BookingRow): number {
  if (b.payment_status !== "paid") return 0;
  return Math.round(Number(b.final_fare ?? b.estimated_fare) || 0);
}

export function refundMethodFor(
  b: BookingRow,
  requested: unknown,
): "razorpay" | "wallet" | "manual" {
  if (requested === "wallet" || requested === "manual") return requested;
  if (b.payment_method === "wallet") return "wallet";
  if (b.payment_intent_id && b.payment_intent_id.startsWith("pay_")) return "razorpay";
  return "manual";
}

/** Admin: refund (part of) a booking's payment. */
export async function createRefund(
  input: RefundInput,
  config: SettlementConfig,
  deps: SettlementDeps,
): Promise<RefundResult> {
  if (!configured(config)) return fail(503, "Refunds are not configured on the server.");
  const bookingId = String(input.bookingId || "");
  if (!UUID_RE.test(bookingId)) return fail(400, "Invalid booking.");
  const amount = Math.round(Number(input.amount));
  if (!Number.isFinite(amount) || amount < 1)
    return fail(400, "Enter a refund amount of at least ₹1.");
  const reason = String(input.reason || "")
    .trim()
    .slice(0, 500);
  if (reason.length < 3) return fail(400, "Please enter a reason for the refund.");
  const ticketId = input.ticketId ? String(input.ticketId) : null;
  if (ticketId && !UUID_RE.test(ticketId)) return fail(400, "Invalid ticket.");

  const uid = await getUserId(input.accessToken, config, deps);
  if (!uid) return fail(401, "Please sign in again.");
  const role = await db<unknown[]>(
    config,
    deps,
    `user_roles?user_id=eq.${uid}&role=eq.admin&select=user_id`,
  );
  if (!role.ok || !Array.isArray(role.data) || role.data.length === 0)
    return fail(403, "Admins only.");

  const b = await db<BookingRow[]>(
    config,
    deps,
    `bookings?id=eq.${bookingId}&select=id,reference,customer_id,status,payment_method,payment_status,payment_intent_id,estimated_fare,final_fare,cancellation_fee`,
  );
  const booking = b.data?.[0];
  if (!booking) return fail(404, "Booking not found.");
  const paid = paidAmount(booking);
  if (paid <= 0)
    return fail(409, "Nothing has been paid for this booking, so there is nothing to refund.");

  const prior = await db<Array<{ amount: unknown; status: string }>>(
    config,
    deps,
    `refunds?booking_id=eq.${bookingId}&select=amount,status`,
  );
  const already = (Array.isArray(prior.data) ? prior.data : [])
    .filter((r) => r.status !== "failed")
    .reduce((s, r) => s + (Math.round(Number(r.amount)) || 0), 0);
  const refundable = Math.max(0, paid - already);
  if (refundable <= 0) return fail(409, "This booking has already been fully refunded.", 0);
  if (amount > refundable) {
    return fail(409, `You can refund at most ₹${refundable.toLocaleString("en-IN")}.`, refundable);
  }

  const method = refundMethodFor(booking, input.method);
  const label = `Refund for ride ${booking.reference || bookingId.slice(0, 8)}`;
  let status: "processed" | "pending" = "processed";
  let razorpayRefundId: string | null = null;
  const refundRef = `refund_${bookingId.slice(0, 8)}_${Date.now().toString(36)}`;

  if (method === "razorpay") {
    if (!booking.payment_intent_id?.startsWith("pay_")) {
      return fail(
        409,
        "This ride wasn't paid through Razorpay. Refund to wallet or record a manual refund.",
      );
    }
    const res = await deps.fetch(
      `https://api.razorpay.com/v1/payments/${booking.payment_intent_id}/refund`,
      {
        method: "POST",
        headers: { Authorization: rzpAuth(config), "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amount * 100,
          speed: "normal",
          notes: { booking_id: bookingId, reason: reason.slice(0, 200) },
          receipt: refundRef.slice(0, 40),
        }),
      },
    );
    const body = (await res.json().catch(() => ({}))) as {
      id?: string;
      status?: string;
      error?: { description?: string };
    };
    if (!res.ok || !body.id) {
      return fail(502, `Razorpay refused the refund: ${body.error?.description || res.status}`);
    }
    razorpayRefundId = body.id;
    status = body.status === "processed" ? "processed" : "pending";
  } else if (method === "wallet") {
    if (!booking.customer_id) return fail(409, "This booking has no passenger account to credit.");
    const res = await db<{ success?: boolean; error?: string }>(
      config,
      deps,
      "rpc/credit_wallet_topup",
      {
        method: "POST",
        body: JSON.stringify({
          _user_id: booking.customer_id,
          _amount: amount,
          _payment_id: refundRef,
          _description: label,
        }),
      },
    );
    if (!res.ok || !res.data?.success) {
      return fail(502, `Could not credit the wallet: ${res.data?.error || res.status}`);
    }
  }
  // manual: the admin pays back by cash / UPI outside the system; we only record it.

  const saved = await db<Array<{ id: string }>>(config, deps, "refunds", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      booking_id: bookingId,
      customer_id: booking.customer_id,
      ticket_id: ticketId,
      amount,
      method,
      status,
      razorpay_refund_id: razorpayRefundId,
      reason,
      created_by: uid,
    }),
  });
  if (!saved.ok || !saved.data?.[0]) {
    // The money has moved; make sure it's visible even if the ledger write failed.
    return fail(
      500,
      `Refund made (${razorpayRefundId || refundRef}) but could not be saved to the ledger. Note it down.`,
    );
  }

  if (ticketId) {
    await db(config, deps, `support_tickets?id=eq.${ticketId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "resolved",
        admin_notes: `Refunded ₹${amount} (${method}${razorpayRefundId ? ` ${razorpayRefundId}` : ""}): ${reason}`,
      }),
    });
  }

  return {
    status: 200,
    body: {
      ok: true,
      refund: { id: saved.data[0].id, amount, method, status },
      refundable: refundable - amount,
    },
  };
}
