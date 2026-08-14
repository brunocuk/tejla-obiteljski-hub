import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { draftsFromPattern, type ReminderPattern } from "@/lib/reminder-engine";

export const EVENT_CATEGORIES = [
  "Škola",
  "Ispit",
  "Pregled",
  "Zubar",
  "Frizer",
  "Kozmetičar",
  "Trening",
  "Izlet",
  "Putovanje",
  "Rođendan",
  "Uplata",
  "Rok",
  "Servis",
  "Osobno",
  "Obitelj",
  "Ostalo",
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export type RecipientMode = "all_parents" | "creator_only" | "selected";

export type ReminderDraft = {
  /** Local key for list handling; database id when the reminder already exists. */
  key: string;
  /** ISO timestamp (absolute, timezone-aware). */
  remind_at: string;
  recipient_mode: RecipientMode;
  /** Exact recipients when recipient_mode is "selected" (auth user ids). */
  recipient_user_ids?: string[];
  /** Set when the reminder came from a preset offset (relative to the event). */
  offset_minutes?: number | null;
  /** Repeat pattern this reminder was generated from. */
  pattern?: ReminderPattern;
};

export type ReminderRow = {
  id: string;
  event_id: string;
  remind_at: string;
  recipient_mode: RecipientMode;
  recipient_user_ids?: string[] | null;
  sent_at: string | null;
  pattern?: string | null;
  cancelled_at?: string | null;
};

/** Re-stamps a list of drafts with the chosen recipients (mode + explicit ids). */
export function withRecipient(
  drafts: ReminderDraft[],
  mode: RecipientMode,
  userIds: string[] = [],
): ReminderDraft[] {
  return drafts.map((d) => ({
    ...d,
    recipient_mode: mode,
    recipient_user_ids: mode === "selected" ? userIds : [],
  }));
}

export type AdultRecipient = { name: string; userId: string };

/**
 * Turns the spoken/written reminder intent ("podsjeti me", "podsjeti nas",
 * "podsjeti Davora") into a concrete recipient choice.
 * Anything unclear stays with the person who made the entry.
 */
export function resolveRecipient(
  scope: string,
  people: string[],
  self: string | null | undefined,
  adults: AdultRecipient[],
): { mode: RecipientMode; userIds: string[] } {
  const norm = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  if (scope === "all_parents") return { mode: "all_parents", userIds: [] };

  if (scope === "named" && people.length > 0) {
    const ids: string[] = [];
    for (const raw of people) {
      const v = norm(raw);
      if (!v) continue;
      if (["ja", "mene", "me", "meni"].includes(v)) {
        if (self) ids.push(self);
        continue;
      }
      const hit = adults.find((a) => norm(a.name) === v || norm(a.name).startsWith(v));
      if (hit) ids.push(hit.userId);
    }
    const unique = [...new Set(ids)];
    if (unique.length === 0) return { mode: "creator_only", userIds: [] };
    if (unique.length === 1 && unique[0] === self) return { mode: "creator_only", userIds: [] };
    return { mode: "selected", userIds: unique };
  }

  // "me" and everything unspecified: only the person who created the entry.
  return { mode: "creator_only", userIds: [] };
}

/** Maps older/AI category values to the supported category list. */
export function normalizeCategory(raw: string): string {
  const v = raw.trim().toLowerCase();
  if (!v) return "";
  const direct = EVENT_CATEGORIES.find((c) => c.toLowerCase() === v);
  if (direct) return direct;
  const map: Record<string, EventCategory> = {
    skola: "Škola",
    ispit: "Ispit",
    test: "Ispit",
    termin: "Pregled",
    pregled: "Pregled",
    lijecnik: "Pregled",
    zubar: "Zubar",
    frizer: "Frizer",
    kozmeticar: "Kozmetičar",
    trening: "Trening",
    sport: "Trening",
    izlet: "Izlet",
    putovanje: "Putovanje",
    rodendan: "Rođendan",
    uplata: "Uplata",
    placanje: "Uplata",
    rok: "Rok",
    zadatak: "Rok",
    servis: "Servis",
    osobno: "Osobno",
    obitelj: "Obitelj",
    ostalo: "Ostalo",
  };
  const key = v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
  return map[key] ?? "";
}

export const OFFSET_OPTIONS: { label: string; minutes: number }[] = [
  { label: "U vrijeme događaja", minutes: 0 },
  { label: "30 minuta prije", minutes: 30 },
  { label: "1 sat prije", minutes: 60 },
  { label: "2 sata prije", minutes: 120 },
  { label: "1 dan prije", minutes: 24 * 60 },
  { label: "2 dana prije", minutes: 2 * 24 * 60 },
  { label: "3 dana prije", minutes: 3 * 24 * 60 },
  { label: "1 tjedan prije", minutes: 7 * 24 * 60 },
];

let seq = 0;
const newKey = () => `r${Date.now()}-${seq++}`;

/** Builds a local Date from "YYYY-MM-DD" + optional "HH:MM" (user's own timezone). */
export function localDate(date: string, time?: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) return null;
  const [y, m, d] = date.trim().split("-").map(Number);
  const [hh, mm] = (time?.trim() ? time.trim() : "00:00").split(":").map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1, hh || 0, mm || 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

const atClock = (base: Date, daysBefore: number, hour: number, minute = 0) => {
  const d = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate() - daysBefore,
    hour,
    minute,
  );
  return d;
};

