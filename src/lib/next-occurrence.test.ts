import { afterEach, describe, expect, it, vi } from "vitest";
import { nextOccurrenceDate } from "./occurrences";
import { NO_RECURRENCE, type EventRecurrence } from "./recurrence";
import { buildReminderRows, type ReminderDraft } from "./reminders";
import { zagrebInstant } from "./recurring-reminders";

const daily: EventRecurrence = { ...NO_RECURRENCE, freq: "daily", interval: 1 };
const weeklyTue: EventRecurrence = { ...NO_RECURRENCE, freq: "weekly", byday: ["TU"] };

afterEach(() => vi.useRealTimers());

describe("nextOccurrenceDate", () => {
  it("skips today when today's time already passed", () => {
    const now = new Date("2026-09-01T14:00:00Z");
    expect(nextOccurrenceDate({ date: "2026-08-01", time: "06:00", recurrence: daily }, now)).toBe(
      "2026-09-02",
    );
  });

  it("keeps today when today's time is still ahead", () => {
    const now = new Date("2026-09-01T04:00:00Z");
    expect(nextOccurrenceDate({ date: "2026-08-01", time: "06:00", recurrence: daily }, now)).toBe(
      "2026-09-01",
    );
  });

  it("never returns a date before the series start", () => {
    const now = new Date("2026-08-01T10:00:00Z");
    expect(nextOccurrenceDate({ date: "2026-09-01", time: "18:15", recurrence: daily }, now)).toBe(
      "2026-09-01",
    );
  });

  it("follows the weekday rule of a weekly series", () => {
    const now = new Date("2026-09-02T10:00:00Z"); // Wednesday
    expect(
      nextOccurrenceDate({ date: "2026-09-01", time: "18:15", recurrence: weeklyTue }, now),
    ).toBe("2026-09-08");
  });

  it("returns null once the series ended", () => {
    const now = new Date("2026-09-10T10:00:00Z");
    expect(
      nextOccurrenceDate(
        { date: "2026-09-01", time: "06:00", recurrence: { ...daily, until: "2026-09-05" } },
        now,
      ),
    ).toBeNull();
  });

  it("returns null for a one-off event", () => {
    expect(
      nextOccurrenceDate({ date: "2026-09-01", time: "06:00", recurrence: NO_RECURRENCE }),
    ).toBeNull();
  });
});

const draft = (remind_at: string): ReminderDraft => ({
  remind_at,
  recipient_mode: "all",
  recipient_user_ids: [],
  pattern: "once",
});

describe("buildReminderRows for a series", () => {
  it("anchors the stored remind_at on the next future occurrence", () => {
    const now = new Date("2026-09-01T14:00:00Z");
    const [row] = buildReminderRows(
      "e-1",
      // captured against today's 06:00, which already passed
      [draft(zagrebInstant("2026-09-01", "06:00").toISOString())],
      "u-1",
      "s-1",
      { date: "2026-08-01", time: "06:00", recurrence_freq: "daily" },
      now,
    ) as Array<Record<string, unknown>>;
    expect(row?.["is_recurring"]).toBe(true);
    expect(row?.["offset_kind"]).toBe("relative");
    expect(row?.["offset_minutes"]).toBe(0);
    expect(row?.["remind_at"]).toBe(zagrebInstant("2026-09-02", "06:00").toISOString());
  });

  it("keeps a calendar rule ('dan prije u 19:00') as a rule, not a timestamp", () => {
    const now = new Date("2026-09-01T14:00:00Z");
    const [row] = buildReminderRows(
      "e-1",
      [draft(zagrebInstant("2026-09-01", "19:00").toISOString())],
      "u-1",
      "s-1",
      { date: "2026-09-01", time: "18:15", recurrence_freq: "weekly", recurrence_byday: ["TU"] },
      now,
    ) as Array<Record<string, unknown>>;
    expect(row?.["is_recurring"]).toBe(true);
    expect(row?.["offset_kind"]).toBe("calendar");
    expect(row?.["days_before"]).toBe(1);
    expect(row?.["at_time"]).toBe("19:00");
  });

  it("crosses the DST switch with a stable wall-clock time", () => {
    const now = new Date("2026-10-20T12:00:00Z");
    const [row] = buildReminderRows(
      "e-1",
      [draft(zagrebInstant("2026-10-27", "19:00").toISOString())],
      "u-1",
      "s-1",
      // Tuesdays: next one after the 2026-10-25 DST end is 2026-10-27
      { date: "2026-09-01", time: "18:15", recurrence_freq: "weekly", recurrence_byday: ["TU"] },
      now,
    ) as Array<Record<string, unknown>>;
    // 19:00 Zagreb in winter time = 18:00Z, not 17:00Z
    expect(row?.["remind_at"]).toBe("2026-10-26T18:00:00.000Z");
  });

  it("leaves a one-off event's rows untouched", () => {
    const at = zagrebInstant("2026-09-01", "06:00").toISOString();
    const [row] = buildReminderRows("e-1", [draft(at)], "u-1", "s-1", {
      date: "2026-09-01",
      time: "06:00",
      recurrence_freq: null,
    }) as Array<Record<string, unknown>>;
    expect(row?.["remind_at"]).toBe(at);
    expect(row?.["is_recurring"]).toBeUndefined();
  });
});
