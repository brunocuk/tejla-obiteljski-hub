import { useState } from "react";
import { Bell, Plus, X } from "lucide-react";
import {
  OFFSET_OPTIONS,
  customDraft,
  draftFromOffset,
  formatReminder,
  type ReminderDraft,
  type ReminderInput,
  type RecipientMode,
} from "@/lib/reminders";

export function ReminderEditor({
  input,
  reminders,
  onChange,
  recipient,
  onRecipientChange,
}: {
  input: ReminderInput;
  reminders: ReminderDraft[];
  onChange: (next: ReminderDraft[]) => void;
  recipient: RecipientMode;
  onRecipientChange: (mode: RecipientMode) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [custom, setCustom] = useState("");

  const add = (minutes: number) => {
    const draft = draftFromOffset(input, minutes, recipient);
    if (!draft) return;
    onChange([...reminders, draft].sort((a, b) => a.remind_at.localeCompare(b.remind_at)));
    setAdding(false);
  };

  const addCustom = () => {
    const draft = customDraft(custom, recipient);
    if (!draft) return;
    onChange([...reminders, draft].sort((a, b) => a.remind_at.localeCompare(b.remind_at)));
    setCustom("");
    setAdding(false);
  };

  const remove = (key: string) => onChange(reminders.filter((r) => r.key !== key));

  const setMode = (mode: RecipientMode) => {
    onRecipientChange(mode);
    onChange(reminders.map((r) => ({ ...r, recipient_mode: mode })));
  };

  return (
    <div className="rounded-2xl bg-secondary/50 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Bell className="size-4" strokeWidth={1.9} /> Podsjetnici
      </p>

      <ul className="mt-3 space-y-2">
        {reminders.map((r) => (
          <li
            key={r.key}
            className="flex items-center gap-2 rounded-xl bg-background px-3 py-2 text-sm"
          >
            <span className="min-w-0 flex-1 truncate">{formatReminder(r.remind_at)}</span>
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
        {reminders.length === 0 ? (
          <li className="text-sm text-muted-foreground">Nema podsjetnika.</li>
        ) : null}
      </ul>

      {adding ? (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            {OFFSET_OPTIONS.map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={() => add(o.minutes)}
                className="rounded-full bg-primary-soft px-3 py-1.5 text-xs font-semibold text-accent-foreground"
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="datetime-local"
              aria-label="Prilagođeno"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={addCustom}
              className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
            >
              Prilagođeno
            </button>
          </div>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="text-xs font-semibold text-muted-foreground"
          >
            Odustani
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-accent-foreground"
        >
          <Plus className="size-4" /> Dodaj podsjetnik
        </button>
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
              onClick={() => setMode(mode)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                recipient === mode
                  ? "bg-primary text-primary-foreground"
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