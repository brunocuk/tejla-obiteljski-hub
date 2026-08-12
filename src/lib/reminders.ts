import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

export type RecipientMode = "all_parents" | "creator_only";

export type ReminderDraft = {
  /** Local key for list handling; database id when the reminder already exists. */
  key: string;
  /** ISO timestamp (absolute, timezone-aware). */
  remind_at: string;
  recipient_mode: RecipientMode;
};

export type ReminderRow = {
  id: string;
  event_id: string;
  remind_at: string;
  recipient_mode: RecipientMode;
  sent_at: string | null;
};

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

const PERSONAL_CATEGORIES = ["Frizer", "Kozmetičar", "Osobno"];

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
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - daysBefore, hour, minute);
  return d;
};

const minutesBefore = (base: Date, minutes: number) =>
  new Date(base.getTime() - minutes * 60_000);

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

/** Default recipient: personal appointments only notify the creator. */
export function defaultRecipient(category: string, onlyMe: boolean): RecipientMode {
  const c = normalizeCategory(category);
  if (PERSONAL_CATEGORIES.includes(c)) return "creator_only";
  return onlyMe && c === "" ? "creator_only" : "all_parents";
}

export function draftFromOffset(
  input: ReminderInput,
  minutes: number,
  recipient: RecipientMode,
): ReminderDraft | null {
  const base = localDate(input.date, input.time) ?? (input.deadline ? localDate(input.deadline, "09:00") : null);
  if (!base) return null;
  return {
    key: newKey(),
    remind_at: minutesBefore(base, minutes).toISOString(),
    recipient_mode: recipient,
  };
}

export function customDraft(localValue: string, recipient: RecipientMode): ReminderDraft | null {
  const dt = new Date(localValue);
  if (Number.isNaN(dt.getTime())) return null;
  return { key: newKey(), remind_at: dt.toISOString(), recipient_mode: recipient };
}

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
          "id, event_id, remind_at, recipient_mode, sent_at, family_events!inner(family_id)",
        )
        .eq("family_events.family_id", familyId!)
        .is("sent_at", null)
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
        .select("id, event_id, remind_at, recipient_mode, sent_at")
        .eq("event_id", eventId!)
        .order("remind_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ReminderRow[];
    },
  });
}

/** Inserts reminders for an event. Past times are skipped. */
export async function insertReminders(eventId: string, drafts: ReminderDraft[], userId: string) {
  const now = Date.now();
  const future = drafts.filter((d) => new Date(d.remind_at).getTime() > now);
  const skipped = drafts.length - future.length;
  if (skipped > 0) {
    console.warn(`[reminders] skipped ${skipped} reminder(s) already in the past`);
  }
  const rows = future.map((d) => ({
      event_id: eventId,
      remind_at: d.remind_at,
      recipient_mode: d.recipient_mode,
      created_by: userId,
    }));
  if (rows.length === 0) return { inserted: 0, skipped };
  const { data, error } = await supabase.from("event_reminders").insert(rows).select("id");
  if (error) {
    console.error("[reminders] insert failed", error.message);
    throw error;
  }
  if (!data || data.length === 0) {
    throw new Error("Podsjetnik nije spremljen.");
  }
  return { inserted: data.length, skipped };
}

/** Replaces all not-yet-sent reminders of an event with the given drafts. */
export async function replaceReminders(eventId: string, drafts: ReminderDraft[], userId: string) {
  const { error } = await supabase
    .from("event_reminders")
    .delete()
    .eq("event_id", eventId)
    .is("sent_at", null);
  if (error) throw error;
  await insertReminders(eventId, drafts, userId);
}