import { useEffect, useSyncExternalStore } from "react";
import { resolveAssignee } from "./family";
import { normalizeCategory } from "./reminders";

const EVENTS_STORAGE_KEY = "family-hub-events";

export type ExtractedItem = {
  person: string;
  assignee: string;
  title: string;
  category: string;
  date: string;
  time: string;
  location: string;
  deadline: string;
  amount: string;
  things_to_bring: string[];
  action_required: string;
  subject: string;
  notes: string;
  confidence: number;
  dayMonth: string;
  needsYear: boolean;
  /** "event" = happens at a time, "task" = something to do (can be completed). */
  type: "event" | "task";
  /** True when the user explicitly asked to be reminded ("podsjeti me"). */
  reminder_intent: boolean;
  /** Explicit reminder clock time "HH:MM" when it was stated. */
  reminder_time: string;
  /** Requested repeat, e.g. "hourly" / "until_done". */
  reminder_recurrence: string;
  /** Index of the event in the same analysis this task belongs to (-1 = none). */
  link_to: number;
};

export type ConfirmedItem = ExtractedItem & { id: string };

type State = { analysis: ExtractedItem[]; confirmed: ConfirmedItem[] };

let state: State & { focusMonth: string } = { analysis: [], confirmed: [], focusMonth: "" };
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

const getSnapshot = () => state;

function readSavedEvents(): ConfirmedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = window.localStorage.getItem(EVENTS_STORAGE_KEY);
    if (!saved) return [];
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Partial<ConfirmedItem> & { id: string } =>
        Boolean(item && typeof item === "object" && "id" in item && typeof item.id === "string"),
      )
      .map((item) => ({ ...normalizeItem(item), id: item.id }));
  } catch {
    return [];
  }
}

function hydrateConfirmed() {
  if (typeof window === "undefined") return;
  const confirmed = readSavedEvents();
  if (JSON.stringify(confirmed) !== JSON.stringify(state.confirmed)) {
    state = { ...state, confirmed };
    emit();
  }
}

function saveConfirmed(items: ConfirmedItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // The in-memory session still works when browser storage is unavailable.
  }
}

export function useHubStore() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    hydrateConfirmed();
  }, []);
  return snapshot;
}

export function normalizeItem(raw: Partial<ExtractedItem>): ExtractedItem {
  const conf = Number(raw.confidence);
  const rawDate = String(raw.date ?? "").trim();
  const rawNotes = String(raw.notes ?? "");
  const parsed = parseDate(rawDate, rawNotes, String(raw.title ?? ""), String(raw.deadline ?? ""));
  return {
    person: String(raw.person ?? ""),
    assignee: raw.assignee ? String(raw.assignee) : resolveAssignee(String(raw.person ?? "")),
    title: String(raw.title ?? ""),
    category: normalizeCategory(String(raw.category ?? "")) || String(raw.category ?? ""),
    date: parsed.date,
    dayMonth: parsed.dayMonth,
    needsYear: parsed.needsYear,
    time: String(raw.time ?? ""),
    location: String(raw.location ?? ""),
    deadline: String(raw.deadline ?? ""),
    amount: String(raw.amount ?? ""),
    things_to_bring: Array.isArray(raw.things_to_bring) ? raw.things_to_bring.map(String) : [],
    action_required: String(raw.action_required ?? ""),
    subject: String(raw.subject ?? ""),
    notes: parsed.notes,
    confidence: Number.isFinite(conf) ? Math.min(1, Math.max(0, conf)) : 0,
    type: raw.type === "task" ? "task" : "event",
    reminder_intent: Boolean(raw.reminder_intent),
    reminder_time: String(raw.reminder_time ?? "").trim(),
    reminder_recurrence: String(raw.reminder_recurrence ?? "").trim(),
    link_to: Number.isInteger(raw.link_to) ? Number(raw.link_to) : -1,
  };
}

const MONTHS: Record<string, number> = {
  sijecanj: 1,
  sijecnja: 1,
  veljaca: 2,
  veljace: 2,
  ozujak: 3,
  ozujka: 3,
  travanj: 4,
  travnja: 4,
  svibanj: 5,
  svibnja: 5,
  lipanj: 6,
  lipnja: 6,
  srpanj: 7,
  srpnja: 7,
  kolovoz: 8,
  kolovoza: 8,
  rujan: 9,
  rujna: 9,
  listopad: 10,
  listopada: 10,
  studeni: 11,
  studenog: 11,
  prosinac: 12,
  prosinca: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");
const deaccent = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

function parseDate(rawDate: string, rawNotes: string, title: string, deadline: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    return { date: rawDate, dayMonth: rawDate.slice(5), needsYear: false, notes: rawNotes };
  }

  const sources: { text: string; isNotes: boolean }[] = [
    { text: rawDate, isNotes: false },
    { text: rawNotes, isNotes: true },
    { text: title, isNotes: false },
    { text: deadline, isNotes: false },
  ];

  for (const src of sources) {
    if (!src.text) continue;
    let day = 0;
    let month = 0;
    let year = 0;
    let matched = "";

    const numeric = src.text.match(/(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4})?/);
    if (numeric) {
      matched = numeric[0];
      day = Number(numeric[1]);
      month = Number(numeric[2]);
      year = numeric[3] ? Number(numeric[3]) : 0;
    } else {
      const named = deaccent(src.text).match(/(\d{1,2})\s*\.?\s*([a-z]+)\s*(\d{4})?/);
      const monthName = named?.[2] ?? "";
      if (named && MONTHS[monthName]) {
        matched = named[0];
        day = Number(named[1]);
        month = MONTHS[monthName]!;
        year = named[3] ? Number(named[3]) : 0;
      }
    }

    if (!day || !month || day > 31 || month > 12) continue;

    const dayMonth = `${pad(month)}-${pad(day)}`;
    const notes = src.isNotes
      ? rawNotes
          .replace(matched, "")
          .replace(/^[\s.,;:–-]+/, "")
          .trim()
      : rawNotes;
    return year
      ? { date: `${year}-${dayMonth}`, dayMonth, needsYear: false, notes }
      : { date: "", dayMonth, needsYear: true, notes };
  }

  return { date: "", dayMonth: "", needsYear: false, notes: rawNotes };
}

export function setAnalysis(items: ExtractedItem[]) {
  state = { ...state, analysis: items };
  emit();
}

export function addConfirmed(items: ExtractedItem[]) {
  hydrateConfirmed();
  const withDate = items.find((i) => /^\d{4}-\d{2}-\d{2}$/.test(i.date.trim()));
  const fingerprint = (item: ExtractedItem) =>
    JSON.stringify([
      item.title.trim(),
      item.date.trim(),
      item.time.trim(),
      item.assignee.trim(),
      item.category.trim(),
      item.notes.trim(),
      item.deadline.trim(),
      item.amount.trim(),
      item.things_to_bring,
    ]);
  const existing = new Set(state.confirmed.map(fingerprint));
  const additions = items
    .map((item, idx) => ({
      ...item,
      person: item.assignee || item.person,
      id: `${Date.now()}-${idx}`,
    }))
    .filter((item) => {
      const key = fingerprint(item);
      if (existing.has(key)) return false;
      existing.add(key);
      return true;
    });
  const confirmed = [...state.confirmed, ...additions];
  state = {
    ...state,
    focusMonth: withDate ? withDate.date.trim().slice(0, 7) : state.focusMonth,
    confirmed,
  };
  saveConfirmed(confirmed);
  emit();
}
