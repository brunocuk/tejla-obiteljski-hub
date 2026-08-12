import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, X } from "lucide-react";
import {
  deleteFamilyEvent,
  updateFamilyEvent,
  type FamilyEvent,
} from "@/lib/family-events";
import { useFamilyMembers, useMyFamilyId, useMyUserId } from "@/lib/family-workspace";
import { ReminderEditor } from "@/components/ReminderEditor";
import {
  EVENT_CATEGORIES,
  RECIPIENT_LABELS,
  defaultRecipient,
  formatReminder,
  replaceReminders,
  suggestReminders,
  useEventReminders,
  type RecipientMode,
  type ReminderDraft,
} from "@/lib/reminders";

const fieldClass =
  "mt-1 w-full rounded-2xl border border-border bg-background px-4 py-3 text-[15px] outline-none focus:border-primary";

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 py-2">
      <span className="w-28 shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 text-[15px] font-medium">{value}</span>
    </div>
  );
}

export function EventDetailSheet({
  event,
  onClose,
}: {
  event: FamilyEvent;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: familyId } = useMyFamilyId();
  const { data: members = [] } = useFamilyMembers(familyId);
  const { data: userId } = useMyUserId();
  const { data: savedReminders = [] } = useEventReminders(event.id);

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: event.title,
    date: event.date,
    time: event.time,
    location: event.location,
    notes: event.notes,
    category: event.category,
  });
  const [selected, setSelected] = useState<string[]>(event.member_ids);
  const [reminders, setReminders] = useState<ReminderDraft[]>([]);
  const [recipient, setRecipient] = useState<RecipientMode>("all_parents");

  const pending = savedReminders.filter((r) => !r.sent_at);

  // Load existing reminders into the editor when entering edit mode.
  useEffect(() => {
    if (!editing) return;
    setReminders(
      pending.map((r) => ({
        key: r.id,
        remind_at: r.remind_at,
        recipient_mode: r.recipient_mode,
      })),
    );
    setRecipient(
      pending[0]?.recipient_mode ?? defaultRecipient(event.category, event.member_ids.length === 1),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, savedReminders.length]);

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = e.target.value;
      setForm((prev) => {
        // Relative (preset) reminders follow the event; custom absolute times stay put.
        if ((key === "date" || key === "time") && reminders.length > 0) {
          const oldBase = new Date(`${prev.date || "1970-01-01"}T${prev.time || "00:00"}`);
          const next = { ...prev, [key]: value };
          const newBase = new Date(`${next.date || "1970-01-01"}T${next.time || "00:00"}`);
          const shift = newBase.getTime() - oldBase.getTime();
          if (Number.isFinite(shift) && shift !== 0) {
            setReminders((rs) =>
              rs.map((r) =>
                r.offset_minutes == null
                  ? r
                  : {
                      ...r,
                      remind_at: new Date(new Date(r.remind_at).getTime() + shift).toISOString(),
                    },
              ),
            );
          }
          return next;
        }
        return { ...prev, [key]: value };
      });
    };

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["family-events", familyId] }),
      queryClient.invalidateQueries({ queryKey: ["event-reminders", event.id] }),
      queryClient.invalidateQueries({ queryKey: ["family-reminders", familyId] }),
    ]);

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      await updateFamilyEvent(event.id, form, selected);
      if (!userId) {
        await refresh();
        setError(
          "Obaveza je spremljena, ali podsjetnik nije. Pokušaj ponovno spremiti podsjetnik.",
        );
        return;
      }
      let res;
      try {
        res = await replaceReminders(event.id, reminders, userId);
      } catch {
        await refresh();
        setError(
          "Obaveza je spremljena, ali podsjetnik nije. Pokušaj ponovno spremiti podsjetnik.",
        );
        return;
      }
      await refresh();
      if (res.skipped > 0) {
        setError(
          `Obaveza je spremljena, ali podsjetnik (${res.skippedTimes.join(", ")}) nije spremljen jer je to vrijeme već prošlo.`,
        );
        return;
      }
      setEditing(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        `Promjene nije bilo moguće spremiti${msg ? ` (${msg})` : ""}. Pokušaj ponovno.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setError(null);
    setBusy(true);
    try {
      await deleteFamilyEvent(event.id);
      await refresh();
      onClose();
    } catch {
      setError("Obavezu nije bilo moguće obrisati. Pokušaj ponovno.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-0 sm:items-center sm:p-6">
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-background p-5 sm:rounded-3xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight">
            {editing ? "Uredi obavezu" : event.title || "Bez naziva"}
          </h2>
          <button
            type="button"
            aria-label="Zatvori"
            onClick={onClose}
            className="rounded-xl p-1 text-muted-foreground active:opacity-60"
          >
            <X className="size-5" />
          </button>
        </div>

        {editing ? (
          <div className="space-y-4">
            <label className="block text-sm font-semibold">
              Naslov
              <input value={form.title} onChange={set("title")} className={fieldClass} />
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
              </div>
            </div>

            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

            <ReminderEditor
              input={{
                category: form.category,
                date: form.date,
                time: form.time,
                deadline: event.deadline,
                things_to_bring: event.things_to_bring,
              }}
              reminders={reminders}
              onChange={setReminders}
              recipient={recipient}
              onRecipientChange={setRecipient}
            />
            <button
              type="button"
              onClick={() =>
                setReminders(
                  suggestReminders(
                    {
                      category: form.category,
                      date: form.date,
                      time: form.time,
                      deadline: event.deadline,
                      things_to_bring: event.things_to_bring,
                    },
                    recipient,
                  ),
                )
              }
              className="w-full rounded-2xl bg-primary-soft px-4 py-2.5 text-sm font-semibold text-accent-foreground"
            >
              Predloži podsjetnike ponovno
            </button>

            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="w-full rounded-3xl px-6 py-4 text-base font-bold text-primary-foreground disabled:opacity-60"
              style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-float)" }}
            >
              {busy ? "Spremam…" : "Spremi promjene"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="w-full rounded-2xl px-4 py-2 text-sm font-semibold text-muted-foreground"
            >
              Odustani
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            <Row label="Datum" value={event.date} />
            <Row label="Vrijeme" value={event.time} />
            <Row label="Lokacija" value={event.location} />
            <Row label="Napomena" value={event.notes} />
            <Row label="Kome pripada" value={event.members.join(", ")} />
            <Row label="Kategorija" value={event.category} />
            <Row label="Rok" value={event.deadline} />
            <Row label="Iznos" value={event.amount} />
            <Row label="Što ponijeti" value={event.things_to_bring.join(", ")} />
            {pending.length > 0 ? (
              <div className="flex gap-3 py-2">
                <span className="w-28 shrink-0 text-sm text-muted-foreground">Podsjetnici</span>
                <ul className="min-w-0 flex-1 space-y-1">
                  {pending.map((r) => (
                    <li key={r.id} className="flex items-center gap-2 text-[15px] font-medium">
                      <Bell className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
                      <span className="min-w-0 flex-1">{formatReminder(r.remind_at)}</span>
                      <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
                        {RECIPIENT_LABELS[r.recipient_mode]}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <Row label="Podsjetnici" value="Nema spremljenih podsjetnika" />
            )}
          </div>
        )}

        {!editing ? (
          <div className="mt-5 space-y-3">
            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
            {confirmDelete ? (
              <div className="rounded-2xl bg-secondary p-4">
                <p className="text-sm font-semibold">Želiš li sigurno obrisati ovu obavezu?</p>
                <div className="mt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 rounded-2xl bg-background px-4 py-3 text-sm font-semibold"
                  >
                    Odustani
                  </button>
                  <button
                    type="button"
                    onClick={remove}
                    disabled={busy}
                    className="flex-1 rounded-2xl bg-destructive px-4 py-3 text-sm font-semibold text-destructive-foreground disabled:opacity-60"
                  >
                    Obriši
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="w-full rounded-3xl px-6 py-4 text-base font-bold text-primary-foreground"
                  style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-float)" }}
                >
                  Uredi
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-destructive"
                >
                  Obriši obavezu
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
