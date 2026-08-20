import { formatCroatianDate, formatMonthTitle, formatTime, formatWeekday } from "@/lib/date-hr";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { assigneeStyle } from "@/lib/family";
import { useFamilyEvents, type FamilyEvent } from "@/lib/family-events";
import { EventDetailSheet } from "@/components/EventDetailSheet";
import { ManualEventForm } from "@/components/ManualEventForm";
import { useFamilyMembers, useMyFamilyId } from "@/lib/family-workspace";
import { ReminderBadge } from "@/components/ReminderBadge";
import { useFamilyReminders } from "@/lib/reminders";

export const Route = createFileRoute("/_authenticated/kalendar")({
  head: () => ({
    meta: [
      { title: "Kalendar — Tejla" },
      {
        name: "description",
        content: "Kalendar po danima: termini, obveze i rokovi za sve članove na jednom mjestu.",
      },
      { property: "og:title", content: "Kalendar — Tejla" },
      {
        property: "og:description",
        content: "Pregled svih obveza po danima, s bojom za svakog člana.",
      },
    ],
  }),
  component: KalendarPage,
});

type CalEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  time: string;
  title: string;
  members: string[];
  meta?: string;
};


function monthKey(d: string) {
  return d.slice(0, 7);
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function KalendarPage() {
  const { data: familyId } = useMyFamilyId();
  const { data: members } = useFamilyMembers(familyId);
  const { data: events, isPending } = useFamilyEvents(familyId);
  const { data: reminderMap = {} } = useFamilyReminders(familyId);
  const [cursor, setCursor] = useState(currentMonth);
  const [filter, setFilter] = useState("Svi");
  const [openId, setOpenId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const openEvent: FamilyEvent | null = (events ?? []).find((e) => e.id === openId) ?? null;

  const filters = ["Svi", ...(members ?? []).map((m) => m.name)];

  const allEvents: CalEvent[] = useMemo(
    () =>
      // Tasks are not calendar entries; they live in the task list on "Danas".
      (events ?? [])
        .filter((e) => e.type !== "task")
        .map((e) => ({
          id: e.id,
          date: e.date,
          time: e.time,
          title: e.title || "Bez naziva",
          members: e.members,
          meta: [
            e.category,
            e.location,
            e.amount,
            e.deadline ? `rok: ${e.deadline}` : "",
            e.things_to_bring.join(", "),
            e.notes,
          ]
            .filter(Boolean)
            .join(" · "),
        })),
    [events],
  );

  const visible = allEvents.filter((e) => filter === "Svi" || e.members.includes(filter));
  const inMonth = visible
    .filter((e) => e.date && monthKey(e.date) === cursor)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const undated = visible.filter((e) => !e.date);

  const grouped = inMonth.reduce<Record<string, CalEvent[]>>((acc, e) => {
    (acc[e.date] ||= []).push(e);
    return acc;
  }, {});

  const [y, m] = cursor.split("-").map(Number);
  const shift = (delta: number) => {
    const d = new Date(Date.UTC(y!, m! - 1 + delta, 1));
    setCursor(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <AppShell>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-foreground">
            Kalendar
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Sve što te čeka, po danima</p>
        </div>
        <button
          type="button"
          aria-label="Dodaj obavezu"
          onClick={() => setAddOpen(true)}
          className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-2xl text-primary-foreground"
          style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-float)" }}
        >
          <Plus className="size-5" strokeWidth={2.4} />
        </button>
      </div>

      <div className="mb-5 flex items-center justify-between rounded-2xl bg-secondary px-2 py-2">
        <button
          type="button"
          aria-label="Prethodni mjesec"
          onClick={() => shift(-1)}
          className="rounded-xl p-2 text-muted-foreground active:opacity-60"
        >
          <ChevronLeft className="size-5" />
        </button>
        <span className="text-sm font-bold tracking-tight">
          {formatMonthTitle(y ?? new Date().getFullYear(), m ?? 1)}
        </span>
        <button
          type="button"
          aria-label="Sljedeći mjesec"
          onClick={() => shift(1)}
          className="rounded-xl p-2 text-muted-foreground active:opacity-60"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {filters.map((f) => {
          const active = filter === f;
          const dot = f === "Svi" ? "" : assigneeStyle(f).dot;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {dot ? <span className={`size-2 rounded-full ${dot}`} /> : null}
              {f}
            </button>
          );
        })}
      </div>

      {isPending ? (
        <div className="card-soft px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">Učitavam obveze…</p>
        </div>
      ) : null}

      {!isPending && inMonth.length === 0 && undated.length === 0 ? (
        <div className="card-soft px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">Nema obaveza za odabrani period.</p>
        </div>
      ) : null}

      <div className="space-y-7">
        {Object.entries(grouped).map(([date, list]) => {

          return (
            <section key={date}>
              <div className="mb-3 flex items-baseline gap-2">
                <h2 className="text-[15px] font-bold tracking-tight">
                  {formatCroatianDate(date)}
                </h2>
                <span className="text-xs font-medium text-muted-foreground">
                  {formatWeekday(date)}
                </span>
              </div>
              <div className="card-soft divide-y divide-border">
                {list.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => setOpenId(i.id)}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left active:opacity-70"
                  >
                    <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                      {i.time ? formatTime(i.time) : "—"}
                    </span>
                    <span
                      className={`h-8 w-1 shrink-0 rounded-full ${assigneeStyle(i.members[0] ?? "").dot}`}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold">{i.title}</p>
                      <p className="truncate text-xs font-medium text-muted-foreground">
                        {[i.members.join(", "), i.meta].filter(Boolean).join(" · ")}
                      </p>
                      <ReminderBadge reminders={reminderMap[i.id]} />
                    </div>
                  </button>
                ))}
              </div>
            </section>
          );
        })}

        {undated.length > 0 ? (
          <section>
            <div className="mb-3 flex items-baseline gap-2">
              <h2 className="text-[15px] font-bold tracking-tight">Bez datuma</h2>
            </div>
            <div className="card-soft divide-y divide-border">
              {undated.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => setOpenId(i.id)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left active:opacity-70"
                >
                  <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                    {i.time ? formatTime(i.time) : "—"}
                  </span>
                  <span
                    className={`h-8 w-1 shrink-0 rounded-full ${assigneeStyle(i.members[0] ?? "").dot}`}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold">{i.title}</p>
                    <p className="truncate text-xs font-medium text-muted-foreground">
                      {[i.members.join(", "), i.meta].filter(Boolean).join(" · ")}
                    </p>
                    <ReminderBadge reminders={reminderMap[i.id]} />
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {openEvent ? <EventDetailSheet event={openEvent} onClose={() => setOpenId(null)} /> : null}

      {addOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30">
          <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-background p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight">Nova obaveza</h2>
              <button
                type="button"
                aria-label="Zatvori"
                onClick={() => setAddOpen(false)}
                className="rounded-xl p-1 text-muted-foreground active:opacity-60"
              >
                <X className="size-5" />
              </button>
            </div>
            <ManualEventForm onClose={() => setAddOpen(false)} />
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
