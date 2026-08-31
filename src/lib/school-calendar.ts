import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeExcludeCodes } from "@/lib/recurrence-exclude";
import { potentialOccurrencesInWindow, type SchoolBreakSeries } from "@/lib/occurrences";

export { potentialOccurrencesInWindow };
export type { SchoolBreakSeries };

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
