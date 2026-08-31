import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ExtractedItem } from "@/lib/hub-store";
import { NO_RECURRENCE } from "@/lib/recurrence";

/** AI review card must surface the full recurring event before saving. */

const mocks = vi.hoisted(() => ({
  members: [
  {
    id: "m-1",
    family_id: "f-1",
    name: "Korina",
    member_type: "child",
    linked_user_id: null,
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
    useFamilyMembers: () => ({ data: mocks.members }),
  };
});

import { AnalysisResults } from "./AnalysisResults";

function baseItem(overrides: Partial<ExtractedItem>): ExtractedItem {
  return {
    person: "Korina",
    assignee: "Korina",
    title: "Malac genijalac",
    category: "Škola",
    date: "2026-09-01",
    time: "18:15",
    end_time: "",
    location: "",
    deadline: "",
    amount: "",
    things_to_bring: [],
    action_required: "",
    subject: "",
    notes: "",
    confidence: 0.95,
    dayMonth: "",
    needsYear: false,
    type: "event",
    reminder_intent: false,
    reminder_time: "",
    reminder_at: "",
    reminder_recurrence: "",
    reminder_scope: "",
    reminder_people: [],
    link_to: -1,
    recurrence: NO_RECURRENCE,
    exception_note: "",
    ...overrides,
  };
}

function renderResults(analysis: ExtractedItem[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AnalysisResults analysis={analysis} onSaved={() => {}} onDiscard={() => {}} />
    </QueryClientProvider>,
  );
}

describe("AnalysisResults recurring event preview", () => {
  it("shows 'Svaki utorak', the 18:15 – 20:15 range and the exception note", () => {
    renderResults([
      baseItem({
        end_time: "20:15",
        recurrence: { freq: "weekly", interval: 1, byday: ["TU"], until: "", note: "", exclude: [] },
        exception_note: "osim za vrijeme školskih praznika",
      }),
    ]);

    const summary = screen.getByTestId("recurrence-summary");
    expect(summary.textContent).toContain("Svaki utorak");
    expect(summary.textContent).toContain("18:15 – 20:15");
    expect(summary.textContent).toContain(
      "Iznimka: osim za vrijeme školskih praznika",
    );
  });

  it("shows the until date when the series ends", () => {
    renderResults([
      baseItem({
        end_time: "20:15",
        recurrence: {
          freq: "weekly",
          interval: 1,
          byday: ["TU"],
          until: "2026-12-22",
          note: "",
        exclude: [],
        },
      }),
    ]);

    const summary = screen.getByTestId("recurrence-summary");
    expect(summary.textContent).toContain("Svaki utorak");
    expect(summary.textContent).toMatch(/do .*2026/);
  });

  it("a plain one-off event has no recurrence row", () => {
    renderResults([baseItem({})]);
    expect(screen.queryByTestId("recurrence-summary")).toBeNull();
    // One-off card still shows its title and date.
    expect(screen.getByDisplayValue("Malac genijalac")).toBeTruthy();
  });
});

describe("recurring import without a start date", () => {
  it("labels the date field 'Početak ponavljanja' and blocks reminders until it is set", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    renderResults([
      baseItem({
        title: "Cordipin 10 mg",
        category: "Osobno",
        date: "",
        time: "06:00",
        recurrence: { freq: "daily", interval: 1, byday: [], until: "", note: "", exclude: [] },
      }),
    ]);

    expect(screen.getByLabelText("Početak ponavljanja")).toBeTruthy();

    await userEvent.click(screen.getByText(/Podsjetnici \(/));
    expect(
      screen.getByText("Odaberi početak ponavljanja kako bi uključila podsjetnik."),
    ).toBeTruthy();
    const preset = screen.getByRole("button", { name: "U vrijeme događaja" }) as HTMLButtonElement;
    expect(preset.disabled).toBe(true);
  });

  it("bulk 'Početak za sve' only fills items without a source date", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const daily = { freq: "daily", interval: 1, byday: [], until: "", note: "", exclude: [] } as const;
    renderResults([
      baseItem({ title: "Cordipin", date: "", time: "06:00", recurrence: { ...daily } }),
      baseItem({ title: "Andol", date: "", time: "08:00", recurrence: { ...daily } }),
      baseItem({ title: "Vitamin D", date: "2026-09-10", time: "09:00", recurrence: { ...daily } }),
    ]);

    const bulk = screen.getByLabelText("Početak za sve");
    await userEvent.clear(bulk);
    await userEvent.type(bulk, "2026-08-31");

    // Both dateless items got the chosen start, so the bulk helper disappears.
    expect(screen.queryByLabelText("Početak za sve")).toBeNull();
    expect(screen.getAllByText(/31\.\s*0?8\.\s*2026/).length).toBe(2);
    // The item with an extracted date keeps it.
    expect(screen.getByText(/10\.\s*0?9\.\s*2026/)).toBeTruthy();
  });
});
