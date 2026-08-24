/**
 * Shared authentication for public cron hooks.
 *
 * The Supabase publishable/anon key is NOT a secret, so it must never guard a
 * cron endpoint. Instead the scheduler sends a server-only CRON_SECRET, either
 * as `x-cron-secret: <secret>` or `Authorization: Bearer <secret>`.
 * The value lives only in the server environment (and in Supabase Vault for
 * pg_cron); it is never shipped to the web or Flutter client.
 */

/** Constant-time-ish comparison to avoid trivial timing oracles. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function extractCronSecret(headers: Headers): string {
  const direct = headers.get("x-cron-secret");
  if (direct) return direct.trim();
  const auth = headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return "";
}

/** Returns true when the request carries the configured cron secret. */
export function isAuthorizedCronRequest(headers: Headers, expected: string | undefined): boolean {
  if (!expected) return false;
  const provided = extractCronSecret(headers);
  if (!provided) return false;
  return safeEqual(provided, expected);
}

/** Returns a 401/500 Response when the request is not a valid cron call, else null. */
export function rejectUnauthorizedCron(request: Request): Response | null {
  const expected = process.env["CRON_SECRET"];
  if (!expected) {
    console.error("[cron] CRON_SECRET_NOT_CONFIGURED");
    return new Response("Cron secret not configured", { status: 500 });
  }
  if (!isAuthorizedCronRequest(request.headers, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}
