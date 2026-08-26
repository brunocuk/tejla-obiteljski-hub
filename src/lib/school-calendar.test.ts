import { describe, expect, it } from "vitest";
import { needsSchoolCalendarWarning, type CoverageRow } from "./school-calendar";
import { NO_RECURRENCE } from "./recurrence";

const series = (exclude: string[]) => ({
  recurrence: {
    ...NO_RECURRENCE,
    freq: "weekly" as const,
    byday: ["TU" as const],
    exclude: exclude as never,
  },
});

const covered: CoverageRow[] = [
  { school_year: "2026/2027", covered: true, gap_from: null, gap_to: null },
];
const gap: CoverageRow[] = [
  { school_year: "2027/2028", covered: false, gap_from: "2027-09-01", gap_to: "2027-09-30" },
];

describe("school calendar coverage banner", () => {
  it("stays hidden when no visible series uses school breaks", () => {
    expect(needsSchoolCalendarWarning([series([]), series(["weekends"])], gap)).toBe(false);
  });

  it("stays hidden when the window is covered", () => {
    expect(needsSchoolCalendarWarning([series(["school_breaks_hr"])], covered)).toBe(false);
  });

  it("stays hidden while coverage is still unknown", () => {
    expect(needsSchoolCalendarWarning([series(["school_breaks_hr"])], undefined)).toBe(false);
  });

  it("shows only when a school-break series meets an uncovered window", () => {
    expect(needsSchoolCalendarWarning([series(["school_breaks_hr"])], gap)).toBe(true);
    expect(
      needsSchoolCalendarWarning([series([]), series(["school_breaks_hr"])], [...covered, ...gap]),
    ).toBe(true);
  });
});
