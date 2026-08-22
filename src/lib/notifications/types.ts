/**
 * Client-agnostic notification contract.
 *
 * Business logic produces `NotificationEvent` rows. Delivery channels (web
 * push today, FCM/APNs for the future Flutter client) only consume them.
 * Nothing here knows about browsers, service workers or React.
 */

export type NotificationKind = "assignment";

export type DeliveryChannel = "web_push" | "fcm" | "apns";

export type NotificationEvent = {
  id: string;
  family_id: string;
  /** Recipient. Always a real Tejla account. */
  user_id: string;
  kind: NotificationKind | string;
  subject_type: string;
  subject_id: string | null;
  title: string;
  body: string;
  /** App-relative destination, e.g. `/?zadatak=<id>`. Clients map it themselves. */
  deep_link: string;
  payload: Record<string, unknown>;
};

/** What every channel returns, so dispatch stays channel-agnostic. */
export type ChannelResult = {
  channel: DeliveryChannel;
  sent: number;
  failed: number;
};

/** Message shape handed to a channel; identical for web and native. */
export type NotificationMessage = {
  title: string;
  body: string;
  deepLink: string;
  /** Collapse key — one visible notification per subject, per device. */
  tag: string;
  data: Record<string, unknown>;
};

export function toMessage(event: NotificationEvent): NotificationMessage {
  return {
    title: event.title,
    body: event.body,
    deepLink: event.deep_link,
    tag: `${event.kind}-${event.subject_id ?? event.id}`,
    data: { ...event.payload, kind: event.kind, subjectId: event.subject_id },
  };
}
