import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Covers the four account-deletion scenarios: ordinary member, owner with
 * another adult, sole user, and an unauthorized/blocked attempt.
 */

const mocks = vi.hoisted(() => ({
  preview: {} as Record<string, unknown>,
  deleteFn: vi.fn(),
  navigate: vi.fn(),
  signOut: vi.fn(),
  cleared: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signOut: mocks.signOut } },
}));

vi.mock("@/lib/account-local", () => ({ clearTejlaLocalData: mocks.cleared }));

vi.mock("@/lib/account.functions", () => ({
  previewAccountDeletion: async () => mocks.preview,
  deleteMyAccount: (...args: unknown[]) => mocks.deleteFn(...args),
}));

import { DeleteAccountSheet } from "./DeleteAccountSheet";

function renderSheet() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <DeleteAccountSheet onClose={() => undefined} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.deleteFn.mockReset().mockResolvedValue({ ok: true });
  mocks.navigate.mockReset();
  mocks.signOut.mockReset().mockResolvedValue({});
  mocks.cleared.mockReset();
});

describe("brisanje računa", () => {
  it("obični član: briše se bez prijenosa vlasništva, obiteljski podaci ostaju", async () => {
    mocks.preview = {
      has_family: true,
      is_owner: false,
      other_users: 1,
      deletes_family: false,
      needs_owner_transfer: false,
      blocked: false,
      adult_candidates: [],
    };
    const user = userEvent.setup();
    renderSheet();

    await screen.findByText(/Zajednički obiteljski podaci ostaju/i);
    await user.click(screen.getByRole("button", { name: /Nastavi na brisanje/i }));
    await user.type(screen.getByPlaceholderText("OBRIŠI"), "OBRIŠI");
    await user.click(screen.getByRole("button", { name: /Trajno obriši račun/i }));

    await waitFor(() => expect(mocks.deleteFn).toHaveBeenCalledTimes(1));
    expect(mocks.deleteFn).toHaveBeenCalledWith({ data: { newOwnerUserId: null } });
    expect(mocks.cleared).toHaveBeenCalled();
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/auth", replace: true }));
  });

  it("owner s drugom odraslom osobom: traži prijenos vlasništva", async () => {
    mocks.preview = {
      has_family: true,
      is_owner: true,
      other_users: 1,
      deletes_family: false,
      needs_owner_transfer: true,
      blocked: false,
      adult_candidates: [{ user_id: "u2", name: "Tata" }],
    };
    const user = userEvent.setup();
    renderSheet();

    await user.click(await screen.findByRole("button", { name: /Nastavi na brisanje/i }));
    await user.type(screen.getByPlaceholderText("OBRIŠI"), "OBRIŠI");
    await user.click(screen.getByRole("button", { name: /Trajno obriši račun/i }));
    expect(mocks.deleteFn).not.toHaveBeenCalled();
    expect(await screen.findByText(/Odaberi tko preuzima/i)).toBeTruthy();

    await user.selectOptions(screen.getByRole("combobox"), "u2");
    await user.click(screen.getByRole("button", { name: /Trajno obriši račun/i }));
    await waitFor(() =>
      expect(mocks.deleteFn).toHaveBeenCalledWith({ data: { newOwnerUserId: "u2" } }),
    );
  });

  it("jedini korisnik: upozorava da se briše cijeli prostor", async () => {
    mocks.preview = {
      has_family: true,
      is_owner: true,
      other_users: 0,
      deletes_family: true,
      needs_owner_transfer: false,
      blocked: false,
      adult_candidates: [],
    };
    const user = userEvent.setup();
    renderSheet();

    expect(await screen.findByText(/briše i cijeli obiteljski prostor/i)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Nastavi na brisanje/i }));
    await user.type(screen.getByPlaceholderText("OBRIŠI"), "OBRIŠI");
    await user.click(screen.getByRole("button", { name: /Trajno obriši račun/i }));
    await waitFor(() => expect(mocks.deleteFn).toHaveBeenCalledTimes(1));
  });

  it("blokirano brisanje: nema puta do potvrde", async () => {
    mocks.preview = {
      has_family: true,
      is_owner: true,
      other_users: 1,
      deletes_family: false,
      needs_owner_transfer: true,
      blocked: true,
      adult_candidates: [],
    };
    renderSheet();

    expect(await screen.findByText(/nije moguće obrisati/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Nastavi na brisanje/i })).toBeNull();
    expect(screen.queryByPlaceholderText("OBRIŠI")).toBeNull();
  });

  it("bez točne potvrdne riječi brisanje se ne pokreće", async () => {
    mocks.preview = {
      has_family: false,
      is_owner: false,
      other_users: 0,
      deletes_family: false,
      needs_owner_transfer: false,
      blocked: false,
      adult_candidates: [],
    };
    const user = userEvent.setup();
    renderSheet();

    await user.click(await screen.findByRole("button", { name: /Nastavi na brisanje/i }));
    await user.type(screen.getByPlaceholderText("OBRIŠI"), "obrisi");
    expect(screen.getByRole("button", { name: /Trajno obriši račun/i })).toHaveProperty(
      "disabled",
      true,
    );
    expect(mocks.deleteFn).not.toHaveBeenCalled();
  });
});
