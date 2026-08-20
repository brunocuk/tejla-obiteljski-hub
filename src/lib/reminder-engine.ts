import { formatClock, formatDayMonthNumeric } from "./date-hr";
import type { RecipientMode, ReminderDraft } from "@/lib/reminders";

/**
 * One universal reminder engine used by every input path (manual, voice, text,
 * photo, document, AI). A pattern is expanded into concrete future times; the
 * existing row-based delivery (event_reminders + push cron) stays unchanged.
 */
export type ReminderPattern =
  "once" | "hourly" | "every_2h" | "every_3h" | "twice_daily" | "three_daily" | "until_done";

export const PATTERN_LABELS: Record<ReminderPattern, string> = {
  once: "Jednom",
  hourly: "Svaki sat",
  every_2h: "Svaka 2 sata",
  every_3h: "Svaka 3 sata",
  twice_daily: "2 puta dnevno",
  three_daily: "3 puta dnevno",
  until_done: "Ponavljaj dok ne označim riješeno",
};

/** Patterns offered in the UI; "until_done" is task-only. */
export const EVENT_PATTERNS: ReminderPattern[] = [
  "once",
  "hourly",
  "every_2h",
  "every_3h",
  "twice_daily",
  "three_daily",
];
export const TASK_PATTERNS: ReminderPattern[] = [...EVENT_PATTERNS, "until_done"];

/** Reasonable active day, so repeats never land in the middle of the night. */
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 22;

/** Safety limit so a bug can never schedule an endless stream of pushes. */
export const MAX_OCCURRENCES = 24;

const INTERVAL_MINUTES: Partial<Record<ReminderPattern, number>> = {
  hourly: 60,
  every_2h: 120,
  every_3h: 180,
  until_done: 120,
};

const COUNT_PER_DAY: Partial<Record<ReminderPattern, number>> = {
  twice_daily: 2,
  three_daily: 3,
};

const clone = (d: Date) => new Date(d.getTime());

/** Moves a time into the active part of the day (same day or next morning). */
function withinActiveDay(d: Date): Date {
  const out = clone(d);
  if (out.getHours() < DAY_START_HOUR) {
    out.setHours(DAY_START_HOUR, 0, 0, 0);
  } else if (out.getHours() >= DAY_END_HOUR) {
    out.setDate(out.getDate() + 1);
    out.setHours(DAY_START_HOUR, 0, 0, 0);
  }
  return out;
}

/**
 * Spreads `count` reminders across the remaining reasonable part of the day,
 * continuing the next morning when there is not enough time left today.
 */
function spreadOverDay(start: Date, count: number, days: number): Date[] {
  const out: Date[] = [];
  let cursor = clone(start);
  for (let day = 0; day < days && out.length < count * days; day += 1) {
    const dayStart = day === 0 ? withinActiveDay(cursor) : new Date(cursor);
    if (day > 0) dayStart.setHours(DAY_START_HOUR, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(DAY_END_HOUR, 0, 0, 0);
    const span = dayEnd.getTime() - dayStart.getTime();
    const slots = count;
    // Minimum 45 minutes between reminders; otherwise push the rest to tomorrow.
    const step = slots > 1 ? span / (slots - 1) : 0;
    for (let i = 0; i < slots; i += 1) {
      const t = new Date(dayStart.getTime() + step * i);
      if (slots > 1 && step < 45 * 60_000 && i > 0) break;
      out.push(t);
    }
    cursor = new Date(dayStart);
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export type ExpandOptions = {
  /** Base time of the first reminder. Defaults to now. */
  start?: Date;
  /** How many days ahead repeating patterns are pre-scheduled. */
  days?: number;
};

/** Concrete future times for a pattern. Always returns at least the start time. */
export function expandPattern(pattern: ReminderPattern, options: ExpandOptions = {}): Date[] {
  const now = Date.now();
  const start = options.start ?? new Date();
  const days = options.days ?? (pattern === "until_done" ? 2 : 1);

  if (pattern === "once") return [start];

  const interval = INTERVAL_MINUTES[pattern];
  if (interval) {
    const out: Date[] = [start];
    let cursor = clone(start);
    while (out.length < MAX_OCCURRENCES) {
      cursor = new Date(cursor.getTime() + interval * 60_000);
      const active = withinActiveDay(cursor);
      cursor = active;
      if (cursor.getTime() - start.getTime() > days * 24 * 3_600_000) break;
      out.push(clone(cursor));
    }
    return out.filter((t) => t.getTime() > now - 1000).slice(0, MAX_OCCURRENCES);
  }

  const count = COUNT_PER_DAY[pattern] ?? 1;
  return spreadOverDay(start, count, Math.max(1, days))
    .filter((t) => t.getTime() > now - 1000)
    .slice(0, MAX_OCCURRENCES);
}

let seq = 0;
const newKey = () => `p${Date.now()}-${seq++}`;

/** Pattern -> reminder drafts, ready for the existing save path. */
export function draftsFromPattern(
  pattern: ReminderPattern,
  recipient: RecipientMode,
  options: ExpandOptions = {},
): ReminderDraft[] {
  return expandPattern(pattern, options).map((t) => ({
    key: newKey(),
    remind_at: t.toISOString(),
    recipient_mode: recipient,
    offset_minutes: null,
    pattern,
  }));
}



const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** "Danas: 12:00 · 15:30 · 19:00" style preview of a computed schedule. */
export function scheduleSummary(times: string[]): string[] {
  const now = new Date();
  const groups = new Map<string, string[]>();
  for (const iso of times) {
    const d = new Date(iso);
    const label = isSameDay(d, now)
      ? "Danas"
      : isSameDay(d, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
        ? "Sutra"
        : formatDayMonthNumeric(d);
    const list = groups.get(label) ?? [];
    list.push(formatClock(d));
    groups.set(label, list);
  }
  return [...groups.entries()].map(([label, list]) => `${label}: ${list.join(" · ")}`);
}
