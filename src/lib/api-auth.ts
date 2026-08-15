import { supabase } from "@/integrations/supabase/client";

/** Authorization header for calls to Tejla's own /api endpoints. */
export async function apiAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
