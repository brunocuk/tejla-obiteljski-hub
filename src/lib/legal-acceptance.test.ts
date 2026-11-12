import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeAcceptanceMethod } from "./legal-acceptance";

describe("normalizeAcceptanceMethod", () => {
  it("accepts the three known methods", () => {
    expect(normalizeAcceptanceMethod("beta-pozivnica-registracija")).toBe(
      "beta-pozivnica-registracija",
    );
    expect(normalizeAcceptanceMethod("obiteljska-pozivnica-registracija")).toBe(
      "obiteljska-pozivnica-registracija",
    );
    expect(normalizeAcceptanceMethod("potvrda-u-aplikaciji")).toBe("potvrda-u-aplikaciji");
  });

  it("rejects everything else", () => {
    expect(normalizeAcceptanceMethod("")).toBeNull();
    expect(normalizeAcceptanceMethod(undefined)).toBeNull();
    expect(normalizeAcceptanceMethod("nesto-trece")).toBeNull();
    expect(normalizeAcceptanceMethod(42)).toBeNull();
  });
});

// Beta redeem mora upisati evidenciju prihvata za novog korisnika.
const state = {
  invite: null as null | { id: string; status: string; created_at: string; expires_at: string },
  burnResult: { id: "inv-1" } as { id: string } | null,
  createdUserId: "user-novi",
  acceptInserts: [] as Array<Record<string, unknown>>,
  deletedUsers: [] as string[],
};

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        createUser: async () => ({
          data: { user: { id: state.createdUserId } },
          error: null,
        }),
        deleteUser: async (id: string) => {
          state.deletedUsers.push(id);
          return { data: null, error: null };
        },
      },
    },
    from: (table: string) => {
      if (table === "beta_invites") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: state.invite }),
            }),
          }),
          update: () => ({
            eq: () => ({
              eq: () => ({
                select: () => ({
                  maybeSingle: async () => ({ data: state.burnResult }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "legal_acceptances") {
        return {
          insert: async (row: Record<string, unknown>) => {
            state.acceptInserts.push(row);
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  },
}));

const { redeemBetaInviteServer } = await import("./beta.server");

describe("redeemBetaInviteServer legal acceptance", () => {
  beforeEach(() => {
    state.invite = {
      id: "inv-1",
      status: "active",
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    };
    state.burnResult = { id: "inv-1" };
    state.acceptInserts = [];
    state.deletedUsers = [];
  });

  it("records acceptance with version and method for the new user", async () => {
    const res = await redeemBetaInviteServer({
      token: "a".repeat(32),
      email: "test@example.com",
      password: "lozinka123",
      name: "Test",
    });
    expect(res.ok).toBe(true);
    expect(state.acceptInserts).toHaveLength(1);
    expect(state.acceptInserts[0]).toMatchObject({
      user_id: "user-novi",
      method: "beta-pozivnica-registracija",
    });
    expect(typeof state.acceptInserts[0]!["doc_version"]).toBe("string");
  });

  it("does not record acceptance when the invite burn fails (user je obrisan)", async () => {
    state.burnResult = null;
    const res = await redeemBetaInviteServer({
      token: "a".repeat(32),
      email: "test@example.com",
      password: "lozinka123",
      name: "Test",
    });
    expect(res.ok).toBe(false);
    expect(state.acceptInserts).toHaveLength(0);
    expect(state.deletedUsers).toEqual(["user-novi"]);
  });
});
