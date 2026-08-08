import { useSyncExternalStore } from "react";
import { resolveAssignee } from "./family";

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

let state: State = { analysis: [], confirmed: [] };
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

const getSnapshot = () => state;

export function useHubStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
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
  state = {
    ...state,
    confirmed: [
      ...state.confirmed,
      ...items.map((i, idx) => ({ ...i, id: `${Date.now()}-${idx}` })),
    ],
  };
  emit();
}
