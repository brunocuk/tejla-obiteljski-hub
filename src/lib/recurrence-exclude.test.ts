import { describe, expect, it } from "vitest";
import { mapExceptionText, sanitizeExcludeCodes } from "./recurrence-exclude";
import { normalizeItem } from "./hub-store";

/**
 * Phase 6: Croatian exception phrases must map onto the three whitelisted
 * calendar rules; everything else stays a free-text note and Tejla never
 * produces concrete dates.
 */

const aiItem = (exception_note: string, recurrence: Record<string, unknown>) =>
  normalizeItem({
    title: "Malac genijalac",
    type: "event",
    date: "2026-09-01",
    exception_note,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recurrence: recurrence as any,
  });

describe("sanitizeExcludeCodes", () => {
  it("keeps only whitelisted codes, deduped and in canonical order", () => {
    expect(
      sanitizeExcludeCodes(["weekends", "nonsense_hr", "school_breaks_hr", "weekends"]),
    ).toEqual(["school_breaks_hr", "weekends"]);
  });

  it("drops anything that is not an array of known codes", () => {
    expect(sanitizeExcludeCodes(undefined)).toEqual([]);
    expect(sanitizeExcludeCodes("school_breaks_hr")).toEqual([]);
    expect(sanitizeExcludeCodes([{ code: "school_breaks_hr" }])).toEqual([]);
  });
});

describe("mapExceptionText", () => {
  it("maps school break phrasings", () => {
    for (const t of [
      "osim školskih praznika",
      "osim za vrijeme školskih odmora",
      "kad nema škole",
      "osim kad nema nastave",
    ]) {
      expect(mapExceptionText(t).exclude, t).toEqual(["school_breaks_hr"]);
    }
  });

  it("maps holiday phrasings", () => {
    expect(mapExceptionText("osim blagdana").exclude).toEqual(["public_holidays_hr"]);
    expect(mapExceptionText("praznikom ne radi").exclude).toEqual(["public_holidays_hr"]);
    expect(mapExceptionText("osim državnih praznika").exclude).toEqual([
      "public_holidays_hr",
    ]);
  });

  it("maps 'osim neradnih dana' to holidays + weekends", () => {
    expect(mapExceptionText("osim neradnih dana").exclude).toEqual([
      "public_holidays_hr",
      "weekends",
    ]);
  });

  it("recognizes a working-day rule instead of an exclusion", () => {
    const m = mapExceptionText("svaki radni dan");
    expect(m.workdays).toBe(true);
    expect(m.exclude).toEqual([]);
  });

  it("leaves an unknown exception as a note", () => {
    const m = mapExceptionText("osim kad smo na putu");
    expect(m.exclude).toEqual([]);
    expect(m.note).toBe("osim kad smo na putu");
  });
});

describe("AI item normalization", () => {
  const weekly = { freq: "weekly", interval: 1, byday: ["TU"], until: "" };

  it("'svaki utorak osim školskih praznika' -> school_breaks_hr", () => {
    const item = aiItem("osim školskih praznika", weekly);
    expect(item.recurrence.exclude).toEqual(["school_breaks_hr"]);
    expect(item.exception_note).toBe("");
  });

  it("'svaki ponedjeljak osim blagdana' -> public_holidays_hr", () => {
    const item = aiItem("osim blagdana", { ...weekly, byday: ["MO"] });
    expect(item.recurrence.exclude).toEqual(["public_holidays_hr"]);
    expect(item.recurrence.byday).toEqual(["MO"]);
  });

  it("'osim neradnih dana' -> public_holidays_hr + weekends", () => {
    const item = aiItem("osim neradnih dana", weekly);
    expect(item.recurrence.exclude).toEqual(["public_holidays_hr", "weekends"]);
  });

  it("keeps an unmappable exception in exception_note", () => {
    const item = aiItem("osim kad smo na putu", weekly);
    expect(item.recurrence.exclude).toEqual([]);
    expect(item.exception_note).toBe("osim kad smo na putu");
  });

  it("turns 'svaki radni dan' into a weekly Mon-Fri rule without weekends", () => {
    const item = aiItem("svaki radni dan", { freq: "daily", interval: 1, byday: [], until: "" });
    expect(item.recurrence.freq).toBe("weekly");
    expect(item.recurrence.byday).toEqual(["MO", "TU", "WE", "TH", "FR"]);
    expect(item.recurrence.exclude).toEqual([]);
  });

  it("drops a hallucinated exclusion code coming from the model", () => {
    const item = aiItem("", { ...weekly, exclude: ["skip_2026-12-24", "school_breaks_hr"] });
    expect(item.recurrence.exclude).toEqual(["school_breaks_hr"]);
  });

  it("never puts exclusions on a one-off item", () => {
    const item = aiItem("osim blagdana", { freq: "", interval: 1, byday: [], until: "" });
    expect(item.recurrence.freq).toBeNull();
    expect(item.recurrence.exclude).toEqual([]);
    expect(item.exception_note).toBe("osim blagdana");
  });
});
