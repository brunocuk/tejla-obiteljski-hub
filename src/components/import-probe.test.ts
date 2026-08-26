import { describe, expect, it } from "vitest";
describe("import probe", () => {
  it("imports AnalysisResults without hanging", async () => {
    const mod = await import("@/components/AnalysisResults");
    expect(typeof mod.AnalysisResults).toBe("function");
  });
});
