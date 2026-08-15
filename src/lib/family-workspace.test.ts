import { describe, expect, it } from "vitest";
import { inviteResultMessage } from "./family-workspace";

describe("inviteResultMessage", () => {
  it("tells the owner that an existing Tejla account gets no e-mail", () => {
    const message = inviteResultMessage({ ok: true, existingAccount: true } as never);
    expect(message).toContain("već ima Tejla račun");
    expect(message).not.toContain("Poziv je poslan");
  });

  it("confirms a sent invite for a brand-new address", () => {
    expect(inviteResultMessage({ ok: true, existingAccount: false } as never)).toBe(
      "Poziv je poslan.",
    );
  });
});
