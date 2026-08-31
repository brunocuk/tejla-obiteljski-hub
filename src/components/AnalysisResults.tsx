import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check } from "lucide-react";
import { WHOLE_FAMILY, resolveAssignee } from "@/lib/family";
import type { ExtractedItem } from "@/lib/hub-store";
import {
  assignableMembers,
  useFamilyMembers,
  useMyFamilyId,
  useMyUserId,
} from "@/lib/family-workspace";
import { formatCroatianDate, isIsoDate } from "@/lib/date-hr";
import { saveFamilyEvents } from "@/lib/family-events";
import { ReminderEditor } from "@/components/ReminderEditor";
import {
  insertReminders,
  normalizeCategory,
  resolveRecipient,
  suggestReminders,
  withRecipient,
  type RecipientMode,
  localDate,
  type ReminderDraft,
} from "@/lib/reminders";
import { draftsFromPattern, type ReminderPattern } from "@/lib/reminder-engine";
import { isRecurring, type EventRecurrence } from "@/lib/recurrence";
import { RecurrenceSummary } from "@/components/RecurrenceSummary";
import { RecurrencePicker } from "@/components/RecurrencePicker";

const RECURRENCE_MAP: Record<string, ReminderPattern> = {
  hourly: "hourly",
  every_2h: "every_2h",
  every_3h: "every_3h",
  twice_daily: "twice_daily",
  three_daily: "three_daily",
  until_done: "until_done",
};

/**
 * Default reminders for one extracted item, shared by every input path.
 * Tasks only get reminders when the user actually asked to be reminded.
 */
function defaultDrafts(
  it: ExtractedItem,
  mode: RecipientMode,
  userIds: string[],
): ReminderDraft[] {
  const stamp = (list: ReminderDraft[]) => withRecipient(list, mode, userIds);
  if (it.type === "task") {
    if (!it.reminder_intent) return [];
    const absolute = it.reminder_at ? new Date(it.reminder_at) : null;
    const base =
      (absolute && !Number.isNaN(absolute.getTime()) ? absolute : null) ??
      (it.reminder_time ? localDate(it.date, it.reminder_time) : null) ??
      (it.date ? localDate(it.date, "") : null);
    // A resolved absolute time is kept exactly as computed at capture time.
    // Only when nothing usable was stated do we start shortly from now, so the
    // reminder is not already in the past by the time the user taps save.
    const start = base && base.getTime() > Date.now() ? base : new Date(Date.now() + 120_000);
    const pattern = RECURRENCE_MAP[it.reminder_recurrence] ?? "once";
    return stamp(draftsFromPattern(pattern, mode, { start }));
  }
  return stamp(
    suggestReminders(
      {
        category: it.category,
        date: it.date,
        time: it.time,
        deadline: it.deadline,
        things_to_bring: it.things_to_bring,
        recurrence: it.recurrence,
      },
      mode,
    ),
  );
}

