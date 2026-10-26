// Razorpay UPI QR payments: a one-time QR for a fixed amount, paid into Orange Taxi's account.
//   ride          — driver collects a "pay the chauffeur" fare by UPI at the end of the ride
//   cash_deposit  — company driver hands in the cash they hold (Admin → Cash Settlements)
//   commission    — commission driver pays the company's commission (Admin → Commission Ledger)
//   ride_link     — the passenger pays a ride online from the rider app (a Razorpay payment link,
//                   opened in the phone's browser; the app has no Razorpay SDK)
// Cash hand-ins and commission QRs can be made by an admin, or by the driver for themselves (then
// capped at what they owe). Settled by whichever sees the payment first: the status poll from the
// screen showing the QR / link, or Razorpay's `qr_code.credited` / `payment_link.paid` webhook.
// payment_qr_codes.status makes it happen only once.
import { partnerLedger } from "./driver-type.ts";
import {
  adminHeaders,
  configured,
  getUserId,
  rzpAuth,
  type SettlementConfig,
  type SettlementDeps,
} from "./razorpay-settlement.ts";

export type QrKind = "ride" | "cash_deposit" | "commission" | "ride_link";

export interface QrView {
  id: string;
  kind: QrKind;
  amount: number;
  status: "pending" | "paid" | "closed";
  image_url: string;
  close_by: string | null;
}

export interface QrResult {
  status: number;
  body: { ok: boolean; error?: string; qr?: QrView };
}

interface QrRow extends QrView {
  booking_id: string | null;
  driver_id: string | null;
  payment_id: string | null;
  created_by: string | null;
}

type RzpPayment = {
  id?: string | undefined;
  status?: string | undefined;
  amount?: number | undefined;
  currency?: string | undefined;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QR_ID_RE = /^(qr|plink)_[A-Za-z0-9]{6,40}$/;
const QR_LIFETIME_MIN = 20;
const LINK_LIFETIME_MIN = 30;
const isLink = (id: string) => id.startsWith("plink_");

const bad = (status: number, error: string): QrResult => ({ status, body: { ok: false, error } });
const view = (r: QrRow): QrView => ({
  id: r.id,
  kind: r.kind,
  amount: Number(r.amount),
  status: r.status,
  image_url: r.image_url,
  close_by: r.close_by,
});

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

async function isAdmin(config: Ready, deps: SettlementDeps, uid: string) {
  const r = await db<unknown[]>(
    config,
    deps,
    `user_roles?user_id=eq.${uid}&role=eq.admin&select=user_id`,
  );
  return r.ok && Array.isArray(r.data) && r.data.length > 0;
}

async function createRazorpayQr(
  config: Ready,
  deps: SettlementDeps,
  amountRupees: number,
  description: string,
  notes: Record<string, string>,
): Promise<{ id: string; image_url: string; close_by: number } | { error: string }> {
  const closeBy = Math.floor(Date.now() / 1000) + QR_LIFETIME_MIN * 60;
  const res = await deps.fetch("https://api.razorpay.com/v1/payments/qr_codes", {
    method: "POST",
    headers: { Authorization: rzpAuth(config), "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "upi_qr",
      name: "Orange Taxi",
      usage: "single_use",
      fixed_amount: true,
      payment_amount: Math.round(amountRupees * 100),
      description: description.slice(0, 100),
      close_by: closeBy,
      notes,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    id?: string;
    image_url?: string;
    error?: { description?: string };
  };
  if (!res.ok || !body.id || !body.image_url) {
    return { error: `Razorpay could not create the QR: ${body.error?.description || res.status}` };
  }
  return { id: body.id, image_url: body.image_url, close_by: closeBy };
}

async function createRazorpayLink(
  config: Ready,
  deps: SettlementDeps,
  amountRupees: number,
  description: string,
  notes: Record<string, string>,
): Promise<{ id: string; image_url: string; close_by: number } | { error: string }> {
  const closeBy = Math.floor(Date.now() / 1000) + LINK_LIFETIME_MIN * 60;
  const res = await deps.fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: { Authorization: rzpAuth(config), "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: Math.round(amountRupees * 100),
      currency: "INR",
      accept_partial: false,
      description: description.slice(0, 100),
      expire_by: closeBy,
      reminder_enable: false,
      notify: { sms: false, email: false },
      notes,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    id?: string;
    short_url?: string;
    error?: { description?: string };
  };
  if (!res.ok || !body.id || !body.short_url) {
    return {
      error: `Razorpay could not create the payment link: ${body.error?.description || res.status}`,
    };
  }
  return { id: body.id, image_url: body.short_url, close_by: closeBy };
}

async function saveQr(
  config: Ready,
  deps: SettlementDeps,
  row: Omit<QrRow, "status" | "payment_id">,
): Promise<QrResult> {
  const r = await db<QrRow[]>(config, deps, "payment_qr_codes", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...row, status: "pending" }),
  });
  if (!r.ok || !r.data?.[0]) return bad(502, "Could not save the QR code.");
  return { status: 200, body: { ok: true, qr: view(r.data[0]) } };
}