const minutesBefore = (base: Date, minutes: number) => new Date(base.getTime() - minutes * 60_000);

export type ReminderInput = {
  category: string;
  date: string;
  time: string;
  deadline?: string;
  things_to_bring?: string[];
};

/** Suggested reminder times for an event, following the default rules per category. */
export function suggestReminders(input: ReminderInput, recipient: RecipientMode): ReminderDraft[] {
  const category = normalizeCategory(input.category);
  const eventAt = localDate(input.date, input.time);
  const deadlineAt = input.deadline ? localDate(input.deadline, "09:00") : null;
  const hasTime = Boolean(input.time.trim());
  const times: Date[] = [];

  const base = eventAt ?? deadlineAt;

  if ((category === "Uplata" || category === "Rok") && (deadlineAt || base)) {
    const d = deadlineAt ?? base!;
    times.push(atClock(d, 3, 19), atClock(d, 1, 19));
  } else if (category === "Ispit" && base) {
    times.push(atClock(base, 3, 18), atClock(base, 1, 18));
  } else if ((category === "Rođendan" || category === "Putovanje") && base) {
    times.push(atClock(base, 7, 9), atClock(base, 1, 9));
  } else if (category === "Izlet" && base) {
    times.push(atClock(base, 1, 19));
  } else if (base && (input.things_to_bring?.length ?? 0) > 0 && !hasTime) {
    times.push(atClock(base, 1, 19));
  } else if (base && hasTime) {
    times.push(atClock(base, 1, 19), minutesBefore(base, 120));
  } else if (base) {
    times.push(atClock(base, 1, 19));
  }

  if (deadlineAt && eventAt && category !== "Uplata" && category !== "Rok") {
    times.push(atClock(deadlineAt, 1, 19));
  }

  // Only future times can ever be delivered; drop stale suggestions so the UI
  // shows exactly what will be saved.
  const now = Date.now();
  const future = times.filter((t) => t.getTime() > now + 30_000);

  // Event is still ahead but every default suggestion already passed
  // (e.g. an event created a couple of hours before it starts).
  if (future.length === 0 && base && base.getTime() > now + 60_000) {
    const thirtyBefore = minutesBefore(base, 30);
    future.push(thirtyBefore.getTime() > now + 30_000 ? thirtyBefore : base);
  }

  const seen = new Set<string>();
  return future
    .filter((t) => {
      const iso = t.toISOString();
      if (seen.has(iso)) return false;
      seen.add(iso);
      return true;
    })
    .sort((a, b) => a.getTime() - b.getTime())
    .map((t) => ({ key: newKey(), remind_at: t.toISOString(), recipient_mode: recipient }));
}

