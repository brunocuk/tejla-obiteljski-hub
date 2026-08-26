import { Bell } from "lucide-react";
import { formatReminderShort, type ReminderRow } from "@/lib/reminders";

/**
 * Subtle bell + next reminder time. Renders nothing when there is nothing to show.
 *
 * A one-off event passes its saved rows. One occurrence of a repeating series
 * passes `times` — the send times computed for THAT occurrence — so a series
 * never shows the first occurrence's template time on every card.
 */
export function ReminderBadge({
  reminders,
  times,
}: {
  reminders?: ReminderRow[] | undefined;
  times?: string[] | undefined;
}) {
  const list = times ?? (reminders ?? []).map((r) => r.remind_at);
  const next = list[0];
  if (!next) return null;
  const more = list.length - 1;
  return (
    <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
      <Bell className="size-3" strokeWidth={2} aria-hidden />
      {formatReminderShort(next)}
      {more > 0 ? ` +${more}` : ""}
    </span>
  );
}
