import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Tekstovi privola preuzeti doslovno iz dokumenta HAJDI obrta (mail "PRIVOLE",
// 16.11.2026.). Mijenjati ih smije samo nova verzija dokumenta, uz podizanje
// CONSENT_VERSION; text_version u evidenciji nosi i oznaku teksta.
export const CONSENT_VERSION = "PRIVOLE 1.0";

export type ConsentPurpose =
  | "djecji-racun"
  | "zdravstveno-spremanje"
  | "zdravstveno-ai"
  | "tejline-poruke";

export type HealthPurpose = "zdravstveno-spremanje" | "zdravstveno-ai";

export type AgeGroup = "10-15" | "16-17";

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  "10-15": "10 do 15 godina",
  "16-17": "16 ili 17 godina",
};

export function consentTextVersion(purpose: ConsentPurpose, ageGroup?: AgeGroup | null): string {
  if (purpose === "djecji-racun") return `${CONSENT_VERSION}/${ageGroup ?? "10-15"}`;
  return CONSENT_VERSION;
}

export function childAccountConsentText(ageGroup: AgeGroup, childName: string, familyName: string): string {
  if (ageGroup === "10-15") {
    return `Potvrđujem da sam ovlašten/a zastupati dijete ${childName} i dajem privolu da Tejla obrađuje podatke potrebne za otvaranje i korištenje njegova računa u obiteljskom prostoru ${familyName}.`;
  }
  return `Dajem privolu da Tejla obrađuje podatke potrebne za moj račun kako bih mogao/la koristiti obiteljski prostor ${familyName} i unositi svoje obveze.`;
}

export function healthSaveConsentText(name: string, familyName: string): string {
  return `Izričito pristajem da Tejla sprema zdravstvene termine za ${name} u obiteljskom prostoru ${familyName} radi organizacije obveza i podsjetnika. Termine mogu vidjeti svi odrasli članovi tog prostora, uključujući one koji se pridruže kasnije. Djeca ih mogu vidjeti prema postavkama vidljivosti.`;
}

export function healthAiConsentText(name: string, familyName: string): string {
  return `Izričito pristajem da Tejla odabranu uputnicu, sliku ili drugi podržani sadržaj s podacima o zdravlju osobe ${name} pošalje Microsoftovu servisu Azure radi izdvajanja prijedloga termina za obiteljski prostor ${familyName}.`;
}

export const TEJLA_MESSAGES_CONSENT_TEXT =
  "Želim primati povremene Tejline poruke sa savjetima, izvan svojih podsjetnika. Mogu ih isključiti u bilo kojem trenutku pod Članovi → Tejline poruke.";

export const CONSENT_HELP_CONTACT = "tejla@tejla.app";

type MemberForConsent = {
  id: string;
  member_type: string | null;
  linked_user_id: string | null;
  age_group: string | null;
  sixteen_confirmed_at: string | null;
};

/**
 * Tko smije upravljati zdravstvenim privolama clana (isto pravilo vrijedi na
 * serveru, ovo je kopija za UI):
 *  - punoljetni clan s racunom: samo on sam;
 *  - dijete 16-17 s racunom (ili potvrdjenih 16): samo dijete;
 *  - clan bez racuna ili dijete 10-15 s racunom: ovlasteni roditelj/skrbnik
 *    (odrasli clan prostora).
 */
export function canManageHealthConsents(
  member: MemberForConsent,
  myUserId: string | null | undefined,
  iAmFamilyAdult: boolean,
): boolean {
  const isSelf = Boolean(myUserId && member.linked_user_id === myUserId);
  const isChild = member.member_type === "child";
  const teenSelfManaged = isChild && (member.age_group === "16-17" || Boolean(member.sixteen_confirmed_at));
  if (member.linked_user_id) {
    if (!isChild) return isSelf;
    if (teenSelfManaged) return isSelf;
    return iAmFamilyAdult;
  }
  return iAmFamilyAdult;
}

export type ConsentRow = {
  id: string;
  family_id: string | null;
  family_member_id: string | null;
  purpose: ConsentPurpose;
  text_version: string;
  granted_by: string | null;
  granted_at: string;
  revoked_at: string | null;
};

export type MemberConsentState = {
  save: boolean;
  ai: boolean;
  account: ConsentRow | null;
};

/** Aktivne privole prostora, mapirane po clanu. */
export function useMemberConsents(familyId: string | null | undefined) {
  return useQuery({
    queryKey: ["member-consents", familyId],
    enabled: Boolean(familyId),
    queryFn: async (): Promise<Record<string, MemberConsentState>> => {
      const { data, error } = await supabase
        .from("member_consents")
        .select("id, family_id, family_member_id, purpose, text_version, granted_by, granted_at, revoked_at")
        .eq("family_id", familyId!)
        .is("revoked_at", null);
      if (error) throw error;
      const map: Record<string, MemberConsentState> = {};
      for (const row of (data ?? []) as ConsentRow[]) {
        if (!row.family_member_id) continue;
        const entry = (map[row.family_member_id] ??= { save: false, ai: false, account: null });
        if (row.purpose === "zdravstveno-spremanje") entry.save = true;
        else if (row.purpose === "zdravstveno-ai") entry.ai = true;
        else if (row.purpose === "djecji-racun") entry.account = row;
      }
      return map;
    },
  });
}
