import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type InviteInput = { email: string; redirectTo: string };

export const sendFamilyInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: InviteInput) => {
    const email = String(input?.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Unesi ispravnu e-mail adresu.");
    }
    let redirectTo = "";
    try {
      redirectTo = new URL(String(input?.redirectTo ?? "")).origin + "/auth";
    } catch {
      redirectTo = "";
    }
    return { email, redirectTo };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;

    const callerEmail = String((claims as { email?: string })?.email ?? "").toLowerCase();
    if (callerEmail && callerEmail === data.email) {
      throw new Error("Ne možeš pozvati vlastitu e-mail adresu.");
    }

    const { data: membership, error: memberError } = await supabase
      .from("family_users")
      .select("family_id, role")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (memberError) throw new Error("Provjera obitelji nije uspjela.");
    if (!membership) throw new Error("Nisi član nijedne obitelji.");
    if (membership.role !== "owner") {
      throw new Error("Samo vlasnik obitelji može slati pozive.");
    }

    const { data: existing } = await supabase
      .from("family_invitations")
      .select("id")
      .eq("family_id", membership.family_id)
      .eq("status", "pending")
      .ilike("email", data.email)
      .limit(1)
      .maybeSingle();
    if (existing) throw new Error("Poziv na ovu adresu već je poslan.");

    const { error: insertError } = await supabase.from("family_invitations").insert({
      family_id: membership.family_id,
      email: data.email,
      role: "parent",
      status: "pending",
      invited_by: userId,
    });
    if (insertError) throw new Error("Spremanje poziva nije uspjelo.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      ...(data.redirectTo ? { redirectTo: data.redirectTo } : {}),
    });

    if (inviteError) {
      const message = inviteError.message.toLowerCase();
      // Existing account: no new user is created, the invitation stays valid.
      if (message.includes("already been registered") || message.includes("already registered")) {
        return { ok: true, existingAccount: true };
      }
      console.error("[invite]", inviteError.message);
      throw new Error("Slanje e-mail poziva nije uspjelo.");
    }

    return { ok: true, existingAccount: false };
  });
