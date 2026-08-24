/**
 * "Tejline poruke" — rule-based, contextual nudges.
 *
 * Pure domain logic: no database, no network, no AI. It receives the user's
 * calendar snapshot plus their recent nudge history and returns at most one
 * message. Everything is evaluated in Europe/Zagreb wall-clock time derived
 * from Intl, so it stays correct across DST changes.
 *
 * This module must never touch the event_reminders engine.
 */

export const TZ = "Europe/Zagreb";

/** Nudges never go out at night. */
export const QUIET_START_HOUR = 22;
export const QUIET_END_HOUR = 8;

/** Zagreb-local hours at which the scheduler is allowed to run. */
export const SEND_HOURS = [9, 18];

/** Max nudges per user in a rolling 7-day window (holidays included). */
export const WEEKLY_LIMIT = 2;

/** Same message_key may not repeat within this many days. */
export const SAME_KIND_COOLDOWN_DAYS = 21;

export type ZagrebNow = {
  /** Local date as YYYY-MM-DD. */
  date: string;
  hour: number;
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
};

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
  hour12: false,
});

const WEEKDAYS: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Wall-clock view of an instant in Zagreb (DST-safe, never hardcoded UTC). */
export function zagrebNow(instant: Date): ZagrebNow {
  const parts = partsFormatter.formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = Number(get("hour")) % 24;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour,
    weekday: WEEKDAYS[get("weekday")] ?? 0,
  };
}

/** Adds whole days to a YYYY-MM-DD calendar date (no timezone involved). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const base = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function diffDays(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export function isQuietHour(hour: number): boolean {
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
}

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

/**
 * ONLY these categories may produce a nudge. Anything else — medical,
 * exams, unknown or free-text categories — is deliberately excluded so a
 * lock screen never leaks sensitive context. Event titles are never used.
 */
export const COUNTDOWN_CATEGORIES = [
  "putovanje",
  "godišnji",
  "koncert",
  "rođendan",
  "izlet",
] as const;

export type CountdownCategory = (typeof COUNTDOWN_CATEGORIES)[number];

const CATEGORY_ALIASES: Record<string, CountdownCategory> = {
  putovanje: "putovanje",
  put: "putovanje",
  godisnji: "godišnji",
  godišnji: "godišnji",
  "godišnji odmor": "godišnji",
  "godisnji odmor": "godišnji",
  odmor: "godišnji",
  koncert: "koncert",
  rodendan: "rođendan",
  rođendan: "rođendan",
  izlet: "izlet",
};

export function normalizeCategory(raw: string | null | undefined): CountdownCategory | null {
  const key = (raw ?? "").trim().toLowerCase();
  if (!key) return null;
  return CATEGORY_ALIASES[key] ?? null;
}

/* ------------------------------------------------------------------ */
/* Message templates                                                   */
/* ------------------------------------------------------------------ */

const COUNTDOWN_TEXT: Record<CountdownCategory, { d3: string; d1: string }> = {
  putovanje: { d3: "Još 3 dana do putovanja. 🧳", d1: "Još jedno spavanje do putovanja. 🧳" },
  godišnji: { d3: "Još malo pa godišnji.", d1: "Sutra počinje godišnji. Konačno. 😌" },
  koncert: { d3: "Još 3 dana do koncerta. 🎶", d1: "Još jedno spavanje do koncerta. 🎶" },
  rođendan: { d3: "Još 3 dana do rođendana. 🎂", d1: "Sutra je rođendan. 🎂" },
  izlet: { d3: "Još 3 dana do izleta.", d1: "Sutra je izlet." },
};

