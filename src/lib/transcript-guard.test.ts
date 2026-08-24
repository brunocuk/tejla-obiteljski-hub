import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  hasCyrillic,
  isUsableTranscript,
  TRANSCRIBE_BIAS_PROMPT,
  TRANSCRIBE_RETRY_PROMPT,
  TRANSCRIBE_UNUSABLE_MESSAGE,
} from "./transcript-guard";

vi.mock("@/lib/api-auth.server", () => ({
  getRequestUserId: async () => "user-1",
}));

describe("transcript guard", () => {
  it("accepts a plain Croatian word", () => {
    expect(isUsableTranscript("depilacija")).toBe(true);
  });

  it("blocks Cyrillic transcript", () => {
    expect(isUsableTranscript("Депилация")).toBe(false);
    expect(hasCyrillic("Депилация")).toBe(true);
  });

  it("blocks mixed Latin/Cyrillic", () => {
    expect(isUsableTranscript("depilacija Депилация")).toBe(false);
  });

  it("accepts Croatian diacritics", () => {
    expect(isUsableTranscript("Šećer, čokolada, žlica, đak, ćevapi — škola")).toBe(true);
  });

  it("blocks empty / whitespace", () => {
    expect(isUsableTranscript("")).toBe(false);
    expect(isUsableTranscript("   \n ")).toBe(false);
    expect(isUsableTranscript(null)).toBe(false);
    expect(isUsableTranscript(undefined)).toBe(false);
  });

  it("accepts emoji and numbers", () => {
    expect(isUsableTranscript("Trening u 18 sati 💪")).toBe(true);
  });

  it("biasing prompts mention Croatian Latin script", () => {
    expect(TRANSCRIBE_BIAS_PROMPT).toContain("latinica");
    expect(TRANSCRIBE_BIAS_PROMPT).toContain("depilacija");
    expect(TRANSCRIBE_RETRY_PROMPT).toContain("Never use Cyrillic");
  });
});

const makeRequest = () => {
  const form = new FormData();
  form.append("file", new File([new Uint8Array([1, 2, 3])], "voice.webm", { type: "audio/webm" }));
  // Use a lightweight request stub so the parsed File keeps the environment's File class.
  return { formData: async () => form, headers: new Headers() } as unknown as Request;
};

async function postTranscribe() {
  const { Route } = await import("@/routes/api/transcribe");
  const handler = (Route.options as any).server.handlers.POST;
  return (await handler({ request: makeRequest() })) as Response;
}

describe("/api/transcribe script guard", () => {
  beforeEach(() => {
    process.env["LOVABLE_API_KEY"] = "test-key";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns 200 for a Latin transcript on the first attempt", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ text: "depilacija u petak" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await postTranscribe();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "depilacija u petak" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries once when Cyrillic comes back, and succeeds", async () => {
    const texts = ["Депилация", "depilacija"];
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ text: texts.shift() }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await postTranscribe();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "depilacija" });
  });

  it("returns 422 when the retry is also Cyrillic", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ text: "Депилация" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await postTranscribe();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: TRANSCRIBE_UNUSABLE_MESSAGE });
  });
});

describe("/api/analyze-image prompt invariant", () => {
  it("instructs Croatian Latin script output", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile("src/routes/api/analyze-image.ts", "utf8"),
    );
    expect(source).toContain(
      "All user-facing output text must be Croatian in Latin script. Never output Cyrillic.",
    );
  });
});
