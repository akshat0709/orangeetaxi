// Builds the GST invoice for an emailed receipt from the database, not from the browser.
//
// Why: /api/send-invoice used to take every invoice field (amounts, GSTIN, company details)
// from the request body. Any signed-in user could have Orange Taxi's billing@ address send a
// "tax invoice" with made-up figures to any inbox. Now the caller only names the booking and
// the recipient; the server checks the caller rode, drove or administers that ride and fills
// in everything else from the booking itself.
import { adminHeaders, getUserId, type SettlementDeps } from "./razorpay-settlement.ts";
import { calculateRideGST, DEFAULT_COMPANY_PROFILE, formatInvoiceNumber } from "./gst-utils.ts";
import type { SendInvoicePayload } from "./send-invoice-email.ts";

export interface InvoiceConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  serviceRoleKey?: string | undefined;
}

export type InvoiceBuild =
  | { ok: true; userId: string; payload: SendInvoicePayload }
  | { ok: false; status: number; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
const GSTIN_RE = /^[0-9]{2}[A-Z0-9]{13}$/;

type BookingRow = {
  id: string;
  reference: string | null;
  status: string;
  customer_id: string | null;
  driver_id: string | null;
  pickup_area: string | null;
  drop_area: string | null;
  vehicle_name: string | null;
  vehicle_number: string | null;
  final_fare: number | string | null;
  estimated_fare: number | string | null;
  payment_method: string | null;
  distance_km: number | string | null;
  duration_min: number | string | null;
  completed_at: string | null;
  created_at: string | null;
  driver: { user_id: string | null; vehicle_number: string | null } | null;
};

const fail = (status: number, error: string): InvoiceBuild => ({ ok: false, status, error });

async function rest<T>(
  config: InvoiceConfig & { serviceRoleKey: string },
  deps: SettlementDeps,
  path: string,
): Promise<T | null> {
  const res = await deps.fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    headers: adminHeaders(config),
  });
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as T | null;
}

function clean(text: unknown, max: number): string | undefined {
  if (typeof text !== "string") return undefined;
  const t = text.replace(/[\r\n\t]+/g, " ").trim();
  return t ? t.slice(0, max) : undefined;
}

export async function buildInvoiceEmail(
  input: {
    accessToken?: string | undefined;
    bookingId?: unknown;
    to?: unknown;
    corporateName?: unknown;
    corporateGstin?: unknown;
  },
  config: InvoiceConfig,
  deps: SettlementDeps,
): Promise<InvoiceBuild> {
  if (!config.serviceRoleKey) return fail(503, "Invoice email is not configured on the server.");
  const ready = { ...config, serviceRoleKey: config.serviceRoleKey };

  const bookingId = String(input.bookingId ?? "");
  if (!UUID_RE.test(bookingId)) return fail(400, "Invalid booking.");
  const to = typeof input.to === "string" ? input.to.trim() : "";
  if (!EMAIL_RE.test(to) || /[\r\n,;<>]/.test(to)) {
    return fail(400, "Enter a valid email address.");
  }
  const corporateGstin = clean(input.corporateGstin, 15)?.toUpperCase();
  if (corporateGstin && !GSTIN_RE.test(corporateGstin)) return fail(400, "Invalid GSTIN.");

  const [uid, rows] = await Promise.all([
    getUserId(input.accessToken, config, deps),
    rest<BookingRow[]>(
      ready,
      deps,
      `bookings?id=eq.${bookingId}&select=id,reference,status,customer_id,driver_id,pickup_area,drop_area,vehicle_name,vehicle_number,final_fare,estimated_fare,payment_method,distance_km,duration_min,completed_at,created_at,driver:drivers!bookings_driver_id_fkey(user_id,vehicle_number)`,
    ),
  ]);
  if (!uid) return fail(401, "Please sign in again.");
  const b = rows?.[0];
  if (!b) return fail(404, "Booking not found.");

  let allowed = b.customer_id === uid || (b.driver?.user_id ?? null) === uid;
  if (!allowed) {
    const roles = await rest<unknown[]>(
      ready,
      deps,
      `user_roles?user_id=eq.${uid}&role=eq.admin&select=user_id`,
    );
    allowed = Array.isArray(roles) && roles.length > 0;
  }
  if (!allowed) return fail(403, "This is not your ride.");
  if (b.status !== "completed")
    return fail(409, "An invoice is available once the ride is complete.");

  const profileRows = b.customer_id
    ? await rest<Array<{ full_name: string | null; phone: string | null }>>(
        ready,
        deps,
        `profiles?id=eq.${b.customer_id}&select=full_name,phone`,
      )
    : null;
  const customer = profileRows?.[0];

  const fare = Number(b.final_fare ?? b.estimated_fare ?? 0) || 0;
  const gst = calculateRideGST(fare, b.pickup_area ?? undefined, b.drop_area ?? undefined);
  const when = b.completed_at || b.created_at || new Date().toISOString();
  const completedAt = new Date(when).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const corporateName = clean(input.corporateName, 120);
  return {
    ok: true,
    userId: uid,
    payload: {
      to,
      invoiceNumber: formatInvoiceNumber(b.reference ?? undefined, when),
      customerName: customer?.full_name || undefined,
      customerPhone: customer?.phone || undefined,
      pickupArea: b.pickup_area || "Pickup",
      dropArea: b.drop_area || "Drop",
      completedAt,
      vehicleName: b.vehicle_name || "Mahindra BE.6",
      vehiclePlate: b.vehicle_number || b.driver?.vehicle_number || undefined,
      paymentMethod: b.payment_method || "cash",
      subtotal: gst.taxableValue,
      cgst: gst.cgstAmount,
      sgst: gst.sgstAmount,
      igst: gst.igstAmount,
      totalFare: fare,
      distanceKm: b.distance_km != null ? Number(b.distance_km) : undefined,
      durationMinutes: b.duration_min != null ? Number(b.duration_min) : undefined,
      ...(corporateName && corporateGstin ? { corporateName, corporateGstin } : {}),
      profile: DEFAULT_COMPANY_PROFILE,
    },
  };
}