/** Selected Croatian holidays with a fixed, non-sensitive greeting. */
const HOLIDAYS: Record<string, { key: string; body: string }> = {
  "01-01": { key: "holiday:nova-godina", body: "Sretna Nova! ✨ Danas ne moraš ništa planirati." },
  "05-01": { key: "holiday:praznik-rada", body: "Danas je Praznik rada. Naglasak na praznik. 😌" },
  "06-25": {
    key: "holiday:dan-drzavnosti",
    body: "Danas je praznik. Nadam se da ti ovo nije nova informacija. 😄",
  },
  "08-05": { key: "holiday:dan-pobjede", body: "Danas je praznik. Tejla danas nema ništa za dodati." },
  "08-15": { key: "holiday:velika-gospa", body: "Danas je blagdan. Uživaj u slobodnom danu." },
  "11-01": { key: "holiday:svi-sveti", body: "Danas samo polako. 🤍" },
  "12-24": { key: "holiday:badnjak", body: "Badnjak je. Za danas je dosta planiranja. 🎄" },
  "12-25": { key: "holiday:bozic", body: "Sretan Božić. Tejla danas šuti. 🎄" },
  "12-31": { key: "holiday:stara-godina", body: "Zadnji dan godine. Ostalo može čekati sutra. ✨" },
};

/**
 * Lowest-priority pool. Never overrides a contextual message and is capped at
 * one per GENERAL_COOLDOWN_DAYS. Rotation is deterministic (date-derived), so
 * no AI call and no randomness.
 */
export const GENERAL_MESSAGES: { key: string; body: string }[] = [
  { key: "general:take_time", body: "Je li danas ostalo malo vremena i za tebe?" },
  { key: "general:not_everything_today", body: "Ne mora baš sve stati u danas." },
  { key: "general:tomorrow", body: "Ako nešto može čekati sutra — neka čeka." },
  { key: "general:just_because", body: "Napravi danas nešto samo zato što ti se radi." },
  { key: "general:quiet_day", body: "Danas nema zadatka. Samo ti želim miran dan." },
];

/** At most one general message per user in this many days. */
export const GENERAL_COOLDOWN_DAYS = 21;

export const isGeneralKey = (key: string) => key.startsWith("general:");

/** Morning window (holidays + countdowns) vs evening window (calm + general). */
export const MORNING_HOUR = 9;
export const EVENING_HOUR = 18;
export const isMorningWindow = (hour: number) => hour >= QUIET_END_HOUR && hour < 12;
export const isEveningWindow = (hour: number) => hour >= 12 && hour < QUIET_START_HOUR;


export type CalendarEvent = {
  id: string;
  /** YYYY-MM-DD, may be null for undated tasks. */
  date: string | null;
  category: string | null;
  type: string | null;
  completed: boolean;
};

export type NudgeCandidate = {
  /** Stable template identity, used for cooldown. */
  messageKey: string;
  /** Stable dedupe bucket appended to the dedupe key. */
  bucket: string;
  body: string;
  deepLink: string;
  subjectId: string | null;
};

export type RecentNudge = { messageKey: string; date: string };

export type NudgeContext = {
  now: ZagrebNow;
  /** Visible events of the user's family (dated, not completed). */
  events: CalendarEvent[];
  /** Nudges already sent to this user, with their Zagreb send date. */
  recent: RecentNudge[];
};

const dated = (events: CalendarEvent[], day: string) =>
  events.filter((e) => !e.completed && e.date === day);

/** Weekend = Saturday + Sunday of the current or upcoming week. */
function nextWeekend(today: string, weekday: number): [string, string] {
  const toSaturday = weekday === 0 ? -1 : 6 - weekday;
  const saturday = addDays(today, toSaturday);
  return [saturday, addDays(saturday, 1)];
}

/**
 * Ordered candidate list. Morning window: holidays, then countdowns.
 * Evening window: calm states, then the general pool as the last resort.
 */
