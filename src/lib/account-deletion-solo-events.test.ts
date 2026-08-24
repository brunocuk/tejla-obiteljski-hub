import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Rule under test (database side, delete_my_account):
 *  - events/tasks where the leaving member is the ONLY participant are deleted
 *  - events with at least one other participant survive (tombstoned history)
 *  - solo deletion must happen BEFORE future event_members are unlinked
 */

const dir = join(process.cwd(), "supabase/migrations");
const sql = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .reverse()
  .map((f) => readFileSync(join(dir, f), "utf8"))
  .find((s) => s.includes("FUNCTION public.delete_my_account"))!;

const soloBlock = sql.slice(sql.indexOf("WITH solo AS"), sql.indexOf("IF _member IS NOT NULL THEN"));

describe("delete_my_account: solo events", () => {
  it("has a migration defining the function", () => {
    expect(sql).toBeTruthy();
  });

  // 1 + 2: solo past and solo future events are both deleted (no date filter).
  it("deletes solo events regardless of date (past and future, events and tasks)", () => {
    expect(soloBlock).toContain("DELETE FROM public.family_events e");
    expect(soloBlock).not.toMatch(/current_date/);
    expect(soloBlock).not.toMatch(/\btype\s*=/);
  });

  // 3 + 4: shared past/future events survive - the delete requires "no other participant".
  it("keeps events that have at least one other participant", () => {
    expect(soloBlock).toMatch(
      /NOT EXISTS\s*\(\s*SELECT 1 FROM public\.event_members em2[\s\S]*family_member_id IS DISTINCT FROM _member/,
    );
  });

  // 5: created by the leaving user but assigned to someone else -> stays.
  it("only removes created_by events when they have no participants at all", () => {
    expect(soloBlock).toMatch(
      /e\.created_by = _uid[\s\S]*NOT EXISTS\s*\(\s*SELECT 1 FROM public\.event_members em3 WHERE em3\.event_id = e\.id\s*\)/,
    );
  });

  // 6: events with no event_members rows, authored by someone else, are untouched.
  it("never deletes participant-less events authored by another user", () => {
    const createdByClause = soloBlock.slice(soloBlock.indexOf("e.created_by = _uid"));
    expect(createdByClause).toContain("em3");
    expect(soloBlock).not.toMatch(/created_by IS NULL/);
  });

  // 7: reminders and member links ride the existing CASCADE rules.
  it("relies on CASCADE for event_members/event_reminders and cleans notification_events", () => {
    expect(soloBlock).not.toContain("DELETE FROM public.event_reminders");
    expect(soloBlock).toMatch(
      /DELETE FROM public\.notification_events n[\s\S]*n\.subject_id = solo\.id/,
    );
  });

  it("deletes solo events BEFORE unlinking future event_members", () => {
    const solo = sql.indexOf("WITH solo AS");
    const unlink = sql.indexOf("DELETE FROM public.event_members em USING public.family_events e");
    expect(solo).toBeGreaterThan(-1);
    expect(unlink).toBeGreaterThan(solo);
  });

  it("keeps the tombstone flow and future-only unlink untouched", () => {
    expect(sql).toContain("SET name = 'Bivši član', linked_user_id = NULL, archived_at = now()");
    expect(sql).toMatch(/em\.family_member_id = _member[\s\S]*e\.date >= current_date/);
  });

  it("is scoped to the leaving user's own family only", () => {
    expect(soloBlock).toContain("e.family_id = _family");
  });

  it("is idempotent: a rerun matches nothing and set-based deletes stay safe", () => {
    // Guarded by _member IS NOT NULL; after the first run the member is
    // archived (linked_user_id NULL) so _member resolves to NULL and the
    // participant branch cannot match again.
    expect(soloBlock).toContain("_member IS NOT NULL");
    expect(sql).toContain("WHERE family_id = _family AND linked_user_id = _uid");
    // Deleting the same rows twice is a no-op; nothing here increments state.
    expect(soloBlock).not.toMatch(/INSERT INTO/);
  });

  it("linked_event_id survivors are handled by ON DELETE SET NULL, not extra SQL", () => {
    expect(soloBlock).not.toContain("linked_event_id");
  });
});
