/**
 * Reminder rules for repeating series.
 *
 * A reminder on a recurring event is a TEMPLATE, not a timestamp: it must be
 * re-evaluated for every occurrence. Two rule kinds exist, because one number
 * cannot express both cases safely:
 *
 * - "relative": N minutes before the occurrence start ("2 sata prije" = 120).
 *   Stable no matter what time the occurrence starts.
 * - "calendar": N calendar days before, at a fixed local wall clock
 *   ("dan prije u 19:00"). Storing this as 1425 minutes would drift by an hour
 *   across a DST switch and break entirely if an occurrence starts at another
 *   time, so it is stored as (days_before, at_time) instead.
 *
 * Both kinds are evaluated in Europe/Zagreb local time — exactly the same rule
 * the database function `materialize_reminder_occurrences` applies, so web,
 * cron and a future Flutter client always agree.
 */

export const REMINDER_TZ = "Europe/Zagreb";

/** Rule of one reminder template of a recurring series. */
export type ReminderRule =
  | { kind: "relative"; offsetMinutes: number }
  | { kind: "calendar"; daysBefore: number; atTime: string };

/** Anything shorter than this before the event stays a plain minute offset. */
const RELATIVE_LIMIT_MINUTES = 12 * 60;

const partsOf = (instant: Date) => {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: REMINDER_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(instant)) map[p.type] = p.value;
  return map;
};

/** Offset of Europe/Zagreb from UTC at a given instant, in milliseconds. */
function tzOffsetMs(instant: Date): number {
  const p = partsOf(instant);
  const asUTC = Date.UTC(
    Number(p["year"]),
    Number(p["month"]) - 1,
    Number(p["day"]),
    Number(p["hour"]) % 24,
    Number(p["minute"]),
    Number(p["second"]),
  );
  return asUTC - instant.getTime();
}

/** Local Zagreb wall clock ("YYYY-MM-DD" + "HH:MM") -> absolute instant. */
export function zagrebInstant(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time && /^\d{1,2}:\d{2}/.test(time) ? time : "09:00").split(":").map(Number);
  const guess = Date.UTC(y!, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
  // Two passes settle the offset even right around a DST switch.
  let ts = guess - tzOffsetMs(new Date(guess));
  ts = guess - tzOffsetMs(new Date(ts));
  return new Date(ts);
}

/** Absolute instant -> Zagreb wall clock. */
export function zagrebWall(instant: Date): { date: string; time: string } {
  const p = partsOf(instant);
  return {
    date: `${p["year"]}-${p["month"]}-${p["day"]}`,
    time: `${p["hour"] === "24" ? "00" : p["hour"]}:${p["minute"]}`,
  };
}

/** Whole calendar days between two "YYYY-MM-DD" dates (b - a). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const t1 = Date.UTC(ay!, (am ?? 1) - 1, ad ?? 1);
  const t2 = Date.UTC(by!, (bm ?? 1) - 1, bd ?? 1);
  return Math.round((t2 - t1) / 86_400_000);
}

/** Shifts a "YYYY-MM-DD" date by whole calendar days. */
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, (m ?? 1) - 1, (d ?? 1) + days));
  return dt.toISOString().slice(0, 10);
}

/**
 * Turns one concrete reminder timestamp (computed for the FIRST occurrence)
 * into a rule that holds for every occurrence of the series.
 */
export function ruleFromTemplate(
  remindAtIso: string,
  eventDate: string,
  eventTime: string,
): ReminderRule {
  const remindAt = new Date(remindAtIso);
  const start = zagrebInstant(eventDate, eventTime || "09:00");
  const deltaMinutes = Math.round((start.getTime() - remindAt.getTime()) / 60_000);
  if (deltaMinutes < RELATIVE_LIMIT_MINUTES) {
    return { kind: "relative", offsetMinutes: deltaMinutes };
  }
  const wall = zagrebWall(remindAt);
  return {
    kind: "calendar",
    daysBefore: Math.max(0, daysBetween(wall.date, eventDate)),
    atTime: wall.time,
  };
}

/** Concrete send time of a rule for one occurrence, as an ISO instant. */
export function occurrenceRemindAt(
  rule: ReminderRule,
  occurrence: { effective_date: string; start_time?: string | null },
  fallbackTime = "09:00",
): string {
  if (rule.kind === "calendar") {
    return zagrebInstant(
      shiftDate(occurrence.effective_date, -rule.daysBefore),
      rule.atTime,
    ).toISOString();
  }
  const start = zagrebInstant(occurrence.effective_date, occurrence.start_time || fallbackTime);
  return new Date(start.getTime() - rule.offsetMinutes * 60_000).toISOString();
}

/** Stored template columns of a recurring reminder. */
export type ReminderTemplate = {
  is_recurring?: boolean | null;
  offset_kind?: string | null;
  offset_minutes?: number | null;
  days_before?: number | null;
  at_time?: string | null;
  remind_at: string;
};

/** Reads the rule back from the stored columns. */
export function ruleFromRow(row: ReminderTemplate): ReminderRule | null {
  if (row.offset_kind === "calendar" && row.days_before != null) {
    return {
      kind: "calendar",
      daysBefore: row.days_before,
      atTime: (row.at_time ?? "19:00").slice(0, 5),
    };
  }
  if (row.offset_minutes == null) return null;
  return { kind: "relative", offsetMinutes: row.offset_minutes };
}

/**
 * Reminder times of ONE occurrence of a series, derived from its templates.
 * Non-recurring reminders are ignored here; they keep their absolute time.
 */
export function occurrenceReminderTimes(
  templates: ReminderTemplate[] | undefined,
  occurrence: { effective_date: string; start_time?: string | null },
  fallbackTime = "09:00",
): string[] {
  const out: string[] = [];
  for (const t of templates ?? []) {
    if (!t.is_recurring) continue;
    const rule = ruleFromRow(t);
    if (!rule) continue;
    out.push(occurrenceRemindAt(rule, occurrence, fallbackTime));
  }
  return [...new Set(out)].sort();
}

/** Columns to persist for a reminder of a recurring series. */
export function recurringReminderColumns(rule: ReminderRule) {
  if (rule.kind === "calendar") {
    return {
      is_recurring: true,
      offset_kind: "calendar",
      days_before: rule.daysBefore,
      at_time: rule.atTime,
      offset_minutes: null as number | null,
    };
  }
  return {
    is_recurring: true,
    offset_kind: "relative",
    days_before: null as number | null,
    at_time: null as string | null,
    offset_minutes: rule.offsetMinutes,
  };
}