/** Driver at the end of a "pay the chauffeur" ride: QR for the fare. */
export async function createRideQr(
  input: { accessToken?: string | undefined; bookingId?: unknown },
  config: SettlementConfig,
  deps: SettlementDeps,
): Promise<QrResult> {
  if (!configured(config)) return bad(503, "UPI QR payments are not configured on the server.");
  const bookingId = String(input.bookingId || "");
  if (!UUID_RE.test(bookingId)) return bad(400, "Invalid booking.");
  // Independent lookups run together: one round trip to Supabase instead of four.
  const [uid, b, open] = await Promise.all([
    getUserId(input.accessToken, config, deps),
    db<
      Array<{
        id: string;
        driver_id: string | null;
        status: string;
        reference: string;
        estimated_fare: number | string;
        final_fare: number | string | null;
        payment_status: string;
        driver: { user_id: string | null } | null;
      }>
    >(
      config,
      deps,
      `bookings?id=eq.${bookingId}&select=id,driver_id,status,reference,estimated_fare,final_fare,payment_status,driver:drivers!bookings_driver_id_fkey(user_id)`,
    ),
    db<QrRow[]>(
      config,
      deps,
      `payment_qr_codes?booking_id=eq.${bookingId}&status=eq.pending&order=created_at.desc&limit=1&select=*`,
    ),
  ]);
  if (!uid) return bad(401, "Please sign in again.");
  const booking = b.data?.[0];
  if (!booking) return bad(404, "Booking not found.");
  const driverId = booking.driver_id;
  if (!driverId || booking.driver?.user_id !== uid) return bad(403, "This is not your ride.");
  if (!["in_progress", "completed"].includes(booking.status)) {
    return bad(409, "Start the ride before collecting payment.");
  }
  if (booking.payment_status === "paid") return bad(409, "This ride is already paid.");
  const amount = Math.round(Number(booking.final_fare ?? booking.estimated_fare) || 0);
  if (amount <= 0) return bad(409, "This ride has no fare to collect.");

  // Reuse a QR that is still open for the same amount (e.g. the driver reopened the screen).
  const existing = open.data?.[0];
  if (
    existing &&
    Number(existing.amount) === amount &&
    (!existing.close_by || new Date(existing.close_by).getTime() - Date.now() > 3 * 60_000)
  ) {
    return { status: 200, body: { ok: true, qr: view(existing) } };
  }

  const qr = await createRazorpayQr(config, deps, amount, `Ride ${booking.reference}`, {
    kind: "ride",
    booking_id: bookingId,
  });
  if ("error" in qr) return bad(502, qr.error);
  return saveQr(config, deps, {
    id: qr.id,
    kind: "ride",
    booking_id: bookingId,
    driver_id: driverId,
    amount,
    image_url: qr.image_url,
    created_by: uid,
    close_by: new Date(qr.close_by * 1000).toISOString(),
  });
}

