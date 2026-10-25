import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

import { generateInvoiceHtml, SendInvoicePayload } from "./lib/send-invoice-email";
import {
  createWalletTopupOrder,
  processRazorpayWebhookEvent,
  safeEqualHex,
  settleRazorpayPayment,
  settleWalletTopup,
  type SettlementConfig,
  supabaseKeyHeaders,
} from "./lib/razorpay-settlement";

const invoiceRateLimits = new Map<string, { count: number; resetAt: number }>();

function checkInvoiceRateLimit(key: string, limit = 5, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = invoiceRateLimits.get(key);
  if (!entry || now > entry.resetAt) {
    invoiceRateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) {
    return false;
  }
  entry.count++;
  return true;
}

async function handleSendInvoiceApi(request: Request, env: unknown): Promise<Response> {
  try {
    // 1. Enforce authentication on sensitive outbound email dispatch
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized: Valid authentication token required to dispatch invoices.",
        }),
        {
          status: 401,
          headers: { "content-type": "application/json" },
        },
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing authentication bearer token." }),
        { status: 401, headers: { "content-type": "application/json" } },
      );
    }

    // Verify token with Supabase Auth
    const supabaseUrl =
      (env as any)?.VITE_SUPABASE_URL ||
      (typeof process !== "undefined" ? process.env?.["VITE_SUPABASE_URL"] : undefined) ||
      "https://qcrpzrrzjddwqebaktyu.supabase.co";
    const supabaseAnonKey =
      (env as any)?.VITE_SUPABASE_PUBLISHABLE_KEY ||
      (typeof process !== "undefined"
        ? process.env?.["VITE_SUPABASE_PUBLISHABLE_KEY"]
        : undefined) ||
      "sb_publishable_j3AZt-Mp2AapyNbCTcys4w_gbNzhfrx";

    try {
      const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: supabaseAnonKey,
        },
      });

      // Fail closed: any non-OK answer (or no user id) means the caller is not authenticated.
      // Previously only 401/403 were rejected and network errors fell back to "token present",
      // which let any string send company-branded email to any address.
      if (!userRes.ok) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: Session invalid or expired." }),
          { status: 401, headers: { "content-type": "application/json" } },
        );
      }
      const userData = (await userRes.json()) as { id?: string };
      if (!userData?.id) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: Session invalid or expired." }),
          { status: 401, headers: { "content-type": "application/json" } },
        );
      }
      if (!checkInvoiceRateLimit(userData.id, 5, 60000)) {
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded. Maximum 5 invoice dispatches per minute.",
          }),
          { status: 429, headers: { "content-type": "application/json" } },
        );
      }
    } catch {
      return new Response(
        JSON.stringify({ error: "Authentication service unavailable. Please try again." }),
        { status: 503, headers: { "content-type": "application/json" } },
      );
    }

    const body = (await request.json()) as SendInvoicePayload;
    if (!body || !body.to || !body.invoiceNumber) {
      return new Response(
        JSON.stringify({ error: "Missing required fields (to, invoiceNumber)" }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        },
      );
    }

    // Prevent email header injection
    if (body.to.includes("\r") || body.to.includes("\n")) {
      return new Response(JSON.stringify({ error: "Invalid recipient header format." }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.to)) {
      return new Response(JSON.stringify({ error: "Invalid recipient email address" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // 2. Retrieve API Key strictly from deployment environment (no hardcoded secret fallbacks)
    const apiKey =
      (env as any)?.RESEND_API_KEY ||
      (typeof process !== "undefined" ? process.env?.["RESEND_API_KEY"] : undefined);

    if (!apiKey) {
      console.error("[Security] RESEND_API_KEY is not configured in server environment.");
      return new Response(
        JSON.stringify({
          error: "Email delivery service unavailable. Contact system administration.",
        }),
        {
          status: 503,
          headers: { "content-type": "application/json" },
        },
      );
    }

    const html = generateInvoiceHtml(body);

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Orange Taxi Invoices <billing@orange-taxi.com>",
        to: [body.to],
        subject: `GST Tax Invoice #${body.invoiceNumber} — Orange Taxi`,
        html,
      }),
    });

    const resendData = (await resendRes.json()) as any;
    if (!resendRes.ok) {
      return new Response(
        JSON.stringify({ error: resendData?.message || "Failed to dispatch email via Resend" }),
        {
          status: resendRes.status,
          headers: { "content-type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ success: true, id: resendData.id }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to process invoice email request" }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      },
    );
  }
}