/** Review + edit screen for AI-extracted obligations, rendered inline in the Inbox flow. */
export function AnalysisResults({
  analysis,
  onSaved,
  onDiscard,
}: {
  analysis: ExtractedItem[];
  onSaved: (count: number) => void;
  onDiscard: () => void;
}) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<ExtractedItem[]>(analysis);
  const [selected, setSelected] = useState<number[]>(analysis.map((_, i) => i));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { data: familyId } = useMyFamilyId();
  const { data: allMembers } = useFamilyMembers(familyId);
  const members = useMemo(() => assignableMembers(allMembers ?? []), [allMembers]);
  const { data: userId } = useMyUserId();
  const memberRows = members.map((m) => ({ id: m.id, name: m.name }));
  const assigneeOptions = [...memberRows.map((m) => m.name), WHOLE_FAMILY];
  const adults = members
    .filter((m) => m.member_type === "parent" && m.linked_user_id)
    .map((m) => ({ name: m.name, userId: m.linked_user_id as string }));
  const [reminders, setReminders] = useState<Record<number, ReminderDraft[]>>({});
  const [recipients, setRecipients] = useState<Record<number, RecipientMode>>({});
  const [recipientIds, setRecipientIds] = useState<Record<number, string[]>>({});
  const [openReminders, setOpenReminders] = useState<number | null>(null);
  const [openRecurrence, setOpenRecurrence] = useState<number | null>(null);
  const [touched, setTouched] = useState<number[]>([]);
  const [years, setYears] = useState<Record<number, string>>({});
  const [editingDate, setEditingDate] = useState<number | null>(null);
  const currentYear = String(new Date().getFullYear());

  useEffect(() => {
    setItems(analysis);
    setSelected(analysis.map((_, i) => i));
    setError("");
  }, [analysis]);

  // Match AI person names against the real member list once it is loaded.
  useEffect(() => {
    if (memberRows.length === 0) return;
    const names = memberRows.map((m) => m.name);
    const meName =
      (members ?? []).find((m) => m.linked_user_id && m.linked_user_id === userId)?.name ?? "";
    // Fallback: derive the owner from an explicit reminder target ("Podsjeti Davora ...").
    const fromReminder = (it: { reminder_scope: string; reminder_people: string[] }) => {
      if (it.reminder_scope === "me") return resolveAssignee(meName, names);
      if (it.reminder_scope === "named" && it.reminder_people.length > 0) {
        const first = resolveAssignee(it.reminder_people[0] ?? "", names);
        if (it.reminder_people.length === 1) return first;
        return meName ? resolveAssignee(meName, names) : first;
      }
      return "";
    };
    setItems((prev) =>
      prev.map((it) =>
        it.assignee
          ? it
          : { ...it, assignee: resolveAssignee(it.person, names) || fromReminder(it) },
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, userId]);

  // Suggest reminders from the AI-detected category, date and time.
  useEffect(() => {
    const nextR: Record<number, ReminderDraft[]> = {};
    const nextM: Record<number, RecipientMode> = {};
    const nextIds: Record<number, string[]> = {};
    items.forEach((it, i) => {
      const resolved = resolveRecipient(it.reminder_scope, it.reminder_people, userId, adults);
      const mode = touched.includes(i) ? (recipients[i] ?? resolved.mode) : resolved.mode;
      const ids = touched.includes(i) ? (recipientIds[i] ?? resolved.userIds) : resolved.userIds;
      nextM[i] = mode;
      nextIds[i] = ids;
      nextR[i] = touched.includes(i) ? (reminders[i] ?? []) : defaultDrafts(it, mode, ids);
    });
    setReminders(nextR);
    setRecipients(nextM);
    setRecipientIds(nextIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, userId, members]);

  const update = (idx: number, field: keyof ExtractedItem, value: string) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));

  const setRecurrence = (idx: number, next: EventRecurrence) =>
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx ? { ...it, recurrence: next, exception_note: next.note } : it,
      ),
    );

  const confirmYear = (idx: number) => {
    const year = (years[idx] ?? currentYear).trim();
    if (!/^\d{4}$/.test(year)) return;
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx ? { ...it, date: `${year}-${it.dayMonth}`, needsYear: false } : it,
      ),
    );
    setError("");
  };

  const toggle = (idx: number) =>
    setSelected((s) => (s.includes(idx) ? s.filter((x) => x !== idx) : [...s, idx]));

  const handleAddAll = async () => {
    const chosen = items.filter((_, i) => selected.includes(i));
    if (chosen.some((c) => !c.assignee)) {
      setError("Odaberi kome pripada ova obaveza.");
      return;
    }
    if (chosen.some((c) => c.needsYear)) {
      setError("Potvrdi godinu za odabrane obveze.");
      return;
    }
    if (!familyId) {
      setError("Obavezu nije bilo moguće spremiti. Pokušaj ponovno.");
      return;
    }
    // Reminders are absolute timestamps resolved at capture time. At save time
    // we only compare them with the real current clock (millisecond precision) —
    // never re-evaluate the original relative phrase. Reminders of a repeating
    // event are rules, so they are never "expired".
    const chosenIdxAll = items
      .map((_, i) => i)
      .filter((i) => selected.includes(i) && !isRecurring(items[i]!.recurrence));
    const nowMs = Date.now();
    const expired = chosenIdxAll
      .flatMap((i) => reminders[i] ?? [])
      .filter((d) => new Date(d.remind_at).getTime() <= nowMs);
    if (expired.length > 0 && expired.length === chosenIdxAll.flatMap((i) => reminders[i] ?? []).length) {
      setError("Vrijeme podsjetnika je u međuvremenu prošlo. Odaberi novo vrijeme.");

      return;
    }
    setError("");
    setSaving(true);
    try {
      const chosenIdx = items.map((_, i) => i).filter((i) => selected.includes(i));
      // link_to points at the original analysis index; remap it to the saved subset.
      const remapped = chosen.map((c) => ({
        ...c,
        link_to: c.link_to >= 0 ? chosenIdx.indexOf(c.link_to) : -1,
      }));
      const ids = await saveFamilyEvents(familyId, remapped, memberRows);
      if (userId) {
        for (let i = 0; i < ids.length; i += 1) {
          const idx = chosenIdx[i];
          const drafts = idx === undefined ? [] : (reminders[idx] ?? []);
          await insertReminders(ids[i]!, drafts, userId);
        }
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["family-events", familyId] }),
        queryClient.invalidateQueries({ queryKey: ["family-reminders", familyId] }),
      ]);
      onSaved(ids.length);
    } catch (e) {
      const detail = e as { message?: string; code?: string; details?: string; hint?: string };
      console.error("[analysis] ANALYSIS_SAVE_FAILED", detail?.code ?? "");

      setError(
        detail?.message
          ? `Obavezu nije bilo moguće spremiti: ${detail.message}`
          : "Obavezu nije bilo moguće spremiti. Pokušaj ponovno.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="card-soft px-5 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          Nismo pronašli nijednu obavezu. Pokušaj s jasnijom slikom ili dodaj ručno.
        </p>
        <button
          type="button"
          onClick={onDiscard}
          className="mt-4 rounded-2xl bg-primary-soft px-4 py-3 text-sm font-semibold text-accent-foreground"
        >
          U redu
        </button>
      </div>
    );
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Pronašli smo {items.length} obveza.</p>
        <button
          type="button"
          onClick={onDiscard}
          className="shrink-0 text-sm font-semibold text-muted-foreground"
        >
          Odbaci
        </button>
      </div>

      <ul className="space-y-3 pb-4">
        {items.map((it, idx) => {
          const checked = selected.includes(idx);
          const lowConfidence = it.confidence < 0.75;
          return (
            <li
              key={idx}
              className={`card-soft px-4 py-4 transition-all ${checked ? "ring-1 ring-primary/40" : "opacity-70"}`}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  aria-label="Odaberi stavku"
                  onClick={() => toggle(idx)}
                  className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                    checked ? "border-primary bg-primary" : "border-border bg-background"
                  }`}
                >
                  {checked ? <Check className="size-3.5 text-primary-foreground" /> : null}
                </button>

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                        it.type === "task"
                          ? "bg-warm text-warm-foreground"
                          : "bg-primary-soft text-accent-foreground"
                      }`}
                    >
                      {it.type === "task" ? "Zadatak" : "Događaj"}
                    </span>
                    {it.type === "task" && it.link_to >= 0 && items[it.link_to] ? (
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        uz „{items[it.link_to]!.title}"
                      </span>
                    ) : null}
                    {it.category ? (
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground">
                        {normalizeCategory(it.category) || it.category}
                      </span>
                    ) : null}
                    {lowConfidence ? (
                      <span className="flex items-center gap-1 rounded-full bg-warm px-2.5 py-1 text-[11px] font-semibold text-warm-foreground">
                        <AlertTriangle className="size-3" /> Provjeri podatke
                      </span>
                    ) : null}
                  </div>

                  <input
                    value={it.title}
                    onChange={(e) => update(idx, "title", e.target.value)}
                    placeholder="Naziv obveze"
                    className="w-full rounded-xl bg-secondary/60 px-3 py-2 text-[15px] font-semibold outline-none focus:ring-1 focus:ring-primary/40"
                  />
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-muted-foreground">
                      Kome pripada?
                    </label>
                    <select
                      value={it.assignee}
                      onChange={(e) => {
                        update(idx, "assignee", e.target.value);
                        setError("");
                      }}
                      className={`w-full appearance-none rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary/40 ${
                        it.assignee
                          ? "bg-secondary/60"
                          : "bg-warm font-semibold text-warm-foreground"
                      }`}
                    >
                      <option value="">Odaberi člana</option>
                      {assigneeOptions.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    {isIsoDate(it.date) && editingDate !== idx ? (
                      <button
                        type="button"
                        onClick={() => setEditingDate(idx)}
                        className="w-full rounded-xl bg-secondary/60 px-3 py-2 text-left text-sm outline-none"
                      >
                        {formatCroatianDate(it.date)}
                      </button>
                    ) : (
                      <input
                        type={isIsoDate(it.date) ? "date" : "text"}
                        value={it.date}
                        autoFocus={editingDate === idx}
                        onBlur={() => setEditingDate(null)}
                        onChange={(e) => update(idx, "date", e.target.value)}
                        placeholder="Datum"
                        className="w-full rounded-xl bg-secondary/60 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/40"
                      />
                    )}
                    <input
                      value={it.time}
                      onChange={(e) => update(idx, "time", e.target.value)}
                      placeholder="Vrijeme"
                      className="w-full rounded-xl bg-secondary/60 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/40"
                    />
                  </div>
                  {it.type === "event" ? (
                    <div className="space-y-2">
                      {isRecurring(it.recurrence) ? (
                        <RecurrenceSummary
                          recurrence={it.recurrence}
                          date={it.date}
                          time={it.time}
                          end_time={it.end_time}
                          exception_note={it.exception_note}
                        />
                      ) : null}
                      <button
                        type="button"
                        onClick={() =>
                          setOpenRecurrence(openRecurrence === idx ? null : idx)
                        }
                        className="text-xs font-semibold text-accent-foreground"
                      >
                        Ponavljanje {openRecurrence === idx ? "▴" : "▾"}
                      </button>
                      {openRecurrence === idx ? (
                        <RecurrencePicker
                          value={it.recurrence}
                          startDate={it.date}
                          onChange={(next) => setRecurrence(idx, next)}
                        />
                      ) : null}
                    </div>
                  ) : null}
                  {it.dateUncertain ? (
                    <p className="rounded-xl bg-warm px-3 py-2.5 text-[11px] font-semibold text-warm-foreground">
                      Nisam sigurna koji si datum rekla. Upiši ga ili ga potvrdi.
                    </p>
                  ) : null}
                  {it.needsYear && it.dayMonth ? (
                    <div className="space-y-1 rounded-xl bg-warm px-3 py-2.5">
                      <p className="text-[11px] font-semibold text-warm-foreground">
                        Potvrdi godinu · prepoznat datum {Number(it.dayMonth.slice(3))}.
                        {Number(it.dayMonth.slice(0, 2))}.
                      </p>
                      <div className="flex gap-2">
                        <input
                          inputMode="numeric"
                          aria-label="Godina"
                          value={years[idx] ?? currentYear}
                          onChange={(e) => setYears((y) => ({ ...y, [idx]: e.target.value }))}
                          placeholder="Godina"
                          className="w-24 rounded-lg bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/40"
                        />
                        <button
                          type="button"
                          onClick={() => confirmYear(idx)}
                          className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                        >
                          Potvrdi godinu
                        </button>
                      </div>
                    </div>
                  ) : null}
                  <textarea
                    value={it.notes}
                    onChange={(e) => update(idx, "notes", e.target.value)}
                    placeholder="Napomena"
                    rows={2}
                    className="w-full resize-none rounded-xl bg-secondary/60 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/40"
                  />

                  {it.location || it.amount || it.things_to_bring.length > 0 || it.deadline ? (
                    <p className="text-xs text-muted-foreground">
                      {[
                        it.location,
                        it.amount,
                        it.deadline ? `rok: ${it.deadline}` : "",
                        it.things_to_bring.join(", "),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setOpenReminders(openReminders === idx ? null : idx)}
                    className="text-xs font-semibold text-accent-foreground"
                  >
                    Podsjetnici ({(reminders[idx] ?? []).length}){" "}
                    {openReminders === idx ? "▴" : "▾"}
                  </button>
                  {openReminders === idx ? (
                    <ReminderEditor
                      input={{
                        category: it.category,
                        date: it.date,
                        time: it.time,
                        deadline: it.deadline,
                        things_to_bring: it.things_to_bring,
                        recurrence: it.recurrence,
                      }}
                      reminders={reminders[idx] ?? []}
                      onChange={(next) => {
                        setTouched((t) => (t.includes(idx) ? t : [...t, idx]));
                        setReminders((prev) => ({ ...prev, [idx]: next }));
                      }}
                      isTask={it.type === "task"}
                      recipient={recipients[idx] ?? "creator_only"}
                      recipientUserIds={recipientIds[idx] ?? []}
                      adults={adults}
                      onRecipientChange={(mode, ids) => {
                        setTouched((t) => (t.includes(idx) ? t : [...t, idx]));
                        setRecipients((prev) => ({ ...prev, [idx]: mode }));
                        setRecipientIds((prev) => ({ ...prev, [idx]: ids }));
                      }}
                    />
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {error ? (
        <p className="mb-2 rounded-2xl bg-warm px-4 py-2.5 text-center text-sm font-semibold text-warm-foreground">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={handleAddAll}
        disabled={selected.length === 0 || saving}
        className="w-full rounded-3xl px-6 py-4 text-base font-bold text-primary-foreground disabled:opacity-40"
        style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-float)" }}
      >
        {saving ? "Spremam…" : `Dodaj sve (${selected.length})`}
      </button>
    </section>
  );
}
