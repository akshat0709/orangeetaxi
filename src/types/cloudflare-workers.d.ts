// Cloudflare Workers runtime module (available only when deployed on Workers / wrangler dev).
declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}
