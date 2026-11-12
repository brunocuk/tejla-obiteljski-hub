import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Entitlement za server rute koje znaju samo korisnika (AI endpointi).
 * Izvor istine je DB funkcija user_has_access (ista logika kao RLS gate).
 * Bilo kakva greska provjere (DB, konfiguracija) NE rusi zahtjev (fail-open
 * uz log): naplata nije sigurnosna granica i kvar u njoj ne smije oboriti
 * cijelu aplikaciju.
 */
export async function userHasAccess(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin.rpc("user_has_access", { _user_id: userId });
    if (error) {
      console.error("ENTITLEMENT_CHECK_ERROR", error.code);
      return true;
    }
    return data === true;
  } catch (err) {
    console.error("ENTITLEMENT_CHECK_ERROR", (err as Error).message);
    return true;
  }
}

export const PAYMENT_REQUIRED_MESSAGE = "Za ovu radnju treba aktivna pretplata.";
