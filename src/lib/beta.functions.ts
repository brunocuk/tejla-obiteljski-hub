import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const checkBetaInvite = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => ({ token: String(input?.token ?? "") }))
  .handler(async ({ data }) => {
    const { loadBetaInvite, normalizeToken } = await import("./beta.server");
    const { state } = await loadBetaInvite(normalizeToken(data.token));
    return { state };
  });

export const redeemBetaInvite = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; email: string; password: string; name: string }) => {
    const email = String(input?.email ?? "")
      .trim()
      .toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Unesi ispravnu e-mail adresu.");
    const password = String(input?.password ?? "");
    if (password.length < 8) throw new Error("Lozinka mora imati najmanje 8 znakova.");
    const name = String(input?.name ?? "").trim();
    if (!name) throw new Error("Unesi svoje ime.");
    return { token: String(input?.token ?? ""), email, password, name };
  })
  .handler(async ({ data }) => {
    const { redeemBetaInviteServer, normalizeToken } = await import("./beta.server");
    return redeemBetaInviteServer({ ...data, token: normalizeToken(data.token) });
  });

export const listBetaInvites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_app_admin");
    if (!isAdmin) throw new Error("Forbidden");
    const { data, error } = await context.supabase
      .from("beta_invites")
      .select("id, token, label, status, created_at, expires_at, used_at, used_by")
      .order("created_at", { ascending: false });
    if (error) throw new Error("Dohvat pozivnica nije uspio.");
    const invites = data ?? [];
    const { loadBetaTesterStatuses } = await import("./beta.server");
    const statuses = await loadBetaTesterStatuses(
      invites.map((i) => i.used_by).filter((v): v is string => Boolean(v)),
    );
    return invites.map((invite) => ({
      ...invite,
      tester: invite.used_by ? (statuses[invite.used_by] ?? null) : null,
    }));
  });

export const createBetaInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { label?: string; days?: number }) => ({
    label: String(input?.label ?? "").trim(),
    // Activation window only: 6 weeks. Redeemed invites never expire the account.
    days: Math.min(Math.max(Number(input?.days ?? 42) || 42, 1), 60),
  }))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_app_admin");
    if (!isAdmin) throw new Error("Forbidden");
    const { generateBetaToken } = await import("./beta.server");
    const token = generateBetaToken();
    const expires = new Date(Date.now() + data.days * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await context.supabase.from("beta_invites").insert({
      token,
      label: data.label,
      expires_at: expires,
      created_by: context.userId,
    });
    if (error) throw new Error("Stvaranje pozivnice nije uspjelo.");
    return { token };
  });

export const revokeBetaInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input?.id ?? "") }))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_app_admin");
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("beta_invites")
      .update({ status: "revoked" })
      .eq("id", data.id)
      .eq("status", "active");
    if (error) throw new Error("Opoziv pozivnice nije uspio.");
    return { ok: true };
  });

export const amIAppAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("is_app_admin");
    return { isAdmin: Boolean(data) };
  });