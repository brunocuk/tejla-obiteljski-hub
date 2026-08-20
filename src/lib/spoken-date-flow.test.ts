import { describe, expect, it } from "vitest";
import { applySpokenDate } from "./croatian-spoken-date";
import { normalizeItem } from "./hub-store";
import { applyRelativeReminders } from "./relative-time";
import { formatCroatianDate, formatShortDate, formatTime, formatRelativeDay } from "./date-hr";

const item = (over: Partial<ReturnType<typeof normalizeItem>> = {}) =>
  normalizeItem({ title: "Pregled", ...over });

describe("applySpokenDate", () => {
  it("overrides an AI guess with the spoken day and month, keeping the year", () => {
    const [out] = applySpokenDate([item({ date: "2026-08-28" })], "pregled dvadesetog osmog");
    expect(out?.date).toBe("2026-08-20");
    expect(out?.dayMonth).toBe("08-20");
  });

  it("keeps a matching AI date untouched", () => {
    const [out] = applySpokenDate([item({ date: "2026-08-28" })], "dvadeset osmog osmog");
    expect(out?.date).toBe("2026-08-28");
  });

  it("asks for the year when none is known", () => {
    const [out] = applySpokenDate([item({ date: "" })], "petnaestog devetog");
    expect(out?.needsYear).toBe(true);
    expect(out?.dayMonth).toBe("09-15");
  });

  it("treats a repeated month ordinal as one date", () => {
    const [out] = applySpokenDate([item({ date: "2026-01-05" })], "dvadesetog osmog osmog");
    expect(out?.dayMonth).toBe("08-20");
    expect(out?.dateUncertain).toBe(false);
  });

  it("sends genuinely ambiguous speech to user confirmation instead of guessing", () => {
    const [out] = applySpokenDate([item({ date: "2026-08-20" })], "petog osmog devetog");
    expect(out?.dateUncertain).toBe(true);
    expect(out?.date).toBe("");
  });

  it("leaves relative speech and manual/AI dates alone", () => {
    const [out] = applySpokenDate([item({ date: "2026-08-21" })], "sutra u 8");
    expect(out?.date).toBe("2026-08-21");
  });

  it("does not disturb relative reminder resolution", () => {
    const now = new Date(2026, 7, 20, 10, 0, 0);
    const items = applyRelativeReminders(
      applySpokenDate(
        [item({ date: "2026-08-20", reminder_intent: true, type: "task", link_to: -1 })],
        "podsjeti me za pola sata",
      ),
      "podsjeti me za pola sata",
      now,
    );
    expect(items[0]?.reminder_at).toBe(new Date(2026, 7, 20, 10, 30, 0).toISOString());
  });
});

describe("croatian display formatting", () => {
  it("formats dates and times", () => {
    expect(formatCroatianDate("2026-09-01")).toBe("1. rujna 2026.");
    expect(formatShortDate("2026-09-01")).toBe("1. 9. 2026.");
    expect(formatTime("18:30")).toBe("18:30");
    expect(formatTime("6:05")).toBe("06:05");
  });

  it("formats relative days", () => {
    const now = new Date(2026, 8, 1);
    expect(formatRelativeDay("2026-09-01", now)).toBe("danas");
    expect(formatRelativeDay("2026-09-02", now)).toBe("sutra");
    expect(formatRelativeDay("2026-09-04", now)).toBe("za 3 dana");
    expect(formatRelativeDay("2026-12-01", now)).toBe("1. prosinca 2026.");
  });
});
