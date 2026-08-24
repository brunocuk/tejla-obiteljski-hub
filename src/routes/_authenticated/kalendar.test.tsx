import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { FamilyEvent } from "@/lib/family-events";

const mocks = vi.hoisted(() => ({
  events: [] as FamilyEvent[],
  members: [
    {
      id: "m-mama",
      name: "Mama",
      member_type: "parent",
      linked_user_id: "u-mama",
      archived_at: null,
    },
    {
      id: "m-tata",
      name: "Tata",
      member_type: "parent",
      linked_user_id: "u-tata",
      archived_at: null,
    },
    {
      id: "m-lara",
      name: "Lara",
      member_type: "child",
      linked_user_id: "u-lara",
      archived_at: null,
    },
  ],
  reminders: {} as Record<string, never[]>,
}));

vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/family-workspace", async () => ({
  useMyFamilyId: () => ({ data: "f-1" }),
  useFamilyMembers: () => ({ data: mocks.members }),
}));

vi.mock("@/lib/family-events", async () => {
  const actual = await vi.importActual<typeof import("@/lib/family-events")>(
    "@/lib/family-events",
  );
  return {
    ...actual,
    useFamilyEvents: () => ({ data: mocks.events, isPending: false }),
  };
});

vi.mock("@/lib/reminders", async () => ({
  useFamilyReminders: () => ({ data: mocks.reminders }),
}));

import { KalendarPage, calendarEventVisible } from "./kalendar";

function makeEvent(over: Partial<FamilyEvent> & { title: string; date: string }): FamilyEvent {
  return {
    id: over.id ?? over.title,
    title: over.title,
    category: "",
    date: over.date,
    time: "",
    location: "",
    notes: "",
    deadline: "",
    amount: "",
    things_to_bring: [],
    members: over.members ?? ["Mama"],
    member_ids: over.member_ids ?? ["m-mama"],
    type: "event",
    completed: false,
    completed_at: null,
    linked_event_id: null,
    created_by: null,
    ...over,
  };
}

function wrapper(children: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const TODAY = new Date(2026, 7, 24); // 24 August 2026 local

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(TODAY);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("calendarEventVisible", () => {
  it("hides past events by default", () => {
    const event = makeEvent({ title: "Past", date: "2026-08-23" });
    expect(calendarEventVisible(event, { filter: "Svi", showPast: false, now: TODAY })).toBe(
      false,
    );
  });

  it("shows today events", () => {
    const event = makeEvent({ title: "Today", date: "2026-08-24" });
    expect(calendarEventVisible(event, { filter: "Svi", showPast: false, now: TODAY })).toBe(true);
  });

  it("shows future events", () => {
    const event = makeEvent({ title: "Future", date: "2026-08-25" });
    expect(calendarEventVisible(event, { filter: "Svi", showPast: false, now: TODAY })).toBe(true);
  });

  it("shows past events when showPast is enabled", () => {
    const event = makeEvent({ title: "Past", date: "2026-08-23" });
    expect(calendarEventVisible(event, { filter: "Svi", showPast: true, now: TODAY })).toBe(true);
  });

  it("always shows undated events", () => {
    const event = makeEvent({ title: "Undated", date: "" });
    expect(calendarEventVisible(event, { filter: "Svi", showPast: false, now: TODAY })).toBe(true);
    expect(calendarEventVisible(event, { filter: "Svi", showPast: true, now: TODAY })).toBe(true);
  });

  it("respects member filter regardless of past toggle", () => {
    const event = makeEvent({ title: "Mama past", date: "2026-08-23", members: ["Mama"] });
    expect(calendarEventVisible(event, { filter: "Tata", showPast: true, now: TODAY })).toBe(false);
    expect(calendarEventVisible(event, { filter: "Mama", showPast: false, now: TODAY })).toBe(
      false,
    );
    expect(calendarEventVisible(event, { filter: "Mama", showPast: true, now: TODAY })).toBe(true);
  });
});

describe("KalendarPage past-event filter", () => {
  it("does not show past events by default", () => {
    mocks.events = [
      makeEvent({ id: "past", title: "Prošli", date: "2026-08-23" }),
      makeEvent({ id: "today", title: "Današnji", date: "2026-08-24", members: ["Tata"] }),
      makeEvent({ id: "future", title: "Budući", date: "2026-08-25", members: ["Lara"] }),
    ];

    render(wrapper(<KalendarPage />));

    expect(screen.queryByText("Prošli")).toBeNull();
    expect(screen.getByText("Današnji")).toBeTruthy();
    expect(screen.getByText("Budući")).toBeTruthy();
  });

  it("shows past events after enabling 'Prikaži prošle'", () => {
    mocks.events = [makeEvent({ id: "past", title: "Prošli", date: "2026-08-23" })];

    render(wrapper(<KalendarPage />));
    expect(screen.queryByText("Prošli")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Prikaži prošle obaveze" }));
    expect(screen.getByText("Prošli")).toBeTruthy();
  });

  it("filters by member while respecting the past-event toggle", () => {
    mocks.events = [
      makeEvent({ id: "mama-past", title: "Mama prošli", date: "2026-08-23", members: ["Mama"] }),
      makeEvent({ id: "tata-today", title: "Tata današnji", date: "2026-08-24", members: ["Tata"] }),
    ];

    render(wrapper(<KalendarPage />));

    // Default filter is "Svi" and past hidden.
    expect(screen.queryByText("Mama prošli")).toBeNull();
    expect(screen.getByText("Tata današnji")).toBeTruthy();

    // Switch to Mama: past hidden, so no Mama events.
    fireEvent.click(screen.getByRole("button", { name: "Mama" }));
    expect(screen.queryByText("Mama prošli")).toBeNull();

    // Enable past: Mama past appears.
    fireEvent.click(screen.getByRole("button", { name: "Prikaži prošle obaveze" }));
    expect(screen.getByText("Mama prošli")).toBeTruthy();

    // Switch back to Tata: Mama past disappears again.
    fireEvent.click(screen.getByRole("button", { name: "Tata" }));
    expect(screen.queryByText("Mama prošli")).toBeNull();
  });

  it("does not mutate the underlying event data", () => {
    const original = makeEvent({ id: "past", title: "Prošli", date: "2026-08-23" });
    mocks.events = [original];

    render(wrapper(<KalendarPage />));
    fireEvent.click(screen.getByRole("button", { name: "Prikaži prošle obaveze" }));

    expect(original.date).toBe("2026-08-23");
    expect(original.members).toEqual(["Mama"]);
  });
});