async function verifyHmacSha256(
  message: string,
  secret: string,
  signature: string,
): Promise<boolean> {
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(message));
    const signHex = Array.from(new Uint8Array(signBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return safeEqualHex(signHex, signature);
  } catch (e) {
    console.error("Crypto verification error:", e);
    return false;
  }
}

async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function readEnv(env: unknown, name: string): string | undefined {
  const fromBinding = (env as Record<string, unknown> | undefined)?.[name];
  if (typeof fromBinding === "string" && fromBinding) return fromBinding;
  return typeof process !== "undefined" ? process.env?.[name] : undefined;
}

function settlementConfig(env: unknown): SettlementConfig {
  return {
    supabaseUrl: readEnv(env, "VITE_SUPABASE_URL") || "https://qcrpzrrzjddwqebaktyu.supabase.co",
    supabaseAnonKey:
      readEnv(env, "VITE_SUPABASE_PUBLISHABLE_KEY") ||
      "sb_publishable_j3AZt-Mp2AapyNbCTcys4w_gbNzhfrx",
    serviceRoleKey: readEnv(env, "SUPABASE_SERVICE_ROLE_KEY"),
    razorpayKeyId: readEnv(env, "RAZORPAY_KEY_ID") || readEnv(env, "VITE_RAZORPAY_KEY_ID"),
    razorpayKeySecret: readEnv(env, "RAZORPAY_KEY_SECRET"),
  };
}

const settlementDeps = {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init),
  hmacSha256Hex,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = (await request.json()) as unknown;
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function bearer(request: Request): string | undefined {
  const h = request.headers.get("authorization") || "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : undefined;
}

async function handleSettleRazorpayPayment(request: Request, env: unknown): Promise<Response> {
  const body = await readJsonBody(request);
  if (!body) return jsonResponse(400, { settled: false, error: "Invalid JSON body" });
  const result = await settleRazorpayPayment(
    {
      bookingId: str(body["bookingId"]),
      razorpay_order_id: str(body["razorpay_order_id"]),
      razorpay_payment_id: str(body["razorpay_payment_id"]),
      razorpay_signature: str(body["razorpay_signature"]),
      accessToken: bearer(request),
    },
    settlementConfig(env),
    settlementDeps,
  );
  return jsonResponse(result.status, result.body);
}

async function handleWalletTopupOrder(request: Request, env: unknown): Promise<Response> {
  const body = await readJsonBody(request);
  if (!body) return jsonResponse(400, { error: "Invalid JSON body" });
  const result = await createWalletTopupOrder(
    { accessToken: bearer(request), amount: body["amount"] },
    settlementConfig(env),
    settlementDeps,
  );
  return jsonResponse(result.status, result.body);
}

async function handleWalletTopupSettle(request: Request, env: unknown): Promise<Response> {
  const body = await readJsonBody(request);
  if (!body) return jsonResponse(400, { settled: false, error: "Invalid JSON body" });
  const result = await settleWalletTopup(
    {
      razorpay_order_id: str(body["razorpay_order_id"]),
      razorpay_payment_id: str(body["razorpay_payment_id"]),
      razorpay_signature: str(body["razorpay_signature"]),
      accessToken: bearer(request),
    },
    settlementConfig(env),
    settlementDeps,
  );
  return jsonResponse(result.status, result.body);
}