/**
 * Default recipient is always the person creating the entry ("Samo mene").
 * Sharing with other adults is an explicit choice (or an explicit spoken request).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function defaultRecipient(_category?: string, _onlyMe?: boolean): RecipientMode {
  return "creator_only";
}

export function draftFromOffset(
  input: ReminderInput,
  minutes: number,
  recipient: RecipientMode,
): ReminderDraft | null {
  const base =
    localDate(input.date, input.time) ??
    (input.deadline ? localDate(input.deadline, "09:00") : null);
  if (!base) return null;
  return {
    key: newKey(),
    remind_at: minutesBefore(base, minutes).toISOString(),
    recipient_mode: recipient,
    offset_minutes: minutes,
  };
}

export function customDraft(localValue: string, recipient: RecipientMode): ReminderDraft | null {
  const dt = new Date(localValue);
  if (Number.isNaN(dt.getTime())) return null;
  return {
    key: newKey(),
    remind_at: dt.toISOString(),
    recipient_mode: recipient,
    offset_minutes: null,
  };
}

/** Human label for a reminder: preset offset when known, otherwise the absolute time. */
export function reminderLabel(draft: ReminderDraft): string {
  if (draft.offset_minutes != null) {
    const preset = OFFSET_OPTIONS.find((o) => o.minutes === draft.offset_minutes);
    if (preset) return preset.label;
  }
  return formatReminder(draft.remind_at);
}

export const isPast = (iso: string) => new Date(iso).getTime() <= Date.now();