type BookingRow = {
  id: string;
  customer_id: string | null;
  driver_id: string | null;
  status: string;
  reference: string;
  estimated_fare: number | string;
  final_fare: number | string | null;
  payment_status: string;
  payment_method: string | null;
};

/** Passenger (rider app): pay this ride online. Returns a Razorpay payment link to open. */
export async function createRideLink(
  input: { accessToken?: string | undefined; bookingId?: unknown },
  config: SettlementConfig,
  deps: SettlementDeps,
): Promise<QrResult> {
  if (!configured(config)) return bad(503, "Online payment is not configured on the server.");
  const bookingId = String(input.bookingId || "");
  if (!UUID_RE.test(bookingId)) return bad(400, "Invalid booking.");
  const uid = await getUserId(input.accessToken, config, deps);
  if (!uid) return bad(401, "Please sign in again.");
  const b = await db<BookingRow[]>(
    config,
    deps,
    `bookings?id=eq.${bookingId}&select=id,customer_id,driver_id,status,reference,estimated_fare,final_fare,payment_status,payment_method`,
  );
  const booking = b.data?.[0];
  if (!booking) return bad(404, "Booking not found.");
  if (booking.customer_id !== uid) return bad(403, "This is not your ride.");
  if (booking.status === "cancelled") return bad(409, "This ride was cancelled.");
  if (booking.payment_status === "paid") return bad(409, "This ride is already paid.");
  if (booking.payment_method === "wallet") return bad(409, "This ride is paid from your wallet.");
  const amount = Math.round(Number(booking.final_fare ?? booking.estimated_fare) || 0);
  if (amount <= 0) return bad(409, "This ride has no fare to pay.");

  const open = await db<QrRow[]>(
    config,
    deps,
    `payment_qr_codes?booking_id=eq.${bookingId}&kind=eq.ride_link&status=eq.pending&order=created_at.desc&limit=1&select=*`,
  );
  const existing = open.data?.[0];
  if (
    existing &&
    Number(existing.amount) === amount &&
    (!existing.close_by || new Date(existing.close_by).getTime() - Date.now() > 5 * 60_000)
  ) {
    return { status: 200, body: { ok: true, qr: view(existing) } };
  }

  const link = await createRazorpayLink(
    config,
    deps,
    amount,
    `Orange Taxi ride ${booking.reference}`,
    {
      kind: "ride_link",
      booking_id: bookingId,
    },
  );
  if ("error" in link) return bad(502, link.error);
  return saveQr(config, deps, {
    id: link.id,
    kind: "ride_link",
    booking_id: bookingId,
    driver_id: booking.driver_id,
    amount,
    image_url: link.image_url,
    created_by: uid,
    close_by: new Date(link.close_by * 1000).toISOString(),
  });
}

const fareOf = (r: { final_fare?: unknown; estimated_fare?: unknown }) =>
  Math.round(Number(r.final_fare ?? r.estimated_fare ?? 0)) || 0;