async function quotedFare(
  cfg: SettlementConfig,
  vehicleCode: unknown,
  distanceKm: number,
): Promise<number | null> {
  try {
    const res = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/fn_fare_quote`, {
      method: "POST",
      headers: {
        ...supabaseKeyHeaders(cfg.supabaseAnonKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        _vehicle_code: typeof vehicleCode === "string" ? vehicleCode : "ORANGE_SIGNATURE",
        _distance_km: Math.max(0, distanceKm),
      }),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ total?: number | string }>;
    const total = Number(rows?.[0]?.total);
    return Number.isFinite(total) && total > 0 ? total : null;
  } catch {
    return null;
  }
}

async function bookedFare(cfg: SettlementConfig, bookingId: string): Promise<number | null> {
  if (!cfg.serviceRoleKey) return null;
  try {
    const res = await fetch(
      `${cfg.supabaseUrl}/rest/v1/bookings?id=eq.${encodeURIComponent(bookingId)}&select=estimated_fare,final_fare`,
      { headers: supabaseKeyHeaders(cfg.serviceRoleKey) },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{
      estimated_fare?: number | string;
      final_fare?: number | string | null;
    }>;
    const fare = Number(rows?.[0]?.final_fare ?? rows?.[0]?.estimated_fare);
    return Number.isFinite(fare) && fare > 0 ? fare : null;
  } catch {
    return null;
  }
}

async function handleCreateRazorpayOrder(request: Request, env: unknown): Promise<Response> {
  try {
    const body = (await request.json()) as {
      amount?: number;
      distanceKm?: number;
      vehicleCode?: string;
      bookingId?: string;
    };
    // Tag mid-ride payments with the booking so the verified webhook can settle them too.
    const bookingNotes =
      typeof body.bookingId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.bookingId)
        ? { kind: "booking", booking_id: body.bookingId }
        : undefined;

    // The order must match what the database will charge: the booked fare for a mid-ride payment,
    // otherwise the admin-set tariff (public.fn_fare_quote, same formula as the booking check).
    const cfg = settlementConfig(env);
    const serverFare = bookingNotes
      ? await bookedFare(cfg, bookingNotes.booking_id)
      : await quotedFare(cfg, body.vehicleCode, Number(body.distanceKm) || 0);
    if (serverFare === null) {
      return jsonResponse(503, {
        success: false,
        error: "Pricing is unavailable. Please try again.",
        reason: bookingNotes
          ? "Could not read the booking (check SUPABASE_SERVICE_ROLE_KEY on the Worker)."
          : "Could not get a fare quote from the database (fn_fare_quote).",
      });
    }
    const effectiveFare = bookingNotes
      ? serverFare
      : Math.max(serverFare, Number(body.amount) || serverFare);
    const amountInPaise = Math.round(effectiveFare * 100);

    const keyId =
      (env as any)?.RAZORPAY_KEY_ID ||
      (typeof process !== "undefined" ? process.env?.["RAZORPAY_KEY_ID"] : undefined) ||
      (typeof process !== "undefined" ? process.env?.["VITE_RAZORPAY_KEY_ID"] : undefined) ||
      "";

    const keySecret =
      (env as any)?.RAZORPAY_KEY_SECRET ||
      (typeof process !== "undefined" ? process.env?.["RAZORPAY_KEY_SECRET"] : undefined);

    // Why no order could be made, returned to the browser so the cause is visible without logs.
    // (Razorpay's error description never contains the key secret.)
    let reason = "Razorpay keys are not configured on the server.";
    if (keySecret && keyId && !keyId.startsWith("mock") && keyId.length > 0) {
      try {
        const authCredentials = btoa(`${keyId}:${keySecret}`);
        const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
          method: "POST",
          headers: {
            Authorization: `Basic ${authCredentials}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: amountInPaise,
            currency: "INR",
            receipt: `rcpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            ...(bookingNotes ? { notes: bookingNotes } : {}),
          }),
        });

        if (!rzpRes.ok) {
          const rzpErr = (await rzpRes.json().catch(() => null)) as {
            error?: { description?: string };
          } | null;
          reason = `Razorpay rejected the order (${rzpRes.status}): ${rzpErr?.error?.description || "unknown error"}`;
          console.warn("[razorpay] order creation failed:", reason);
        }
        if (rzpRes.ok) {
          const rzpData = (await rzpRes.json()) as any;
          return new Response(
            JSON.stringify({
              success: true,
              orderId: rzpData.id,
              amount: rzpData.amount,
              currency: rzpData.currency,
              keyId,
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
      } catch (e) {
        reason = "Could not reach Razorpay.";
        console.warn("Razorpay API order creation error:", e);
      }
    }

    // No order, no checkout: an order-less checkout can never be verified or settled, so the
    // customer could be charged for a ride that is never booked.
    return jsonResponse(503, {
      success: false,
      error:
        "Online payments are temporarily unavailable. Please choose cash or try again shortly.",
      reason,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to initialize payment order" }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}

async function handleVerifyRazorpayPayment(request: Request, env: unknown): Promise<Response> {
  try {
    const body = (await request.json()) as {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    };

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
    if (!razorpay_payment_id) {
      return new Response(
        JSON.stringify({ verified: false, error: "Missing razorpay_payment_id" }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }

    const keySecret =
      (env as any)?.RAZORPAY_KEY_SECRET ||
      (typeof process !== "undefined" ? process.env?.["RAZORPAY_KEY_SECRET"] : undefined);

    if (!keySecret) {
      return new Response(
        JSON.stringify({
          verified: false,
          error:
            "Payment verification unavailable: RAZORPAY_KEY_SECRET is not configured on the server",
        }),
        { status: 503, headers: { "content-type": "application/json" } },
      );
    }

    if (!razorpay_order_id || !razorpay_signature) {
      return new Response(
        JSON.stringify({
          verified: false,
          error: "Missing razorpay_order_id or razorpay_signature for cryptographic verification",
        }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }

    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const isValid = await verifyHmacSha256(payload, keySecret, razorpay_signature);
    if (!isValid) {
      return new Response(
        JSON.stringify({ verified: false, error: "Cryptographic signature mismatch" }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ verified: true, paymentId: razorpay_payment_id }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ verified: false, error: err.message || "Payment verification failed" }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}

const processedWebhookEvents = new Set<string>();

async function handleRazorpayWebhook(request: Request, env: unknown): Promise<Response> {
  try {
    const signature = request.headers.get("x-razorpay-signature");
    const rawBody = await request.text();

    const webhookSecret =
      (env as any)?.RAZORPAY_WEBHOOK_SECRET ||
      (typeof process !== "undefined" ? process.env?.["RAZORPAY_WEBHOOK_SECRET"] : undefined);

    // The webhook credits wallets and settles bookings, so it must never run unverified
    // (previously a missing secret was tolerated outside NODE_ENV=production).
    if (!webhookSecret) {
      return jsonResponse(503, {
        error: "Webhook verification unavailable: RAZORPAY_WEBHOOK_SECRET not configured",
      });
    }
    if (!signature) {
      return jsonResponse(400, { error: "Missing x-razorpay-signature header" });
    }
    if (!(await verifyHmacSha256(rawBody, webhookSecret, signature))) {
      return jsonResponse(400, { error: "Invalid webhook signature" });
    }

    let eventData: any;
    try {
      eventData = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const eventId = eventData?.id || eventData?.event_id;
    if (eventId && processedWebhookEvents.has(eventId)) {
      return new Response(JSON.stringify({ status: "already_processed", event_id: eventId }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (eventId) {
      processedWebhookEvents.add(eventId);
      if (processedWebhookEvents.size > 1000) {
        const iter = processedWebhookEvents.values();
        processedWebhookEvents.delete(iter.next().value!);
      }
    }

    const eventType = eventData?.event;
    const outcome = await processRazorpayWebhookEvent(
      eventData,
      settlementConfig(env),
      settlementDeps,
    );
    if (outcome.status >= 500) {
      // Let Razorpay retry transient failures; drop the dedupe mark so the retry is processed.
      if (eventId) processedWebhookEvents.delete(eventId);
      return jsonResponse(outcome.status, { error: outcome.body.error });
    }
    return jsonResponse(200, { success: true, event: eventType, settled: outcome.body.settled });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Webhook processing error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
  <url>
    <loc>https://orange-taxi.com/</loc>
    <lastmod>2026-09-15</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://orange-taxi.com/book</loc>
    <lastmod>2026-09-15</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://orange-taxi.com/drive</loc>
    <lastmod>2026-09-15</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://orange-taxi.com/track</loc>
    <lastmod>2026-09-15</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://orange-taxi.com/business</loc>
    <lastmod>2026-09-15</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://orange-taxi.com/talk-to-orange</loc>
    <lastmod>2026-09-15</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://orange-taxi.com/electric</loc>
    <lastmod>2026-09-15</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://orange-taxi.com/experience</loc>
    <lastmod>2026-09-15</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://orange-taxi.com/about</loc>
    <lastmod>2026-09-15</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://orange-taxi.com/contact</loc>
    <lastmod>2026-09-15</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://orange-taxi.com/support</loc>
    <lastmod>2026-09-15</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://orange-taxi.com/login</loc>
    <lastmod>2026-09-15</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://orange-taxi.com/terms</loc>
    <lastmod>2026-09-15</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>https://orange-taxi.com/privacy</loc>
    <lastmod>2026-09-15</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>`;

function applySecurityHeaders(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  headers.set("Permissions-Policy", "camera=(), microphone=(), payment=(self)");
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://maps.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.razorpay.com https://checkout.razorpay.com https://lumberjack.razorpay.com https://lumberjack-rzp.razorpay.com https://maps.googleapis.com; frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com; object-src 'none'; base-uri 'self';",
  );
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

// Nitro calls this entry without the Worker's env, and its process polyfill doesn't expose
// Worker variables or secrets. Read them from Cloudflare's runtime module instead.
let cachedWorkerEnv: Record<string, unknown> | null = null;
async function workerEnv(passed: unknown): Promise<unknown> {
  if (passed && typeof passed === "object" && Object.keys(passed as object).length > 0)
    return passed;
  if (cachedWorkerEnv) return cachedWorkerEnv;
  try {
    const mod = (await import(/* @vite-ignore */ "cloudflare:workers")) as {
      env?: Record<string, unknown>;
    };
    if (mod?.env) {
      cachedWorkerEnv = mod.env;
      // Code that reads process.env directly (server functions, auth middleware) needs them too.
      if (typeof process !== "undefined" && process.env) {
        for (const [k, v] of Object.entries(mod.env)) {
          if (typeof v === "string" && process.env[k] === undefined) process.env[k] = v;
        }
      }
    }
  } catch {
    // Not running on Cloudflare (local Node dev): process.env is used instead.
  }
  return cachedWorkerEnv ?? passed;
}

export default {
  async fetch(request: Request, rawEnv: unknown, ctx: unknown) {
    const env = await workerEnv(rawEnv);
    try {
      const url = new URL(request.url);
      const host = url.hostname.toLowerCase();

      // Subdomain and domain detection
      const isBookingsSubdomain =
        host === "bookings.orange-taxi.com" ||
        host === "bookings.localhost" ||
        url.searchParams.get("__subdomain") === "bookings";

      const isAdminSubdomain =
        host === "admin.orange-taxi.com" ||
        host === "admin.localhost" ||
        url.searchParams.get("__subdomain") === "admin";

      const isMainDomain = host === "orange-taxi.com" || host === "www.orange-taxi.com";

      // 1. Canonical host and HTTPS enforcement for search crawlers
      if (
        host === "www.orange-taxi.com" ||
        (url.protocol === "http:" && (isMainDomain || isBookingsSubdomain || isAdminSubdomain))
      ) {
        url.protocol = "https:";
        if (host === "www.orange-taxi.com") {
          url.hostname = "orange-taxi.com";
        }
        return Response.redirect(url.toString(), 301);
      }

      // 2. Subdomain: bookings.orange-taxi.com
      if (isBookingsSubdomain) {
        // Root / on bookings immediately directs to the booking engine /book
        if (url.pathname === "/") {
          url.pathname = "/book";
          return Response.redirect(url.toString(), 302);
        }

        // If visiting a flagship marketing route on bookings subdomain, redirect to main site
        const marketingRoutes = [
          "/about",
          "/drive",
          "/business",
          "/electric",
          "/experience",
          "/contact",
          "/support",
          "/terms",
          "/privacy",
        ];
        if (marketingRoutes.includes(url.pathname)) {
          const mainTarget = new URL(url.pathname + url.search, "https://orange-taxi.com");
          return Response.redirect(mainTarget.toString(), 302);
        }
      }

      // 3. Subdomain: admin.orange-taxi.com
      if (isAdminSubdomain) {
        // Root / on admin immediately directs to /admin
        if (url.pathname === "/") {
          url.pathname = "/admin";
          return Response.redirect(url.toString(), 302);
        }
      }

      // 4. Main Domain: orange-taxi.com (Flagship Marketing Showcase)
      if (isMainDomain) {
        // Direct /book requests to the dedicated bookings subdomain
        if (url.pathname === "/book") {
          const bookingTarget = new URL("/book" + url.search, "https://bookings.orange-taxi.com");
          return Response.redirect(bookingTarget.toString(), 301);
        }

        // Direct /admin requests to the dedicated admin subdomain
        if (url.pathname === "/admin") {
          const adminTarget = new URL("/admin" + url.search, "https://admin.orange-taxi.com");
          return Response.redirect(adminTarget.toString(), 301);
        }

        // Direct /track requests to the dedicated bookings tracking
        if (url.pathname === "/track") {
          const trackTarget = new URL("/track" + url.search, "https://bookings.orange-taxi.com");
          return Response.redirect(trackTarget.toString(), 301);
        }
      }

      if (url.pathname === "/sitemap.xml") {
        return applySecurityHeaders(
          new Response(SITEMAP_XML, {
            status: 200,
            headers: {
              "content-type": "application/xml; charset=utf-8",
              "cache-control": "public, max-age=3600, s-maxage=86400",
            },
          }),
        );
      }

      if (url.pathname === "/api/send-invoice" && request.method === "POST") {
        const invoiceRes = await handleSendInvoiceApi(request, env);
        return applySecurityHeaders(invoiceRes);
      }

      if (url.pathname === "/api/create-razorpay-order" && request.method === "POST") {
        const orderRes = await handleCreateRazorpayOrder(request, env);
        return applySecurityHeaders(orderRes);
      }

      if (url.pathname === "/api/verify-razorpay-payment" && request.method === "POST") {
        const verifyRes = await handleVerifyRazorpayPayment(request, env);
        return applySecurityHeaders(verifyRes);
      }

      if (url.pathname === "/api/settle-razorpay-payment" && request.method === "POST") {
        const settleRes = await handleSettleRazorpayPayment(request, env);
        return applySecurityHeaders(settleRes);
      }

      if (url.pathname === "/api/wallet-topup/order" && request.method === "POST") {
        return applySecurityHeaders(await handleWalletTopupOrder(request, env));
      }

      if (url.pathname === "/api/wallet-topup/settle" && request.method === "POST") {
        return applySecurityHeaders(await handleWalletTopupSettle(request, env));
      }

      if (url.pathname === "/api/razorpay-webhook" && request.method === "POST") {
        const webhookRes = await handleRazorpayWebhook(request, env);
        return applySecurityHeaders(webhookRes);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      return applySecurityHeaders(normalized);
    } catch (error) {
      console.error(error);
      return applySecurityHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    }
  },
};
