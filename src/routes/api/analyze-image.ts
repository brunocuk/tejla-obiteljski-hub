import { createFileRoute } from "@tanstack/react-router";

const SYSTEM_PROMPT = `You extract scheduling and task information from an image, a PDF page or pasted text (screenshot, photo of a notice, email, message).
Return STRICT JSON only, matching exactly:
{"items":[{"type":"event","person":"","title":"","category":"","date":"","time":"","end_time":"","location":"","deadline":"","amount":"","things_to_bring":[],"action_required":"","subject":"","notes":"","confidence":0,"reminder_intent":false,"reminder_time":"","reminder_recurrence":"","reminder_scope":"","reminder_people":[],"link_to":-1,"recurrence":{"freq":"","interval":1,"byday":[],"until":""},"exception_note":""}]}
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
- The person named in a reminder request is ALSO the owner of the task unless the text clearly states someone else must do it. "Podsjeti Davora da nazove servis" => person "Davor". "Podsjeti Korinu sutra da ponese opremu" => person "Korina". "Podsjeti me da kupim mlijeko" => person is the speaker. "Podsjeti mene i Davora" => person is the speaker. Always fill "person" in these cases; never leave it empty when a reminder names someone.
- A statement without a reminder request ("Danas moram kupiti poklon") is still a task, but reminder_intent must be false.
- Never invent information that is not present in the input.
- Unknown field => empty string, or empty array for things_to_bring.
- Dates in YYYY-MM-DD when the year is visible. If the day and month are visible but the year is NOT, put the visible date into the "date" field exactly as written (for example "8.6." or "8. lipnja") and do NOT guess the year.
- Relative Croatian expressions ("danas", "sutra", "prekosutra", "u petak", "sljedeci utorak", "za tjedan dana") must be resolved to a concrete YYYY-MM-DD using the provided current date. A weekday without "sljedeci" means the next upcoming occurrence.
- Spoken Croatian ordinal dates ("dvadesetog osmog", "dvadeset i prvog osmog") are resolved deterministically by the app. Never "correct" or reinterpret such a spoken date; copy exactly what was said. If the spoken date is ambiguous, leave "date" empty instead of guessing.
- Spoken times ("u 8 navecer", "pola 9 ujutro", "u podne") must be converted to 24h HH:MM.
- A stated time RANGE ("od 18:15 do 20:15", "od 18 do 20 sati", "18:15-20:15") fills "time" with the start and "end_time" with the end. Never put a time range into notes.
- REPEATING events ("svaki utorak", "svaki dan", "svaki drugi tjedan", "svakog 5. u mjesecu", "svaki tjedan do kraja lipnja") fill the "recurrence" object and are returned as ONE item, never as many copies:
  * "freq" is "daily", "weekly" or "monthly"; leave it "" when the thing happens only once.
  * "interval" is 1 unless the text says "svaki drugi" (2), "svaki treci" (3) ...
  * "byday" lists weekday codes for weekly repeats: MO, TU, WE, TH, FR, SA, SU ("svaki utorak" => ["TU"], "utorkom i cetvrtkom" => ["TU","TH"]).
  * "until" is YYYY-MM-DD when an end is stated ("do kraja lipnja", "do 30.6."), otherwise "".
  * "date" stays the FIRST occurrence of the series ("Od 1.9. svaki utorak" => date is 2025-09-01 style first date, resolved with the provided current date).
  * Tasks never repeat: only items with type "event" may have a recurrence.
- An EXCEPTION to a repeat that cannot be turned into concrete dates ("osim kada su skolski praznici", "osim praznikom", "osim kad smo na putu") goes into "exception_note" as written. NEVER guess which dates are school holidays and never drop the exception silently.
- Relative reminder expressions ("za 5 minuta", "za pola sata", "za sat vremena", "za 2 sata", "za 3 dana") are counted from the provided current local time, NEVER from the moment of writing. Resolve them into reminder_time (HH:MM) and, when they cross midnight, into the task "date".
- "podsjeti me X prije" refers to the EVENT time minus X; keep the event time in "time" and never copy the event time into reminder_time.
- Only fill a field when it was actually stated. Never invent a person, location, time or date.
- A month heading in the input (for example "Lipanj") confirms the month for the items listed under it.
- Never leave a recognizable event date only inside notes; notes are for additional descriptive information only.
- category must be exactly one of: Škola, Ispit, Pregled, Zubar, Frizer, Kozmetičar, Trening, Izlet, Putovanje, Rođendan, Uplata, Rok, Servis, Osobno, Obitelj, Ostalo. Pick the closest match; use "Ostalo" when unclear.
- confidence is a number between 0 and 1.
- Never make medical or legal interpretations; only extract scheduling and task information.
- Text values must be in Croatian, as written in the input.
- All user-facing output text must be Croatian in Latin script. Never output Cyrillic.
- If nothing relevant is found, return {"items":[]}.`;

