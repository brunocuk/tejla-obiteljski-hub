import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Recurring events V1.
 *
 * One `family_events` row is the SERIES. Individual occurrences are never
 * materialized as extra rows: the canonical expansion lives in Postgres
 * (`expand_event_occurrences`), so the web app, the reminder cron and a future
 * Flutter client always compute exactly the same list.
 *
 * An occurrence is identified by its ORIGINAL date. Moving an occurrence keeps
 * that identity and only changes `effective_date`, which is what makes skip /
 * move / reminder dedupe stable.
 *
 * Anything with `recurrence_freq === null` keeps the previous behaviour and
 * never touches any of this.
 */

export type RecurrenceFreq = "daily" | "weekly" | "monthly";

export const WEEKDAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
export type WeekdayCode = (typeof WEEKDAY_CODES)[number];

export const WEEKDAY_SHORT: Record<WeekdayCode, string> = {
  MO: "pon",
  TU: "uto",
  WE: "sri",
  TH: "čet",
  FR: "pet",
  SA: "sub",
  SU: "ned",
};

const WEEKDAY_EVERY: Record<WeekdayCode, string> = {
  MO: "ponedjeljak",
  TU: "utorak",
  WE: "srijedu",
  TH: "četvrtak",
  FR: "petak",
  SA: "subotu",
  SU: "nedjelju",
};

export type EventRecurrence = {
  freq: RecurrenceFreq | null;
  interval: number;
  byday: WeekdayCode[];
  /** "YYYY-MM-DD" or "" for an open-ended series. */
  until: string;
  /** Free text the user/Tejla could not turn into a rule ("osim praznika"). */
  note: string;
};

export const NO_RECURRENCE: EventRecurrence = {
  freq: null,
  interval: 1,
  byday: [],
  until: "",
  note: "",
};

export const isRecurring = (r: Pick<EventRecurrence, "freq">) => r.freq !== null;

/** ISO weekday code of a "YYYY-MM-DD" date, or null when unparseable. */
export function weekdayCodeOf(date: string): WeekdayCode | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) return null;
  const [y, m, d] = date.trim().split("-").map(Number);
  const dt = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
  if (Number.isNaN(dt.getTime())) return null;
  // getUTCDay(): 0 = Sunday
  const idx = (dt.getUTCDay() + 6) % 7;
  return WEEKDAY_CODES[idx]!;
}

/** Croatian one-liner for a repeat rule, e.g. "Svaki utorak". */
export function describeRecurrence(r: EventRecurrence, startDate = ""): string {
  if (!r.freq) return "";
  const every = r.interval > 1 ? `Svakih ${r.interval}` : "Svaki";
  let core: string;
  if (r.freq === "daily") {
    core = r.interval > 1 ? `Svakih ${r.interval} dana` : "Svaki dan";
  } else if (r.freq === "monthly") {
    core = r.interval > 1 ? `Svakih ${r.interval} mjeseci` : "Svaki mjesec";
  } else {
    const days = r.byday.length > 0 ? r.byday : ([weekdayCodeOf(startDate)].filter(Boolean) as WeekdayCode[]);
    const names = days.map((d) => WEEKDAY_EVERY[d]).join(", ");
    core = names
      ? r.interval > 1
        ? `${every} ${r.interval}. tjedan: ${names}`
        : `Svaki ${names}`
      : r.interval > 1
        ? `Svakih ${r.interval} tjedana`
        : "Svaki tjedan";
  }
  return r.until ? `${core}, do ${r.until}` : core;
}

export type Occurrence = {
  event_id: string;
  /** Permanent identity of this occurrence inside the series. */
  original_occurrence_date: string;
  /** Where the occurrence actually sits after a possible move. */
  effective_date: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
  title: string;
  location: string | null;
  notes: string | null;
};

const normalizeTime = (v: string | null) => (v ? v.slice(0, 5) : null);

/** Canonical occurrences of every recurring series of the family in a window. */
export function useFamilyOccurrences(
  familyId: string | null | undefined,
  from: string,
  to: string,
) {
  return useQuery({
    queryKey: ["family-occurrences", familyId, from, to],
    enabled: Boolean(familyId && from && to),
    queryFn: async (): Promise<Occurrence[]> => {
      const { data, error } = await supabase.rpc("expand_family_occurrences", {
        _family_id: familyId!,
        _from: from,
        _to: to,
      });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        start_time: normalizeTime(row.start_time),
        end_time: normalizeTime(row.end_time),
      })) as Occurrence[];
    },
  });
}

export type OccurrencePatch = {
  effective_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  title?: string | null;
  location?: string | null;
  notes?: string | null;
};

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error("Nisi prijavljen.");
  return uid;
}

/** "Obriši samo ovaj" — the occurrence disappears, the series stays. */
export async function skipOccurrence(eventId: string, originalDate: string) {
  const created_by = await currentUserId();
  const { error } = await supabase.from("event_occurrence_overrides").upsert(
    {
      event_id: eventId,
      original_occurrence_date: originalDate,
      status: "skipped",
      created_by,
    },
    { onConflict: "event_id,original_occurrence_date" },
  );
  if (error) throw error;
  await dropReminderOccurrences(eventId, originalDate);
}

/** "Uredi samo ovaj" — override single fields, identity date never changes. */
export async function modifyOccurrence(
  eventId: string,
  originalDate: string,
  patch: OccurrencePatch,
) {
  const created_by = await currentUserId();
  const { error } = await supabase.from("event_occurrence_overrides").upsert(
    {
      event_id: eventId,
      original_occurrence_date: originalDate,
      status: "modified",
      created_by,
      ...patch,
    },
    { onConflict: "event_id,original_occurrence_date" },
  );
  if (error) throw error;
  // The next cron pass re-materializes this occurrence at its new time.
  await dropReminderOccurrences(eventId, originalDate);
}

/** Puts a single occurrence back on the series rule. */
export async function clearOccurrenceOverride(eventId: string, originalDate: string) {
  const { error } = await supabase
    .from("event_occurrence_overrides")
    .delete()
    .eq("event_id", eventId)
    .eq("original_occurrence_date", originalDate);
  if (error) throw error;
  await dropReminderOccurrences(eventId, originalDate);
}

/**
 * "Obriši ovaj i buduće" — the series simply ends the day before, which keeps
 * all past occurrences (and their history) intact.
 */
export async function endSeriesBefore(eventId: string, originalDate: string) {
  const until = addDays(originalDate, -1);
  const { error } = await supabase
    .from("family_events")
    .update({ recurrence_until: until, updated_at: new Date().toISOString() })
    .eq("id", eventId);
  if (error) throw error;
}

/** Pending reminder slots of one occurrence; sent ones are kept as history. */
async function dropReminderOccurrences(eventId: string, originalDate: string) {
  const { data } = await supabase.from("event_reminders").select("id").eq("event_id", eventId);
  const ids = (data ?? []).map((r) => r.id);
  if (ids.length === 0) return;
  await supabase
    .from("reminder_occurrences")
    .delete()
    .in("reminder_id", ids)
    .eq("original_occurrence_date", originalDate)
    .is("sent_at", null);
}

export function addDays(date: string, delta: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, (m ?? 1) - 1, (d ?? 1) + delta));
  return dt.toISOString().slice(0, 10);
}

/** First and last day of a "YYYY-MM" month, as plain dates. */
export function monthBounds(monthKey: string): { from: string; to: string } {
  const [y, m] = monthKey.split("-").map(Number);
  const from = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return { from, to: `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}` };
}