/** What a driver owes right now: cash they hold (company) or commission (partner). */
async function amountDriverOwes(
  config: Ready,
  deps: SettlementDeps,
  driverId: string,
  kind: "cash_deposit" | "commission",
): Promise<number> {
  const rides = await db<
    Array<{ final_fare: unknown; estimated_fare: unknown; payment_method: string | null }>
  >(
    config,
    deps,
    `bookings?driver_id=eq.${driverId}&status=eq.completed&select=final_fare,estimated_fare,payment_method&limit=10000`,
  );
  const list = Array.isArray(rides.data) ? rides.data : [];
  if (kind === "cash_deposit") {
    const held = list
      .filter((r) => r.payment_method === "cash" || r.payment_method === "driver_upi")
      .reduce((s, r) => s + fareOf(r), 0);
    const st = await db<Array<{ amount: unknown }>>(
      config,
      deps,
      `driver_cash_settlements?driver_id=eq.${driverId}&select=amount`,
    );
    const handed = (Array.isArray(st.data) ? st.data : []).reduce(
      (s, x) => s + (Math.round(Number(x.amount)) || 0),
      0,
    );
    return Math.max(0, held - handed);
  }
  const st = await db<Array<{ amount: unknown; direction: string | null }>>(
    config,
    deps,
    `driver_commission_settlements?driver_id=eq.${driverId}&select=amount,direction`,
  );
  const ps = await db<Array<{ partner_commission_percent: unknown }>>(
    config,
    deps,
    `pricing_settings?id=eq.1&select=partner_commission_percent`,
  );
  const pct = Number(ps.data?.[0]?.partner_commission_percent ?? 15);
  return Math.max(0, partnerLedger(list, Array.isArray(st.data) ? st.data : [], pct).balance);
}

/** QR for a driver's cash hand-in or a commission driver's commission payment. Admins can make
 * one for any driver; a driver can make one for themselves, up to what they owe. */
export async function createDepositQr(
  input: {
    accessToken?: string | undefined;
    driverId?: unknown;
    amount?: unknown;
    kind?: unknown;
    /** Payment link instead of a QR: for paying from the same phone (the driver app). */
    link?: unknown;
  },
  config: SettlementConfig,
  deps: SettlementDeps,
): Promise<QrResult> {
  if (!configured(config)) return bad(503, "UPI QR payments are not configured on the server.");
  const kind =
    input.kind === "commission"
      ? "commission"
      : input.kind === "cash_deposit"
        ? "cash_deposit"
        : null;
  if (!kind) return bad(400, "Unknown QR type.");
  const driverId = String(input.driverId || "");
  if (!UUID_RE.test(driverId)) return bad(400, "Invalid driver.");
  const amount = Math.round(Number(input.amount));
  if (!Number.isFinite(amount) || amount < 1 || amount > 100000) {
    return bad(400, "Amount must be between ₹1 and ₹1,00,000.");
  }
  const uid = await getUserId(input.accessToken, config, deps);
  if (!uid) return bad(401, "Please sign in again.");
  const admin = await isAdmin(config, deps, uid);
  if (!admin) {
    const me = await db<Array<{ id: string }>>(config, deps, `drivers?user_id=eq.${uid}&select=id`);
    if (me.data?.[0]?.id !== driverId) return bad(403, "You can only pay for yourself.");
  }

  const d = await db<Array<{ id: string; full_name: string; driver_type: string }>>(
    config,
    deps,
    `drivers?id=eq.${driverId}&select=id,full_name,driver_type`,
  );
  const driver = d.data?.[0];
  if (!driver) return bad(404, "Driver not found.");
  if (kind === "commission" && driver.driver_type !== "partner") {
    return bad(409, "Commission QR codes are only for commission drivers.");
  }
  if (!admin) {
    if (kind === "cash_deposit" && driver.driver_type === "partner") {
      return bad(409, "Commission drivers pay commission, not cash hand-ins.");
    }
    const owed = await amountDriverOwes(config, deps, driverId, kind);
    if (owed <= 0) return bad(409, "You don't owe anything right now.");
    if (amount > owed) return bad(409, `You can pay at most ₹${owed.toLocaleString("en-IN")}.`);
  }

  const qr = await (input.link === true ? createRazorpayLink : createRazorpayQr)(
    config,
    deps,
    amount,
    kind === "commission"
      ? `Commission – ${driver.full_name}`
      : `Cash hand-in – ${driver.full_name}`,
    { kind, driver_id: driverId },
  );
  if ("error" in qr) return bad(502, qr.error);
  return saveQr(config, deps, {
    id: qr.id,
    kind,
    booking_id: null,
    driver_id: driverId,
    amount,
    image_url: qr.image_url,
    created_by: uid,
    close_by: new Date(qr.close_by * 1000).toISOString(),
  });
}

