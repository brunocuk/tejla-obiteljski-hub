import { createFileRoute } from "@tanstack/react-router";
import { SEND_HOURS, zagrebNow } from "@/lib/notifications/tejla-messages";
import { rejectUnauthorizedCron } from "@/lib/cron-auth";

/**
 * Scheduler endpoint for "Tejline poruke".
 *
 * Called hourly by cron; the send window is decided here in Europe/Zagreb
 * wall-clock time, so it stays correct across DST changes (no hardcoded UTC
 * hours). Completely separate from /api/public/hooks/send-reminders.
 */
export const Route = createFileRoute("/api/public/hooks/tejla-messages")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = rejectUnauthorizedCron(request);
        if (denied) return denied;


        const now = zagrebNow(new Date());
        if (!SEND_HOURS.includes(now.hour)) {
          return Response.json({ skipped: "outside_send_window", hour: now.hour });
        }

        const { runTejlaMessages } = await import("@/lib/notifications/tejla-messages.server");
        const result = await runTejlaMessages();
        console.log(`[tejla-messages] ${now.date} ${now.hour}h →`, result);
        return Response.json(result);
      },
    },
  },
});
