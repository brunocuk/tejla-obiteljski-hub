import { formatCroatianDate, isIsoDate } from "@/lib/date-hr";
import { describeRecurrence, type EventRecurrence } from "@/lib/recurrence";

/**
 * Read-only preview of a recurring AI event so the user can confirm the whole
 * slot (repeat rule, time range, end of series, exception) before saving.
 */
export function RecurrenceSummary({
  recurrence,
  date,
  time,
  end_time,
  exception_note,
}: {
  recurrence: EventRecurrence;
  date: string;
  time: string;
  end_time: string;
  exception_note: string;
}) {
  const described = describeRecurrence(
    isIsoDate(recurrence.until)
      ? { ...recurrence, until: formatCroatianDate(recurrence.until) }
      : recurrence,
    date,
  );
  return (
    <div
      data-testid="recurrence-summary"
      className="space-y-1 rounded-xl bg-primary-soft px-3 py-2.5"
    >
      <p className="text-xs font-semibold text-accent-foreground">{described}</p>
      <p className="text-xs text-accent-foreground/80">
        {time || "—"}
        {end_time ? ` – ${end_time}` : ""}
      </p>
      {exception_note ? (
        <p className="text-xs text-accent-foreground/80">
          Iznimka: {exception_note}
        </p>
      ) : null}
    </div>
  );
}
