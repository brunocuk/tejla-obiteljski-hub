import type { NotificationEvent } from "./types";
import { dispatchNotifications } from "./dispatch.server";

/**
 * Business logic for "someone was assigned a task/event".
 *
 * Pure domain rules, no client assumptions: it decides WHO must be told and
 * WHAT the message says, writes a channel-agnostic notification event, and
 * then asks the delivery layer to carry it. A Flutter client calling the same
 * endpoint produces exactly the same events.
 */
export async function recordAssignmentNotifications(
  eventId: string,
  actorUserId: string,
): Promise<NotificationEvent[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: event } = await supabaseAdmin
    .from("family_events")
    .select("id, family_id, title, type")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return [];

  // The caller must belong to the space the event lives in.
  const { data: actorMembership } = await supabaseAdmin
    .from("family_users")
    .select("user_id")
    .eq("family_id", event.family_id)
    .eq("user_id", actorUserId)
    .maybeSingle();
  if (!actorMembership) return [];

  const { data: links } = await supabaseAdmin
    .from("event_members")
    .select("family_members(linked_user_id, family_id)")
    .eq("event_id", eventId);

  const candidates = new Set<string>();
  for (const link of links ?? []) {
    const member = link.family_members as {
      linked_user_id: string | null;
      family_id: string;
    } | null;
    if (!member?.linked_user_id) continue;
    if (member.family_id !== event.family_id) continue;
    if (member.linked_user_id === actorUserId) continue; // never notify yourself
    candidates.add(member.linked_user_id);
  }
  if (candidates.size === 0) return [];

  const { data: spaceUsers } = await supabaseAdmin
    .from("family_users")
    .select("user_id")
    .eq("family_id", event.family_id);
  const allowed = new Set((spaceUsers ?? []).map((u) => u.user_id));

  const isTask = event.type === "task";
  // Privacy-safe: the push body (and the stored notification event) must never
  // carry the obligation title or any other event detail — those stay in-app.
  const body = isTask
    ? "Dodijeljen ti je novi zadatak. Otvori Tejlu za detalje."
    : "Dodijeljen ti je novi termin. Otvori Tejlu za detalje.";

  const created: NotificationEvent[] = [];
  for (const userId of candidates) {
    if (!allowed.has(userId)) continue;
    // dedupe_key is unique: one assignment notification per (event, person),
    // no matter how many times the event is saved or from which client.
    const { data: row, error } = await supabaseAdmin
      .from("notification_events")
      .insert({
        family_id: event.family_id,
        user_id: userId,
        kind: "assignment",
        subject_type: "family_event",
        subject_id: event.id,
        title: "Tejla",
        body,
        deep_link: `/?zadatak=${event.id}`,
        payload: { eventType: isTask ? "task" : "event", actorUserId },
        dedupe_key: `assignment:${event.id}:${userId}`,
      })
      .select("id, family_id, user_id, kind, subject_type, subject_id, title, body, deep_link, payload")
      .maybeSingle();
    if (error || !row) continue; // already notified earlier
    created.push(row as unknown as NotificationEvent);
  }

  return created;
}

/** Domain call used by the app: record the events, then deliver them. */
export async function notifyAssignmentForEvent(eventId: string, actorUserId: string) {
  const events = await recordAssignmentNotifications(eventId, actorUserId);
  if (events.length === 0) return { sent: 0, recipients: 0 };
  const { sent, recipients } = await dispatchNotifications(events);
  return { sent, recipients };
}
