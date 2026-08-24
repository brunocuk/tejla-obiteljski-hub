import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const reminders = readFileSync("src/routes/api/public/hooks/send-reminders.ts", "utf8");
const assignment = readFileSync("src/lib/notifications/assignment.server.ts", "utf8");
const analyze = readFileSync("src/routes/api/analyze-image.ts", "utf8");
const transcribe = readFileSync("src/routes/api/transcribe.ts", "utf8");
const tejla = readFileSync("src/lib/notifications/tejla-messages.ts", "utf8");

function buildMessageSource(source: string) {
  const start = source.indexOf("function buildMessage");
  return source.slice(start, source.indexOf("\n}", start));
}

describe("reminder push payload is privacy-safe", () => {
  const body = buildMessageSource(reminders);

  it("uses the fixed neutral texts", () => {
    expect(body).toContain('title: "Tejla podsjetnik"');
    expect(body).toContain('body: "Imaš obvezu uskoro. Otvori Tejlu za detalje."');
  });

  it("does not include the event title or member name", () => {
    expect(body).not.toContain("e.title");
    expect(body).not.toContain("family_members");
  });

  it("does not include amount, things_to_bring, location or notes", () => {
    for (const field of ["amount", "things_to_bring", "location", "notes"]) {
      expect(body).not.toContain(field);
    }
  });

  it("keeps a deep link carrying the event id", () => {
    expect(body).toMatch(/url: `\/\?zadatak=\$\{e\.id\}`/);
  });
});

describe("assignment push payload is privacy-safe", () => {
  it("uses a neutral body without the obligation title", () => {
    expect(assignment).toContain("Dodijeljen ti je novi zadatak. Otvori Tejlu za detalje.");
    expect(assignment).toContain("Dodijeljen ti je novi termin. Otvori Tejlu za detalje.");
    expect(assignment).not.toContain("event.title");
  });

  it("still stores the event deep link", () => {
    expect(assignment).toContain("deep_link: `/?zadatak=${event.id}`");
  });
});

describe("server logs carry no user content", () => {
  it("AI gateway errors log only a code and status", () => {
    expect(analyze).toContain('console.error("AI_GATEWAY_ERROR", res.status)');
    expect(analyze).not.toContain('console.error("AI gateway error"');
  });

  it("AI parse failures do not log the model output", () => {
    expect(analyze).toContain('console.error("AI_OUTPUT_PARSE_FAILED")');
    expect(analyze).not.toContain("Failed to parse AI output");
  });

  it("transcription errors do not log the provider body", () => {
    expect(transcribe).toContain('console.error("TRANSCRIPTION_ERROR", res.status)');
    expect(transcribe).not.toContain("AI transcription error");
  });
});

describe("Tejla messages are untouched", () => {
  it("still uses fixed templates without event data", () => {
    expect(tejla).not.toContain("things_to_bring");
    expect(tejla).not.toContain("family_members");
  });
});
