import { createFileRoute } from "@tanstack/react-router";

/** Transcribes a short recorded voice note (Croatian) into plain text. */
export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { getRequestUserId } = await import("@/lib/api-auth.server");
        const userId = await getRequestUserId(request);
        if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const { transcriptionsTarget } = await import("@/lib/ai-provider.server");
        const target = transcriptionsTarget();
        if (!target) return Response.json({ error: "AI provider not configured" }, { status: 500 });

        const inbound = await request.formData();
        const file = inbound.get("file");
        if (!(file instanceof File) || file.size === 0) {
          return Response.json({ error: "Missing audio" }, { status: 400 });
        }
        if (file.size > 20 * 1024 * 1024) {
          return Response.json({ error: "Snimka je predugačka" }, { status: 413 });
        }

        const {
          TRANSCRIBE_BIAS_PROMPT,
          TRANSCRIBE_RETRY_PROMPT,
          TRANSCRIBE_UNUSABLE_MESSAGE,
          isUsableTranscript,
          hasCyrillic,
        } = await import("@/lib/transcript-guard");

        const transcribe = async (prompt: string) => {
          const form = new FormData();
          form.append("file", file, file.name || "voice.webm");
          form.append("model", target.model);
          form.append("language", "hr");
          form.append("prompt", prompt);

          const res = await fetch(target.url, {
            method: "POST",
            headers: target.headers,
            body: form,
          });

          if (!res.ok) {
            console.error("TRANSCRIPTION_ERROR", res.status);
            return { ok: false as const, status: res.status };
          }
          const json = (await res.json()) as { text?: string };
          return { ok: true as const, text: (json.text ?? "").trim() };
        };

        let attempt = await transcribe(TRANSCRIBE_BIAS_PROMPT);
        if (!attempt.ok) {
          return Response.json({ error: "Transkripcija nije uspjela" }, { status: attempt.status });
        }

        if (hasCyrillic(attempt.text)) {
          // Exactly one automatic retry with a stronger script instruction.
          const retry = await transcribe(TRANSCRIBE_RETRY_PROMPT);
          if (!retry.ok) {
            return Response.json({ error: "Transkripcija nije uspjela" }, { status: retry.status });
          }
          attempt = retry;
        }

        if (!isUsableTranscript(attempt.text)) {
          return Response.json({ error: TRANSCRIBE_UNUSABLE_MESSAGE }, { status: 422 });
        }

        return Response.json({ text: attempt.text });
      },
    },
  },
});
