import { describe, expect, it } from "vitest";
import {
  CONSENT_VERSION,
  canManageHealthConsents,
  childAccountConsentText,
  consentTextVersion,
  healthAiConsentText,
  healthSaveConsentText,
} from "@/lib/consents";

type MemberInput = Parameters<typeof canManageHealthConsents>[0];

const member = (over: Partial<MemberInput>): MemberInput => ({
  id: "m1",
  member_type: "child",
  linked_user_id: null,
  age_group: null,
  sixteen_confirmed_at: null,
  ...over,
});

describe("canManageHealthConsents", () => {
  it("odrasli s racunom: samo on sam", () => {
    const adult = member({ member_type: "parent", linked_user_id: "u-adult" });
    expect(canManageHealthConsents(adult, "u-adult", false)).toBe(true);
    expect(canManageHealthConsents(adult, "u-other", true)).toBe(false);
  });

  it("clan bez racuna: odrasli clan prostora", () => {
    const noAccountChild = member({});
    const noAccountAdult = member({ member_type: "parent" });
    expect(canManageHealthConsents(noAccountChild, "u-parent", true)).toBe(true);
    expect(canManageHealthConsents(noAccountAdult, "u-parent", true)).toBe(true);
    expect(canManageHealthConsents(noAccountChild, "u-child", false)).toBe(false);
  });

  it("dijete 10-15 s racunom: roditelj da, dijete ne", () => {
    const young = member({ linked_user_id: "u-child", age_group: "10-15" });
    expect(canManageHealthConsents(young, "u-parent", true)).toBe(true);
    expect(canManageHealthConsents(young, "u-child", false)).toBe(false);
  });

  it("dijete 16-17 s racunom: samo dijete", () => {
    const teen = member({ linked_user_id: "u-child", age_group: "16-17" });
    expect(canManageHealthConsents(teen, "u-child", false)).toBe(true);
    expect(canManageHealthConsents(teen, "u-parent", true)).toBe(false);
  });

  it("samoizjava o 16. godini prebacuje upravljanje na dijete", () => {
    const confirmed = member({
      linked_user_id: "u-child",
      age_group: "10-15",
      sixteen_confirmed_at: "2026-11-17T10:00:00Z",
    });
    expect(canManageHealthConsents(confirmed, "u-child", false)).toBe(true);
    expect(canManageHealthConsents(confirmed, "u-parent", true)).toBe(false);
  });

  it("dijete s racunom bez dobne skupine (stare pozivnice): odrasli upravljaju", () => {
    const legacy = member({ linked_user_id: "u-child" });
    expect(canManageHealthConsents(legacy, "u-parent", true)).toBe(true);
    expect(canManageHealthConsents(legacy, "u-child", false)).toBe(false);
  });
});

describe("tekstovi privola", () => {
  it("verzija teksta nosi dobnu skupinu za djecji racun", () => {
    expect(consentTextVersion("djecji-racun", "10-15")).toBe(`${CONSENT_VERSION}/10-15`);
    expect(consentTextVersion("djecji-racun", "16-17")).toBe(`${CONSENT_VERSION}/16-17`);
    expect(consentTextVersion("zdravstveno-spremanje")).toBe(CONSENT_VERSION);
    expect(consentTextVersion("tejline-poruke")).toBe(CONSENT_VERSION);
  });

  it("tekstovi sadrze ime i naziv prostora (zahtjev iz maila PRIVOLE)", () => {
    expect(childAccountConsentText("10-15", "Lara", "Obitelj Horvat")).toContain("Lara");
    expect(childAccountConsentText("10-15", "Lara", "Obitelj Horvat")).toContain("Obitelj Horvat");
    expect(childAccountConsentText("10-15", "Lara", "Obitelj Horvat")).toContain(
      "ovlašten/a zastupati dijete",
    );
    // 16-17 tekst je u prvom licu djeteta, bez imena djeteta
    expect(childAccountConsentText("16-17", "Lara", "Obitelj Horvat")).toContain("moj račun");
    expect(childAccountConsentText("16-17", "Lara", "Obitelj Horvat")).toContain("Obitelj Horvat");
    expect(healthSaveConsentText("Lara", "Obitelj Horvat")).toContain("Izričito pristajem");
    expect(healthSaveConsentText("Lara", "Obitelj Horvat")).toContain(
      "vidjeti svi odrasli članovi",
    );
    expect(healthAiConsentText("Lara", "Obitelj Horvat")).toContain("Azure");
    expect(healthAiConsentText("Lara", "Obitelj Horvat")).toContain("Lara");
  });
});
