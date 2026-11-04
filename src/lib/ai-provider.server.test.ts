import { afterEach, describe, expect, it } from "vitest";
import { chatCompletionsTarget, transcriptionsTarget } from "./ai-provider.server";

const ENV_KEYS = [
  "AZURE_OPENAI_ENDPOINT",
  "AZURE_OPENAI_API_KEY",
  "AZURE_OPENAI_CHAT_DEPLOYMENT",
  "AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT",
  "LOVABLE_API_KEY",
] as const;

const saved = ENV_KEYS.map((k) => [k, process.env[k]] as const);

function clearEnv() {
  for (const k of ENV_KEYS) delete process.env[k];
}

afterEach(() => {
  clearEnv();
  for (const [k, v] of saved) if (v !== undefined) process.env[k] = v;
});

describe("ai-provider.server", () => {
  it("returns null when no provider is configured", () => {
    clearEnv();
    expect(chatCompletionsTarget()).toBeNull();
    expect(transcriptionsTarget()).toBeNull();
  });

  it("falls back to the Lovable gateway when only LOVABLE_API_KEY is set", () => {
    clearEnv();
    process.env["LOVABLE_API_KEY"] = "test-key";
    const chat = chatCompletionsTarget();
    expect(chat?.provider).toBe("lovable");
    expect(chat?.url).toBe("https://ai.gateway.lovable.dev/v1/chat/completions");
    expect(chat?.model).toBe("google/gemini-3.6-flash");
    expect(chat?.headers["Lovable-API-Key"]).toBe("test-key");
    expect(transcriptionsTarget()?.model).toBe("openai/gpt-4o-mini-transcribe");
  });

  it("prefers Azure when configured, with deployment names and trimmed endpoint", () => {
    clearEnv();
    process.env["LOVABLE_API_KEY"] = "test-key";
    process.env["AZURE_OPENAI_ENDPOINT"] = "https://tejla.openai.azure.com/";
    process.env["AZURE_OPENAI_API_KEY"] = "azure-key";
    const chat = chatCompletionsTarget();
    expect(chat?.provider).toBe("azure");
    expect(chat?.url).toBe("https://tejla.openai.azure.com/openai/v1/chat/completions");
    expect(chat?.model).toBe("gpt-4.1-mini");
    expect(chat?.headers["api-key"]).toBe("azure-key");
    const stt = transcriptionsTarget();
    expect(stt?.url).toBe(
      "https://tejla.openai.azure.com/openai/deployments/gpt-4o-mini-transcribe/audio/transcriptions?api-version=2025-03-01-preview",
    );
    expect(stt?.model).toBe("gpt-4o-mini-transcribe");
  });

  it("honours explicit deployment overrides", () => {
    clearEnv();
    process.env["AZURE_OPENAI_ENDPOINT"] = "https://tejla.openai.azure.com";
    process.env["AZURE_OPENAI_API_KEY"] = "azure-key";
    process.env["AZURE_OPENAI_CHAT_DEPLOYMENT"] = "tejla-vision";
    process.env["AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT"] = "tejla-stt";
    expect(chatCompletionsTarget()?.model).toBe("tejla-vision");
    expect(transcriptionsTarget()?.model).toBe("tejla-stt");
  });
});
