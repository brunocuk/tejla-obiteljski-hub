import { describe, expect, it } from "vitest";
import {
  NO_RECURRENCE,
  addDays,
  describeRecurrence,
  isRecurring,
  monthBounds,
  weekdayCodeOf,
} from "./recurrence";

describe("weekdayCodeOf", () => {
  it("reads the weekday of a date without timezone drift", () => {
    expect(weekdayCodeOf("2026-09-01")).toBe("TU");
    expect(weekdayCodeOf("2026-09-06")).toBe("SU");
  });

  it("returns null for an unusable date", () => {
    expect(weekdayCodeOf("")).toBeNull();
    expect(weekdayCodeOf("lipanj")).toBeNull();
  });
});

describe("describeRecurrence", () => {
  it("describes a plain weekly rule in Croatian", () => {
    expect(
      describeRecurrence({ ...NO_RECURRENCE, freq: "weekly", byday: ["TU"] }, "2026-09-01"),
    ).toContain("utorak");
  });

  it("falls back to the start date weekday when no day is picked", () => {
    expect(describeRecurrence({ ...NO_RECURRENCE, freq: "weekly" }, "2026-09-01")).toContain(
      "utorak",
    );
  });

  it("says nothing repeats for a one-off obligation", () => {
    expect(describeRecurrence(NO_RECURRENCE, "2026-09-01")).not.toContain("Svaki");
  });

  it("mentions the end date when the series is bounded", () => {
    const text = describeRecurrence(
      { ...NO_RECURRENCE, freq: "weekly", byday: ["TU"], until: "2026-12-31" },
      "2026-09-01",
    );
    expect(text).toMatch(/2026|12/);
  });
});

describe("isRecurring", () => {
  it("treats a missing rule as a one-off", () => {
    expect(isRecurring(NO_RECURRENCE)).toBe(false);
    expect(isRecurring({ freq: "weekly" })).toBe(true);
  });
});

describe("addDays", () => {
  it("crosses a month boundary", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
  });

  it("stays stable across the Zagreb DST switch", () => {
    // 2026-10-25 is the autumn switch; a naive local Date would repeat a day.
    expect(addDays("2026-10-24", 1)).toBe("2026-10-25");
    expect(addDays("2026-10-25", 1)).toBe("2026-10-26");
  });

  it("goes backwards too", () => {
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("monthBounds", () => {
  it("covers a whole month", () => {
    expect(monthBounds("2026-09")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
  });

  it("handles February in a leap year", () => {
    expect(monthBounds("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });
});
