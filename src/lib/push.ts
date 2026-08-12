import { supabase } from "@/integrations/supabase/client";

export type PushStatus = "unsupported" | "needs-install" | "granted" | "denied" | "default";

const isIOS = () =>
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && (navigator as unknown as { maxTouchPoints: number }).maxTouchPoints > 1));

export const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true);

export const pushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

/** Reads the live browser permission — never cached in localStorage. */
export function pushStatus(): PushStatus {
  if (typeof window === "undefined") return "unsupported";
  if (!pushSupported()) {
    // iOS only exposes Web Push inside an installed Home Screen app.
    if (isIOS() && !isStandalone()) return "needs-install";
    return "unsupported";
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return "default";
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

const b64 = (buf: ArrayBuffer | null) =>
  buf
    ? btoa(String.fromCharCode(...new Uint8Array(buf)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")
    : "";

/** Saves (or refreshes) the Web Push subscription for the signed-in user. */
export async function syncSubscription(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const res = await fetch("/api/public/vapid-key");
    const { key } = (await res.json()) as { key: string };
    if (!key) return false;

    const existing = await registration.pushManager.getSubscription();
    const sub =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      }));

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return false;

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: uid,
        endpoint: sub.endpoint,
        p256dh: b64(sub.getKey("p256dh")),
        auth: b64(sub.getKey("auth")),
      },
      { onConflict: "endpoint" },
    );
    return !error;
  } catch {
    return false;
  }
}

/** Asks for permission (only from a direct user tap) and stores the subscription. */
export async function enablePush(): Promise<PushStatus | "error"> {
  const status = pushStatus();
  if (status === "unsupported" || status === "needs-install") return status;

  const permission = await Notification.requestPermission();
  if (permission === "denied") return "denied";
  if (permission !== "granted") return "default";

  const ok = await syncSubscription();
  return ok ? "granted" : "error";
}