export function buildCandidates(ctx: NudgeContext): NudgeCandidate[] {
  const { now, events } = ctx;
  const out: NudgeCandidate[] = [];
  const morning = isMorningWindow(now.hour);
  const evening = isEveningWindow(now.hour);

  if (morning) {
    const holiday = HOLIDAYS[now.date.slice(5)];
    if (holiday) {
      out.push({
        messageKey: holiday.key,
        bucket: now.date.slice(0, 4),
        body: holiday.body,
        deepLink: "/",
        subjectId: null,
      });
    }

    for (const offset of [1, 3]) {
      const day = addDays(now.date, offset);
      for (const event of dated(events, day)) {
        const category = normalizeCategory(event.category);
        if (!category) continue;
        out.push({
          messageKey: `countdown:${category}:${offset}`,
          bucket: `${event.id}:d${offset}`,
          body: offset === 1 ? COUNTDOWN_TEXT[category].d1 : COUNTDOWN_TEXT[category].d3,
          deepLink: `/?zadatak=${event.id}`,
          subjectId: event.id,
        });
      }
    }
  }

  if (evening) {
    const tomorrow = addDays(now.date, 1);
    if (dated(events, tomorrow).length === 0) {
      out.push({
        messageKey: "calm:empty_tomorrow",
        bucket: tomorrow,
        body: "Sutra nemaš ništa u kalendaru. Da, stvarno. 😌",
        deepLink: "/",
        subjectId: null,
      });
    }

    // Only announced on Thu/Fri, and only when both weekend days are free.
    if (now.weekday === 4 || now.weekday === 5) {
      const [sat, sun] = nextWeekend(now.date, now.weekday);
      if (dated(events, sat).length === 0 && dated(events, sun).length === 0) {
        out.push({
          messageKey: "calm:quiet_weekend",
          bucket: sat,
          body: "Vikend ti je prazan. Nemoj odmah nešto upisati. 😄",
          deepLink: "/",
          subjectId: null,
        });
      }
    }

    // Lowest priority: always appended last, so a contextual message wins.
    const general = pickGeneral(now.date);
    out.push({
      messageKey: general.key,
      bucket: now.date,
      body: general.body,
      deepLink: "/",
      subjectId: null,
    });
  }

  return out;
}

/** Deterministic rotation through the general pool (no randomness, no AI). */
export function pickGeneral(date: string): { key: string; body: string } {
  const index = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  return GENERAL_MESSAGES[
    ((index % GENERAL_MESSAGES.length) + GENERAL_MESSAGES.length) % GENERAL_MESSAGES.length
  ]!;
}

/** Quota gate: max 1/day, max 2 per rolling 7 days, per-template cooldown. */
export function quotaBlocks(
  candidate: NudgeCandidate,
  now: ZagrebNow,
  recent: RecentNudge[],
): boolean {
  const withinDays = (n: number) =>
    recent.filter((r) => diffDays(r.date, now.date) >= 0 && diffDays(r.date, now.date) < n);

  if (withinDays(1).length > 0) return true; // already nudged today
  if (withinDays(7).length >= WEEKLY_LIMIT) return true;
  if (
    withinDays(SAME_KIND_COOLDOWN_DAYS).some((r) => r.messageKey === candidate.messageKey)
  ) {
    return true;
  }
  // Any general message blocks the whole pool for the cooldown period.
  if (
    isGeneralKey(candidate.messageKey) &&
    withinDays(GENERAL_COOLDOWN_DAYS).some((r) => isGeneralKey(r.messageKey))
  ) {
    return true;
  }
  return false;
}


/** The single message to send now, or null. */
export function pickNudge(ctx: NudgeContext): NudgeCandidate | null {
  if (isQuietHour(ctx.now.hour)) return null;
  for (const candidate of buildCandidates(ctx)) {
    if (!quotaBlocks(candidate, ctx.now, ctx.recent)) return candidate;
  }
  return null;
}

export const NUDGE_KIND = "tejla_message";

export function dedupeKey(userId: string, candidate: NudgeCandidate): string {
  return `tejla:${candidate.messageKey}:${userId}:${candidate.bucket}`;
}
