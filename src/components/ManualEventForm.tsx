import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { saveManualEvent } from "@/lib/family-events";
import { useFamilyMembers, useMyFamilyId, useMyUserId } from "@/lib/family-workspace";
import { ReminderEditor } from "@/components/ReminderEditor";
import {
  EVENT_CATEGORIES,
  defaultRecipient,
  insertReminders,
  suggestReminders,
  type RecipientMode,
  type ReminderDraft,
} from "@/lib/reminders";

const fieldClass =
  "mt-1 w-full rounded-2xl border border-border bg-background px-4 py-3 text-[15px] outline-none focus:border-primary";

export function ManualEventForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: familyId } = useMyFamilyId();
  const { data: members = [] } = useFamilyMembers(familyId);
  const { data: userId } = useMyUserId();
  const [form, setForm] = useState({
    title: "",
    date: "",
    time: "",
    location: "",
    notes: "",
    category: "",
  });
  const [kind, setKind] = useState<"event" | "task">("event");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reminders, setReminders] = useState<ReminderDraft[]>([]);
  const [recipient, setRecipient] = useState<RecipientMode>("all_parents");
  const [touched, setTouched] = useState(false);

  const onlyMe =
    selected.length === 1 &&
    members.some((m) => m.id === selected[0] && m.linked_user_id === userId);

  // Suggested reminders follow the category/date/time until the user edits them.
  useEffect(() => {
    if (touched) return;
    const mode = defaultRecipient(form.category, onlyMe);
    setRecipient(mode);
    if (kind === "task") {
      // A task only gets reminders the user asks for, via the preset buttons.
      setReminders([]);
      return;
    }
    setReminders(
      suggestReminders(
        { category: form.category, date: form.date, time: form.time, things_to_bring: [] },
        mode,
      ),
    );
  }, [form.category, form.date, form.time, onlyMe, touched, kind]);

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) {
      setError("Upiši naslov obaveze.");
      return;
    }
    if (selected.length === 0) {
      setError("Odaberi barem jednog člana.");
      return;
    }
    if (!familyId) {
      setError("Obavezu nije bilo moguće spremiti. Pokušaj ponovno.");
      return;
    }
    setSaving(true);
    try {
      const eventId = await saveManualEvent(familyId, { ...form, type: kind }, selected);
      let skipped = 0;
      if (reminders.length > 0) {
        if (!userId) {
          setError(
            "Obaveza je spremljena, ali podsjetnik nije. Pokušaj ponovno spremiti podsjetnik.",
          );
          setSaving(false);
          return;
        }
        try {
          const res = await insertReminders(eventId, reminders, userId);
          skipped = res.skipped;
        } catch {
          await queryClient.invalidateQueries({ queryKey: ["family-events", familyId] });
          setError(
            "Obaveza je spremljena, ali podsjetnik nije. Pokušaj ponovno spremiti podsjetnik.",
          );
          setSaving(false);
          return;
        }
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["family-events", familyId] }),
        queryClient.invalidateQueries({ queryKey: ["family-reminders", familyId] }),
        queryClient.invalidateQueries({ queryKey: ["event-reminders", eventId] }),
      ]);
      if (skipped > 0) {
        setError(
          `Obaveza je spremljena, ali ${skipped} podsjetnik(a) nije spremljeno jer je vrijeme već prošlo.`,
        );
        setSaving(false);
        return;
      }
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(`Obavezu nije bilo moguće spremiti${msg ? ` (${msg})` : ""}. Pokušaj ponovno.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="card-soft mt-3 space-y-4 p-4">
      <div className="flex gap-2">
        {(
          [
            ["event", "Događaj"],
            ["task", "Zadatak"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={kind === value}
            onClick={() => setKind(value)}
            className={`flex-1 rounded-2xl px-4 py-2.5 text-sm font-semibold ${
              kind === value
                ? "bg-primary text-primary-foreground"
                : "bg-primary-soft text-accent-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="block text-sm font-semibold">
        Naslov
        <input
          value={form.title}
          onChange={set("title")}
          className={fieldClass}
          placeholder="npr. Roditeljski sastanak"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold">
          Datum
          <input type="date" value={form.date} onChange={set("date")} className={fieldClass} />
        </label>
        <label className="block text-sm font-semibold">
          Vrijeme
          <input type="time" value={form.time} onChange={set("time")} className={fieldClass} />
        </label>
      </div>
      <label className="block text-sm font-semibold">
        Lokacija
        <input value={form.location} onChange={set("location")} className={fieldClass} />
      </label>
      <label className="block text-sm font-semibold">
        Kategorija <span className="font-normal text-muted-foreground">(neobavezno)</span>
        <select value={form.category} onChange={set("category")} className={fieldClass}>
          <option value="">Bez kategorije</option>
          {EVENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-semibold">
        Napomena
        <textarea value={form.notes} onChange={set("notes")} rows={3} className={fieldClass} />
      </label>

      <div>
        <p className="text-sm font-semibold">Kome pripada?</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => toggle(m.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                selected.includes(m.id)
                  ? "bg-primary text-primary-foreground"
                  : "bg-primary-soft text-accent-foreground"
              }`}
            >
              {m.name || "Bez imena"}
            </button>
          ))}
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Još nema članova.</p>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

      <ReminderEditor
        input={{ category: form.category, date: form.date, time: form.time }}
        reminders={reminders}
        onChange={(next) => {
          setTouched(true);
          setReminders(next);
        }}
        isTask={kind === "task"}
        recipient={recipient}
        onRecipientChange={(mode) => {
          setTouched(true);
          setRecipient(mode);
        }}
      />

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-3xl px-6 py-4 text-base font-bold text-primary-foreground disabled:opacity-60"
        style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-float)" }}
      >
        {saving ? "Spremam…" : kind === "task" ? "Spremi zadatak" : "Spremi obavezu"}
      </button>
      <button
        type="button"
        onClick={onClose}
        className="w-full rounded-2xl px-4 py-2 text-sm font-semibold text-muted-foreground"
      >
        Odustani
      </button>
    </form>
  );
}
