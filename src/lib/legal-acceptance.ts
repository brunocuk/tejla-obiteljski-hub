/**
 * Nacini prihvata Uvjeta/Pravila koje evidencija poznaje. Beta redeem upisuje
 * svoj zapis direktno na serveru (beta.server.ts); ostala dva idu kroz
 * recordLegalAcceptance server funkciju.
 */
export const ACCEPTANCE_METHODS = [
  "beta-pozivnica-registracija",
  "obiteljska-pozivnica-registracija",
  "potvrda-u-aplikaciji",
] as const;

export type AcceptanceMethod = (typeof ACCEPTANCE_METHODS)[number];

export function normalizeAcceptanceMethod(raw: unknown): AcceptanceMethod | null {
  return (ACCEPTANCE_METHODS as readonly string[]).includes(String(raw))
    ? (String(raw) as AcceptanceMethod)
    : null;
}
