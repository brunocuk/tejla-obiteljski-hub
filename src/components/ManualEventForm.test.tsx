import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/** Archived (former) members must never be offered for a new obligation. */

const mocks = vi.hoisted(() => ({
  role: "owner" as string,
  userId: "u-me" as string,
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
      id: "m-child",
      family_id: "f-1",
      name: "Lara",
      member_type: "child",
      linked_user_id: "u-child",
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
    useMyUserId: () => ({ data: mocks.userId }),
    useMyFamilyRole: () => ({ data: mocks.role }),
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

  it("a child may only assign the obligation to themselves", () => {
    mocks.role = "child";
    mocks.userId = "u-child";
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <ManualEventForm onClose={() => {}} />
      </QueryClientProvider>,
    );

    expect(screen.getByRole("button", { name: "Lara" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Baka" })).toBeNull();
    // No recipient choice beyond "only me".
    expect(screen.queryByRole("button", { name: "Sve roditelje" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Odabrane osobe" })).toBeNull();
    mocks.role = "owner";
    mocks.userId = "u-me";
  });
});
