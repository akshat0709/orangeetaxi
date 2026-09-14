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

async function handleSendInvoiceApi(request: Request, env: unknown): Promise<Response> {
  try {
    const body = (await request.json()) as SendInvoicePayload;
    if (!body || !body.to || !body.invoiceNumber) {
      return new Response(JSON.stringify({ error: "Missing required fields (to, invoiceNumber)" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const apiKey =
      (env as any)?.RESEND_API_KEY ||
      (typeof process !== "undefined" ? process.env?.RESEND_API_KEY : undefined) ||
      "re_GnGbP7X3_ALB8BwSfKRdougXVkmBii7S3";

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
      return new Response(JSON.stringify({ error: resendData?.message || "Failed to dispatch email via Resend" }), {
        status: resendRes.status,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: resendData.id }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Failed to process invoice email request" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      if (url.pathname === "/api/send-invoice" && request.method === "POST") {
        return await handleSendInvoiceApi(request, env);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
