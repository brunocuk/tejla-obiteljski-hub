import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { consentTextVersion, type AgeGroup, type HealthPurpose } from "@/lib/consents";
import {
  insertConsent,
  isFamilyAdult,
  loadMember,
  revokeActiveConsent,
  teenSelfManaged,
  type MemberRow,
} from "@/lib/consents.server";

// Server strana evidencije privola (Matejin mail "PRIVOLE", 16.11.2026.).
// Sva pravila TKO smije dati ili povuci privolu zive ovdje; klijent ima samo
// kopiju pravila za prikaz. Upis radi service_role, klijent kroz RLS cita.

/** Isto pravilo kao canManageHealthConsents u consents.ts, serverski autoritet. */
async function assertCanManageHealthConsent(userId: string, member: MemberRow): Promise<void> {
  const isSelf = member.linked_user_id === userId;
  if (member.linked_user_id) {
    if (member.member_type !== "child") {
      if (!isSelf) throw new Error("Zdravstvene opcije za sebe potvrđuje svaki punoljetni član sam.");
      return;
    }
    if (teenSelfManaged(member)) {
      if (!isSelf) {
        throw new Error("Ove opcije uključuje i isključuje samo dijete u svojem računu.");
      }
      return;
    }
  }
  if (!(await isFamilyAdult(userId, member.family_id))) {
    throw new Error("Ovu privolu može dati samo ovlašteni roditelj ili skrbnik u prostoru.");
  }
}

const HEALTH_PURPOSES: HealthPurpose[] = ["zdravstveno-spremanje", "zdravstveno-ai"];

function normalizeHealthPurpose(raw: unknown): HealthPurpose {
  const value = String(raw);
  if (!(HEALTH_PURPOSES as string[]).includes(value)) throw new Error("Nepoznata svrha privole.");
  return value as HealthPurpose;
}

/** Ukljucivanje jedne od dvije zdravstvene opcije za clana. */
export const grantHealthConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { familyMemberId?: string; purpose?: string }) => {
    const familyMemberId = String(input?.familyMemberId ?? "");
    if (!familyMemberId) throw new Error("Nedostaje član.");
    return { familyMemberId, purpose: normalizeHealthPurpose(input?.purpose) };
  })
  .handler(async ({ data, context }) => {
    const member = await loadMember(data.familyMemberId);
    await assertCanManageHealthConsent(context.userId, member);
    await insertConsent({
      family_id: member.family_id,
      family_member_id: member.id,
      purpose: data.purpose,
      text_version: consentTextVersion(data.purpose),
      granted_by: context.userId,
      granted_via: "postavke",
    });
    return { ok: true as const };
  });

/** Povlacenje jedne zdravstvene opcije; zaustavlja obradu za tu svrhu. */
export const revokeHealthConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { familyMemberId?: string; purpose?: string }) => {
    const familyMemberId = String(input?.familyMemberId ?? "");
    if (!familyMemberId) throw new Error("Nedostaje član.");
    return { familyMemberId, purpose: normalizeHealthPurpose(input?.purpose) };
  })
  .handler(async ({ data, context }) => {
    const member = await loadMember(data.familyMemberId);
    await assertCanManageHealthConsent(context.userId, member);
    await revokeActiveConsent({
      family_member_id: member.id,
      purpose: data.purpose,
      revoked_by: context.userId,
    });
    return { ok: true as const };
  });

/**
 * Samoizjava "Navrsio/la sam 16 godina" (varijanta A, bez datuma rodjenja).
 * Nakon potvrde dijete samo upravlja svojim privolama i moze povuci
 * roditeljsku privolu za racun.
 */
export const confirmSixteen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: member } = await supabaseAdmin
      .from("family_members")
      .select("id, member_type, age_group, sixteen_confirmed_at")
      .eq("linked_user_id", context.userId)
      .maybeSingle();
    if (!member || member.member_type !== "child") {
      throw new Error("Ova potvrda vrijedi samo za dječji račun.");
    }
    if (member.sixteen_confirmed_at || member.age_group === "16-17") {
      return { ok: true as const };
    }
    const { error } = await supabaseAdmin
      .from("family_members")
      .update({ sixteen_confirmed_at: new Date().toISOString() })
      .eq("id", member.id);
    if (error) throw new Error("Spremanje potvrde nije uspjelo. Pokušaj ponovno.");
    return { ok: true as const };
  });

/**
 * Povlacenje privole za djecji racun. Smiju: odrasli clan prostora (roditelj
 * koji ju je dao, ili drugi ovlasteni odrasli) te dijete samo kad ima 16+
 * (dobna skupina 16-17 ili potvrdjena samoizjava). Racun se zatvara: clan se
 * odspaja (ostaje profil bez prijave, obveze u prostoru ostaju), a djetetov
 * korisnicki racun se brise.
 */
