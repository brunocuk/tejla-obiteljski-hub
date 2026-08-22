import type { ChannelResult, NotificationEvent } from "../types";
import { toMessage } from "../types";

/**
 * Native delivery for the future Flutter iOS/Android client.
 *
 * Device tokens are already collected in `device_push_tokens`, so the
 * business logic does not change when this channel goes live: only the
 * `deliver()` body below has to call FCM/APNs. Until a provider key exists,
 * the channel reports itself as unavailable and dispatch falls back to web
 * push — never a duplicate.
 */

type TokenRow = { id: string; token: string; platform: string; provider: string };

const providerConfigured = () => Boolean(process.env["FCM_SERVICE_ACCOUNT_JSON"]);

export const nativePushChannel = {
  channel: "fcm" as const,

  async hasTargets(userId: string) {
    if (!providerConfigured()) return false;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("device_push_tokens")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("disabled_at", null);
    return (count ?? 0) > 0;
  },

  async send(event: NotificationEvent): Promise<ChannelResult> {
    if (!providerConfigured()) return { channel: "fcm", sent: 0, failed: 0 };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tokens } = await supabaseAdmin
      .from("device_push_tokens")
      .select("id, token, platform, provider")
      .eq("user_id", event.user_id)
      .is("disabled_at", null);

    const message = toMessage(event);
    let sent = 0;
    let failed = 0;

    for (const device of (tokens ?? []) as TokenRow[]) {
      const { error: claimError } = await supabaseAdmin.from("notification_deliveries").insert({
        notification_event_id: event.id,
        channel: "fcm",
        target_ref: device.id,
      });
      if (claimError) continue;

      // TODO(flutter): call FCM/APNs here with `message`. The payload contract
      // is identical to web push: title, body, deepLink, tag, data.
      const status = "skipped";
      failed += 0;
      void message;

      await supabaseAdmin
        .from("notification_deliveries")
        .update({ status, error: "native provider not configured yet" })
        .eq("notification_event_id", event.id)
        .eq("channel", "fcm")
        .eq("target_ref", device.id);
    }

    return { channel: "fcm", sent, failed };
  },
};
