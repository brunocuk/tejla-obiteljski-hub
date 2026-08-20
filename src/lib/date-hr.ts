/**
 * Single date/time presentation layer for Tejla.
 *
 * Storage stays untouched: dates are "YYYY-MM-DD" and times "HH:MM" everywhere
 * in the database and API. Only display goes through this module, so switching
 * locale later means changing LOCALE here — not the UI components.
 */

export const LOCALE = "hr-HR";

const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(LOCALE, options);

const longDate = fmt({ day: "numeric", month: "long", year: "numeric" });
const dayMonthLong = fmt({ day: "numeric", month: "long" });
const weekdayLong = fmt({ weekday: "long" });
const weekdayShort = fmt({ weekday: "short" });
const monthLong = fmt({ month: "long" });
const timeFmt = fmt({ hour: "2-digit", minute: "2-digit", hour12: false });

export const isIsoDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test((v ?? "").trim());

/** Local Date from "YYYY-MM-DD" — never shifts across timezones. */
export function dateFromIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso ?? "").trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** "2026-09-01" -> "1. rujna 2026." Non-ISO input is returned unchanged. */
export function formatCroatianDate(iso: string): string {
  const d = dateFromIso(iso);
  return d ? longDate.format(d) : (iso ?? "");
}

/** "2026-09-01" -> "1. 9. 2026." */
export function formatShortDate(iso: string): string {
  const d = dateFromIso(iso);
  if (!d) return iso ?? "";
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}.`;
}

/** Date without the year: "1. rujna". */
export function formatDayMonth(value: string | Date): string {
  const d = value instanceof Date ? value : dateFromIso(value);
  return d ? dayMonthLong.format(d) : typeof value === "string" ? value : "";
}

/** "ponedjeljak" (lowercase, as Croatian writes weekdays). */
export function formatWeekday(value: string | Date): string {
  const d = value instanceof Date ? value : dateFromIso(value);
  return d ? weekdayLong.format(d) : "";
}

/** "pon" — short weekday for calendar headers. */
export function formatWeekdayShort(value: string | Date): string {
  const d = value instanceof Date ? value : dateFromIso(value);
  return d ? weekdayShort.format(d).replace(/\.$/, "") : "";
}

/** "Rujan 2026" — calendar month title. */
export function formatMonthTitle(year: number, month1: number): string {
  const d = new Date(year, month1 - 1, 1);
  return `${capitalize(monthLong.format(d))} ${year}`;
}

/** Croatian nominative month name, e.g. "rujan". */
export function monthName(month1: number): string {
  return monthLong.format(new Date(2000, month1 - 1, 1));
}

/** 24h clock: "18:30". Accepts "HH:MM", "H:MM" or a Date. */
export function formatTime(value: string | Date): string {
  if (value instanceof Date) return timeFmt.format(value);
  const m = /^(\d{1,2}):(\d{2})/.exec((value ?? "").trim());
  if (!m) return value ?? "";
  return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`;
}

/** "1. rujna 2026. u 18:30" */
export function formatDateTime(iso: string, time?: string): string {
  const date = formatCroatianDate(iso);
  const t = time ? formatTime(time) : "";
  return t ? `${date} u ${t}` : date;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Whole days between today and an ISO date (negative = past). */
export function daysFromToday(iso: string, now: Date = new Date()): number | null {
  const d = dateFromIso(iso);
  if (!d) return null;
  return Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / 86_400_000);
}

/** "danas", "sutra", "za 3 dana", "prije 2 dana" or the full date when far away. */
export function formatRelativeDay(iso: string, now: Date = new Date()): string {
  const diff = daysFromToday(iso, now);
  if (diff === null) return iso ?? "";
  if (diff === 0) return "danas";
  if (diff === 1) return "sutra";
  if (diff === 2) return "prekosutra";
  if (diff === -1) return "jučer";
  if (diff > 2 && diff <= 7) return `za ${diff} dana`;
  if (diff < -1 && diff >= -7) return `prije ${Math.abs(diff)} dana`;
  return formatCroatianDate(iso);
}
