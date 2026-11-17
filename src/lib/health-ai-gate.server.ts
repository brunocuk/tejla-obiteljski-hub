// Gate zdravstvenog AI toka (mail "PRIVOLE" 16.11.): prije nego sadrzaj s
// podacima o zdravlju clana ode Azureu, clan mora imati aktivnu privolu
// zdravstveno-ai, a pozivatelj mora biti clan istog prostora. Vraca poruku
// za korisnika kad je obrada zabranjena, null kad smije.

export const HEALTH_AI_CONSENT_MESSAGE =
  "Za AI izdvajanje zdravstvenog termina potrebna je uključena privola za tu osobu. Uključi je pod Članovi.";

export async function assertHealthAiAllowed(
  userId: string,
  familyMemberId: string,
): Promise<string | null> {
  try {
    const { loadMember, hasActiveConsent } = await import("@/lib/consents.server");
    const member = await loadMember(familyMemberId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: membership } = await supabaseAdmin
      .from("family_users")
      .select("id")
      .eq("family_id", member.family_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) return "Odabrana osoba nije član tvog prostora.";
    if (!(await hasActiveConsent(familyMemberId, "zdravstveno-ai"))) {
      return HEALTH_AI_CONSENT_MESSAGE;
    }
    return null;
  } catch {
    // Fail-closed: bez potvrdjene privole zdravstveni sadrzaj ne ide dalje.
    return HEALTH_AI_CONSENT_MESSAGE;
  }
}
