/**
 * Faza 0 nalaz V2 (SSRF): push_subscriptions.endpoint upisuje klijent sam
 * (PostgREST + RLS), a server potom POST-a na taj URL. Obrana u dva sloja:
 * CHECK constraint u bazi (migracija 20261104120000) brani nove upise, a ova
 * provjera pri slanju pokriva i retke koji su u bazu ušli prije constrainta.
 * Lista i SQL regex moraju ostati usklađeni.
 */

const ALLOWED_HOST_SUFFIXES = [
  ".push.apple.com", // Safari (web.push.apple.com i regionalne varijante)
  ".push.services.mozilla.com", // Firefox (updates.push.services.mozilla.com)
  ".notify.windows.com", // Edge / WNS (wns2-*.notify.windows.com)
] as const;

const ALLOWED_HOSTS = [
  "fcm.googleapis.com", // Chrome i ostali Chromiumi
  "push.apple.com",
  "push.services.mozilla.com",
] as const;

/** True when the URL points at a known browser push service over https. */
export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if ((ALLOWED_HOSTS as readonly string[]).includes(host)) return true;
  return ALLOWED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}
