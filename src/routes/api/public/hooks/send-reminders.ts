import { createFileRoute } from "@tanstack/react-router";
import { buildPushPayload } from "@block65/webcrypto-web-push";

type EventRow = {
  id: string;
  family_id: string;
  title: string;
  category: string | null;
  date: string | null;
  time: string | null;
  things_to_bring: unknown;
  type?: string | null;
  completed?: boolean | null;
  amount: string | null;
  deadline: string | null;
  event_members: { family_members: { name: string } | null }[] | null;
};

type ReminderRow = {
  id: string;
  remind_at: string;
  recipient_mode: string;
  recipient_user_ids: string[] | null;
  created_by: string;
  family_events: EventRow | null;
};


/**
 * Privacy-safe push body. The lock screen must never expose the member name,
 * the obligation title, location, amount, notes or "ponijeti" — all of that
 * stays inside the app, reachable through the deep link.
 */
function buildMessage(reminder: ReminderRow) {
  const e = reminder.family_events!;
  return {
    title: "Tejla podsjetnik",
    body: "Imaš obvezu uskoro. Otvori Tejlu za detalje.",
    url: `/?zadatak=${e.id}`,
  };
}


export const Route = createFileRoute("/api/public/hooks/send-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        const expected =
          process.env["SUPABASE_ANON_KEY"] ?? process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "";
        if (!expected || apiKey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const vapid = {
          subject: process.env["VAPID_SUBJECT"] ?? "mailto:noreply@example.com",
          publicKey: process.env["VAPID_PUBLIC_KEY"] ?? "",
          privateKey: process.env["VAPID_PRIVATE_KEY"] ?? "",
        };
        if (!vapid.publicKey || !vapid.privateKey) {
          return Response.json({ error: "Missing VAPID keys" }, { status: 500 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const nowIso = new Date().toISOString();
        const windowStart = new Date(Date.now() - 6 * 3_600_000).toISOString();

        const { data, error } = await supabaseAdmin
          .from("event_reminders")
          .select(
            "id, remind_at, recipient_mode, recipient_user_ids, created_by, family_events!inner(id, family_id, title, category, date, time, things_to_bring, amount, deadline, type, completed, event_members(family_members(name)))",
          )
          // A finished task must never keep notifying.
          .eq("family_events.completed", false)
          .is("sent_at", null)
          .is("cancelled_at", null)
          .lte("remind_at", nowIso)
          .gte("remind_at", windowStart)
          .limit(100);

        if (error) {
          console.error("reminder fetch failed", error.message);
          return Response.json({ error: "fetch failed" }, { status: 500 });
        }

        const reminders = (data ?? []) as unknown as ReminderRow[];
        console.log(
          `[send-reminders] run started at ${nowIso}; due reminders: ${reminders.length}`,
        );
        let sent = 0;
        let attempted = 0;
        let failed = 0;

        for (const reminder of reminders) {
          if (!reminder.family_events) continue;
          const message = buildMessage(reminder);
          let rSent = 0;
          let rAttempted = 0;

          let userIds: string[] = [reminder.created_by];
          if (reminder.recipient_mode === "all_parents") {
            const { data: members } = await supabaseAdmin
              .from("family_users")
              .select("user_id")
              .eq("family_id", reminder.family_events.family_id)
              // "Sve roditelje" means the adults of the space, never the children.
              .in("role", ["owner", "parent"]);
            userIds = (members ?? []).map((m) => m.user_id);
          } else if (reminder.recipient_mode === "selected") {
            const picked = (reminder.recipient_user_ids ?? []).filter(Boolean);
            // Only deliver to people who really belong to this family space.
            const { data: members } = await supabaseAdmin
              .from("family_users")
              .select("user_id")
              .eq("family_id", reminder.family_events.family_id);
            const allowed = new Set((members ?? []).map((m) => m.user_id));
            userIds = picked.filter((id) => allowed.has(id));
            if (userIds.length === 0) userIds = [reminder.created_by];
          }

          if (userIds.length > 0) {
            const { data: subs } = await supabaseAdmin
              .from("push_subscriptions")
              .select("id, endpoint, p256dh, auth")
              .in("user_id", userIds);

            for (const sub of subs ?? []) {
              attempted += 1;
              rAttempted += 1;
              try {
                const payload = await buildPushPayload(
                  {
                    data: JSON.stringify({ ...message, tag: reminder.id }),
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
                  failed += 1;
                  console.warn(`[send-reminders] removed expired subscription ${sub.id}`);
                } else if (res.ok) {
                  sent += 1;
                  rSent += 1;
                } else {
                  failed += 1;
                  console.error(`[send-reminders] push rejected ${res.status} for sub ${sub.id}`);
                }
              } catch (err) {
                failed += 1;
                console.error("[send-reminders] push failed", err);
              }
            }
          }

          // Only mark as sent when at least one push went out, or when there was
          // nothing to deliver to (no subscriptions) - otherwise retry next run.
          if (rSent > 0 || rAttempted === 0) {
            await supabaseAdmin
              .from("event_reminders")
              .update({ sent_at: new Date().toISOString() })
              .eq("id", reminder.id);
          }
        }

        console.log(
          `[send-reminders] done: due=${reminders.length} attempted=${attempted} sent=${sent} failed=${failed}`,
        );
        return Response.json({ processed: reminders.length, attempted, sent, failed });
      },
    },
  },
});
