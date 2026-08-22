import type { ChannelResult, NotificationEvent } from "./types";
import { webPushChannel } from "./channels/web-push.server";
import { nativePushChannel } from "./channels/native-push.server";

/**
 * Delivery layer. Business logic hands it notification events; it decides
 * which channel(s) carry them.
 *
 * Duplicate rule: a recipient gets ONE channel per notification. A user who
 * later has both a Flutter device token and an old browser subscription is
 * reached natively only; web push is the fallback. Per-device duplicates are
 * blocked by the unique claim in `notification_deliveries`.
 */
const channelsByPriority = [nativePushChannel, webPushChannel];

export async function dispatchNotifications(events: NotificationEvent[]) {
  const results: ChannelResult[] = [];
  for (const event of events) {
    for (const channel of channelsByPriority) {
      let available = false;
      try {
        available = await channel.hasTargets(event.user_id);
      } catch (err) {
        console.error(`[notifications] ${channel.channel} target lookup failed`, err);
      }
      if (!available) continue;
      try {
        results.push(await channel.send(event));
      } catch (err) {
        console.error(`[notifications] ${channel.channel} delivery failed`, err);
      }
      break; // one channel per recipient
    }
  }
  const sent = results.reduce((n, r) => n + r.sent, 0);
  return { sent, recipients: events.length, results };
}
