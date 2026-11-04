import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAuthEmail,
  buildConfirmationUrl,
  handleAuthEmailRequest,
  parseAuthEmailPayload,
  verifyStandardWebhook,
  type AuthEmailPayload,
} from "./auth-email.server";

const ENV_KEYS = [
  "SEND_EMAIL_HOOK_SECRET",
  "RESEND_API_KEY",
  "AUTH_EMAIL_FROM",
  "SUPABASE_URL",
] as const;

const saved = ENV_KEYS.map((k) => [k, process.env[k]] as const);

function clearEnv() {
  for (const k of ENV_KEYS) delete process.env[k];
}

afterEach(() => {
  clearEnv();
  for (const [k, v] of saved) if (v !== undefined) process.env[k] = v;
  vi.restoreAllMocks();
});

const SECRET_BYTES = new TextEncoder().encode("tajna-za-test-0123456789abcdef");
const SECRET = `v1,whsec_${Buffer.from(SECRET_BYTES).toString("base64")}`;

async function sign(id: string, timestamp: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    SECRET_BYTES,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${body}`),
  );
  return `v1,${Buffer.from(new Uint8Array(sig)).toString("base64")}`;
}

function payloadFor(actionType: string, extra?: Partial<AuthEmailPayload["email_data"]>): AuthEmailPayload {
  return {
    user: { email: "ana@example.com", new_email: "nova@example.com" },
    email_data: {
      token: "123456",
      token_hash: "hash-abc",
      redirect_to: "https://app.tejla.app/",
      email_action_type: actionType,
      site_url: "https://app.tejla.app",
      ...extra,
    },
  };
}

describe("verifyStandardWebhook", () => {
  it("accepts a valid signature", async () => {
    const body = JSON.stringify({ ping: true });
    const ts = String(Math.floor(Date.now() / 1000));
    const signature = await sign("msg_1", ts, body);
    const verdict = await verifyStandardWebhook(
      body,
      { id: "msg_1", timestamp: ts, signature },
      SECRET,
    );
    expect(verdict.ok).toBe(true);
  });

  it("accepts when our signature is one of several listed", async () => {
    const body = "{}";
    const ts = String(Math.floor(Date.now() / 1000));
    const signature = `v1,AAAA ${await sign("msg_2", ts, body)}`;
    const verdict = await verifyStandardWebhook(
      body,
      { id: "msg_2", timestamp: ts, signature },
      SECRET,
    );
    expect(verdict.ok).toBe(true);
  });

  it("rejects a tampered body", async () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const signature = await sign("msg_3", ts, "{}");
    const verdict = await verifyStandardWebhook(
      '{"a":1}',
      { id: "msg_3", timestamp: ts, signature },
      SECRET,
    );
    expect(verdict.ok).toBe(false);
  });

  it("rejects a stale timestamp", async () => {
    const body = "{}";
    const ts = String(Math.floor(Date.now() / 1000) - 3600);
    const signature = await sign("msg_4", ts, body);
    const verdict = await verifyStandardWebhook(
      body,
      { id: "msg_4", timestamp: ts, signature },
      SECRET,
    );
    expect(verdict.ok).toBe(false);
  });

  it("rejects missing headers", async () => {
    const verdict = await verifyStandardWebhook(
      "{}",
      { id: null, timestamp: null, signature: null },
      SECRET,
    );
    expect(verdict.ok).toBe(false);
  });
});

describe("parseAuthEmailPayload", () => {
  it("accepts a well-formed payload", () => {
    expect(parseAuthEmailPayload(JSON.stringify(payloadFor("signup")))).not.toBeNull();
  });

  it("rejects garbage and missing fields", () => {
    expect(parseAuthEmailPayload("ne-json")).toBeNull();
    expect(parseAuthEmailPayload("{}")).toBeNull();
    expect(parseAuthEmailPayload(JSON.stringify({ user: { email: "a@b.c" } }))).toBeNull();
  });
});

describe("buildConfirmationUrl", () => {
  it("builds the GoTrue verify link with redirect", () => {
    process.env["SUPABASE_URL"] = "https://happouvaqmaqkzxpwupv.supabase.co/";
    const url = buildConfirmationUrl(payloadFor("recovery").email_data);
    expect(url).toBe(
      "https://happouvaqmaqkzxpwupv.supabase.co/auth/v1/verify?token=hash-abc&type=recovery&redirect_to=https%3A%2F%2Fapp.tejla.app%2F",
    );
  });

  it("omits redirect_to when empty", () => {
    process.env["SUPABASE_URL"] = "https://x.supabase.co";
    const url = buildConfirmationUrl(payloadFor("signup", { redirect_to: "" }).email_data);
    expect(url).not.toContain("redirect_to");
  });
});

describe("buildAuthEmail", () => {
  it.each([
    ["signup", "Potvrdi svoju e-mail adresu"],
    ["invite", "Pozvan/a si u Tejlu"],
    ["magiclink", "Tvoj link za prijavu"],
    ["recovery", "Postavi novu lozinku"],
    ["email_change", "Potvrdi novu e-mail adresu"],
    ["reauthentication", "Tvoj kontrolni kod"],
  ])("maps %s to a Croatian subject", async (actionType, subject) => {
    process.env["SUPABASE_URL"] = "https://x.supabase.co";
    const email = await buildAuthEmail(payloadFor(actionType));
    expect(email?.to).toBe("ana@example.com");
    expect(email?.subject).toBe(subject);
    expect(email?.element).toBeTruthy();
  });

  it("returns null for unknown action types", async () => {
    expect(await buildAuthEmail(payloadFor("nepoznato"))).toBeNull();
  });

  it("personalizes the invite from user_metadata and sets replyTo", async () => {
    process.env["SUPABASE_URL"] = "https://x.supabase.co";
    const payload = payloadFor("invite");
    payload.user.user_metadata = {
      invited_by_name: "Mateja",
      invited_by_email: "mateja@example.com",
      family_name: "Obitelj Hajdinjak",
    };
    const email = await buildAuthEmail(payload);
    expect(email?.subject).toBe("Mateja te poziva u Tejlu");
    expect(email?.replyTo).toBe("mateja@example.com");
  });

  it("keeps the generic invite when metadata is missing or malformed", async () => {
    process.env["SUPABASE_URL"] = "https://x.supabase.co";
    const payload = payloadFor("invite");
    payload.user.user_metadata = { invited_by_name: 42, invited_by_email: "nije-mail" };
    const email = await buildAuthEmail(payload);
    expect(email?.subject).toBe("Pozvan/a si u Tejlu");
    expect(email?.replyTo).toBeUndefined();
  });
});

describe("handleAuthEmailRequest", () => {
  function requestFor(body: string, headers: Record<string, string>): Request {
    return new Request("https://app.tejla.app/api/auth-email", {
      method: "POST",
      headers,
      body,
    });
  }

  it("returns 500 when the hook secret is missing", async () => {
    clearEnv();
    const res = await handleAuthEmailRequest(requestFor("{}", {}));
    expect(res.status).toBe(500);
  });

  it("returns 401 on a bad signature", async () => {
    clearEnv();
    process.env["SEND_EMAIL_HOOK_SECRET"] = SECRET;
    const ts = String(Math.floor(Date.now() / 1000));
    const res = await handleAuthEmailRequest(
      requestFor("{}", {
        "webhook-id": "msg_x",
        "webhook-timestamp": ts,
        "webhook-signature": "v1,krivo",
      }),
    );
    expect(res.status).toBe(401);
  });

  it("renders and sends through Resend on the happy path", async () => {
    clearEnv();
    process.env["SEND_EMAIL_HOOK_SECRET"] = SECRET;
    process.env["RESEND_API_KEY"] = "re_test";
    process.env["SUPABASE_URL"] = "https://x.supabase.co";

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ id: "mail_1" }), { status: 200 }));

    const body = JSON.stringify(payloadFor("recovery"));
    const ts = String(Math.floor(Date.now() / 1000));
    const res = await handleAuthEmailRequest(
      requestFor(body, {
        "webhook-id": "msg_ok",
        "webhook-timestamp": ts,
        "webhook-signature": await sign("msg_ok", ts, body),
      }),
    );

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    const sent = JSON.parse(String(init?.body));
    expect(sent.to).toEqual(["ana@example.com"]);
    expect(sent.from).toBe("Tejla <noreply@tejla.app>");
    expect(sent.subject).toBe("Postavi novu lozinku");
    expect(sent.html).toContain("x.supabase.co/auth/v1/verify");
    expect(sent.text).toContain("auth/v1/verify");
  });

  it("passes reply_to to Resend for personalized invites", async () => {
    clearEnv();
    process.env["SEND_EMAIL_HOOK_SECRET"] = SECRET;
    process.env["RESEND_API_KEY"] = "re_test";
    process.env["SUPABASE_URL"] = "https://x.supabase.co";

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ id: "mail_2" }), { status: 200 }));

    const payload = payloadFor("invite");
    payload.user.user_metadata = {
      invited_by_name: "Mateja",
      invited_by_email: "mateja@example.com",
      family_name: "Obitelj Hajdinjak",
    };
    const body = JSON.stringify(payload);
    const ts = String(Math.floor(Date.now() / 1000));
    const res = await handleAuthEmailRequest(
      requestFor(body, {
        "webhook-id": "msg_inv",
        "webhook-timestamp": ts,
        "webhook-signature": await sign("msg_inv", ts, body),
      }),
    );

    expect(res.status).toBe(200);
    const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(sent.subject).toBe("Mateja te poziva u Tejlu");
    expect(sent.reply_to).toBe("mateja@example.com");
    expect(sent.html).toContain("Obitelj Hajdinjak");
    expect(sent.text).toContain("Mateja te poziva");
  });

  it("returns 400 for unknown action types after a valid signature", async () => {
    clearEnv();
    process.env["SEND_EMAIL_HOOK_SECRET"] = SECRET;
    const body = JSON.stringify(payloadFor("email"));
    const ts = String(Math.floor(Date.now() / 1000));
    const res = await handleAuthEmailRequest(
      requestFor(body, {
        "webhook-id": "msg_unk",
        "webhook-timestamp": ts,
        "webhook-signature": await sign("msg_unk", ts, body),
      }),
    );
    expect(res.status).toBe(400);
  });
});
