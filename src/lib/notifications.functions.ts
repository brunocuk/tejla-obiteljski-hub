import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Client-neutral notification API. The current PWA calls it after saving an
 * assignment; a future Flutter client calls exactly the same endpoints.
 */

export const notifyAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string }) => input)
  .handler(async ({ data, context }) => {
    const { notifyAssignmentForEvent } = await import("./notifications/assignment.server");
    return notifyAssignmentForEvent(data.eventId, context.userId);
  });

/** Native clients (Flutter) register their FCM/APNs token here. */
export const registerDeviceToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { token: string; platform: "ios" | "android"; appVersion?: string }) => {
    if (!input.token.trim()) throw new Error("token required");
    if (input.platform !== "ios" && input.platform !== "android") {
      throw new Error("platform must be ios or android");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("device_push_tokens").upsert(
      {
        user_id: userId,
        token: data.token.trim(),
        platform: data.platform,
        provider: data.platform === "ios" ? "apns" : "fcm",
        app_version: data.appVersion ?? null,
        disabled_at: null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "token" },
    );
    if (error) throw error;
    return { ok: true };
  });

/** Called on sign-out or when the OS revokes the token. */
export const unregisterDeviceToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("device_push_tokens")
      .delete()
      .eq("token", data.token);
    if (error) throw error;
    return { ok: true };
  });
