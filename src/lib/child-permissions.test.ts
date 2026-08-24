import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assigneeChoicesForActor,
  eventPermissions,
  isAdultRole,
  reminderRecipientModes,
} from "@/lib/family-workspace";

/**
 * Business rule: a child manages their own obligations and reminders, but never
 * administers the family or other people's obligations.
 */

const CHILD_USER = "u-child";
const CHILD_MEMBER = "m-child";
const PARENT_USER = "u-parent";
const PARENT_MEMBER = "m-parent";

const child = { isAdult: false, myUserId: CHILD_USER, myMemberId: CHILD_MEMBER };
const adult = { isAdult: true, myUserId: PARENT_USER, myMemberId: PARENT_MEMBER };

const members = [
  { id: CHILD_MEMBER, member_type: "child" as const },
  { id: PARENT_MEMBER, member_type: "parent" as const },
];

describe("child creating obligations", () => {
  it("child creates an event for themselves → allowed", () => {
    const choices = assigneeChoicesForActor(members, child);
    expect(choices.map((m) => m.id)).toEqual([CHILD_MEMBER]);
    const event = { created_by: CHILD_USER, type: "event", member_ids: [CHILD_MEMBER] };
    expect(eventPermissions(event, child)).toEqual({
      canEdit: true,
      canDelete: true,
      canToggleComplete: true,
    });
  });

  it("child creates a task for themselves → allowed", () => {
    const task = { created_by: CHILD_USER, type: "task", member_ids: [CHILD_MEMBER] };
    expect(eventPermissions(task, child).canEdit).toBe(true);
    expect(eventPermissions(task, child).canToggleComplete).toBe(true);
  });

  it("child cannot assign an obligation to a parent", () => {
    expect(assigneeChoicesForActor(members, child).some((m) => m.id === PARENT_MEMBER)).toBe(false);
  });
});

describe("child reminders", () => {
  it("child may remind only themselves", () => {
    expect(reminderRecipientModes(false)).toEqual(["creator_only"]);
  });

  it("child cannot pick all_parents or selected recipients", () => {
    const modes = reminderRecipientModes(false);
    expect(modes).not.toContain("all_parents");
    expect(modes).not.toContain("selected");
  });
});

describe("adult-created obligations", () => {
  it("child participant on an adult-created event has no edit or delete rights", () => {
    const event = { created_by: PARENT_USER, type: "event", member_ids: [CHILD_MEMBER] };
    expect(eventPermissions(event, child)).toEqual({
      canEdit: false,
      canDelete: false,
      canToggleComplete: false,
    });
  });

  it("child on an adult-created task assigned to them may only toggle completion", () => {
    const task = { created_by: PARENT_USER, type: "task", member_ids: [CHILD_MEMBER] };
    const perms = eventPermissions(task, child);
    expect(perms.canToggleComplete).toBe(true);
    expect(perms.canEdit).toBe(false);
    expect(perms.canDelete).toBe(false);
  });

  it("child who is not a participant gets nothing", () => {
    const task = { created_by: PARENT_USER, type: "task", member_ids: [PARENT_MEMBER] };
    expect(eventPermissions(task, child)).toEqual({
      canEdit: false,
      canDelete: false,
      canToggleComplete: false,
    });
  });

  it("child cannot delete someone else's task or event", () => {
    expect(
      eventPermissions({ created_by: PARENT_USER, type: "task", member_ids: [CHILD_MEMBER] }, child)
        .canDelete,
    ).toBe(false);
    expect(
      eventPermissions(
        { created_by: PARENT_USER, type: "event", member_ids: [CHILD_MEMBER] },
        child,
      ).canDelete,
    ).toBe(false);
  });
});

describe("adult behaviour is unchanged", () => {
  it("owner and parent count as adults, child does not", () => {
    expect(isAdultRole("owner")).toBe(true);
    expect(isAdultRole("parent")).toBe(true);
    expect(isAdultRole("child")).toBe(false);
    expect(isAdultRole(null)).toBe(false);
  });

  it("adults keep full rights on anything, including other people's obligations", () => {
    const foreign = { created_by: "u-someone", type: "event", member_ids: ["m-someone"] };
    expect(eventPermissions(foreign, adult)).toEqual({
      canEdit: true,
      canDelete: true,
      canToggleComplete: true,
    });
    expect(assigneeChoicesForActor(members, adult)).toHaveLength(2);
    expect(reminderRecipientModes(true)).toEqual(["creator_only", "all_parents", "selected"]);
  });
});

/** Defence in depth: the database enforces the same rules if the UI is bypassed. */
describe("database guards", () => {
  const dir = join(process.cwd(), "supabase/migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .reverse()
    .map((f) => readFileSync(join(dir, f), "utf8"));

  const sql = files.find((s) => s.includes("guard_event_reminder_write"));

  it("has the child permissions migration", () => {
    expect(sql).toBeTruthy();
  });

  it("limits child edit rights to what the child created", () => {
    expect(sql!).toMatch(/can_edit_event_row[\s\S]*RETURN _created_by = _uid;/);
  });

  it("allows completion toggling only for a task the child participates in", () => {
    expect(sql!).toContain("can_toggle_event_row");
    expect(sql!).toMatch(/AND type = 'task'/);
  });

  it("blocks every other field change on an adult-created obligation", () => {
    expect(sql!).toMatch(/NEW\.title IS DISTINCT FROM OLD\.title/);
    expect(sql!).toMatch(/NEW\.linked_event_id IS DISTINCT FROM OLD\.linked_event_id/);
    expect(sql!).toMatch(/RAISE EXCEPTION 'Ovu obavezu je unijela odrasla osoba/);
  });

  it("blocks assigning obligations to other members", () => {
    expect(sql!).toContain("guard_event_member_write");
    expect(sql!).toMatch(/RAISE EXCEPTION 'Obavezu možeš dodijeliti samo sebi\./);
  });

  it("blocks child reminders aimed at anyone else", () => {
    expect(sql!).toMatch(/NEW\.recipient_mode = 'all_parents'/);
    expect(sql!).toMatch(/RAISE EXCEPTION 'Podsjetnik možeš postaviti samo sebi\./);
  });

  it("leaves adults on the previous behaviour", () => {
    expect(sql!).toMatch(/IF public\.is_family_adult\(_family_id\) THEN\s*\n\s*RETURN public\.can_view_event_row/);
  });
});
