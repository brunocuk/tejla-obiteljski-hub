import { formatCroatianDate, isIsoDate } from "@/lib/date-hr";
import { describeRecurrence, type EventRecurrence } from "@/lib/recurrence";
import { EXCLUDE_LABELS, sanitizeExcludeCodes } from "@/lib/recurrence-exclude";

/**
 * Read-only preview of a recurring AI event so the user can confirm the whole
 * slot (repeat rule, time range, end of series, calendar exceptions) before
 * saving. Deterministic exceptions show as chips; anything Tejla could not map
 * stays visible as the free-text note.
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
  const exclude = sanitizeExcludeCodes(recurrence.exclude);
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
      {exclude.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {exclude.map((code) => (
            <span
              key={code}
              data-testid={`exclude-chip-${code}`}
              className="rounded-full bg-background px-2.5 py-1 text-[11px] font-semibold text-accent-foreground"
            >
              {EXCLUDE_LABELS[code]}
            </span>
          ))}
        </div>
      ) : null}
      {exception_note ? (
        <p className="text-xs text-accent-foreground/80">
          Iznimka: {exception_note}
        </p>
      ) : null}
    </div>
  );
}
