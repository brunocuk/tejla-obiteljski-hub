import { createFileRoute } from "@tanstack/react-router";

/** Transcribes a short recorded voice note (Croatian) into plain text. */
export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { getRequestUserId } = await import("@/lib/api-auth.server");
        const userId = await getRequestUserId(request);
        if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return Response.json({ error: "Missing LOVABLE_API_KEY" }, { status: 500 });

        const inbound = await request.formData();
        const file = inbound.get("file");
        if (!(file instanceof File) || file.size === 0) {
          return Response.json({ error: "Missing audio" }, { status: 400 });
        }
        if (file.size > 20 * 1024 * 1024) {
          return Response.json({ error: "Snimka je predugačka" }, { status: 413 });
        }

        const form = new FormData();
        form.append("file", file, file.name || "voice.webm");
        form.append("model", "openai/gpt-4o-mini-transcribe");
        form.append("language", "hr");

        const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
          method: "POST",
          headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
          body: form,
        });

        if (!res.ok) {
          console.error("TRANSCRIPTION_ERROR", res.status);
          return Response.json({ error: "Transkripcija nije uspjela" }, { status: res.status });
        }

        const json = (await res.json()) as { text?: string };
        return Response.json({ text: (json.text ?? "").trim() });
      },
    },
  },
});
