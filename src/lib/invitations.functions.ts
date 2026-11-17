import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { consentTextVersion, type AgeGroup } from "@/lib/consents";
import { insertConsent } from "@/lib/consents.server";

type InviteInput = {
  email: string;
  redirectTo: string;
  role?: "parent" | "child";
  familyMemberId?: string | null;
  ageGroup?: AgeGroup;
  parentConsent?: boolean;
};

export const sendFamilyInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: InviteInput) => {
    const email = String(input?.email ?? "")
      .trim()
      .toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Unesi ispravnu e-mail adresu.");
    }
    let redirectTo = "";
    try {
      redirectTo = new URL(String(input?.redirectTo ?? "")).origin + "/auth";
    } catch {
      redirectTo = "";
    }
    const role = input?.role === "child" ? "child" : "parent";
    const familyMemberId = input?.familyMemberId ? String(input.familyMemberId) : null;
    // Djecji racun na pozivnicu (mail "PRIVOLE" 16.11.): roditelj bira dobnu
    // skupinu; za 10-15 privolu daje prije aktivacije, uz izricitu potvrdu.
    const ageGroup =
      input?.ageGroup === "10-15" || input?.ageGroup === "16-17" ? input.ageGroup : null;
    const parentConsent = Boolean(input?.parentConsent);
    if (role === "child") {
      if (!familyMemberId) throw new Error("Dijete pozovi kroz njegov profil člana.");
      if (!ageGroup) throw new Error("Odaberi dobnu skupinu djeteta.");
      if (ageGroup === "10-15" && !parentConsent) {
        throw new Error("Za dijete od 10 do 15 godina potrebna je privola roditelja ili skrbnika.");
      }
    }
    return { email, redirectTo, role, familyMemberId, ageGroup, parentConsent };
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

    let memberId: string | null = null;
    if (data.familyMemberId) {
      const { data: member } = await supabase
        .from("family_members")
        .select("id")
        .eq("id", data.familyMemberId)
        .eq("family_id", membership.family_id)
        .maybeSingle();
      if (!member) throw new Error("Odabrani član ne postoji u ovom prostoru.");
      memberId = member.id;
    }

    const { error: insertError } = await supabase.from("family_invitations").insert({
      family_id: membership.family_id,
      email: data.email,
      role: data.role,
      status: "pending",
      invited_by: userId,
      family_member_id: memberId,
      age_group: data.role === "child" ? data.ageGroup : null,
    });
    if (insertError) throw new Error("Spremanje poziva nije uspjelo.");

    // Privola roditelja/skrbnika za racun djeteta 10-15 daje se vec pri
    // pozivnici (prije aktivacije); 16-17 potvrdjuje dijete pri aktivaciji.
    if (data.role === "child" && data.ageGroup === "10-15" && memberId) {
      await insertConsent({
        family_id: membership.family_id,
        family_member_id: memberId,
        purpose: "djecji-racun",
        text_version: consentTextVersion("djecji-racun", "10-15"),
        granted_by: userId,
        granted_via: "pozivnica",
      });
    }

    // Ime pozivatelja i prostora za osobniju pozivnicu (Gmail generičke pozivnice
    // gura u Promocije); best-effort, mail radi i bez njih.
    const [{ data: inviterProfile }, { data: family }] = await Promise.all([
      supabase.from("profiles").select("name").eq("id", userId).maybeSingle(),
      supabase.from("families").select("name").eq("id", membership.family_id).maybeSingle(),
    ]);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      ...(data.redirectTo ? { redirectTo: data.redirectTo } : {}),
      data: {
        invited_by_name: inviterProfile?.name?.trim() ?? "",
        invited_by_email: callerEmail,
        family_name: family?.name?.trim() ?? "",
      },
    });

    if (inviteError) {
      const message = inviteError.message.toLowerCase();
      // Existing account: no new user is created, the invitation stays valid.
      if (message.includes("already been registered") || message.includes("already registered")) {
        return { ok: true, existingAccount: true };
      }
      console.error(
        "[invite] INVITE_SEND_FAILED",
        (inviteError as { status?: number })?.status ?? "",
        (inviteError as { code?: string })?.code ?? "",
      );
      throw new Error("Slanje e-mail poziva nije uspjelo.");
    }

    return { ok: true, existingAccount: false };
  });
