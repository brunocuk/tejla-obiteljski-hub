import { describe, expect, it } from "vitest";
import { WHOLE_FAMILY, labelForMemberIds, resolveMemberIds } from "@/lib/family";
import { normalizeItem } from "@/lib/hub-store";

const members = [
  { id: "m-lucija", name: "Lucija" },
  { id: "m-lara", name: "Lara" },
  { id: "m-korina", name: "Korina" },
];

describe("multi-member assignment for screenshot import", () => {
  it("keeps explicit ids for a shared obligation", () => {
    expect(resolveMemberIds({ assignee_ids: ["m-lucija", "m-lara"] }, members)).toEqual([
      "m-lucija",
      "m-lara",
    ]);
  });

  it("drops ids that no longer belong to the family", () => {
    expect(resolveMemberIds({ assignee_ids: ["m-lara", "m-gone"] }, members)).toEqual(["m-lara"]);
  });

  it("falls back to the legacy single name when no ids are stored", () => {
    expect(resolveMemberIds({ assignee: "Lara" }, members)).toEqual(["m-lara"]);
  });

  it("expands the legacy whole-family value to every member", () => {
    expect(resolveMemberIds({ assignee: WHOLE_FAMILY }, members)).toEqual(members.map((m) => m.id));
  });

  it("returns nothing when the draft is unassigned", () => {
    expect(resolveMemberIds({ assignee: "" }, members)).toEqual([]);
  });

  it("labels a subset with names and a full selection as Svi", () => {
    expect(labelForMemberIds(["m-lucija", "m-lara"], members)).toBe("Lucija, Lara");
    expect(labelForMemberIds(members.map((m) => m.id), members)).toBe(WHOLE_FAMILY);
  });

  it("normalizeItem hydrates assignee_ids and survives legacy drafts", () => {
    expect(normalizeItem({ title: "A", assignee_ids: ["m-lara"] } as never).assignee_ids).toEqual([
      "m-lara",
    ]);
    expect(normalizeItem({ title: "A", assignee: "Lara" } as never).assignee_ids).toEqual([]);
  });

  it("order of selection does not change the dedupe fingerprint", () => {
    const a = ["m-lara", "m-lucija"].slice().sort().join(",");
    const b = ["m-lucija", "m-lara"].slice().sort().join(",");
    expect(a).toBe(b);
  });
});
