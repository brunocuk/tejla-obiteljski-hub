import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LEGAL_VERSION } from "@/lib/legal";
import { normalizeAcceptanceMethod } from "@/lib/legal-acceptance";

/**
 * Evidencija prihvata Uvjeta koristenja i Pravila privatnosti: verzija,
 * vrijeme (serversko) i nacin. Upis radi service_role; klijent kroz RLS smije
 * samo citati vlastite zapise.
 */
export const recordLegalAcceptance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { method?: string }) => {
    const method = normalizeAcceptanceMethod(input?.method);
    if (!method) throw new Error("Nepoznat način prihvata.");
    return { method };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("legal_acceptances").insert({
      user_id: context.userId,
      doc_version: LEGAL_VERSION,
      method: data.method,
    });
    if (error) {
      console.error("LEGAL_ACCEPT_STORE_ERROR", error.code);
      throw new Error("Spremanje prihvata nije uspjelo. Pokušaj ponovno.");
    }
    return { ok: true as const, version: LEGAL_VERSION };
  });
