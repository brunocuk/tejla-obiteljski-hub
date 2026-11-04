import { describe, expect, it } from "vitest";
import { isAllowedPushEndpoint } from "./push-endpoint";

describe("isAllowedPushEndpoint", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc123",
    "https://web.push.apple.com/QOYWfnWOPkpJaNJUxcv1pA",
    "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
  ])("allows real push service endpoint %s", (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true);
  });

  it.each([
    "http://fcm.googleapis.com/fcm/send/abc", // https obavezan
    "https://evil.example.com/collect",
    "https://10.0.0.1/metadata",
    "https://localhost:8080/",
    "https://fcm.googleapis.com.evil.com/send", // sufiks spoofing
    "https://evilpush.apple.com/x", // nije poddomena push.apple.com
    "https://fcm.googleapis.com@evil.com/", // userinfo trik, host je evil.com
    "nije-url",
    "",
  ])("blocks %s", (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false);
  });

  it("allows true subdomains of allowed zones", () => {
    expect(isAllowedPushEndpoint("https://de.push.apple.com/x")).toBe(true);
    expect(isAllowedPushEndpoint("https://updates-autopush.stage.push.services.mozilla.com/x")).toBe(true);
  });
});
