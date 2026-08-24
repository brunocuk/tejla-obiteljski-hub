import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type BetaInviteState = "valid" | "used" | "revoked" | "expired" | "invalid";

export type BetaInviteRow = {
  id: string;
  token: string;
  label: string;
  status: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
};

/** Cryptographically random, non-sequential invite token. */
export function generateBetaToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function normalizeToken(raw: unknown): string {
  const token = String(raw ?? "").trim();
  return /^[a-f0-9]{32,128}$/i.test(token) ? token.toLowerCase() : "";
}

export async function loadBetaInvite(token: string) {
  if (!token) return { state: "invalid" as BetaInviteState, invite: null };
  const { data } = await supabaseAdmin
    .from("beta_invites")
    .select("id, status, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!data) return { state: "invalid" as BetaInviteState, invite: null };
  if (data.status === "used") return { state: "used" as BetaInviteState, invite: data };
  if (data.status === "revoked") return { state: "revoked" as BetaInviteState, invite: data };
  if (new Date(data.expires_at).getTime() <= Date.now()) {
    return { state: "expired" as BetaInviteState, invite: data };
  }
  return { state: "valid" as BetaInviteState, invite: data };
}

/** Creates the beta tester's account and burns the invite in one server-side step. */
export async function redeemBetaInviteServer(input: {
  token: string;
  email: string;
  password: string;
  name: string;
}) {
  const { state, invite } = await loadBetaInvite(input.token);
  if (state !== "valid" || !invite) return { ok: false as const, state };

  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.name },
  });

  if (error || !created?.user) {
    const message = (error?.message ?? "").toLowerCase();
    if (message.includes("already") && message.includes("registered")) {
      return { ok: false as const, state: "invalid" as BetaInviteState, existing: true };
    }
    console.error(
      "[beta-redeem] BETA_CREATE_USER_FAILED",
      (error as { status?: number } | null)?.status ?? "",
      (error as { code?: string } | null)?.code ?? "",
    );
    throw new Error("Izrada računa nije uspjela. Pokušaj ponovno.");
  }

  // Single use: only burn the invite while it is still active.
  const { data: burned } = await supabaseAdmin
    .from("beta_invites")
    .update({ status: "used", used_at: new Date().toISOString(), used_by: created.user.id })
    .eq("id", invite.id)
    .eq("status", "active")
    .select("id")
    .maybeSingle();

  if (!burned) {
    await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    return { ok: false as const, state: "used" as BetaInviteState };
  }

  return { ok: true as const, state: "valid" as BetaInviteState };
}

export type BetaTesterStatus = {
  registered_at: string | null;
  last_sign_in_at: string | null;
  has_workspace: boolean;
};

/** Read-only technical onboarding status for redeemed invites, keyed by used_by UUID. */
export async function loadBetaTesterStatuses(
  userIds: string[],
): Promise<Record<string, BetaTesterStatus>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return {};

  const result: Record<string, BetaTesterStatus> = {};
  for (const id of ids) {
    result[id] = { registered_at: null, last_sign_in_at: null, has_workspace: false };
    const { data } = await supabaseAdmin.auth.admin.getUserById(id);
    if (data?.user) {
      result[id].registered_at = data.user.created_at ?? null;
      result[id].last_sign_in_at = data.user.last_sign_in_at ?? null;
    }
  }

  const { data: spaces } = await supabaseAdmin
    .from("family_users")
    .select("user_id")
    .in("user_id", ids);
  for (const row of spaces ?? []) {
    const entry = result[row.user_id];
    if (entry) entry.has_workspace = true;
  }

  return result;
}