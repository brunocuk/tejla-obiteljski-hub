import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReminderBadge } from "./ReminderBadge";
import { formatReminderShort, type ReminderRow } from "@/lib/reminders";
import { occurrenceReminderTimes, zagrebInstant } from "@/lib/recurring-reminders";

const template: ReminderRow = {
  id: "r1",
  event_id: "e1",
  remind_at: zagrebInstant("2026-08-31", "15:00").toISOString(),
  recipient_mode: "creator_only",
  sent_at: null,
  is_recurring: true,
  offset_kind: "relative",
  offset_minutes: 120,
};

describe("ReminderBadge", () => {
  it("shows the reminder of THIS occurrence, not the first template time", () => {
    const times = occurrenceReminderTimes([template], {
      effective_date: "2026-09-14",
      start_time: "17:00",
    });
    render(<ReminderBadge times={times} />);
    expect(screen.getByText(new RegExp(formatReminderShort(times[0]!)))).toBeTruthy();
    expect(screen.queryByText(new RegExp(formatReminderShort(template.remind_at)))).toBeNull();
  });

  it("keeps showing saved rows for a one-off event", () => {
    const row: ReminderRow = { ...template, is_recurring: false, offset_kind: "relative" };
    render(<ReminderBadge reminders={[row]} />);
    expect(screen.getByText(new RegExp(formatReminderShort(row.remind_at)))).toBeTruthy();
  });

  it("renders nothing without reminders", () => {
    const { container } = render(<ReminderBadge reminders={[]} />);
    expect(container.textContent).toBe("");
  });
});
