import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInvoiceEmail } from "../src/lib/invoice-email.ts";

const RIDER = "55555555-5555-4555-8555-555555555555";
const DRIVER_USER = "11111111-1111-4111-8111-111111111111";
const STRANGER = "66666666-6666-4666-8666-666666666666";
const ADMIN = "33333333-3333-4333-8333-333333333333";
const BOOKING = "22222222-2222-4222-8222-222222222222";
const config = {
  supabaseUrl: "https://db.example",
  supabaseAnonKey: "anon",
  serviceRoleKey: "svc",
};

function deps(status = "completed") {
  const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s });
  const users: Record<string, string> = {
    "Bearer rider": RIDER,
    "Bearer driver": DRIVER_USER,
    "Bearer stranger": STRANGER,
    "Bearer admin": ADMIN,
  };
  return {
    hmacSha256Hex: async () => "",
    fetch: (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const auth = (init?.headers as Record<string, string> | undefined)?.["Authorization"] || "";
      if (url.endsWith("/auth/v1/user")) {
        return users[auth] ? json(200, { id: users[auth] }) : json(401, {});
      }
      if (url.includes("/rest/v1/bookings?id=eq.")) {
        return json(200, [
          {
            id: BOOKING,
            reference: "AB12CD34",
            status,
            customer_id: RIDER,
            driver_id: "d1",
            pickup_area: "IGI Airport T3, Delhi",
            drop_area: "Connaught Place, Delhi",
            vehicle_name: "Mahindra BE.6",
            vehicle_number: "DL01AB1234",
            final_fare: 1050,
            estimated_fare: 999,
            payment_method: "upi",
            distance_km: 16.2,
            duration_min: 38,
            completed_at: "2026-10-26T10:00:00Z",
            created_at: "2026-10-26T09:20:00Z",
            driver: { user_id: DRIVER_USER, vehicle_number: "DL01AB1234" },
          },
        ]);
      }
      if (url.includes("/rest/v1/user_roles")) return json(200, url.includes(ADMIN) ? [{}] : []);
      if (url.includes("/rest/v1/profiles"))
        return json(200, [{ full_name: "Asha", phone: "9876543210" }]);
      throw new Error(`unexpected ${url}`);
    }) as typeof fetch,
  };
}

test("invoice figures come from the booking, not the request", async () => {
  const r = await buildInvoiceEmail(
    { accessToken: "rider", bookingId: BOOKING, to: "asha@example.com" },
    config,
    deps(),
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.payload.totalFare, 1050);
  assert.equal(r.payload.subtotal, 1000);
  assert.equal(r.payload.cgst + r.payload.sgst, 50);
  assert.equal(r.payload.customerName, "Asha");
  assert.equal(r.payload.invoiceNumber, "OT/26-27/12CD34");
  assert.equal(r.payload.profile?.gstin, "07AAFCO0132P1ZD");
});

test("only the passenger, the driver or an admin can email the invoice", async () => {
  for (const who of ["rider", "driver", "admin"]) {
    const r = await buildInvoiceEmail(
      { accessToken: who, bookingId: BOOKING, to: "a@b.co" },
      config,
      deps(),
    );
    assert.equal(r.ok, true, who);
  }
  const s = await buildInvoiceEmail(
    { accessToken: "stranger", bookingId: BOOKING, to: "a@b.co" },
    config,
    deps(),
  );
  assert.deepEqual(s, { ok: false, status: 403, error: "This is not your ride." });
  const anon = await buildInvoiceEmail({ bookingId: BOOKING, to: "a@b.co" }, config, deps());
  assert.equal(anon.ok ? 200 : anon.status, 401);
});

test("bad input is refused", async () => {
  const bad = async (input: Record<string, unknown>, status: number) => {
    const r = await buildInvoiceEmail(
      { accessToken: "rider", bookingId: BOOKING, to: "a@b.co", ...input },
      config,
      deps(),
    );
    assert.equal(r.ok ? 200 : r.status, status, JSON.stringify(input));
  };
  await bad({ to: "a@b.co\r\nBcc: x@y.z" }, 400);
  await bad({ to: "a@b.co, c@d.ef" }, 400);
  await bad({ to: "not-an-email" }, 400);
  await bad({ bookingId: "1 or 1=1" }, 400);
  await bad({ corporateName: "Acme", corporateGstin: "<script>" }, 400);
  const notDone = await buildInvoiceEmail(
    { accessToken: "rider", bookingId: BOOKING, to: "a@b.co" },
    config,
    deps("in_progress"),
  );
  assert.equal(notDone.ok ? 200 : notDone.status, 409);
});
