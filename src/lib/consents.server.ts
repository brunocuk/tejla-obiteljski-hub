import type { ConsentPurpose } from "@/lib/consents";

// Server helperi evidencije privola; koriste ih consents.functions.ts,
// invitations.functions.ts (privola roditelja uz pozivnicu 10-15) i AI rute
// (provjera privole prije slanja sadrzaja Azureu).

export type MemberRow = {
  id: string;
  family_id: string;
  name: string | null;
  member_type: string | null;
  linked_user_id: string | null;
  age_group: string | null;
  sixteen_confirmed_at: string | null;
};

export async function loadMember(familyMemberId: string): Promise<MemberRow> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("family_members")
    .select("id, family_id, name, member_type, linked_user_id, age_group, sixteen_confirmed_at")
    .eq("id", familyMemberId)
    .maybeSingle();
  if (error || !data) throw new Error("Član ne postoji.");
  return data as MemberRow;
}

export async function isFamilyAdult(userId: string, familyId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("family_users")
    .select("role")
    .eq("family_id", familyId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.role === "owner" || data?.role === "parent";
}

export function teenSelfManaged(member: Pick<MemberRow, "member_type" | "age_group" | "sixteen_confirmed_at">): boolean {
  return (
    member.member_type === "child" &&
    (member.age_group === "16-17" || Boolean(member.sixteen_confirmed_at))
  );
}

export async function insertConsent(row: {
  family_id?: string | null;
  family_member_id?: string | null;
  subject_user_id?: string | null;
  purpose: ConsentPurpose;
  text_version: string;
  granted_by: string;
  granted_via: "pozivnica" | "aktivacija-racuna" | "postavke" | "onboarding";
}): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("member_consents").insert(row);
  // 23505 = aktivna privola vec postoji (duplikat je bezopasan)
  if (error && error.code !== "23505") {
    console.error("CONSENT_STORE_ERROR", error.code);
    throw new Error("Spremanje privole nije uspjelo. Pokušaj ponovno.");
  }
}

export async function revokeActiveConsent(filter: {
  family_member_id?: string;
  subject_user_id?: string;
  purpose: ConsentPurpose;
  revoked_by: string;
}): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let query = supabaseAdmin
    .from("member_consents")
    .update({ revoked_at: new Date().toISOString(), revoked_by: filter.revoked_by })
    .eq("purpose", filter.purpose)
    .is("revoked_at", null);
  if (filter.family_member_id) query = query.eq("family_member_id", filter.family_member_id);
  if (filter.subject_user_id) {
    query = query.eq("subject_user_id", filter.subject_user_id).is("family_member_id", null);
  }
  const { error } = await query;
  if (error) {
    console.error("CONSENT_REVOKE_ERROR", error.code);
    throw new Error("Povlačenje privole nije uspjelo. Pokušaj ponovno.");
  }
}

export async function hasActiveConsent(
  familyMemberId: string,
  purpose: ConsentPurpose,
): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("member_consents")
    .select("id")
    .eq("family_member_id", familyMemberId)
    .eq("purpose", purpose)
    .is("revoked_at", null)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("CONSENT_CHECK_ERROR", error.code);
    return false;
  }
  return Boolean(data);
}
