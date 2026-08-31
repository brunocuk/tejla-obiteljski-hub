import { describe, expect, it } from "vitest";
import { normalizeClockTime } from "./time-normalize";
import { normalizeItem } from "./hub-store";

describe("normalizeClockTime", () => {
  it("turns 24:00 into midnight", () => {
    expect(normalizeClockTime("24:00")).toBe("00:00");
  });

  it("pads and keeps ordinary times", () => {
    expect(normalizeClockTime("6:05")).toBe("06:05");
    expect(normalizeClockTime("18:15")).toBe("18:15");
    expect(normalizeClockTime("18:15:00")).toBe("18:15");
  });

  it("passes through empty and unparsable values", () => {
    expect(normalizeClockTime("")).toBe("");
    expect(normalizeClockTime(undefined)).toBe("");
    expect(normalizeClockTime("navečer")).toBe("navečer");
  });
});

describe("normalizeItem clock normalization", () => {
  it("normalizes time, end_time and reminder_time without shifting the date", () => {
    const item = normalizeItem({
      title: "Cordipin",
      date: "2026-09-01",
      time: "24:00",
      end_time: "24:00",
      reminder_time: "24:00",
    });
    expect(item.date).toBe("2026-09-01");
    expect(item.time).toBe("00:00");
    expect(item.end_time).toBe("00:00");
    expect(item.reminder_time).toBe("00:00");
  });
});
