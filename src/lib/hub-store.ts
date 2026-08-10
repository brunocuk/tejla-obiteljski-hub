import { useEffect, useSyncExternalStore } from "react";
import { resolveAssignee } from "./family";

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
  return {
    person: String(raw.person ?? ""),
    assignee: raw.assignee ? String(raw.assignee) : resolveAssignee(String(raw.person ?? "")),
    title: String(raw.title ?? ""),
    category: String(raw.category ?? ""),
    date: String(raw.date ?? ""),
    time: String(raw.time ?? ""),
    location: String(raw.location ?? ""),
    deadline: String(raw.deadline ?? ""),
    amount: String(raw.amount ?? ""),
    things_to_bring: Array.isArray(raw.things_to_bring) ? raw.things_to_bring.map(String) : [],
    action_required: String(raw.action_required ?? ""),
    subject: String(raw.subject ?? ""),
    notes: String(raw.notes ?? ""),
    confidence: Number.isFinite(conf) ? Math.min(1, Math.max(0, conf)) : 0,
  };
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
