import { describe, expect, it } from "vitest";
import {
  needsSchoolCalendarWarning,
  potentialOccurrencesInWindow,
  type CoverageRow,
} from "./school-calendar";
import { monthBounds, NO_RECURRENCE } from "./recurrence";

/** "Malac genijalac": every Tuesday from 1.9.2026., skips school breaks. */
const malacGenijalac = {
  date: "2026-09-01",
  recurrence: {
    ...NO_RECURRENCE,
    freq: "weekly" as const,
    byday: ["TU" as const],
    exclude: ["school_breaks_hr"] as never,
  },
};

const plain = (exclude: string[]) => ({
  date: "2026-09-01",
  recurrence: {
    ...NO_RECURRENCE,
    freq: "weekly" as const,
    byday: ["TU" as const],
    exclude: exclude as never,
  },
});

const coveredYear = (year: string, from: string, to: string): CoverageRow[] => [
  { school_year: year, covered: true, gap_from: null, gap_to: null },
];
const gapYear = (year: string, from: string, to: string): CoverageRow[] => [
  { school_year: year, covered: false, gap_from: from, gap_to: to },
];

describe("potentialOccurrencesInWindow", () => {
  it("has no occurrence before the series starts", () => {
    const b = monthBounds("2026-08");
    expect(potentialOccurrencesInWindow(malacGenijalac, b.from, b.to)).toEqual([]);
  });

  it("lists every Tuesday of the starting month", () => {
    const b = monthBounds("2026-09");
    expect(potentialOccurrencesInWindow(malacGenijalac, b.from, b.to)).toEqual([
      "2026-09-01",
      "2026-09-08",
      "2026-09-15",
      "2026-09-22",
      "2026-09-29",
    ]);
  });

  it("ignores school-break filtering (returns dates inside holidays too)", () => {
    const b = monthBounds("2026-12");
    expect(potentialOccurrencesInWindow(malacGenijalac, b.from, b.to)).toContain("2026-12-29");
  });

  it("stops at the series end date", () => {
    const b = monthBounds("2026-10");
    const ended = { ...malacGenijalac, recurrence: { ...malacGenijalac.recurrence, until: "2026-10-10" } };
    expect(potentialOccurrencesInWindow(ended, b.from, b.to)).toEqual(["2026-10-06"]);
  });
});

describe("school calendar coverage banner", () => {
  it("stays hidden in kolovoz 2026. — the series has no occurrence yet", () => {
    const b = monthBounds("2026-08");
    expect(
      needsSchoolCalendarWarning([malacGenijalac], gapYear("2025/2026", b.from, b.to), b),
    ).toBe(false);
  });

  it("stays hidden in rujan 2026. — the 2026/2027 calendar exists", () => {
    const b = monthBounds("2026-09");
    expect(
      needsSchoolCalendarWarning([malacGenijalac], coveredYear("2026/2027", b.from, b.to), b),
    ).toBe(false);
  });

  it("stays hidden in siječanj 2027. — still inside the known calendar", () => {
    const b = monthBounds("2027-01");
    expect(
      needsSchoolCalendarWarning([malacGenijalac], coveredYear("2026/2027", b.from, b.to), b),
    ).toBe(false);
  });

  it("shows in rujan 2027. when 2027/2028 is missing and occurrences exist", () => {
    const b = monthBounds("2027-09");
    expect(
      needsSchoolCalendarWarning([malacGenijalac], gapYear("2027/2028", b.from, b.to), b),
    ).toBe(true);
  });

  it("never shows without a relevant series", () => {
    const b = monthBounds("2027-09");
    expect(needsSchoolCalendarWarning([], gapYear("2027/2028", b.from, b.to), b)).toBe(false);
    expect(
      needsSchoolCalendarWarning([plain([]), plain(["weekends"])], gapYear("2027/2028", b.from, b.to), b),
    ).toBe(false);
  });

  it("stays hidden while coverage is still unknown", () => {
    const b = monthBounds("2027-09");
    expect(needsSchoolCalendarWarning([malacGenijalac], undefined, b)).toBe(false);
  });

  it("ignores a gap that does not overlap any occurrence", () => {
    const b = monthBounds("2027-09");
    // Tuesdays in rujan 2027. are 7., 14., 21. and 28. — none inside 1.–5. 9.
    expect(
      needsSchoolCalendarWarning([malacGenijalac], gapYear("2027/2028", "2027-09-01", "2027-09-05"), b),
    ).toBe(false);
    expect(
      needsSchoolCalendarWarning([malacGenijalac], gapYear("2027/2028", "2027-09-06", "2027-09-30"), b),
    ).toBe(true);
  });
});
