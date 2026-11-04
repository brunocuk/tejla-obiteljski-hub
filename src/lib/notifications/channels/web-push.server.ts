import { buildPushPayload } from "@block65/webcrypto-web-push";
import type { ChannelResult, NotificationEvent } from "../types";
import { toMessage } from "../types";
import { isAllowedPushEndpoint } from "../push-endpoint";

/**
 * Web Push delivery for the current PWA/browser client.
 * One of several interchangeable channels — it holds no business rules.
 */
export const webPushChannel = {
  channel: "web_push" as const,

  /** True when this user has at least one live browser subscription. */
  async hasTargets(userId: string) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    return (count ?? 0) > 0;
  },

  async send(event: NotificationEvent): Promise<ChannelResult> {
    const vapid = {
      subject: process.env["VAPID_SUBJECT"] ?? "mailto:noreply@example.com",
      publicKey: process.env["VAPID_PUBLIC_KEY"] ?? "",
      privateKey: process.env["VAPID_PRIVATE_KEY"] ?? "",
    };
    if (!vapid.publicKey || !vapid.privateKey) return { channel: "web_push", sent: 0, failed: 0 };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", event.user_id);

    const message = toMessage(event);
    let sent = 0;
    let failed = 0;

    for (const sub of subs ?? []) {
      // Claim this (notification, channel, device) slot; a duplicate insert
      // means it was already delivered and must not be sent twice.
      const { error: claimError } = await supabaseAdmin.from("notification_deliveries").insert({
        notification_event_id: event.id,
        channel: "web_push",
        target_ref: sub.id,
      });
      if (claimError) continue;

      let status = "failed";
      let errorText: string | null = null;
      if (!isAllowedPushEndpoint(sub.endpoint)) {
        // SSRF guard (Faza 0 V2): never POST outside known push services.
        await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
        await supabaseAdmin
          .from("notification_deliveries")
          .update({ status: "blocked", error: "endpoint not allowed", sent_at: new Date().toISOString() })
          .eq("notification_event_id", event.id)
          .eq("channel", "web_push")
          .eq("target_ref", sub.id);
        failed += 1;
        continue;
      }
      try {
        const payload = await buildPushPayload(
          {
            data: JSON.stringify({
              title: message.title,
              body: message.body,
              url: message.deepLink,
              tag: message.tag,
              data: message.data,
            }),
            options: { ttl: 3600 },
          },
          {
            endpoint: sub.endpoint,
            expirationTime: null,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          vapid,
        );
        const res = await fetch(sub.endpoint, payload as unknown as RequestInit);
        if (res.status === 404 || res.status === 410) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
          status = "expired";
        } else if (res.ok) {
          status = "sent";
          sent += 1;
        } else {
          errorText = `http ${res.status}`;
          failed += 1;
        }
      } catch (err) {
        errorText = err instanceof Error ? err.message : "unknown";
        failed += 1;
      }

      await supabaseAdmin
        .from("notification_deliveries")
        .update({ status, error: errorText, sent_at: new Date().toISOString() })
        .eq("notification_event_id", event.id)
        .eq("channel", "web_push")
        .eq("target_ref", sub.id);
    }

    return { channel: "web_push", sent, failed };
  },
};
