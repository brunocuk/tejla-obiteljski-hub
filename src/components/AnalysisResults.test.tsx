import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtractedItem } from "@/lib/hub-store";
import { NO_RECURRENCE, type EventRecurrence } from "@/lib/recurrence";

/** AI review card must surface the full recurring event before saving. */

const mocks = vi.hoisted(() => ({
  role: "owner" as string,
  userId: "u-me" as string,
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
    useMyUserId: () => ({ data: mocks.userId }),
    useMyFamilyRole: () => ({ data: mocks.role }),
    useFamilyMembers: () => ({ data: mocks.members }),
  };
});

import { AnalysisResults } from "./AnalysisResults";

function baseItem(overrides: Partial<ExtractedItem>): ExtractedItem {
  const item: ExtractedItem = {
    person: "Korina",
    assignee: "Korina",
    assignee_ids: [],
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
  } as ExtractedItem;
  return item;
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
    const daily: EventRecurrence = { freq: "daily", interval: 1, byday: [], until: "", note: "", exclude: [] };
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
    expect(screen.getAllByText(/31\.\s*(kolovoza|0?8\.)\s*2026/).length).toBe(2);
    // The item with an extracted date keeps it.
    expect(screen.getByText(/10\.\s*(rujna|0?9\.)\s*2026/)).toBeTruthy();
  });
});

describe("multi-member assignment", () => {
  const family = [
    { id: "m-lucija", family_id: "f-1", name: "Lucija", member_type: "child", linked_user_id: null, created_at: "2026-01-01T00:00:00Z", archived_at: null },
    { id: "m-lara", family_id: "f-1", name: "Lara", member_type: "child", linked_user_id: null, created_at: "2026-01-01T00:00:00Z", archived_at: null },
    { id: "m-korina", family_id: "f-1", name: "Korina", member_type: "child", linked_user_id: null, created_at: "2026-01-01T00:00:00Z", archived_at: null },
    { id: "m-mateja", family_id: "f-1", name: "Mateja", member_type: "parent", linked_user_id: "u-me", created_at: "2026-01-01T00:00:00Z", archived_at: null },
  ];

  const pressed = (name: string) => {
    const card = screen.getAllByRole("group", { name: "Kome pripada?" }).at(-1)!;
    return within(card).getByRole("button", { name }).getAttribute("aria-pressed") === "true";
  };

  beforeEach(() => {
    mocks.members = family as typeof mocks.members;
    mocks.role = "owner";
    mocks.userId = "u-me";
  });

  afterEach(() => {
    mocks.members = family as typeof mocks.members;
    mocks.role = "owner";
    mocks.userId = "u-me";
  });

  it("keeps a legacy single-name draft assigned to that one member", () => {
    renderResults([baseItem({ assignee: "Lucija" })]);
    expect(pressed("Lucija")).toBe(true);
    expect(pressed("Lara")).toBe(false);
  });

  it("assigns Lucija + Lara to one draft without touching anyone else", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    renderResults([baseItem({ title: "Mentalna aritmetika", person: "", assignee: "" })]);

    await userEvent.click(screen.getByRole("button", { name: "Lucija" }));
    await userEvent.click(screen.getByRole("button", { name: "Lara" }));

    expect(pressed("Lucija")).toBe(true);
    expect(pressed("Lara")).toBe(true);
    expect(pressed("Korina")).toBe(false);
    expect(pressed("Mateja")).toBe(false);
    expect(pressed("Svi")).toBe(false);
  });

  it("'Svi' selects everyone, and deselecting one leaves an explicit subset", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    renderResults([baseItem({ person: "", assignee: "" })]);

    await userEvent.click(screen.getByRole("button", { name: "Svi" }));
    expect(family.every((m) => pressed(m.name))).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "Korina" }));
    expect(pressed("Korina")).toBe(false);
    expect(pressed("Svi")).toBe(false);
    expect(pressed("Lucija")).toBe(true);
  });

  it("a legacy 'Svi' draft shows every member selected", () => {
    renderResults([baseItem({ assignee: "Svi" })]);
    expect(pressed("Svi")).toBe(true);
    expect(family.every((m) => pressed(m.name))).toBe(true);
  });

  it("bulk Lucija + Lara applies to every draft, and one card can still be overridden", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    renderResults([
      baseItem({ title: "A", person: "", assignee: "" }),
      baseItem({ title: "B", person: "", assignee: "" }),
    ]);

    const bulk = screen.getByRole("group", { name: "Sve obveze pripadaju" });
    await userEvent.click(within(bulk).getByRole("button", { name: "Lucija" }));
    await userEvent.click(within(bulk).getByRole("button", { name: "Lara" }));

    const cards = screen.getAllByRole("group", { name: "Kome pripada?" });
    for (const card of cards) {
      expect(within(card).getByRole("button", { name: "Lucija" }).getAttribute("aria-pressed")).toBe("true");
      expect(within(card).getByRole("button", { name: "Lara" }).getAttribute("aria-pressed")).toBe("true");
    }

    // Individual override on the second card only.
    await userEvent.click(within(cards[1]!).getByRole("button", { name: "Lara" }));
    expect(within(cards[0]!).getByRole("button", { name: "Lara" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(cards[1]!).getByRole("button", { name: "Lara" }).getAttribute("aria-pressed")).toBe("false");
    expect(within(cards[1]!).getByRole("button", { name: "Lucija" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("a child actor is only offered themselves", () => {
    mocks.role = "child";
    mocks.userId = "u-lara";
    mocks.members = family.map((m) =>
      m.id === "m-lara" ? { ...m, linked_user_id: "u-lara" } : m,
    ) as typeof mocks.members;

    renderResults([baseItem({ person: "", assignee: "" })]);

    expect(screen.getByRole("button", { name: "Lara" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Lucija" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mateja" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Svi" })).toBeNull();
  });
});
