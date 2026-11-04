/**
 * Supabase Auth "Send Email Hook" handler (selidba s Lovablea).
 *
 * Nova produkcija: Supabase (GoTrue) na svaki auth mail zove ovaj endpoint
 * umjesto vlastitog SMTP-a. Payload je potpisan standardwebhooks shemom
 * (headeri webhook-id / webhook-timestamp / webhook-signature, tajna oblika
 * "v1,whsec_<base64>"). Mi renderiramo postojeće hrvatske React Email
 * templete i šaljemo kroz Resend HTTP API (bez SDK-a, kao na landingu).
 *
 * Env: SEND_EMAIL_HOOK_SECRET (iz Supabase Auth Hooks ekrana),
 *      RESEND_API_KEY, opcionalno AUTH_EMAIL_FROM
 *      (default "Tejla <noreply@tejla.app>"; notify.tejla.app NE koristiti,
 *      ta je zona NS-delegirana Lovableu do gašenja stare produkcije).
 *
 * Stari Lovable hook (/lovable/email/auth/webhook) ostaje u repou za živu
 * betu i umire s njom na cutoveru.
 */
import * as React from "react";

const SITE_NAME = "Tejla";
const DEFAULT_FROM = "Tejla <noreply@tejla.app>";
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

export type AuthEmailData = {
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: string;
  site_url: string;
  token_new?: string;
  token_hash_new?: string;
};

export type AuthEmailPayload = {
  user: { email: string; new_email?: string | null };
  email_data: AuthEmailData;
};