async function loadRow(config: Ready, deps: SettlementDeps, qrId: string) {
  const r = await db<QrRow[]>(config, deps, `payment_qr_codes?id=eq.${qrId}&select=*`);
  return r.data?.[0] ?? null;
}

async function findPaidPayment(
  config: Ready,
  deps: SettlementDeps,
  row: QrRow,
): Promise<RzpPayment | null> {
  let items: RzpPayment[] = [];
  if (isLink(row.id)) {
    const res = await deps.fetch(`https://api.razorpay.com/v1/payment_links/${row.id}`, {
      headers: { Authorization: rzpAuth(config) },
    });
    if (!res.ok) return null;
    const body = (await res.json().catch(() => ({}))) as {
      payments?: Array<{ payment_id?: string; amount?: number; status?: string }> | null;
    };
    items = (body.payments || []).map((p) => ({
      id: p.payment_id,
      amount: p.amount,
      status: p.status,
      currency: "INR",
    }));
  } else {
    const res = await deps.fetch(
      `https://api.razorpay.com/v1/payments/qr_codes/${row.id}/payments`,
      { headers: { Authorization: rzpAuth(config) } },
    );
    if (!res.ok) return null;
    const body = (await res.json().catch(() => ({}))) as { items?: RzpPayment[] };
    items = body.items || [];
  }
  const need = Math.round(Number(row.amount) * 100);
  for (const p of items) {
    if (!p.id || Number(p.amount) < need || (p.currency && p.currency !== "INR")) continue;
    if (p.status === "captured") return p;
    if (p.status === "authorized") {
      const cap = await deps.fetch(`https://api.razorpay.com/v1/payments/${p.id}/capture`, {
        method: "POST",
        headers: { Authorization: rzpAuth(config), "Content-Type": "application/json" },
        body: JSON.stringify({ amount: p.amount, currency: "INR" }),
      });
      if (cap.ok) return (await cap.json()) as RzpPayment;
    }
  }
  return null;
}

/** What paying the QR does, once. */
async function applyPayment(
  config: Ready,
  deps: SettlementDeps,
  row: QrRow,
  paymentId: string,
): Promise<boolean> {
  if ((row.kind === "ride" || row.kind === "ride_link") && row.booking_id) {
    const r = await db<unknown[]>(
      config,
      deps,
      `bookings?id=eq.${row.booking_id}&payment_status=neq.paid`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          // 'upi' = paid online by the passenger, 'upi_qr' = paid by scanning the driver's QR.
          // Either way the money went to Orange Taxi, so it is never cash the driver holds.
          payment_method: row.kind === "ride_link" ? "upi" : "upi_qr",
          payment_status: "paid",
          payment_made: "yes",
          payment_intent_id: paymentId,
        }),
      },
    );
    return r.ok;
  }
  if (row.kind === "cash_deposit" && row.driver_id) {
    const r = await db(config, deps, "driver_cash_settlements", {
      method: "POST",
      body: JSON.stringify({
        driver_id: row.driver_id,
        amount: Number(row.amount),
        payment_mode: "upi_qr",
        razorpay_payment_id: paymentId,
        collected_by: "Razorpay UPI QR",
        notes: `Cash hand-in paid by UPI QR (${paymentId})`,
      }),
    });
    return r.ok || r.status === 409; // 409: already recorded for this payment
  }
  if (row.kind === "commission" && row.driver_id) {
    const d = await db<Array<{ full_name: string }>>(
      config,
      deps,
      `drivers?id=eq.${row.driver_id}&select=full_name`,
    );
    const r = await db(config, deps, "driver_commission_settlements", {
      method: "POST",
      body: JSON.stringify({
        driver_id: row.driver_id,
        driver_name: d.data?.[0]?.full_name ?? null,
        amount: Number(row.amount),
        direction: "driver_to_company",
        payment_mode: "upi",
        reference_no: paymentId,
        razorpay_payment_id: paymentId,
        collected_by: "Razorpay UPI QR",
        notes: `Commission paid by UPI QR (${paymentId})`,
      }),
    });
    return r.ok || r.status === 409;
  }
  return false;
}

