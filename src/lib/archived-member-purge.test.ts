import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canManageMemberData, type FamilyMemberRow } from "@/lib/family-workspace";

function member(over: Partial<FamilyMemberRow>): FamilyMemberRow {
  return {
    id: "m-1",
    family_id: "f-1",
    name: "Član",
    member_type: "parent",
    linked_user_id: null,
    created_at: "2026-01-01T00:00:00Z",
    archived_at: null,
    ...over,
  };
}

const archived = member({ id: "m-archived", archived_at: "2026-08-24T10:56:07Z" });

describe("data management for an archived (former) member", () => {
  it("hides the 'Podaci i brisanje' section for a tombstone", () => {
    expect(canManageMemberData(archived)).toBe(false);
  });

  it("keeps the section for normal members, children and adults without an account", () => {
    expect(canManageMemberData(member({}))).toBe(true);
    expect(canManageMemberData(member({ member_type: "child" }))).toBe(true);
    expect(canManageMemberData(member({ linked_user_id: "u-me" }))).toBe(true);
  });
});

/**
 * Defence in depth: the database must refuse a direct purge_member_data call
 * for an archived member, so history survives even if the UI is bypassed.
 */
describe("purge_member_data server guard", () => {
  const dir = join(process.cwd(), "supabase/migrations");
  const latest = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .reverse()
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .find((sql) => sql.includes("FUNCTION public.purge_member_data"));

  it("has a migration defining the function", () => {
    expect(latest).toBeTruthy();
  });

  it("rejects archived members with a clear Croatian error before deleting anything", () => {
    const sql = latest!;
    expect(sql).toMatch(/archived_at INTO/i);
    expect(sql).toMatch(/IF _archived IS NOT NULL THEN[\s\S]*RAISE EXCEPTION 'Ovo je povijesni zapis/);
    // The guard must run before any DELETE so historical events/links stay intact.
    const guard = sql.indexOf("_archived IS NOT NULL");
    const firstDelete = sql.search(/DELETE FROM/);
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(firstDelete);
  });

  it("still purges data for non-archived members (event/link logic unchanged)", () => {
    const sql = latest!;
    expect(sql).toContain("DELETE FROM public.event_members");
    expect(sql).toContain("DELETE FROM public.family_events");
    expect(sql).toContain("_unlinked := _unlinked + 1");
  });
});
