import { createFileRoute } from "@tanstack/react-router";

const SYSTEM_PROMPT = `You extract scheduling and task information from an image, a PDF page or pasted text (screenshot, photo of a notice, email, message).
Return STRICT JSON only, matching exactly:
{"items":[{"type":"event","person":"","title":"","category":"","date":"","time":"","location":"","deadline":"","amount":"","things_to_bring":[],"action_required":"","subject":"","notes":"","confidence":0,"reminder_intent":false,"reminder_time":"","reminder_recurrence":"","reminder_scope":"","reminder_people":[],"link_to":-1}]}
Rules:
- "type" is "event" when something happens at a moment in time (appointment, birthday, trip, exam, deadline). "type" is "task" when the user must DO something ("kupiti poklon", "izvaditi krv", "platiti ratu").
- One sentence can produce BOTH an event and a task. Then return two items: the event first (type "event"), the task second (type "task") with "link_to" set to the index of that event in the items array (0-based). Never return the same thing twice as two events.
- "podsjeti me", "podsjeti nas", "podsjeti <ime>", "nemoj da zaboravim", "javi mi da", "podsjecaj me" mean reminder intent: set reminder_intent true on the TASK item.
- For a task, the stated reminder clock time goes into "reminder_time" (HH:MM), NOT into "time". A reminder time is when the user wants to be notified, never when the task happens. Leave "time" empty for tasks unless the task itself must happen at that exact time.
- The reminder day goes into the task's "date" (YYYY-MM-DD) when stated ("danas", "sutra").
- "svaki sat" / "svaka 2 sata" / "svaka 3 sata" / "2 puta dnevno" / "3 puta dnevno" / "dok ne ..." set reminder_recurrence to one of: hourly, every_2h, every_3h, twice_daily, three_daily, until_done. Otherwise leave it empty.
- WHO must be reminded goes into "reminder_scope" and "reminder_people":
  * "podsjeti me" / "podsjeti mene" / "podsjeti meni" / "nemoj da zaboravim" / any first-person only request => reminder_scope "me", reminder_people [].
  * "podsjeti nas" / "podsjeti roditelje" / "podsjeti sve" / "podsjeti mamu i tatu" (generic, not by name) => reminder_scope "all_parents", reminder_people [].
  * one or more named people ("podsjeti Davora", "podsjeti mene i Davora", "podsjeti Davora i Lucija") => reminder_scope "named" and reminder_people listing exactly those names as spoken. When the speaker includes themself ("mene i Davora"), put the speaker's own name first in reminder_people.
  * No reminder request at all => reminder_scope "" and reminder_people [].
- Never set reminder_scope "all_parents" just because the text mentions "me", "mene", "meni" or a personal task.
- A statement without a reminder request ("Danas moram kupiti poklon") is still a task, but reminder_intent must be false.
- Never invent information that is not present in the input.
- Unknown field => empty string, or empty array for things_to_bring.
- Dates in YYYY-MM-DD when the year is visible. If the day and month are visible but the year is NOT, put the visible date into the "date" field exactly as written (for example "8.6." or "8. lipnja") and do NOT guess the year.
- Relative Croatian expressions ("danas", "sutra", "prekosutra", "u petak", "sljedeci utorak", "za tjedan dana") must be resolved to a concrete YYYY-MM-DD using the provided current date. A weekday without "sljedeci" means the next upcoming occurrence.
- Spoken times ("u 8 navecer", "pola 9 ujutro", "u podne") must be converted to 24h HH:MM.
- Only fill a field when it was actually stated. Never invent a person, location, time or date.
- A month heading in the input (for example "Lipanj") confirms the month for the items listed under it.
- Never leave a recognizable event date only inside notes; notes are for additional descriptive information only.
- category must be exactly one of: Škola, Ispit, Pregled, Zubar, Frizer, Kozmetičar, Trening, Izlet, Putovanje, Rođendan, Uplata, Rok, Servis, Osobno, Obitelj, Ostalo. Pick the closest match; use "Ostalo" when unclear.
- confidence is a number between 0 and 1.
- Never make medical or legal interpretations; only extract scheduling and task information.
- Text values must be in Croatian, as written in the input.
- If nothing relevant is found, return {"items":[]}.`;

type Body = {
  image?: string;
  mimeType?: string;
  text?: string;
  today?: string;
  speaker?: string;
  members?: string[];
};

export const Route = createFileRoute("/api/analyze-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return Response.json({ error: "Missing LOVABLE_API_KEY" }, { status: 500 });

        const body = (await request.json()) as Body;
        const pastedText = typeof body.text === "string" ? body.text.trim() : "";
        const today = typeof body.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.today)
          ? body.today
          : new Date().toISOString().slice(0, 10);
        const speaker = typeof body.speaker === "string" ? body.speaker.trim().slice(0, 60) : "";
        const members = Array.isArray(body.members)
          ? body.members.filter((m): m is string => typeof m === "string").slice(0, 20)
          : [];
        const personHint = [
          speaker
            ? `The person speaking / writing is "${speaker}". First-person Croatian expressions ("imam", "moram", "idem", "meni", "moj termin", "kod mene", "trebam") mean the obligation belongs to "${speaker}" — set person to "${speaker}".`
            : "",
          members.length ? `Known family members: ${members.join(", ")}.` : "",
          `When a name is stated ("Lara ima zubara"), set person to that name. If it cannot be reliably determined who the obligation belongs to, leave person empty — never guess.`,
        ]
          .filter(Boolean)
          .join("\n");
        if (!pastedText && (!body.image || typeof body.image !== "string")) {
          return Response.json({ error: "Missing image or text" }, { status: 400 });
        }
        const dataUrl = body.image
          ? body.image.startsWith("data:")
            ? body.image
            : `data:${body.mimeType || "image/jpeg"};base64,${body.image}`
          : "";

        const userContent = pastedText
          ? [
              {
                type: "text",
                text: `Izdvoji sve obveze iz ovog teksta i vrati iskljucivo JSON:\n\n${pastedText}`,
              },
            ]
          : [
              {
                type: "text",
                text: "Izdvoji sve obveze iz ovog dokumenta i vrati iskljucivo JSON.",
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ];

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
              {
                role: "system",
                content: `${SYSTEM_PROMPT}\nCurrent date (user's local timezone): ${today}.\n${personHint}`,
              },
              { role: "user", content: userContent },
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
