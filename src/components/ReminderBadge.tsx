import { Bell } from "lucide-react";
import { formatReminderShort, type ReminderRow } from "@/lib/reminders";

/**
 * Subtle bell + next saved reminder time. Renders nothing when the event has
 * no rows in event_reminders.
 */
export function ReminderBadge({ reminders }: { reminders: ReminderRow[] | undefined }) {
  const next = reminders?.[0];
  if (!next) return null;
  const more = (reminders?.length ?? 0) - 1;
  return (
    <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
      <Bell className="size-3" strokeWidth={2} aria-hidden />
      {formatReminderShort(next.remind_at)}
      {more > 0 ? ` +${more}` : ""}
    </span>
  );
}