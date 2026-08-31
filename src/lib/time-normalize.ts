/**
 * One place that cleans up clock values coming from Tejla / imports.
 *
 * The only real-world problem is "24:00": HTML time inputs reject it, JS Date
 * silently rolls it into the next day and the reminder/recurrence math would
 * then use a date the user never saw. Midnight is always written "00:00" and
 * the calendar date is never shifted.
 */
export function normalizeClockTime(raw: unknown): string {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  const m = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return value;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || mm > 59 || hh > 24) return value;
  const hour = hh === 24 ? 0 : hh;
  return `${String(hour).padStart(2, "0")}:${String(mm % 60).padStart(2, "0")}`;
}
