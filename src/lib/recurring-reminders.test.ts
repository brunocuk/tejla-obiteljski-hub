import { describe, expect, it } from "vitest";
import {
  occurrenceRemindAt,
  occurrenceReminderTimes,
  recurringReminderColumns,
  ruleFromTemplate,
  shiftDate,
  zagrebInstant,
  zagrebWall,
} from "./recurring-reminders";
import { buildReminderRows } from "./reminders";
import type { ReminderDraft } from "./reminders";

const draft = (remind_at: string): ReminderDraft => ({
  key: remind_at,
  remind_at,
  recipient_mode: "creator_only",
});

describe("weekly occurrence, 2 hours before", () => {
  const event = { date: "2026-08-31", time: "17:00", recurrence_freq: "weekly" };
  const template = zagrebInstant("2026-08-31", "15:00").toISOString();

  it("stores a relative rule of 120 minutes", () => {
    const rule = ruleFromTemplate(template, event.date, event.time);
    expect(rule).toEqual({ kind: "relative", offsetMinutes: 120 });
    expect(recurringReminderColumns(rule)).toMatchObject({
      is_recurring: true,
      offset_kind: "relative",
      offset_minutes: 120,
      days_before: null,
      at_time: null,
    });
  });

  it("lands 2 hours before every occurrence across several weeks", () => {
    const rule = ruleFromTemplate(template, event.date, event.time);
    for (const date of ["2026-08-31", "2026-09-07", "2026-09-14", "2026-11-02"]) {
      const at = occurrenceRemindAt(rule, { effective_date: date, start_time: "17:00" });
      expect(zagrebWall(new Date(at))).toEqual({ date, time: "15:00" });
    }
  });
});

describe("day before at 19:00 across the DST switch", () => {
  const event = { date: "2026-10-20", time: "17:00" };
  const template = zagrebInstant("2026-10-19", "19:00").toISOString();
  const rule = ruleFromTemplate(template, event.date, event.time);

  it("is stored as a calendar rule, not as fixed minutes", () => {
    expect(rule).toEqual({ kind: "calendar", daysBefore: 1, atTime: "19:00" });
    expect(recurringReminderColumns(rule)).toMatchObject({
      offset_kind: "calendar",
      days_before: 1,
      at_time: "19:00",
      offset_minutes: null,
    });
  });

  it("stays at local 19:00 before and after the October DST change", () => {
    // Croatia switches to winter time on 2026-10-25.
    for (const date of ["2026-10-20", "2026-10-27", "2026-11-03"]) {
      const at = occurrenceRemindAt(rule, { effective_date: date, start_time: "17:00" });
      const wall = zagrebWall(new Date(at));
      expect(wall).toEqual({ date: shiftDate(date, -1), time: "19:00" });
    }
    // Same wall clock, different UTC instant -> a fixed 1425 minutes would drift.
    const before = new Date(
      occurrenceRemindAt(rule, { effective_date: "2026-10-20", start_time: "17:00" }),
    );
    const after = new Date(
      occurrenceRemindAt(rule, { effective_date: "2026-10-27", start_time: "17:00" }),
    );
    expect(after.getTime() - before.getTime()).toBe(7 * 24 * 3_600_000 + 3_600_000);
  });

  it("also holds when an occurrence starts at another time", () => {
    const at = occurrenceRemindAt(rule, { effective_date: "2026-11-10", start_time: "09:30" });
    expect(zagrebWall(new Date(at))).toEqual({ date: "2026-11-09", time: "19:00" });
  });
});

describe("moved and skipped occurrences", () => {
  const rule = { kind: "relative", offsetMinutes: 120 } as const;
  const templates = [
    { is_recurring: true, offset_kind: "relative", offset_minutes: 120, remind_at: "x" },
  ];

  it("a moved occurrence moves its reminder with it", () => {
    const at = occurrenceReminderTimes(templates, {
      effective_date: "2026-09-09",
      start_time: "18:30",
    });
    expect(zagrebWall(new Date(at[0]!))).toEqual({ date: "2026-09-09", time: "16:30" });
    expect(occurrenceRemindAt(rule, { effective_date: "2026-09-09", start_time: "18:30" })).toBe(
      at[0],
    );
  });

  it("a skipped occurrence has no reminder because it is not expanded", () => {
    // The canonical expansion drops skipped occurrences, so nothing reaches the badge.
    const occurrences = [{ effective_date: "2026-09-07", start_time: "17:00" }];
    const times = occurrences.flatMap((o) => occurrenceReminderTimes(templates, o));
    expect(times).toHaveLength(1);
    expect(occurrenceReminderTimes(templates, undefined as never)).toBeDefined;
  });

  it("ignores one-off reminders of the same event", () => {
    expect(
      occurrenceReminderTimes(
        [{ is_recurring: false, offset_minutes: 120, remind_at: "2026-08-31T13:00:00Z" }],
        { effective_date: "2026-09-07", start_time: "17:00" },
      ),
    ).toEqual([]);
  });
});

describe("ordinary (non-recurring) events stay untouched", () => {
  it("produces exactly the old row shape", () => {
    const rows = buildReminderRows("e1", [draft("2026-08-31T17:00:00.000Z")], "u1", "s1", {
      date: "2026-08-31",
      time: "19:00",
      recurrence_freq: null,
    });
    expect(rows).toEqual([
      {
        event_id: "e1",
        remind_at: "2026-08-31T17:00:00.000Z",
        recipient_mode: "creator_only",
        recipient_user_ids: [],
        created_by: "u1",
        pattern: "once",
        series_id: "s1",
      },
    ]);
  });

  it("also when the event row is unknown", () => {
    const rows = buildReminderRows("e1", [draft("2026-08-31T17:00:00.000Z")], "u1", null, null);
    expect(rows[0]).not.toHaveProperty("is_recurring");
  });
});

describe("recurring event templates", () => {
  it("flags every reminder as recurring with its own rule", () => {
    const rows = buildReminderRows(
      "e2",
      [
        draft(zagrebInstant("2026-08-31", "15:00").toISOString()),
        draft(zagrebInstant("2026-08-30", "19:00").toISOString()),
      ],
      "u1",
      "s2",
      { date: "2026-08-31", time: "17:00:00", recurrence_freq: "weekly" },
    );
    expect(rows[0]).toMatchObject({ is_recurring: true, offset_kind: "relative", offset_minutes: 120 });
    expect(rows[1]).toMatchObject({
      is_recurring: true,
      offset_kind: "calendar",
      days_before: 1,
      at_time: "19:00",
    });
  });
});
