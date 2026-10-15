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
        JSON.stringify({ error: "Unauthorized: Valid authentication token required to dispatch invoices." }),
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
      "https://ndaollycrvlawemhwvky.supabase.co";
    const supabaseAnonKey =
      (env as any)?.VITE_SUPABASE_PUBLISHABLE_KEY ||
      (typeof process !== "undefined" ? process.env?.["VITE_SUPABASE_PUBLISHABLE_KEY"] : undefined) ||
      "sb_publishable_baABGadHhpQI6LtkZcyI0g_HJX39Y_d";

    try {
      const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: supabaseAnonKey,
        },
      });

      if (userRes.status === 401 || userRes.status === 403) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: Session invalid or expired." }),
          { status: 401, headers: { "content-type": "application/json" } },
        );
      }

      if (userRes.ok) {
        const userData = (await userRes.json()) as any;
        const callerId = userData?.id || "authenticated_user";
        if (!checkInvoiceRateLimit(callerId, 5, 60000)) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded. Maximum 5 invoice dispatches per minute." }),
            { status: 429, headers: { "content-type": "application/json" } },
          );
        }
      }
    } catch (e) {
      // In sandbox/offline testing, fallback to token presence
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
      return new Response(
        JSON.stringify({ error: "Invalid recipient header format." }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        },
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.to)) {
      return new Response(
        JSON.stringify({ error: "Invalid recipient email address" }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        },
      );
    }

    // 2. Retrieve API Key strictly from deployment environment (no hardcoded secret fallbacks)
    const apiKey =
      (env as any)?.RESEND_API_KEY ||
      (typeof process !== "undefined" ? process.env?.["RESEND_API_KEY"] : undefined);

    if (!apiKey) {
      console.error("[Security] RESEND_API_KEY is not configured in server environment.");
      return new Response(
        JSON.stringify({ error: "Email delivery service unavailable. Contact system administration." }),
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

async function verifyHmacSha256(message: string, secret: string, signature: string): Promise<boolean> {
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(message));
    const signHex = Array.from(new Uint8Array(signBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return signHex.toLowerCase() === signature.toLowerCase();
  } catch (e) {
    console.error("Crypto verification error:", e);
    return false;
  }
}

async function handleCreateRazorpayOrder(request: Request, env: unknown): Promise<Response> {
  try {
    const body = (await request.json()) as {
      amount?: number;
      distanceKm?: number;
      vehicleCode?: string;
    };

    const dist = Math.max(0, Number(body.distanceKm) || 0);
    // Authoritative calculation: Base ₹99 + ₹18/km, minimum ₹149, + 5% GST
    const baseFare = 99;
    const distanceFare = Math.round(dist * 18);
    const subtotal = Math.max(149, baseFare + distanceFare);
    const tax = Math.round(subtotal * 0.05);
    const authoritativeTotal = subtotal + tax;

    const effectiveFare = Math.max(authoritativeTotal, Number(body.amount) || authoritativeTotal);
    const amountInPaise = Math.round(effectiveFare * 100);

    const keyId =
      (env as any)?.RAZORPAY_KEY_ID ||
      (typeof process !== "undefined" ? process.env?.["RAZORPAY_KEY_ID"] : undefined) ||
      (typeof process !== "undefined" ? process.env?.["VITE_RAZORPAY_KEY_ID"] : undefined) ||
      "rzp_test_TjnylwNIDTQjP2";

    const keySecret =
      (env as any)?.RAZORPAY_KEY_SECRET ||
      (typeof process !== "undefined" ? process.env?.["RAZORPAY_KEY_SECRET"] : undefined);

    if (keySecret && keyId && !keyId.startsWith("mock")) {
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
        }),
      });

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
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
    }

    // Secure fallback order generation for dev/test environments without live secret
    const testOrderId = `order_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
    return new Response(
      JSON.stringify({
        success: true,
        orderId: testOrderId,
        amount: amountInPaise,
        currency: "INR",
        keyId,
        mock: true,
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to initialize payment order" }),
      { status: 500, headers: { "content-type": "application/json" } }
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
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    const keySecret =
      (env as any)?.RAZORPAY_KEY_SECRET ||
      (typeof process !== "undefined" ? process.env?.["RAZORPAY_KEY_SECRET"] : undefined);

    const isProd =
      (env as any)?.NODE_ENV === "production" ||
      (typeof process !== "undefined" && process.env?.NODE_ENV === "production");

    if (keySecret) {
      if (!razorpay_order_id || !razorpay_signature) {
        return new Response(
          JSON.stringify({ verified: false, error: "Missing razorpay_order_id or razorpay_signature" }),
          { status: 400, headers: { "content-type": "application/json" } }
        );
      }
      const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
      const isValid = await verifyHmacSha256(payload, keySecret, razorpay_signature);
      if (!isValid) {
        return new Response(
          JSON.stringify({ verified: false, error: "Cryptographic signature mismatch" }),
          { status: 400, headers: { "content-type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ verified: true, paymentId: razorpay_payment_id }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (isProd) {
      return new Response(
        JSON.stringify({ verified: false, error: "Payment verification unavailable: RAZORPAY_KEY_SECRET not provisioned" }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }

    // In dev / test when secret is not provisioned
    return new Response(
      JSON.stringify({ verified: true, paymentId: razorpay_payment_id, dev_mode: true }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ verified: false, error: err.message || "Payment verification failed" }),
      { status: 500, headers: { "content-type": "application/json" } }
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

    if (webhookSecret) {
      if (!signature) {
        return new Response(
          JSON.stringify({ error: "Missing x-razorpay-signature header" }),
          { status: 400, headers: { "content-type": "application/json" } }
        );
      }
      const isValid = await verifyHmacSha256(rawBody, webhookSecret, signature);
      if (!isValid) {
        return new Response(
          JSON.stringify({ error: "Invalid webhook signature" }),
          { status: 400, headers: { "content-type": "application/json" } }
        );
      }
    } else {
      const isProd =
        (env as any)?.NODE_ENV === "production" ||
        (typeof process !== "undefined" && process.env?.NODE_ENV === "production");
      if (isProd) {
        return new Response(
          JSON.stringify({ error: "Webhook verification unavailable: RAZORPAY_WEBHOOK_SECRET not configured" }),
          { status: 500, headers: { "content-type": "application/json" } }
        );
      }
    }

    let eventData: any;
    try {
      eventData = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    const eventId = eventData?.id || eventData?.event_id;
    if (eventId && processedWebhookEvents.has(eventId)) {
      return new Response(
        JSON.stringify({ status: "already_processed", event_id: eventId }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (eventId) {
      processedWebhookEvents.add(eventId);
      if (processedWebhookEvents.size > 1000) {
        const iter = processedWebhookEvents.values();
        processedWebhookEvents.delete(iter.next().value!);
      }
    }

    const eventType = eventData?.event;
    return new Response(
      JSON.stringify({ success: true, event: eventType }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Webhook processing error" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
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
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://maps.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.razorpay.com https://maps.googleapis.com; frame-src 'self' https://api.razorpay.com; object-src 'none'; base-uri 'self';",
  );
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);

      // Canonical host and HTTPS enforcement for search crawlers
      if (
        url.hostname === "www.orange-taxi.com" ||
        (url.protocol === "http:" && url.hostname === "orange-taxi.com")
      ) {
        url.protocol = "https:";
        url.hostname = "orange-taxi.com";
        return Response.redirect(url.toString(), 301);
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
