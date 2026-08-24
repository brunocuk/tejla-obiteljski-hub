import { dispatchNotifications } from "./dispatch.server";
import type { NotificationEvent } from "./types";
import {
  NUDGE_KIND,
  SAME_KIND_COOLDOWN_DAYS,
  addDays,
  dedupeKey,
  isQuietHour,
  pickNudge,
  zagrebNow,
  type CalendarEvent,
  type RecentNudge,
} from "./tejla-messages";

/**
 * Scheduler for "Tejline poruke".
 *
 * Reads the calendar, applies the pure rules in ./tejla-messages, writes at
 * most one channel-agnostic notification_event per user and hands it to the
 * existing dispatch layer. The event_reminders engine is untouched.
 */

export async function runTejlaMessages(instant = new Date()) {
  const now = zagrebNow(instant);
  if (isQuietHour(now.hour)) return { skipped: "quiet_hours" as const, created: 0, sent: 0 };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1. Who opted in (default is OFF; absence of a row means OFF).
  const { data: prefs } = await supabaseAdmin
    .from("user_notification_prefs")
    .select("user_id")
    .eq("tejla_messages_enabled", true);
  const optedIn = (prefs ?? []).map((p) => p.user_id);
  if (optedIn.length === 0) return { skipped: null, created: 0, sent: 0 };

  // 2. Only users with a live push target can be reached at all.
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("user_id")
    .in("user_id", optedIn);
  const { data: tokens } = await supabaseAdmin
    .from("device_push_tokens")
    .select("user_id")
    .in("user_id", optedIn)
    .is("disabled_at", null);
  const reachable = new Set([
    ...(subs ?? []).map((s) => s.user_id),
    ...(tokens ?? []).map((t) => t.user_id),
  ]);

  // 3. Adults of a space only; children have their own visibility rules and
  //    an archived (former) member is never a recipient.
  const { data: memberships } = await supabaseAdmin
    .from("family_users")
    .select("user_id, family_id, role")
    .in("user_id", [...reachable])
    .in("role", ["owner", "parent"]);

  const recipients: { userId: string; familyId: string }[] = [];
  for (const m of memberships ?? []) {
    const { data: member } = await supabaseAdmin
      .from("family_members")
      .select("id, archived_at")
      .eq("family_id", m.family_id)
      .eq("linked_user_id", m.user_id)
      .maybeSingle();
    if (!member || member.archived_at) continue;
    recipients.push({ userId: m.user_id, familyId: m.family_id });
  }
  if (recipients.length === 0) return { skipped: null, created: 0, sent: 0 };

  // 4. Calendar window: today .. +7 days, per family.
  const windowEnd = addDays(now.date, 7);
  const eventsByFamily = new Map<string, CalendarEvent[]>();
  for (const familyId of new Set(recipients.map((r) => r.familyId))) {
    const { data: events } = await supabaseAdmin
      .from("family_events")
      .select("id, date, category, type, completed")
      .eq("family_id", familyId)
      .gte("date", now.date)
      .lte("date", windowEnd);
    eventsByFamily.set(familyId, (events ?? []) as CalendarEvent[]);
  }

  const created: NotificationEvent[] = [];
  const historyFrom = new Date(
    Date.parse(`${addDays(now.date, -SAME_KIND_COOLDOWN_DAYS)}T00:00:00Z`),
  ).toISOString();

  for (const { userId, familyId } of recipients) {
    const { data: history } = await supabaseAdmin
      .from("notification_events")
      .select("payload, created_at")
      .eq("user_id", userId)
      .eq("kind", NUDGE_KIND)
      .gte("created_at", historyFrom);

    const recent: RecentNudge[] = (history ?? []).map((h) => ({
      messageKey: String((h.payload as { messageKey?: string })?.messageKey ?? ""),
      date: zagrebNow(new Date(h.created_at)).date,
    }));

    const candidate = pickNudge({
      now,
      events: eventsByFamily.get(familyId) ?? [],
      recent,
    });
    if (!candidate) continue;

    // UNIQUE(dedupe_key) makes a repeated cron run a no-op.
    const { data: row, error } = await supabaseAdmin
      .from("notification_events")
      .insert({
        family_id: familyId,
        user_id: userId,
        kind: NUDGE_KIND,
        subject_type: "nudge",
        subject_id: candidate.subjectId,
        title: "Tejla",
        body: candidate.body,
        deep_link: candidate.deepLink,
        payload: { messageKey: candidate.messageKey },
        dedupe_key: dedupeKey(userId, candidate),
      })
      .select(
        "id, family_id, user_id, kind, subject_type, subject_id, title, body, deep_link, payload",
      )
      .maybeSingle();
    if (error || !row) continue;
    created.push(row as unknown as NotificationEvent);
  }

  if (created.length === 0) return { skipped: null, created: 0, sent: 0 };
  const { sent } = await dispatchNotifications(created);
  return { skipped: null, created: created.length, sent };
}
