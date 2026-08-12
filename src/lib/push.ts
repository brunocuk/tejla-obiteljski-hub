import { supabase } from "@/integrations/supabase/client";

const DENIED_KEY = "family-hub-push-denied";

export const pushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

export function pushStatus(): "unsupported" | "granted" | "denied" | "default" {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  if (typeof localStorage !== "undefined" && localStorage.getItem(DENIED_KEY)) return "denied";
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
  buf ? btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : "";

/** Asks for permission (only when the user taps the button) and stores the subscription. */
export async function enablePush(): Promise<"granted" | "denied" | "error"> {
  if (!pushSupported()) return "error";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    try {
      localStorage.setItem(DENIED_KEY, "1");
    } catch {
      /* ignore */
    }
    return "denied";
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const res = await fetch("/api/public/vapid-key");
    const { key } = (await res.json()) as { key: string };
    if (!key) return "error";

    const existing = await registration.pushManager.getSubscription();
    const sub =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      }));

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return "error";

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: uid,
        endpoint: sub.endpoint,
        p256dh: b64(sub.getKey("p256dh")),
        auth: b64(sub.getKey("auth")),
      },
      { onConflict: "endpoint" },
    );
    if (error) return "error";
    return "granted";
  } catch {
    return "error";
  }
}