function base64ToBytes(value: string): Uint8Array {
  const bin = atob(value);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

/**
 * Verifies a standardwebhooks signature (the scheme Supabase auth hooks use).
 * Secret arrives as "v1,whsec_<base64>"; signature header holds one or more
 * space-separated "v1,<base64 hmac>" entries.
 */
export async function verifyStandardWebhook(
  rawBody: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  secret: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return { ok: false, reason: "missing headers" };

  const tsSeconds = Number(timestamp);
  if (!Number.isFinite(tsSeconds)) return { ok: false, reason: "invalid timestamp" };
  if (Math.abs(Date.now() - tsSeconds * 1000) > TIMESTAMP_TOLERANCE_MS) {
    return { ok: false, reason: "stale timestamp" };
  }

  const keyB64 = secret.replace(/^v1,/, "").replace(/^whsec_/, "");
  let keyBytes: Uint8Array;
  try {
    keyBytes = base64ToBytes(keyB64);
  } catch {
    return { ok: false, reason: "invalid secret" };
  }

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes as unknown as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`),
  );
  const expected = bytesToBase64(new Uint8Array(signed));

  for (const candidate of signature.split(" ")) {
    const [version, sig] = candidate.split(",", 2);
    if (version === "v1" && sig && constantTimeEqual(sig, expected)) return { ok: true };
  }
  return { ok: false, reason: "signature mismatch" };
}

export function parseAuthEmailPayload(raw: string): AuthEmailPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const payload = parsed as AuthEmailPayload;
  if (
    !payload.user ||
    typeof payload.user.email !== "string" ||
    !payload.email_data ||
    typeof payload.email_data.email_action_type !== "string" ||
    typeof payload.email_data.token_hash !== "string"
  ) {
    return null;
  }
  return payload;
}

/** GoTrue verification link, same shape GoTrue puts in its own templates. */
export function buildConfirmationUrl(data: AuthEmailData, tokenHash?: string): string {
  const base = (process.env["SUPABASE_URL"] ?? "").trim().replace(/\/+$/, "");
  const params = new URLSearchParams({
    token: tokenHash ?? data.token_hash,
    type: data.email_action_type,
  });
  if (data.redirect_to) params.set("redirect_to", data.redirect_to);
  return `${base}/auth/v1/verify?${params.toString()}`;
}

export type RenderedAuthEmail = {
  to: string;
  subject: string;
  element: React.ReactElement;
};

/**
 * Maps a hook payload to recipient, subject and template element.
 * Returns null for action types we do not use (GoTrue then gets a 400 and
 * the problem is visible in its logs instead of silently eating mails).
 */
export async function buildAuthEmail(payload: AuthEmailPayload): Promise<RenderedAuthEmail | null> {
  const data = payload.email_data;
  const siteUrl = data.site_url || "https://app.tejla.app";
  const to = payload.user.email;
  const confirmationUrl = buildConfirmationUrl(data);

  switch (data.email_action_type) {
    case "signup": {
      const { SignupEmail } = await import("@/lib/email-templates/signup");
      return {
        to,
        subject: "Potvrdi svoju e-mail adresu",
        element: React.createElement(SignupEmail, {
          siteName: SITE_NAME,
          siteUrl,
          recipient: to,
          confirmationUrl,
        }),
      };
    }
    case "invite": {
      const { InviteEmail } = await import("@/lib/email-templates/invite");
      return {
        to,
        subject: "Pozvan/a si u Tejlu",
        element: React.createElement(InviteEmail, { siteName: SITE_NAME, siteUrl, confirmationUrl }),
      };
    }
    case "magiclink": {
      const { MagicLinkEmail } = await import("@/lib/email-templates/magic-link");
      return {
        to,
        subject: "Tvoj link za prijavu",
        element: React.createElement(MagicLinkEmail, { siteName: SITE_NAME, confirmationUrl }),
      };
    }
    case "recovery": {
      const { RecoveryEmail } = await import("@/lib/email-templates/recovery");
      return {
        to,
        subject: "Postavi novu lozinku",
        element: React.createElement(RecoveryEmail, { siteName: SITE_NAME, confirmationUrl }),
      };
    }
    case "email_change": {
      const { EmailChangeEmail } = await import("@/lib/email-templates/email-change");
      const newEmail = payload.user.new_email ?? "";
      return {
        to,
        subject: "Potvrdi novu e-mail adresu",
        element: React.createElement(EmailChangeEmail, {
          siteName: SITE_NAME,
          oldEmail: to,
          email: to,
          newEmail,
          confirmationUrl,
        }),
      };
    }
    case "reauthentication": {
      const { ReauthenticationEmail } = await import("@/lib/email-templates/reauthentication");
      return {
        to,
        subject: "Tvoj kontrolni kod",
        element: React.createElement(ReauthenticationEmail, { token: data.token }),
      };
    }
    default:
      return null;
  }
}

/** Sends through the Resend HTTP API; throws on non-2xx so the hook returns 500 and GoTrue retries. */
export async function sendViaResend(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const apiKey = (process.env["RESEND_API_KEY"] ?? "").trim();
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  const from = (process.env["AUTH_EMAIL_FROM"] ?? "").trim() || DEFAULT_FROM;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [args.to], subject: args.subject, html: args.html, text: args.text }),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}

/** Full request handler, mounted by the /api/auth-email route. */
export async function handleAuthEmailRequest(request: Request): Promise<Response> {
  const secret = (process.env["SEND_EMAIL_HOOK_SECRET"] ?? "").trim();
  if (!secret) {
    return Response.json({ error: "Hook secret not configured" }, { status: 500 });
  }

  const rawBody = await request.text();
  const verdict = await verifyStandardWebhook(
    rawBody,
    {
      id: request.headers.get("webhook-id"),
      timestamp: request.headers.get("webhook-timestamp"),
      signature: request.headers.get("webhook-signature"),
    },
    secret,
  );
  if (!verdict.ok) {
    return Response.json({ error: `Invalid webhook: ${verdict.reason}` }, { status: 401 });
  }

  const payload = parseAuthEmailPayload(rawBody);
  if (!payload) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const email = await buildAuthEmail(payload);
  if (!email) {
    return Response.json(
      { error: `Unknown auth email action type: ${payload.email_data.email_action_type}` },
      { status: 400 },
    );
  }

  try {
    const { render } = await import("@react-email/render");
    const html = await render(email.element);
    const text = await render(email.element, { plainText: true });
    await sendViaResend({ to: email.to, subject: email.subject, html, text });
  } catch (error) {
    console.error("[auth-email] send failed:", error);
    return Response.json({ error: "Failed to send email" }, { status: 500 });
  }

  return Response.json({ success: true });
}
