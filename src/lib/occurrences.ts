import { addDays, weekdayCodeOf, type EventRecurrence } from "@/lib/recurrence";

/**
 * Pure (database-free) occurrence math shared by the school-calendar banner and
 * the reminder engine.
 *
 * This is deliberately NOT a second canonical expansion: overrides and Croatian
 * calendar exclusions stay in Postgres (`expand_event_occurrences`). Here we
 * only answer "which dates would the rule produce", which is what a client
 * needs to place a reminder template on the next upcoming slot.
 */

export type RecurringSeries = {
  /** Series start date, "YYYY-MM-DD". */
  date: string;
  recurrence: EventRecurrence;
};

/** Kept for existing imports. */
export type SchoolBreakSeries = RecurringSeries;

const MAX_STEPS = 400;

/**
 * Potential occurrence dates of a series inside [from, to] (both inclusive).
 *
 * `recurrence.until` is inclusive: an occurrence that falls exactly on the end
 * date is produced, nothing after it ever is.
 */
export function potentialOccurrencesInWindow(
  series: RecurringSeries,
  from: string,
  to: string,
): string[] {
  const { date, recurrence } = series;
  if (!recurrence.freq || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const end = recurrence.until && recurrence.until < to ? recurrence.until : to;
  if (end < from || date > end) return [];

  const interval = Math.max(1, recurrence.interval || 1);
  const out: string[] = [];

  if (recurrence.freq === "weekly") {
    const startCode = weekdayCodeOf(date);
    const days = recurrence.byday.length > 0 ? recurrence.byday : startCode ? [startCode] : [];
    if (days.length === 0) return [];
    // Weeks are counted from the series start week so `interval` stays stable.
    let cursor = date;
    for (let step = 0; step < MAX_STEPS * 7 && cursor <= end; step++) {
      const weekIndex = Math.floor(daysBetween(date, cursor) / 7);
      const code = weekdayCodeOf(cursor);
      if (weekIndex % interval === 0 && code && days.includes(code) && cursor >= from) {
        out.push(cursor);
      }
      cursor = addDays(cursor, 1);
    }
    return out;
  }

  if (recurrence.freq === "daily") {
    let cursor = date;
    for (let step = 0; step < MAX_STEPS && cursor <= end; step++) {
      if (cursor >= from) out.push(cursor);
      cursor = addDays(cursor, interval);
    }
    return out;
  }

  // monthly
  const [y0, m0, d0] = date.split("-").map(Number);
  for (let step = 0; step < MAX_STEPS; step++) {
    const monthsAhead = step * interval;
    const y = y0! + Math.floor((m0! - 1 + monthsAhead) / 12);
    const m = ((m0! - 1 + monthsAhead) % 12) + 1;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const day = Math.min(d0!, lastDay);
    const cursor = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (cursor > end) break;
    if (cursor >= from) out.push(cursor);
  }
  return out;
}

export function daysBetween(a: string, b: string): number {
  const toUtc = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y!, (m ?? 1) - 1, d ?? 1);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

const localAt = (date: string, time: string): Date => {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time && /^\d{1,2}:\d{2}/.test(time) ? time : "00:00").split(":").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
};

/**
 * Next occurrence of a series that still lies in the future.
 *
 * Today's occurrence is skipped once its start time has passed ("svaki dan u
 * 06:00" at 14:00 -> tomorrow 06:00). Returns null for a one-off event or when
 * the series has already ended.
 */
export function nextOccurrenceDate(
  event: { date: string; time?: string; recurrence: EventRecurrence },
  now: Date = new Date(),
): string | null {
  if (!event.recurrence?.freq) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date ?? "")) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  const today = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
  const from = event.date > today ? event.date : today;
  const horizon = addDays(from, MAX_STEPS);
  const time = (event.time ?? "").trim();
  for (const date of potentialOccurrencesInWindow(event, from, horizon)) {
    if (localAt(date, time).getTime() > now.getTime()) return date;
  }
  return null;
}