const WEEKDAY_FMT = new Intl.DateTimeFormat("hr-HR", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatReminder = (iso: string) => WEEKDAY_FMT.format(new Date(iso));

const SHORT_FMT = new Intl.DateTimeFormat("hr-HR", {
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Compact local-time label for the card indicator. */
export const formatReminderShort = (iso: string) => SHORT_FMT.format(new Date(iso));

export const RECIPIENT_LABELS: Record<RecipientMode, string> = {
  all_parents: "Sve roditelje",
  creator_only: "Samo mene",
  selected: "Odabrane osobe",
};

/**
 * All not-yet-sent reminders of the family, grouped by event id.
 * Reflects exactly what exists in the database.
 */
export function useFamilyReminders(familyId: string | null | undefined) {
  return useQuery({
    queryKey: ["family-reminders", familyId],
    enabled: Boolean(familyId),
    queryFn: async (): Promise<Record<string, ReminderRow[]>> => {
      const { data, error } = await supabase
        .from("event_reminders")
        .select(
          "id, event_id, remind_at, recipient_mode, recipient_user_ids, sent_at, family_events!inner(family_id)",
        )
        .eq("family_events.family_id", familyId!)
        .is("sent_at", null)
        .is("cancelled_at", null)
        .order("remind_at", { ascending: true });
      if (error) throw error;
      const map: Record<string, ReminderRow[]> = {};
      for (const row of (data ?? []) as unknown as ReminderRow[]) {
        (map[row.event_id] ??= []).push(row);
      }
      return map;
    },
  });
}

export function useEventReminders(eventId: string | null | undefined) {
  return useQuery({
    queryKey: ["event-reminders", eventId],
    enabled: Boolean(eventId),
    queryFn: async (): Promise<ReminderRow[]> => {
      const { data, error } = await supabase
        .from("event_reminders")
        .select("id, event_id, remind_at, recipient_mode, recipient_user_ids, sent_at")
        .eq("event_id", eventId!)
        .is("cancelled_at", null)
        .order("remind_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ReminderRow[];
    },
  });
}

export type InsertResult = { inserted: number; skipped: number; skippedTimes: string[] };

/** Inserts reminders for an event. Past times are skipped and reported back. */
export async function insertReminders(
  eventId: string,
  drafts: ReminderDraft[],
  userId: string,
): Promise<InsertResult> {
  if (!userId) throw new Error("Korisnik nije prijavljen");
  const now = Date.now();
  const future = drafts.filter((d) => new Date(d.remind_at).getTime() > now);
  const skippedTimes = drafts
    .filter((d) => new Date(d.remind_at).getTime() <= now)
    .map((d) => formatReminder(d.remind_at));
  const skipped = skippedTimes.length;
  const seriesId =
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : null;
  const rows = future.map((d) => ({
    event_id: eventId,
    remind_at: d.remind_at,
    recipient_mode: d.recipient_mode,
    recipient_user_ids: d.recipient_mode === "selected" ? (d.recipient_user_ids ?? []) : [],
    created_by: userId,
    pattern: d.pattern ?? "once",
    series_id: seriesId,
  }));
  if (rows.length === 0) return { inserted: 0, skipped, skippedTimes };
  const { data, error } = await supabase.from("event_reminders").insert(rows).select("id");
  if (error) {
    console.error("[reminders] insert failed", error.message);
    throw error;
  }
  if (!data || data.length === 0) {
    throw new Error("Podsjetnik nije spremljen.");
  }
  return { inserted: data.length, skipped, skippedTimes };
}

/**
 * Pauses (does not delete) every not-yet-sent reminder of an event, so the
 * original schedule can be restored when a task is reopened.
 */
export async function cancelPendingReminders(eventId: string) {
  const { error } = await supabase
    .from("event_reminders")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("event_id", eventId)
    .is("sent_at", null)
    .is("cancelled_at", null);
  if (error) throw error;
}

/**
 * Restores the paused schedule of a reopened task: future times come back,
 * past ones are dropped, and a repeating pattern continues from the next
 * valid slot. Never creates duplicates.
 */
export async function restorePausedReminders(eventId: string, userId: string) {
  const { data, error } = await supabase
    .from("event_reminders")
    .select("id, event_id, remind_at, recipient_mode, recipient_user_ids, sent_at, pattern")
    .eq("event_id", eventId)
    .is("sent_at", null)
    .not("cancelled_at", "is", null)
    .order("remind_at", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as unknown as ReminderRow[];
  if (rows.length === 0) return { restored: 0, created: 0 };

  const now = Date.now();
  const future = rows.filter((r) => new Date(r.remind_at).getTime() > now + 30_000);
  const past = rows.filter((r) => !future.includes(r));

  if (future.length > 0) {
    const { error: upErr } = await supabase
      .from("event_reminders")
      .update({ cancelled_at: null })
      .in(
        "id",
        future.map((r) => r.id),
      );
    if (upErr) throw upErr;
  }

  const pattern = (rows.find((r) => r.pattern && r.pattern !== "once")?.pattern ??
    "once") as ReminderPattern;

  // Repeating schedules continue from the next valid slot when nothing future is left.
  let created = 0;
  if (future.length === 0 && pattern !== "once") {
    const source = rows[rows.length - 1]!;
    const drafts = draftsFromPattern(pattern, source.recipient_mode, {
      start: new Date(now + 60_000),
    }).map((d) => ({ ...d, recipient_user_ids: source.recipient_user_ids ?? [] }));
    const result = await insertReminders(eventId, drafts, userId);
    created = result.inserted;
  }

  if (past.length > 0) {
    await supabase
      .from("event_reminders")
      .delete()
      .in(
        "id",
        past.map((r) => r.id),
      );
  }

  return { restored: future.length, created };
}

/** Replaces all not-yet-sent reminders of an event with the given drafts. */
export async function replaceReminders(
  eventId: string,
  drafts: ReminderDraft[],
  userId: string,
): Promise<InsertResult> {
  const { error } = await supabase
    .from("event_reminders")
    .delete()
    .eq("event_id", eventId)
    .is("sent_at", null);
  if (error) throw error;
  return insertReminders(eventId, drafts, userId);
}
