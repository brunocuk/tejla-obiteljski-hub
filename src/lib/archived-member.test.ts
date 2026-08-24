import { describe, expect, it } from "vitest";
import {
  assignableMembers,
  canAssignNewObligation,
  canEditMemberName,
  canInviteMemberToAccount,
  canRemoveMemberFromFamily,
  eventAssigneeChoices,
  isArchivedMember,
  type FamilyMemberRow,
} from "@/lib/family-workspace";

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

// GDPR tombstone left behind after an account deletion.
const archived = member({
  id: "m-archived",
  name: "Bivši član",
  archived_at: "2026-08-24T10:36:39Z",
});
// Ordinary profile that simply has no account of its own.
const plainAdult = member({ id: "m-plain", name: "Baka" });
const plainChild = member({ id: "m-kid", name: "Lara", member_type: "child" });
const me = member({ id: "m-me", name: "Ja", linked_user_id: "u-me" });

describe("archived (former) family member", () => {
  it("is identified by archived_at, not by its name", () => {
    expect(isArchivedMember(archived)).toBe(true);
    expect(isArchivedMember(member({ name: "Bivši član" }))).toBe(false);
    expect(isArchivedMember(plainAdult)).toBe(false);
  });

  it("cannot be invited to their own account", () => {
    expect(canInviteMemberToAccount(archived, true)).toBe(false);
  });

  it("cannot be edited", () => {
    expect(canEditMemberName(archived, "u-me")).toBe(false);
    expect(canEditMemberName({ ...archived, linked_user_id: "u-me" }, "u-me")).toBe(false);
  });

  it("cannot be removed from the family through the UI", () => {
    expect(canRemoveMemberFromFamily(archived, true, "u-me")).toBe(false);
  });

  it("cannot receive a new future obligation", () => {
    expect(canAssignNewObligation(archived)).toBe(false);
    expect(assignableMembers([plainAdult, archived, plainChild])).toEqual([plainAdult, plainChild]);
  });

  it("stays listed on events where it is already a participant (history preserved)", () => {
    const choices = eventAssigneeChoices([plainAdult, archived], [archived.id]);
    expect(choices.map((m) => m.id)).toEqual([plainAdult.id, archived.id]);
    // …but not offered on an event it never belonged to.
    expect(eventAssigneeChoices([plainAdult, archived], []).map((m) => m.id)).toEqual([
      plainAdult.id,
    ]);
  });
});

describe("normal members keep working exactly as before", () => {
  it("an adult profile without an account can still be invited, and children too", () => {
    expect(canInviteMemberToAccount(plainAdult, true)).toBe(true);
    expect(canInviteMemberToAccount(plainChild, true)).toBe(true);
    expect(canInviteMemberToAccount(plainAdult, false)).toBe(false);
    expect(canInviteMemberToAccount(me, true)).toBe(false); // already has an account
  });

  it("you can still edit your own name", () => {
    expect(canEditMemberName(me, "u-me")).toBe(true);
    expect(canEditMemberName(plainAdult, "u-me")).toBe(false);
  });

  it("adults can still remove other members", () => {
    expect(canRemoveMemberFromFamily(plainAdult, true, "u-me")).toBe(true);
    expect(canRemoveMemberFromFamily(plainChild, true, "u-me")).toBe(true);
    expect(canRemoveMemberFromFamily(me, true, "u-me")).toBe(false); // never yourself
    expect(canRemoveMemberFromFamily(plainAdult, false, "u-me")).toBe(false);
  });

  it("can still be assigned new obligations", () => {
    expect(canAssignNewObligation(plainAdult)).toBe(true);
    expect(canAssignNewObligation(plainChild)).toBe(true);
  });
});