export const revokeChildAccountConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { familyMemberId?: string }) => {
    const familyMemberId = String(input?.familyMemberId ?? "");
    if (!familyMemberId) throw new Error("Nedostaje član.");
    return { familyMemberId };
  })
  .handler(async ({ data, context }) => {
    const member = await loadMember(data.familyMemberId);
    if (member.member_type !== "child") throw new Error("Privola za račun vrijedi samo za dijete.");
    const isSelf = member.linked_user_id === context.userId;
    const allowed = isSelf
      ? teenSelfManaged(member)
      : await isFamilyAdult(context.userId, member.family_id);
    if (!allowed) {
      throw new Error(
        isSelf
          ? "Privolu možeš povući nakon potvrde da imaš 16 godina."
          : "Privolu može povući samo ovlašteni roditelj ili skrbnik.",
      );
    }

    await revokeActiveConsent({
      family_member_id: member.id,
      purpose: "djecji-racun",
      revoked_by: context.userId,
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const childUserId = member.linked_user_id;
    if (childUserId) {
      const { error: unlinkError } = await supabaseAdmin
        .from("family_members")
        .update({ linked_user_id: null })
        .eq("id", member.id);
      if (unlinkError) throw new Error("Zatvaranje računa nije uspjelo. Pokušaj ponovno.");
      await supabaseAdmin
        .from("family_users")
        .delete()
        .eq("family_id", member.family_id)
        .eq("user_id", childUserId);
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(childUserId);
      if (deleteError) {
        console.error("CHILD_ACCOUNT_DELETE_ERROR", deleteError.message);
        throw new Error("Brisanje računa nije dovršeno. Javi se na tejla@tejla.app.");
      }
    } else {
      // Racun jos nije aktiviran: povlacenje ponistava i otvorenu pozivnicu.
      await supabaseAdmin
        .from("family_invitations")
        .update({ status: "cancelled" })
        .eq("family_member_id", member.id)
        .eq("status", "pending");
    }
    return { ok: true as const, accountClosed: Boolean(childUserId) };
  });

/**
 * Kontekst cekajuce pozivnice za ekran aktivacije (auth.tsx): uloga, dobna
 * skupina i imena za tekst privole. Null kad pozivnice nema.
 */
export const getPendingInviteContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = String((context.claims as { email?: string })?.email ?? "").toLowerCase();
    if (!email) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("family_invitations")
      .select("id, family_id, role, age_group, family_member_id")
      .eq("status", "pending")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!inv) return null;
    const [{ data: family }, { data: member }] = await Promise.all([
      supabaseAdmin.from("families").select("name").eq("id", inv.family_id).maybeSingle(),
      inv.family_member_id
        ? supabaseAdmin
            .from("family_members")
            .select("name")
            .eq("id", inv.family_member_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    return {
      role: inv.role === "child" ? ("child" as const) : ("parent" as const),
      ageGroup: (inv.age_group === "10-15" || inv.age_group === "16-17"
        ? inv.age_group
        : null) as AgeGroup | null,
      childName: member?.name?.trim() ?? "",
      familyName: family?.name?.trim() ?? "",
    };
  });

/**
 * Privola djeteta 16-17 pri aktivaciji racuna (tocka 1 iz maila). Veze se na
 * clana i prostor iz pozivnice; poziva se nakon postavljanja lozinke.
 */
export const recordChildAccountSelfConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = String((context.claims as { email?: string })?.email ?? "").toLowerCase();
    if (!email) throw new Error("Nedostaje e-mail računa.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("family_invitations")
      .select("id, family_id, role, age_group, family_member_id")
      .eq("status", "pending")
      .eq("role", "child")
      .eq("age_group", "16-17")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!inv?.family_member_id) throw new Error("Pozivnica za dječji račun nije pronađena.");
    await insertConsent({
      family_id: inv.family_id,
      family_member_id: inv.family_member_id,
      purpose: "djecji-racun",
      text_version: consentTextVersion("djecji-racun", "16-17"),
      granted_by: context.userId,
      granted_via: "aktivacija-racuna",
    });
    return { ok: true as const };
  });

/**
 * Evidencija privole za Tejline poruke (tocka 4 iz maila): uz postojeci
 * prekidac (default iskljuceno) biljezi se tko/kada/verzija teksta.
 */
export const recordTejlaMessagesConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { enabled?: boolean; via?: string }) => ({
    enabled: Boolean(input?.enabled),
    via: input?.via === "onboarding" ? ("onboarding" as const) : ("postavke" as const),
  }))
  .handler(async ({ data, context }) => {
    if (data.enabled) {
      await insertConsent({
        subject_user_id: context.userId,
        purpose: "tejline-poruke",
        text_version: consentTextVersion("tejline-poruke"),
        granted_by: context.userId,
        granted_via: data.via,
      });
    } else {
      await revokeActiveConsent({
        subject_user_id: context.userId,
        purpose: "tejline-poruke",
        revoked_by: context.userId,
      });
    }
    return { ok: true as const };
  });
