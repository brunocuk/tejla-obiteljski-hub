import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/** Archived (former) members must never be offered for a new obligation. */

const mocks = vi.hoisted(() => ({
  members: [
    {
      id: "m-plain",
      family_id: "f-1",
      name: "Baka",
      member_type: "parent",
      linked_user_id: null,
      created_at: "2026-01-01T00:00:00Z",
      archived_at: null,
    },
    {
      id: "m-archived",
      family_id: "f-1",
      name: "Bivši član",
      member_type: "parent",
      linked_user_id: null,
      created_at: "2026-01-01T00:00:00Z",
      archived_at: "2026-08-24T10:36:39Z",
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

import { ManualEventForm } from "./ManualEventForm";

describe("ManualEventForm assignee chips", () => {
  it("offers normal members but not the archived former member", () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <ManualEventForm onClose={() => {}} />
      </QueryClientProvider>,
    );

    expect(screen.getByRole("button", { name: "Baka" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Bivši član" })).toBeNull();
  });
});
