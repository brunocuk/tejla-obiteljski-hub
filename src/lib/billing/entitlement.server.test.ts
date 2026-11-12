import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcState = {
  result: true as boolean | null,
  error: null as null | { code: string },
  calls: [] as Array<{ fn: string; args: unknown }>,
};

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: async (fn: string, args: unknown) => {
      rpcState.calls.push({ fn, args });
      return { data: rpcState.result, error: rpcState.error };
    },
  },
}));

const { userHasAccess } = await import("./entitlement.server");

describe("userHasAccess", () => {
  beforeEach(() => {
    rpcState.result = true;
    rpcState.error = null;
    rpcState.calls = [];
  });

  it("delegates to the user_has_access DB function", async () => {
    await expect(userHasAccess("user-1")).resolves.toBe(true);
    expect(rpcState.calls).toEqual([{ fn: "user_has_access", args: { _user_id: "user-1" } }]);
  });

  it("returns false when the DB says no access", async () => {
    rpcState.result = false;
    await expect(userHasAccess("user-1")).resolves.toBe(false);
  });

  it("fails open when the check itself errors (naplata ne smije srusiti app)", async () => {
    rpcState.error = { code: "XX000" };
    rpcState.result = null;
    await expect(userHasAccess("user-1")).resolves.toBe(true);
  });
});
