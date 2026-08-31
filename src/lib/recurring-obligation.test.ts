import { describe, expect, it } from "vitest";
import { normalizeItem } from "@/lib/hub-store";
import { effectiveType } from "@/lib/family-events";
import { NO_RECURRENCE } from "@/lib/recurrence";

describe("V1 invariant: a repeating obligation is stored as an event", () => {
  it("promotes an AI item that has recurrence but was classified as a task", () => {
    const item = normalizeItem({
      title: "Cordipin 10 mg",
      type: "task",
      time: "06:00",
      recurrence: { freq: "daily", interval: 1, byday: [], until: "", exclude: [] },
    } as never);
    expect(item.type).toBe("event");
    expect(item.recurrence.freq).toBe("daily");
    expect(item.time).toBe("06:00");
  });

  it("keeps a plain task a task", () => {
    const item = normalizeItem({ title: "Kupi tenisice", type: "task" } as never);
    expect(item.type).toBe("task");
    expect(item.recurrence.freq).toBeNull();
  });

  it("never infers recurrence when none was extracted", () => {
    const item = normalizeItem({ title: "Zalij cvijeće", type: "task", recurrence: {} } as never);
    expect(item.type).toBe("task");
    expect(item.recurrence).toEqual(NO_RECURRENCE);
  });

  it("effectiveType promotes a recurring draft before the write", () => {
    expect(effectiveType("task", { ...NO_RECURRENCE, freq: "weekly" })).toBe("event");
    expect(effectiveType("task", NO_RECURRENCE)).toBe("task");
    expect(effectiveType("task", undefined)).toBe("task");
    expect(effectiveType("event", NO_RECURRENCE)).toBe("event");
  });
});