type Body = {
  image?: string;
  /** Base64 data URL of a non-image document (currently PDF only). */
  file?: string;
  fileName?: string;
  mimeType?: string;
  text?: string;
  today?: string;
  nowTime?: string;
  speaker?: string;
  members?: string[];
};

/** Max decoded PDF size we accept (bytes). Base64 is ~1.37x larger. */
const MAX_PDF_BYTES = 15 * 1024 * 1024;


export const Route = createFileRoute("/api/analyze-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { getRequestUserId } = await import("@/lib/api-auth.server");
        const userId = await getRequestUserId(request);
        if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const contentLength = Number(request.headers.get("content-length") ?? 0);
        if (contentLength > 24 * 1024 * 1024) {
          return Response.json({ error: "Ulaz je prevelik" }, { status: 413 });
        }

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return Response.json({ error: "Missing LOVABLE_API_KEY" }, { status: 500 });

        const body = (await request.json()) as Body;
        const pastedText = typeof body.text === "string" ? body.text.trim() : "";
        if (pastedText.length > 20000) {
          return Response.json({ error: "Tekst je predug" }, { status: 413 });
        }
        if (typeof body.image === "string" && body.image.length > 8 * 1024 * 1024) {
          return Response.json({ error: "Slika je prevelika" }, { status: 413 });
        }

        // ---- PDF branch: sent to the model as a native file block, never as image_url.
        const rawFile = typeof body.file === "string" ? body.file.trim() : "";
        const declaredMime = typeof body.mimeType === "string" ? body.mimeType.trim() : "";
        const isPdf =
          Boolean(rawFile) &&
          (declaredMime === "application/pdf" || rawFile.startsWith("data:application/pdf"));
        if (rawFile && !isPdf) {
          return Response.json(
            { error: "Ova vrsta dokumenta nije podržana. Podržani su PDF, JPG i PNG." },
            { status: 415 },
          );
        }
        let pdfDataUrl = "";
        const pdfName =
          typeof body.fileName === "string" && body.fileName.trim()
            ? body.fileName.trim().slice(0, 120)
            : "dokument.pdf";
        if (isPdf) {
          const base64 = rawFile.startsWith("data:")
            ? rawFile.slice(rawFile.indexOf(",") + 1)
            : rawFile;
          if (!base64) {
            return Response.json({ error: "PDF je prazan ili neispravan" }, { status: 400 });
          }
          const bytes = Math.floor((base64.length * 3) / 4);
          if (bytes > MAX_PDF_BYTES) {
            return Response.json(
              { error: "PDF je prevelik (maksimalno 15 MB). Podijeli ga ili pošalji manji dio." },
              { status: 413 },
            );
          }
          pdfDataUrl = `data:application/pdf;base64,${base64}`;
        }

        const today = typeof body.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.today)
          ? body.today
          : new Date().toISOString().slice(0, 10);
        const nowTime =
          typeof body.nowTime === "string" && /^\d{2}:\d{2}$/.test(body.nowTime)
            ? body.nowTime
            : "";
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
        if (!pastedText && !isPdf && (!body.image || typeof body.image !== "string")) {
          return Response.json({ error: "Missing image, file or text" }, { status: 400 });
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
          : isPdf
            ? [
                {
                  type: "text",
                  text: "Izdvoji sve obveze iz SVIH stranica ovog PDF dokumenta i vrati iskljucivo JSON.",
                },
                {
                  type: "file",
                  file: { filename: pdfName, file_data: pdfDataUrl },
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
                content: `${SYSTEM_PROMPT}\nCurrent date (user's local timezone): ${today}.${
                  nowTime ? `\nCurrent local time: ${nowTime}.` : ""
                }\n${personHint}`,
              },
              { role: "user", content: userContent },
            ],
            response_format: { type: "json_object" },
          }),
        });

        if (!res.ok) {
          console.error("AI_GATEWAY_ERROR", res.status);
          if (isPdf && res.status === 400) {
            return Response.json(
              { error: "PDF nije čitljiv. Pošalji drugi PDF ili fotografiju stranice." },
              { status: 422 },
            );
          }
          if (res.status === 429) {
            return Response.json(
              { error: "Previše zahtjeva. Pokušaj za koju minutu." },
              { status: 429 },
            );
          }
          if (res.status === 402) {
            return Response.json(
              { error: "Tejla trenutačno ne može obraditi sadržaj. Pokušaj ponovno malo kasnije." },
              { status: 402 },
            );
          }
          return Response.json({ error: "Tejla nije uspjela obraditi sadržaj." }, { status: res.status });
        }


        const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const content = json.choices?.[0]?.message?.content ?? "";
        const match = content.match(/\{[\s\S]*\}/);
        try {
          const parsed = JSON.parse(match ? match[0] : content) as { items?: unknown };
          return Response.json({ items: Array.isArray(parsed.items) ? parsed.items : [] });
        } catch {
          console.error("AI_OUTPUT_PARSE_FAILED");
          return Response.json({ error: "Tejla nije uspjela pročitati rezultat obrade." }, { status: 502 });
        }
      },
    },
  },
});
