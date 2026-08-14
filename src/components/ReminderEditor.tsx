import { useState } from "react";
import { Bell, X } from "lucide-react";
import {
  OFFSET_OPTIONS,
  customDraft,
  draftFromOffset,
  isPast,
  reminderLabel,
  RECIPIENT_LABELS,
  type ReminderDraft,
  type ReminderInput,
  type RecipientMode,
} from "@/lib/reminders";
import {
  EVENT_PATTERNS,
  PATTERN_LABELS,
  TASK_PATTERNS,
  draftsFromPattern,
  scheduleSummary,
  type ReminderPattern,
} from "@/lib/reminder-engine";

/** "2026-08-12T14:30" for a datetime-local input, in the user's local timezone. */
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function ReminderEditor({
  input,
  reminders,
  onChange,
  recipient,
  onRecipientChange,
  isTask = false,
}: {
  input: ReminderInput;
  reminders: ReminderDraft[];
  onChange: (next: ReminderDraft[]) => void;
  recipient: RecipientMode;
  onRecipientChange: (mode: RecipientMode) => void;
  /** Tasks may repeat until they are marked done; events may not. */
  isTask?: boolean;
}) {
  const customExisting = reminders.find((r) => r.offset_minutes == null);
  const [custom, setCustom] = useState(() =>
    customExisting ? toLocalInput(customExisting.remind_at) : "",
  );
  const [customError, setCustomError] = useState<string | null>(null);

  const sort = (list: ReminderDraft[]) =>
    [...list].sort((a, b) => a.remind_at.localeCompare(b.remind_at));

  const dedupe = (list: ReminderDraft[]) => {
    const seen = new Set<string>();
    return list.filter((r) => {
      if (seen.has(r.remind_at)) return false;
      seen.add(r.remind_at);
      return true;
    });
  };

  const isPresetActive = (minutes: number) => {
    const draft = draftFromOffset(input, minutes, recipient);
    if (!draft) return false;
    return reminders.some((r) => r.remind_at === draft.remind_at);
  };

  /** Tapping a preset immediately activates (or removes) that reminder. */
  const togglePreset = (minutes: number) => {
    const draft = draftFromOffset(input, minutes, recipient);
    if (!draft) return;
    if (reminders.some((r) => r.remind_at === draft.remind_at)) {
      onChange(reminders.filter((r) => r.remind_at !== draft.remind_at));
      return;
    }
    onChange(sort(dedupe([...reminders, draft])));
  };

  /** Choosing a date/time immediately activates a custom reminder — no extra tap. */
  const changeCustom = (value: string) => {
    setCustom(value);
    const others = reminders.filter((r) => r.offset_minutes != null);
    if (!value) {
      setCustomError(null);
      onChange(others);
      return;
    }
    const draft = customDraft(value, recipient);
    if (!draft) {
      setCustomError("Ovo vrijeme nije ispravno. Odaberi drugo vrijeme.");
      onChange(others);
      return;
    }
    if (isPast(draft.remind_at)) {
      setCustomError("Ovo vrijeme je već prošlo. Odaberi drugo vrijeme.");
      onChange(others);
      return;
    }
    setCustomError(null);
    onChange(sort(dedupe([...others, draft])));
  };

  const remove = (key: string) => {
    const target = reminders.find((r) => r.key === key);
    if (target && target.offset_minutes == null) {
      setCustom("");
      setCustomError(null);
    }
    onChange(reminders.filter((r) => r.key !== key));
  };

  const setMode = (mode: RecipientMode) => {
    onRecipientChange(mode);
    onChange(reminders.map((r) => ({ ...r, recipient_mode: mode })));
  };

  const customActive = reminders.some(
    (r) => r.offset_minutes == null && (r.pattern ?? "once") === "once",
  );

  const activePattern: ReminderPattern =
    (reminders.find((r) => r.pattern && r.pattern !== "once")?.pattern as ReminderPattern) ??
    "once";

  /** One tap = a whole computed schedule; the user never types several times. */
  const applyPattern = (pattern: ReminderPattern) => {
    const first = reminders[0];
    const base = first ? new Date(first.remind_at) : new Date();
    const start = base.getTime() > Date.now() ? base : new Date();
    if (pattern === "once") {
      onChange(
        first ? [{ ...first, pattern: "once" }] : draftsFromPattern("once", recipient, { start }),
      );
      return;
    }
    onChange(draftsFromPattern(pattern, recipient, { start }));
  };

  const patterns = isTask ? TASK_PATTERNS : EVENT_PATTERNS;
  const summary = scheduleSummary(reminders.map((r) => r.remind_at));

  return (
    <div className="rounded-2xl bg-secondary/50 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Bell className="size-4" strokeWidth={1.9} /> Podsjetnici
      </p>

      <div className="mt-3">
        <p className="text-xs font-semibold text-muted-foreground">Ponavljanje</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {patterns.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={activePattern === p}
              onClick={() => applyPattern(p)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                activePattern === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-primary-soft text-accent-foreground"
              }`}
            >
              {PATTERN_LABELS[p]}
            </button>
          ))}
        </div>
        {summary.length > 0 ? (
          <ul className="mt-2 space-y-0.5 text-xs font-medium text-muted-foreground">
            {summary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <p className="mt-4 text-xs font-semibold text-muted-foreground">Prilagođeno vrijeme</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {OFFSET_OPTIONS.map((o) => {
          const active = isPresetActive(o.minutes);
          return (
            <button
              key={o.label}
              type="button"
              aria-pressed={active}
              onClick={() => togglePreset(o.minutes)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-primary-soft text-accent-foreground"
              }`}
            >
              {o.label}
            </button>
          );
        })}
        <span
          aria-hidden
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            customActive
              ? "bg-primary text-primary-foreground"
              : "bg-primary-soft text-accent-foreground"
          }`}
        >
          Prilagođeno
        </span>
      </div>

      <input
        type="datetime-local"
        aria-label="Prilagođeno vrijeme podsjetnika"
        value={custom}
        onChange={(e) => changeCustom(e.target.value)}
        className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
      {customError ? (
        <p className="mt-1 text-xs font-semibold text-destructive">{customError}</p>
      ) : null}

      {reminders.length > 0 ? (
        <div className="mt-4 rounded-xl bg-background p-3">
          <p className="text-xs font-semibold text-muted-foreground">
            {reminders.length === 1 ? "Podsjetnik je postavljen:" : "Podsjetnici:"}
          </p>
          <ul className="mt-2 space-y-1.5">
            {reminders.map((r) => (
              <li key={r.key} className="flex items-center gap-2 text-sm font-medium">
                <Bell className="size-3.5 shrink-0 text-accent-foreground" strokeWidth={2.2} />
                <span className="min-w-0 flex-1">
                  {reminderLabel(r)} · {RECIPIENT_LABELS[r.recipient_mode]}
                  {isPast(r.remind_at) ? (
                    <span className="ml-2 text-[11px] font-semibold text-destructive">
                      Ovo vrijeme je već prošlo. Odaberi drugo vrijeme.
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  aria-label="Ukloni podsjetnik"
                  onClick={() => remove(r.key)}
                  className="text-muted-foreground active:opacity-60"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Nema podsjetnika.</p>
      )}

      <div className="mt-4">
        <p className="text-sm font-semibold">Podsjeti</p>
        <div className="mt-2 flex gap-2">
          {(
            [
              ["all_parents", "Sve roditelje"],
              ["creator_only", "Samo mene"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              aria-pressed={recipient === mode}
              onClick={() => setMode(mode)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                recipient === mode
                  ? "bg-primary text-primary-foreground ring-2 ring-primary/40"
                  : "bg-primary-soft text-accent-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
