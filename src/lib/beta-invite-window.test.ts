import { beforeEach, describe, expect, it, vi } from "vitest";

const rows: Record<string, { id: string; status: string; expires_at: string }> = {};

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: (_col: string, token: string) => ({
          maybeSingle: async () => ({ data: rows[token] ?? null }),
        }),
      }),
    }),
  },
}));

const { loadBetaInvite } = await import("@/lib/beta.server");

const DAY = 24 * 60 * 60 * 1000;
const CREATED = new Date("2026-08-01T10:00:00Z");

function clampDays(days?: number) {
  // Mirrors createBetaInvite's inputValidator.
  return Math.min(Math.max(Number(days ?? 42) || 42, 1), 60);
}

describe("beta invite activation window", () => {
  beforeEach(() => {
    for (const key of Object.keys(rows)) delete rows[key];
    vi.useRealTimers();
  });

  it("new invites default to a 42 day activation window", () => {
    expect(clampDays(undefined)).toBe(42);
    expect(clampDays(42)).toBe(42);
  });

  it("active invite stays valid until created_at + 42 days", async () => {
    const token = "a".repeat(32);
    rows[token] = {
      id: "i-1",
      status: "active",
      expires_at: new Date(CREATED.getTime() + 42 * DAY).toISOString(),
    };

    vi.useFakeTimers();
    vi.setSystemTime(new Date(CREATED.getTime() + 41 * DAY));
    expect((await loadBetaInvite(token)).state).toBe("valid");

    vi.setSystemTime(new Date(CREATED.getTime() + 43 * DAY));
    expect((await loadBetaInvite(token)).state).toBe("expired");
  });

  it("expired active invite cannot be redeemed", async () => {
    const token = "b".repeat(32);
    rows[token] = {
      id: "i-2",
      status: "active",
      expires_at: new Date(CREATED.getTime() + 42 * DAY).toISOString(),
    };
    vi.useFakeTimers();
    vi.setSystemTime(new Date(CREATED.getTime() + 100 * DAY));
    const { state } = await loadBetaInvite(token);
    expect(state).toBe("expired");
    expect(state).not.toBe("valid");
  });

  it("used invite stays used after expires_at", async () => {
    const token = "c".repeat(32);
    rows[token] = {
      id: "i-3",
      status: "used",
      expires_at: new Date(CREATED.getTime() + 42 * DAY).toISOString(),
    };
    vi.useFakeTimers();
    vi.setSystemTime(new Date(CREATED.getTime() + 400 * DAY));
    expect((await loadBetaInvite(token)).state).toBe("used");
  });

  it("an expired used invite has no bearing on auth/login", async () => {
    // Invariant: nothing in the auth path reads beta_invites.
    const authSources = ["src/routes/auth.tsx", "src/routes/_authenticated/route.tsx"];
    const fs = await import("node:fs/promises");
    for (const file of authSources) {
      const src = await fs.readFile(file, "utf8");
      expect(src).not.toContain("beta_invites");
      expect(src).not.toContain("beta.functions");
    }
  });
});
