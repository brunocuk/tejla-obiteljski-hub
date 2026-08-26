import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EventRecurrence } from "@/lib/recurrence";
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

/**
 * The banner is shown ONLY when both things are true: a visible series really
 * relies on school breaks, and the school calendar does not cover the window.
 */
export function needsSchoolCalendarWarning(
  series: { recurrence: EventRecurrence }[],
  coverage: CoverageRow[] | undefined,
): boolean {
  const usesBreaks = series.some((e) =>
    sanitizeExcludeCodes(e.recurrence.exclude).includes("school_breaks_hr"),
  );
  if (!usesBreaks) return false;
  return (coverage ?? []).some((row) => !row.covered);
}
