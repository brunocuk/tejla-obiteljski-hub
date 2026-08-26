import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addDays, weekdayCodeOf, type EventRecurrence } from "@/lib/recurrence";
import { sanitizeExcludeCodes } from "@/lib/recurrence-exclude";

export type CoverageRow = {
  school_year: string;
  covered: boolean;
  gap_from: string | null;
  gap_to: string | null;
};

/** Does Tejla know the MZOM school calendar for the visible window? */
export function useSchoolCalendarCoverage(from: string, to: string, enabled: boolean) {
  return useQuery({
    queryKey: ["school-calendar-coverage", from, to],
    enabled: Boolean(enabled && from && to),
    queryFn: async (): Promise<CoverageRow[]> => {
      const { data, error } = await supabase.rpc("school_calendar_coverage", {
        _from: from,
        _to: to,
      });
      if (error) throw error;
      return (data ?? []) as CoverageRow[];
    },
  });
}

export type SchoolBreakSeries = {
  /** Series start date, "YYYY-MM-DD". */
  date: string;
  recurrence: EventRecurrence;
};

const MAX_STEPS = 400;

/**
 * Potential occurrence dates of a series inside [from, to].
 *
 * Deliberately unfiltered: overrides and Croatian calendar exclusions are NOT
 * applied, because the question is "would the school-break rule need a
 * calendar here?", and the canonical expansion fails open when the calendar is
 * missing.
 */
export function potentialOccurrencesInWindow(
  series: SchoolBreakSeries,
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

function daysBetween(a: string, b: string): number {
  const toUtc = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y!, (m ?? 1) - 1, d ?? 1);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/**
 * The banner is shown ONLY when a real occurrence in the visible window would
 * need the school calendar and that exact date is not covered. Merely owning a
 * school-break series somewhere is not enough.
 */
export function needsSchoolCalendarWarning(
  series: SchoolBreakSeries[],
  coverage: CoverageRow[] | undefined,
  window: { from: string; to: string },
): boolean {
  const gaps = (coverage ?? []).filter((row) => !row.covered);
  if (gaps.length === 0) return false;

  const relevant = series.filter((e) =>
    sanitizeExcludeCodes(e.recurrence.exclude).includes("school_breaks_hr"),
  );
  if (relevant.length === 0) return false;

  return relevant.some((s) =>
    potentialOccurrencesInWindow(s, window.from, window.to).some((date) =>
      gaps.some((gap) => {
        const gFrom = gap.gap_from ?? window.from;
        const gTo = gap.gap_to ?? window.to;
        return date >= gFrom && date <= gTo;
      }),
    ),
  );
}
