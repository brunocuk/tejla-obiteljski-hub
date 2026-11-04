/**
 * AI provider resolution (Faza 2: migracija s Lovable AI gatewaya na Azure OpenAI).
 *
 * Both providers speak the OpenAI-compatible API, so the route handlers stay
 * identical; only the URL, auth headers and model/deployment name differ.
 *
 * Selection order:
 *  1. Azure OpenAI, when AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY are set
 *     (the target production setup; data stays in the chosen Azure region).
 *  2. Lovable gateway, when LOVABLE_API_KEY is set (legacy beta on Lovable
 *     Cloud; dies outside Lovable hosting and is removed at cutover).
 *
 * Azure uses the GA v1 surface (https://{resource}.openai.azure.com/openai/v1/...),
 * where `model` is the DEPLOYMENT name, not the upstream model id.
 */

export type AiTarget = {
  url: string;
  headers: Record<string, string>;
  /** Model id (Lovable) or deployment name (Azure) to send as `model`. */
  model: string;
  provider: "azure" | "lovable";
};

function azureBase(): { endpoint: string; key: string } | null {
  const endpoint = (process.env["AZURE_OPENAI_ENDPOINT"] ?? "").trim().replace(/\/+$/, "");
  const key = (process.env["AZURE_OPENAI_API_KEY"] ?? "").trim();
  if (!endpoint || !key) return null;
  return { endpoint, key };
}

export function chatCompletionsTarget(): AiTarget | null {
  const azure = azureBase();
  if (azure) {
    return {
      url: `${azure.endpoint}/openai/v1/chat/completions`,
      headers: { "api-key": azure.key },
      model: (process.env["AZURE_OPENAI_CHAT_DEPLOYMENT"] ?? "").trim() || "gpt-4.1-mini",
      provider: "azure",
    };
  }
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (lovableKey) {
    return {
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      headers: { "Lovable-API-Key": lovableKey, "X-Lovable-AIG-SDK": "fetch" },
      model: "google/gemini-3.6-flash",
      provider: "lovable",
    };
  }
  return null;
}

export function transcriptionsTarget(): AiTarget | null {
  const azure = azureBase();
  if (azure) {
    const deployment =
      (process.env["AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT"] ?? "").trim() ||
      "gpt-4o-mini-transcribe";
    // Audio transcriptions are not served on the /openai/v1 surface yet
    // (DeploymentNotFound, verified 3.11.2026); use the deployment-scoped
    // route with an explicit api-version instead.
    return {
      url: `${azure.endpoint}/openai/deployments/${deployment}/audio/transcriptions?api-version=2025-03-01-preview`,
      headers: { "api-key": azure.key },
      model: deployment,
      provider: "azure",
    };
  }
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (lovableKey) {
    return {
      url: "https://ai.gateway.lovable.dev/v1/audio/transcriptions",
      headers: { "Lovable-API-Key": lovableKey, "X-Lovable-AIG-SDK": "fetch" },
      model: "openai/gpt-4o-mini-transcribe",
      provider: "lovable",
    };
  }
  return null;
}
