import { createFileRoute } from "@tanstack/react-router";

const SYSTEM_PROMPT = `You extract family scheduling and task information from an image (screenshot, photo of a notice, document).
Return STRICT JSON only, matching exactly:
{"items":[{"person":"","title":"","category":"","date":"","time":"","location":"","deadline":"","amount":"","things_to_bring":[],"action_required":"","subject":"","notes":"","confidence":0}]}
Rules:
- Never invent information that is not visible in the image.
- Unknown field => empty string, or empty array for things_to_bring.
- Dates in YYYY-MM-DD when the year is known. If the year is not visible, keep the visible date text in notes and leave date empty. Do not guess the year.
- category must be one of: ispit, termin, trening, izlet, uplata, zadatak, rodendan, ostalo.
- confidence is a number between 0 and 1.
- Never make medical or legal interpretations; only extract scheduling and task information.
- Text values must be in Croatian, as written in the image.
- If nothing relevant is found, return {"items":[]}.`;

type Body = { image?: string; mimeType?: string };

export const Route = createFileRoute("/api/analyze-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return Response.json({ error: "Missing LOVABLE_API_KEY" }, { status: 500 });

        const body = (await request.json()) as Body;
        if (!body.image || typeof body.image !== "string") {
          return Response.json({ error: "Missing image" }, { status: 400 });
        }
        const dataUrl = body.image.startsWith("data:")
          ? body.image
          : `data:${body.mimeType || "image/jpeg"};base64,${body.image}`;

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": key,
            "X-Lovable-AIG-SDK": "fetch",
          },
          body: JSON.stringify({
            model: "google/gemini-3.6-flash",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Izdvoji sve obiteljske obveze iz ove slike i vrati iskljucivo JSON.",
                  },
                  { type: "image_url", image_url: { url: dataUrl } },
                ],
              },
            ],
            response_format: { type: "json_object" },
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          console.error("AI gateway error", res.status, text);
          return Response.json({ error: text }, { status: res.status });
        }

        const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const content = json.choices?.[0]?.message?.content ?? "";
        const match = content.match(/\{[\s\S]*\}/);
        try {
          const parsed = JSON.parse(match ? match[0] : content) as { items?: unknown };
          return Response.json({ items: Array.isArray(parsed.items) ? parsed.items : [] });
        } catch {
          console.error("Failed to parse AI output", content);
          return Response.json({ error: "Neuspjesno citanje AI odgovora" }, { status: 502 });
        }
      },
    },
  },
});
