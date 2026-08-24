import { describe, expect, it } from "vitest";
import { extractCronSecret, isAuthorizedCronRequest } from "@/lib/cron-auth";

const SECRET = "s".repeat(64);

function headers(init: Record<string, string>) {
  return new Headers(init);
}

describe("cron hook authentication", () => {
  it("accepts the x-cron-secret header", () => {
    expect(isAuthorizedCronRequest(headers({ "x-cron-secret": SECRET }), SECRET)).toBe(true);
  });

  it("accepts Authorization: Bearer <secret>", () => {
    expect(
      isAuthorizedCronRequest(headers({ authorization: `Bearer ${SECRET}` }), SECRET),
    ).toBe(true);
  });

  it("rejects a request without any secret", () => {
    expect(isAuthorizedCronRequest(headers({}), SECRET)).toBe(false);
  });

  it("rejects a wrong secret", () => {
    expect(isAuthorizedCronRequest(headers({ "x-cron-secret": "nope" }), SECRET)).toBe(false);
  });

  it("rejects the Supabase publishable key, which is not a secret", () => {
    const publishable = "sb_publishable_S2MiYCWPNlVV30n_kuO3PA_PqSMSzn5";
    expect(isAuthorizedCronRequest(headers({ apikey: publishable }), SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(headers({ "x-cron-secret": publishable }), SECRET)).toBe(false);
  });

  it("rejects everything when CRON_SECRET is not configured", () => {
    expect(isAuthorizedCronRequest(headers({ "x-cron-secret": SECRET }), undefined)).toBe(false);
    expect(isAuthorizedCronRequest(headers({ "x-cron-secret": "" }), "")).toBe(false);
  });

  it("extracts the secret from either header form", () => {
    expect(extractCronSecret(headers({ "x-cron-secret": " abc " }))).toBe("abc");
    expect(extractCronSecret(headers({ authorization: "Bearer abc" }))).toBe("abc");
    expect(extractCronSecret(headers({ authorization: "Basic abc" }))).toBe("");
  });
});
