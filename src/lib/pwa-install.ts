/** Small helper around the Android/Chrome install prompt and iOS detection. */

export type Platform = "ios" | "android" | "desktop";

/**
 * Which shell is running Tejla. "native" is reserved for the future Flutter
 * app (it sets `window.__TEJLA_NATIVE__` or a UA marker), where installing a
 * PWA is meaningless — the onboarding step disappears on its own.
 */
export type ClientKind = "web" | "native";

export function getClientKind(): ClientKind {
  if (typeof window === "undefined") return "web";
  const flagged = (window as unknown as { __TEJLA_NATIVE__?: boolean }).__TEJLA_NATIVE__ === true;
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  return flagged || /TejlaNative/i.test(ua) ? "native" : "web";
}

/** Home-screen install only ever applies to the web/PWA client. */
export const installStepApplies = () => getClientKind() === "web" && !isInstalled();

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as InstallPromptEvent;
    listeners.forEach((fn) => fn());
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    rememberInstalled();
    listeners.forEach((fn) => fn());
  });
}

export function onInstallAvailabilityChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export const canPromptInstall = () => deferredPrompt !== null;

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredPrompt) return "unavailable";
  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === "accepted") {
    deferredPrompt = null;
    rememberInstalled();
  }
  listeners.forEach((fn) => fn());
  return outcome;
}

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" &&
      (navigator as unknown as { maxTouchPoints: number }).maxTouchPoints > 1);
  if (iOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

const INSTALLED_KEY = "tejla-pwa-installed";

/** Remembers a successful install so the current browser tab stops offering it. */
export function rememberInstalled() {
  try {
    window.localStorage.setItem(INSTALLED_KEY, "1");
  } catch {
    /* private mode — falls back to display-mode detection */
  }
}

function remembersInstalled() {
  try {
    return window.localStorage.getItem(INSTALLED_KEY) === "1";
  } catch {
    return false;
  }
}

export const isInstalled = () => {
  if (typeof window === "undefined") return false;
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (standalone) {
    rememberInstalled();
    return true;
  }
  return remembersInstalled();
};
