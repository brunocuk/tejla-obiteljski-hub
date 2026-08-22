import { buildPushPayload } from "@block65/webcrypto-web-push";

type PushSub = { id: string; endpoint: string; p256dh: string; auth: string };

/**
 * Instant "someone assigned you a task" push.
 * Completely separate from the scheduled reminder pipeline: it fires once,
 * right after the assignment is stored, and never replaces a reminder.
 */
export async function notifyAssignmentForEvent(eventId: string, actorUserId: string) {
  const vapid = {
    subject: process.env["VAPID_SUBJECT"] ?? "mailto:noreply@example.com",
    publicKey: process.env["VAPID_PUBLIC_KEY"] ?? "",
    privateKey: process.env["VAPID_PRIVATE_KEY"] ?? "",
  };
  if (!vapid.publicKey || !vapid.privateKey) return { sent: 0, recipients: 0 };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: event } = await supabaseAdmin
    .from("family_events")
    .select("id, family_id, title, type")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return { sent: 0, recipients: 0 };

  // The caller must belong to the space the event lives in.
  const { data: actorMembership } = await supabaseAdmin
    .from("family_users")
    .select("user_id")
    .eq("family_id", event.family_id)
    .eq("user_id", actorUserId)
    .maybeSingle();
  if (!actorMembership) return { sent: 0, recipients: 0 };

  // Assignees that own a Tejla account (parents, adults, teens with access).
  const { data: links } = await supabaseAdmin
    .from("event_members")
    .select("family_members(linked_user_id, family_id)")
    .eq("event_id", eventId);

  const candidates = new Set<string>();
  for (const link of links ?? []) {
    const member = link.family_members as { linked_user_id: string | null; family_id: string } | null;
    if (!member?.linked_user_id) continue;
    if (member.family_id !== event.family_id) continue;
    if (member.linked_user_id === actorUserId) continue; // never notify yourself
    candidates.add(member.linked_user_id);
  }
  if (candidates.size === 0) return { sent: 0, recipients: 0 };

  // Only real members of this space.
  const { data: spaceUsers } = await supabaseAdmin
    .from("family_users")
    .select("user_id")
    .eq("family_id", event.family_id);
  const allowed = new Set((spaceUsers ?? []).map((u) => u.user_id));

  // Deduplicate: one assignment push per (event, user), ever.
  const fresh: string[] = [];
  for (const userId of candidates) {
    if (!allowed.has(userId)) continue;
    const { error } = await supabaseAdmin
      .from("assignment_notifications")
      .insert({ event_id: eventId, user_id: userId });
    if (!error) fresh.push(userId);
  }
  if (fresh.length === 0) return { sent: 0, recipients: 0 };

  // Who assigned it.
  let actorName = "";
  const { data: actorMember } = await supabaseAdmin
    .from("family_members")
    .select("name")
    .eq("family_id", event.family_id)
    .eq("linked_user_id", actorUserId)
    .maybeSingle();
  actorName = (actorMember?.name ?? "").trim();
  if (!actorName) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("name")
      .eq("id", actorUserId)
      .maybeSingle();
    actorName = (profile?.name ?? "").trim();
  }

  const isTask = event.type === "task";
  const what = isTask ? "novi zadatak" : "novi termin";
  const body = actorName
    ? `${actorName} ti je dodijelio/la ${what}`
    : `Dodijeljen ti je ${what}`;
  const message = {
    title: "Tejla",
    body,
    url: `/?zadatak=${eventId}`,
    tag: `assign-${eventId}`,
  };

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", fresh);

  let sent = 0;
  for (const sub of (subs ?? []) as PushSub[]) {
    try {
      const payload = await buildPushPayload(
        {
          data: JSON.stringify({
            ...message,
            body: `${body}\n„${(event.title ?? "").trim()}”`.slice(0, 200),
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
      } else if (res.ok) {
        sent += 1;
      }
    } catch (err) {
      console.error("[assignment-push] failed", err);
    }
  }

  return { sent, recipients: fresh.length };
}
