import { describe, expect, it } from "vitest";
import { draftFromOffset, hasReminderBase, reminderBaseDate } from "@/lib/reminders";
import { NO_RECURRENCE, type EventRecurrence } from "@/lib/recurrence";

const DAILY: EventRecurrence = {
  freq: "daily",
  interval: 1,
  byday: [],
  until: "",
  note: "",
  exclude: [],
};

const input = (date: string) => ({
  category: "Ostalo",
  date,
  time: "06:00",
  recurrence: DAILY,
});

describe("recurring obligation without a start date", () => {
  it("cannot anchor a reminder while the start date is missing", () => {
    expect(hasReminderBase(input(""))).toBe(false);
    expect(draftFromOffset(input(""), 0, "creator_only")).toBeNull();
  });

  it("becomes selectable once the start date is chosen", () => {
    const now = new Date(2026, 7, 31, 15, 2);
    expect(hasReminderBase(input("2026-08-31"))).toBe(true);
    // Today's 06:00 already passed -> the anchor moves to tomorrow.
    expect(reminderBaseDate(input("2026-08-31"), now)).toBe("2026-09-01");
  });

  it("uses today's occurrence when its time is still ahead", () => {
    const now = new Date(2026, 7, 31, 5, 0);
    expect(reminderBaseDate(input("2026-08-31"), now)).toBe("2026-08-31");
  });

  it("respects the series end date", () => {
    const now = new Date(2026, 7, 31, 15, 2);
    const ended = {
      ...input("2026-08-01"),
      recurrence: { ...DAILY, until: "2026-08-10" },
    };
    // Nothing is left; the original date is returned and past-time handling applies.
    expect(reminderBaseDate(ended, now)).toBe("2026-08-01");
  });

  it("one-off events keep their own date as the reminder anchor", () => {
    const oneOff = {
      category: "Škola",
      date: "2026-09-01",
      time: "18:15",
      recurrence: NO_RECURRENCE,
    };
    expect(reminderBaseDate(oneOff)).toBe("2026-09-01");
    expect(hasReminderBase(oneOff)).toBe(true);
  });
});
