/** Local (browser) traces Tejla leaves behind, cleared when an account is deleted. */
const EXACT_KEYS = ["family-hub-events", "family-hub-recent", "tejla-pwa-installed"];
const PREFIXES = ["tejla-onboarding-", "sb-"];

export function clearTejlaLocalData() {
  if (typeof window === "undefined") return;
  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      const keys: string[] = [];
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (!key) continue;
        if (EXACT_KEYS.includes(key) || PREFIXES.some((p) => key.startsWith(p))) keys.push(key);
      }
      keys.forEach((key) => storage.removeItem(key));
    } catch {
      // Storage can be unavailable (private mode); nothing else to clean up.
    }
  }
}
