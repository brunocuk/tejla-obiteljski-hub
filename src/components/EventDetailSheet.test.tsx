import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * Event recurrence ("Ponavljanje obveze") must be editable on a saved event and
 * must stay separate from reminder repetition ("Ponavljanje podsjetnika").
 */

const mocks = vi.hoisted(() => ({
  members: [
    {
      id: "m-1",
      family_id: "f-1",
      name: "Mama",
      member_type: "parent",
      linked_user_id: "u-me",
      created_at: "2026-01-01T00:00:00Z",
      archived_at: null,
    },
  ],
}));

vi.mock("@/lib/family-workspace", async () => {
  const actual = await vi.importActual<typeof import("@/lib/family-workspace")>(
    "@/lib/family-workspace",
  );
  return {
    ...actual,
    useMyFamilyId: () => ({ data: "f-1" }),
    useMyUserId: () => ({ data: "u-me" }),
    useMyFamilyRole: () => ({ data: "owner" }),
    useFamilyMembers: () => ({ data: mocks.members }),
  };
});

vi.mock("@/lib/family-events", async () => {
  const actual = await vi.importActual<typeof import("@/lib/family-events")>(
    "@/lib/family-events",
  );
  return { ...actual, useFamilyEvents: () => ({ data: [] }) };
});

vi.mock("@/lib/reminders", async () => {
  const actual = await vi.importActual<typeof import("@/lib/reminders")>("@/lib/reminders");
  return { ...actual, useEventReminders: () => ({ data: [] }) };
});

import { EventDetailSheet } from "./EventDetailSheet";

const dailyEvent = {
  id: "e-1",
  title: "Cordipin 10 mg",
  category: "",
  date: "2026-08-31",
  time: "06:00",
  end_time: "",
  location: "",
  notes: "",
  deadline: "",
  amount: "",
  things_to_bring: [],
  type: "event" as const,
  completed: false,
  completed_at: null,
  linked_event_id: null,
  created_by: "u-me",
  member_ids: ["m-1"],
  member_names: ["Mama"],
  recurrence: {
    freq: "daily" as const,
    interval: 1,
    byday: [],
    until: "",
    note: "",
    exclude: [],
  },
};

function open(occurrenceDate: string | null = null) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <EventDetailSheet
        event={dailyEvent as never}
        occurrenceDate={occurrenceDate}
        onClose={() => {}}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Uredi" }));
}

describe("EventDetailSheet event recurrence", () => {
  it("shows the saved recurrence in a section separate from reminders", () => {
    open();
    expect(screen.getByText("Ponavljanje obveze")).toBeTruthy();
    const select = screen.getByRole("combobox", { name: /Ponavljanje/ }) as HTMLSelectElement;
    expect(select.value).toBe("daily");
    // End condition control from the shared picker.
    const end = screen.getByRole("combobox", { name: "Završetak ponavljanja" }) as HTMLSelectElement;
    expect(end.value).toBe("never");
    // Reminder repetition stays its own thing.
    expect(screen.getByText("Ponavljanje podsjetnika")).toBeTruthy();
  });

  it("lets the user switch the end condition to a date", () => {
    open();
    fireEvent.change(screen.getByRole("combobox", { name: "Završetak ponavljanja" }), {
      target: { value: "on_date" },
    });
    const date = screen.getByLabelText("Datum završetka") as HTMLInputElement;
    expect(date.value).toBe("2026-08-31");
    fireEvent.change(date, { target: { value: "2026-09-07" } });
    expect((screen.getByLabelText("Datum završetka") as HTMLInputElement).value).toBe("2026-09-07");
  });

  it("on a single-occurrence edit it explains where recurrence is changed", () => {
    open("2026-09-02");
    expect(screen.getByText("Ponavljanje obveze")).toBeTruthy();
    expect(screen.getByText("Ponavljanje se mijenja pod „Cijela serija”.")).toBeTruthy();
  });
});