async function trySettle(config: Ready, deps: SettlementDeps, row: QrRow): Promise<QrRow> {
  if (row.status !== "pending") return row;
  const payment = await findPaidPayment(config, deps, row);
  if (!payment?.id) {
    if (row.close_by && new Date(row.close_by).getTime() < Date.now()) {
      await db(config, deps, `payment_qr_codes?id=eq.${row.id}&status=eq.pending`, {
        method: "PATCH",
        body: JSON.stringify({ status: "closed" }),
      });
      return { ...row, status: "closed" };
    }
    return row;
  }
  // Claim it: only one caller (poll or webhook) gets the row back.
  const claim = await db<QrRow[]>(
    config,
    deps,
    `payment_qr_codes?id=eq.${row.id}&status=eq.pending`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        status: "paid",
        payment_id: payment.id,
        paid_at: new Date().toISOString(),
      }),
    },
  );
  if (!claim.ok || !claim.data?.length) return (await loadRow(config, deps, row.id)) ?? row;
  const applied = await applyPayment(config, deps, row, payment.id);
  if (!applied) {
    // Put it back so the next poll or webhook retry records it.
    await db(config, deps, `payment_qr_codes?id=eq.${row.id}&payment_id=eq.${payment.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "pending", payment_id: null, paid_at: null }),
    });
    return row;
  }
  return { ...row, status: "paid", payment_id: payment.id };
}

/** The screen showing the QR asks this every few seconds. */
export async function qrStatus(
  input: { accessToken?: string | undefined; qrId?: unknown },
  config: SettlementConfig,
  deps: SettlementDeps,
): Promise<QrResult> {
  if (!configured(config)) return bad(503, "UPI QR payments are not configured on the server.");
  const qrId = String(input.qrId || "");
  if (!QR_ID_RE.test(qrId)) return bad(400, "Invalid QR code.");
  const uid = await getUserId(input.accessToken, config, deps);
  if (!uid) return bad(401, "Please sign in again.");
  const row = await loadRow(config, deps, qrId);
  if (!row) return bad(404, "QR code not found.");
  if (row.created_by !== uid && !(await isAdmin(config, deps, uid)))
    return bad(403, "Not your QR code.");
  const latest = await trySettle(config, deps, row);
  return { status: 200, body: { ok: true, qr: view(latest) } };
}

/** Razorpay webhooks `qr_code.credited` and `payment_link.paid`. */
export async function settleQrFromWebhook(
  event: {
    event?: string;
    payload?: {
      qr_code?: { entity?: { id?: string } };
      payment_link?: { entity?: { id?: string } };
    };
  },
  config: SettlementConfig,
  deps: SettlementDeps,
): Promise<{ status: number; settled: boolean; error?: string }> {
  if (event?.event !== "qr_code.credited" && event?.event !== "payment_link.paid") {
    return { status: 200, settled: false };
  }
  if (!configured(config)) return { status: 503, settled: false, error: "Not configured." };
  const qrId =
    event.event === "payment_link.paid"
      ? event.payload?.payment_link?.entity?.id
      : event.payload?.qr_code?.entity?.id;
  if (!qrId || !QR_ID_RE.test(qrId))
    return { status: 400, settled: false, error: "Malformed QR event." };
  const row = await loadRow(config, deps, qrId);
  if (!row) return { status: 200, settled: false }; // not one of ours
  const latest = await trySettle(config, deps, row);
  if (latest.status === "pending")
    return { status: 502, settled: false, error: "Payment not found yet." };
  return { status: 200, settled: latest.status === "paid" };
}
