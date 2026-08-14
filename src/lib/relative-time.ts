/**
 * Deterministic Croatian relative-time parsing for reminders.
 *
 * The AI extracts *what* must be remembered; this module decides *when* a
 * relative expression ("za 5 minuta", "sutra u 8") lands, always relative to
 * the user's current local clock — never to the moment the row was written.
 * Only the reminder time is computed here; event times stay untouched.
 */

const deaccent = (s: string) =>
  s
    .toLowerCase()
    .replace(/[čć]/g, "c")
    .replace(/[š]/g, "s")
    .replace(/[ž]/g, "z")
    .replace(/[đ]/g, "d");

const NUMBER_WORDS: Record<string, number> = {
  jednu: 1,
  jedan: 1,
  jedno: 1,
  dva: 2,
  dvije: 2,
  tri: 3,
  cetiri: 4,
  pet: 5,
  sest: 6,
  sedam: 7,
  osam: 8,
  devet: 9,
  deset: 10,
  petnaest: 15,
  dvadeset: 20,
  trideset: 30,
  cetrdeset: 40,
  pedeset: 50,
};

const amount = (raw: string | undefined): number | null => {
  if (!raw) return null;
  const n = Number(raw);
  if (Number.isFinite(n)) return n;
  return NUMBER_WORDS[raw] ?? null;
};

const add = (now: Date, minutes: number) => new Date(now.getTime() + minutes * 60_000);

/** Interprets a spoken hour ("u 8" late in the day means 20:00 for "večeras"). */
function atTime(base: Date, hour: number, minute: number, eveningHint: boolean): Date {
  let h = hour;
  if (eveningHint && h < 12) h += 12;
  const out = new Date(base);
  out.setHours(h, minute, 0, 0);
  return out;
}

export type RelativeMatch = { at: Date; expression: string };

/**
 * Finds a relative reminder time in free Croatian text.
 * Returns null when nothing relative was said (absolute times stay with the AI).
 */
export function parseRelativeReminder(text: string, now: Date = new Date()): RelativeMatch | null {
  const t = deaccent(text).replace(/\s+/g, " ").trim();
  if (!t) return null;

  // "za pola sata" / "za sat vremena" / "za pola sata i 10 minuta" is handled as the first match.
  if (/za pola sata/.test(t)) return { at: add(now, 30), expression: "za pola sata" };
  if (/za sat vremena|za jedan sat\b|za sat\b/.test(t))
    return { at: add(now, 60), expression: "za sat vremena" };
  if (/za sat i pol/.test(t)) return { at: add(now, 90), expression: "za sat i pol" };

  const minutes = t.match(/za ([\w]+) (?:minutu|minute|minuta|min)\b/);
  if (minutes) {
    const n = amount(minutes[1]);
    if (n && n > 0) return { at: add(now, n), expression: minutes[0] };
  }

  const hours = t.match(/za ([\w]+) (?:sat|sata|sati)\b/);
  if (hours) {
    const n = amount(hours[1]);
    if (n && n > 0) return { at: add(now, n * 60), expression: hours[0] };
  }

  const days = t.match(/za ([\w]+) (?:dan|dana)\b/);
  if (days) {
    const n = amount(days[1]);
    if (n && n > 0) return { at: add(now, n * 24 * 60), expression: days[0] };
  }

  const weeks = t.match(/za ([\w]+) (?:tjedan|tjedna|tjedana)\b/);
  if (weeks) {
    const n = amount(weeks[1]);
    if (n && n > 0) return { at: add(now, n * 7 * 24 * 60), expression: weeks[0] };
  }

  // Day words with an optional clock time: "sutra u 8", "veceras u 20", "danas u 17:30".
  const dayWord = t.match(/\b(danas|veceras|jutros|sutra|prekosutra)\b(?: (?:u|oko) (\d{1,2})(?:[:.](\d{2}))?)?/);
  if (dayWord) {
    const word = dayWord[1];
    const base = new Date(now);
    if (word === "sutra") base.setDate(base.getDate() + 1);
    if (word === "prekosutra") base.setDate(base.getDate() + 2);
    if (dayWord[2]) {
      const hour = Number(dayWord[2]);
      const minute = dayWord[3] ? Number(dayWord[3]) : 0;
      const at = atTime(base, hour, minute, word === "veceras");
      if (at.getTime() > now.getTime()) return { at, expression: dayWord[0] };
      return null;
    }
    // No clock time stated: default morning for future days, "veceras" -> 20:00.
    if (word === "veceras") {
      const at = atTime(base, 20, 0, false);
      if (at.getTime() > now.getTime()) return { at, expression: word };
      return null;
    }
    if (word === "sutra" || word === "prekosutra") {
      return { at: atTime(base, 8, 0, false), expression: word };
    }
    return null;
  }

  return null;
}

type ReminderItemLike = {
  type: "event" | "task";
  date: string;
  time: string;
  reminder_intent: boolean;
  reminder_time: string;
  reminder_at?: string;
  link_to: number;
};

const UNIT_MINUTES: Record<string, number> = {
  minutu: 1,
  minute: 1,
  minuta: 1,
  min: 1,
  sat: 60,
  sata: 60,
  sati: 60,
  dan: 1440,
  dana: 1440,
};

/** "2 sata prije" / "pola sata prije" -> minutes before the event. */
export function parseLeadTime(text: string): number | null {
  const t = deaccent(text).replace(/\s+/g, " ");
  if (/pola sata (prije|ranije)/.test(t)) return 30;
  const m = t.match(/([\w]+) (minutu|minute|minuta|min|sat|sata|sati|dan|dana) (prije|ranije)/);
  if (!m) return null;
  const n = amount(m[1]);
  const unit = m[2] ? UNIT_MINUTES[m[2]] : undefined;
  if (!n || !unit) return null;
  return n * unit;
}

/** Local Date from "YYYY-MM-DD" + "HH:MM" (time optional). */
function localDateTime(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [y = 0, mo = 1, d = 1] = date.split("-").map(Number);
  const [h = 9, mi = 0] =
    time && /^\d{1,2}:\d{2}$/.test(time) ? time.split(":").map(Number) : [9, 0];
  const out = new Date(y, mo - 1, d, h, mi, 0, 0);
  return Number.isNaN(out.getTime()) ? null : out;
}

/**
 * Resolves reminder times for spoken/typed input against the user's clock.
 * Event dates and times are never modified — only `reminder_at` is filled in.
 */
export function applyRelativeReminders<T extends ReminderItemLike>(
  items: T[],
  text: string,
  now: Date = new Date(),
): T[] {
  if (!text.trim()) return items;
  const lead = parseLeadTime(text);
  const relative = lead == null ? parseRelativeReminder(text, now) : null;
  if (lead == null && !relative) return items;

  return items.map((item) => {
    if (!item.reminder_intent) return item;
    if (lead != null) {
      // "podsjeti me 2 sata prije" -> relative to the event, not to now.
      const linked = item.link_to >= 0 ? items[item.link_to] : null;
      const base =
        localDateTime(item.date, item.time) ??
        (linked ? localDateTime(linked.date, linked.time) : null);
      if (!base) return item;
      const at = new Date(base.getTime() - lead * 60_000);
      return { ...item, reminder_at: at.toISOString() };
    }
    return { ...item, reminder_at: relative!.at.toISOString() };
  });
}
