import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * E2E-style regression tests for the FamilyGate onboarding scenarios A/B/C/D.
 * These guard the closed-beta security rule: a user must NEVER be silently
 * joined to a family just because a pending invitation exists for their e-mail.
 */

const mocks = vi.hoisted(() => ({
  familyId: null as string | null,
  pendingInvite: null as null | {
    id: string;
    family_id: string;
    family_name: string;
    role: string;
  },
  members: [] as Array<{ id: string; name: string; linked_user_id: string | null }>,
  acceptPendingInvitation: vi.fn(),
  createFamily: vi.fn(),
  updateMyDisplayName: vi.fn(),
}));

vi.mock("@/lib/family-workspace", () => ({
  useMyFamilyId: () => ({ data: mocks.familyId, isLoading: false }),
  usePendingInvitation: () => ({ data: mocks.pendingInvite, isLoading: false }),
  useMyUserId: () => ({ data: "user-1" }),
  useFamilyMembers: () => ({ data: mocks.members, isLoading: false }),
  acceptPendingInvitation: mocks.acceptPendingInvitation,
  createFamily: mocks.createFamily,
  updateMyDisplayName: mocks.updateMyDisplayName,
}));

import { FamilyGate } from "./FamilyGate";

function renderGate() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FamilyGate>
        <div>APP_CONTENT</div>
      </FamilyGate>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.familyId = null;
  mocks.pendingInvite = null;
  mocks.members = [];
  mocks.acceptPendingInvitation.mockReset().mockResolvedValue("family-invited");
  mocks.createFamily.mockReset().mockResolvedValue("family-new");
  mocks.updateMyDisplayName.mockReset().mockResolvedValue(undefined);
});

describe("FamilyGate onboarding", () => {
  it("A: new user without invitation sees the create-space landing, not the app", async () => {
    renderGate();
    expect(await screen.findByText("Tu si.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stvori svoj prostor" })).toBeInTheDocument();
    expect(screen.queryByText("APP_CONTENT")).not.toBeInTheDocument();
    expect(mocks.acceptPendingInvitation).not.toHaveBeenCalled();
  });

  it("A2: creating a space calls createFamily with the entered values", async () => {
    const user = userEvent.setup();
    renderGate();
    await user.type(await screen.findByPlaceholderText("Obitelj Horvat"), "Obitelj Test");
    await user.type(screen.getByPlaceholderText("Mateja"), "Mateja");
    await user.click(screen.getByRole("button", { name: "Stvori svoj prostor" }));
    await waitFor(() => expect(mocks.createFamily).toHaveBeenCalledWith("Obitelj Test", "Mateja"));
  });

  it("B: pending invitation is only shown — never auto-accepted (cross-family guard)", async () => {
    mocks.pendingInvite = {
      id: "inv-1",
      family_id: "family-other",
      family_name: "Obitelj Druga",
      role: "child",
    };
    renderGate();
    expect(await screen.findByText("Imaš poziv.")).toBeInTheDocument();
    expect(screen.getByText("Obitelj Druga")).toBeInTheDocument();
    expect(screen.getByText("dijete")).toBeInTheDocument();
    expect(screen.queryByText("APP_CONTENT")).not.toBeInTheDocument();
    // The critical assertion: no silent join.
    expect(mocks.acceptPendingInvitation).not.toHaveBeenCalled();
  });

  it("C: explicitly accepting the invitation joins the family and opens the app", async () => {
    const user = userEvent.setup();
    mocks.pendingInvite = {
      id: "inv-1",
      family_id: "family-other",
      family_name: "Obitelj Druga",
      role: "parent",
    };
    mocks.members = [{ id: "m1", name: "Mateja", linked_user_id: "user-1" }];
    renderGate();
    await user.click(await screen.findByRole("button", { name: "Prihvati pozivnicu" }));
    await waitFor(() => expect(mocks.acceptPendingInvitation).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("APP_CONTENT")).toBeInTheDocument();
  });

  it("D: declining the invitation falls back to creating an own space", async () => {
    const user = userEvent.setup();
    mocks.pendingInvite = {
      id: "inv-1",
      family_id: "family-other",
      family_name: "Obitelj Druga",
      role: "parent",
    };
    renderGate();
    await user.click(await screen.findByRole("button", { name: "Ne, stvori svoj prostor" }));
    expect(await screen.findByText("Tu si.")).toBeInTheDocument();
    expect(mocks.acceptPendingInvitation).not.toHaveBeenCalled();
  });

  it("E: an invited member without a name is asked for it once before the app renders", async () => {
    mocks.familyId = "family-1";
    mocks.members = [{ id: "m1", name: "", linked_user_id: "user-1" }];
    renderGate();
    expect(await screen.findByText("Kako se zoveš?")).toBeInTheDocument();
    expect(screen.queryByText("APP_CONTENT")).not.toBeInTheDocument();
  });

  it("F: an existing member with a family and a name goes straight into the app", async () => {
    mocks.familyId = "family-1";
    mocks.members = [{ id: "m1", name: "Mateja", linked_user_id: "user-1" }];
    renderGate();
    expect(await screen.findByText("APP_CONTENT")).toBeInTheDocument();
  });
});
