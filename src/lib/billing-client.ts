import { apiAuthHeaders } from "@/lib/api-auth";

/** Pokrece Stripe checkout ili customer portal i vraca URL za redirect. */
export async function startBillingFlow(
  path: "/api/billing/checkout" | "/api/billing/portal",
  familyId: string,
): Promise<string> {
  const headers = { "Content-Type": "application/json", ...(await apiAuthHeaders()) };
  const res = await fetch(path, {
    method: "POST",
    headers,
    body: JSON.stringify({ familyId }),
  });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) {
    throw new Error(data.error ?? "Nešto je pošlo po zlu. Pokušaj ponovno.");
  }
  return data.url;
}
