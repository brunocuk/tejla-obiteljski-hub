import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { assigneeStyle, memberStyles, WHOLE_FAMILY, type MemberName } from "@/lib/family";
import { useHubStore } from "@/lib/hub-store";

export const Route = createFileRoute("/_authenticated/kalendar")({
  head: () => ({
    meta: [
      { title: "Kalendar — Family Hub" },
      {
        name: "description",
        content: "Obiteljski kalendar po danima: škola, treninzi, ispiti i termini za svako dijete.",
      },
      { property: "og:title", content: "Kalendar — Family Hub" },
      {
        property: "og:description",
        content: "Pregled obiteljskih obveza po danima, s bojom za svakog člana.",
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
  assignee: string;
  meta?: string;
};

const demoEvents: CalEvent[] = [
  { id: "d1", date: "2025-09-12", time: "08:00", title: "Škola", assignee: "Lara" },
  { id: "d2", date: "2025-09-12", time: "16:30", title: "Zubar", assignee: "Korina" },
  { id: "d3", date: "2025-09-12", time: "18:00", title: "Trening", assignee: "Lucija" },
  { id: "d4", date: "2025-09-13", time: "10:00", title: "Turnir — dvorana Trnsko", assignee: "Lucija" },
  { id: "d5", date: "2025-09-13", time: "17:00", title: "Roditeljski sastanak", assignee: "Mama" },
  { id: "d6", date: "2025-09-14", time: "09:45", title: "Matematika — pisana provjera", assignee: "Lara" },
  { id: "d7", date: "2025-09-17", time: "11:20", title: "Priroda — ispit", assignee: "Lara" },
  { id: "d8", date: "2025-09-17", time: "20:00", title: "Uplata izleta — rok", assignee: "Tata" },
  { id: "d9", date: "2025-09-22", time: "07:30", title: "Izlet — 12 €, voda, kapa", assignee: "Korina" },
];

const MONTHS = [
  "Siječanj", "Veljača", "Ožujak", "Travanj", "Svibanj", "Lipanj",
  "Srpanj", "Kolovoz", "Rujan", "Listopad", "Studeni", "Prosinac",
];
const MONTHS_GEN = [
  "siječnja", "veljače", "ožujka", "travnja", "svibnja", "lipnja",
  "srpnja", "kolovoza", "rujna", "listopada", "studenoga", "prosinca",
];
const WEEKDAYS = ["nedjelja", "ponedjeljak", "utorak", "srijeda", "četvrtak", "petak", "subota"];

const FILTERS = ["Svi", "Mama", "Tata", "Lara", "Lucija", "Korina"] as const;

function monthKey(d: string) {
  return d.slice(0, 7);
}

function KalendarPage() {
  const { confirmed, focusMonth } = useHubStore();
  const [cursor, setCursor] = useState(() => focusMonth || "2025-09");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Svi");

  useEffect(() => {
    if (focusMonth) setCursor(focusMonth);
  }, [focusMonth]);

  const allEvents: CalEvent[] = useMemo(
    () => [
      ...demoEvents,
      ...confirmed.map((c) => ({
        id: c.id,
        date: /^\d{4}-\d{2}-\d{2}$/.test(c.date.trim()) ? c.date.trim() : "",
        time: c.time,
        title: c.title || "Bez naziva",
        assignee: c.assignee,
        meta: [
          c.category,
          c.location,
          c.amount,
          c.deadline ? `rok: ${c.deadline}` : "",
          c.things_to_bring.join(", "),
          c.notes,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    ],
    [confirmed],
  );

  const visible = allEvents.filter(
    (e) => filter === "Svi" || e.assignee === filter || e.assignee === WHOLE_FAMILY,
  );
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
      <PageHeader title="Kalendar" subtitle="Obiteljske obveze po danima" />

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
          {MONTHS[(m ?? 1) - 1]} {y}
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
        {FILTERS.map((f) => {
          const active = filter === f;
          const dot = f === "Svi" ? "" : memberStyles[f as MemberName].dot;
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

      {inMonth.length === 0 && undated.length === 0 ? (
        <div className="card-soft px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">Nema obaveza za odabrani period.</p>
        </div>
      ) : null}

      <div className="space-y-7">
        {Object.entries(grouped).map(([date, list]) => {
          const d = new Date(`${date}T00:00:00Z`);
          return (
            <section key={date}>
              <div className="mb-3 flex items-baseline gap-2">
                <h2 className="text-[15px] font-bold tracking-tight">
                  {d.getUTCDate()}. {MONTHS_GEN[d.getUTCMonth()]} {d.getUTCFullYear()}.
                </h2>
                <span className="text-xs font-medium text-muted-foreground">
                  {WEEKDAYS[d.getUTCDay()]}
                </span>
              </div>
              <div className="card-soft divide-y divide-border">
                {list.map((i) => (
                  <div key={i.id} className="flex items-center gap-4 px-5 py-4">
                    <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                      {i.time || "—"}
                    </span>
                    <span className={`h-8 w-1 shrink-0 rounded-full ${assigneeStyle(i.assignee).dot}`} />
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold">{i.title}</p>
                      <p className="truncate text-xs font-medium text-muted-foreground">
                        {[i.assignee, i.meta].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </div>
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
                <div key={i.id} className="flex items-center gap-4 px-5 py-4">
                  <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                    {i.time || "—"}
                  </span>
                  <span className={`h-8 w-1 shrink-0 rounded-full ${assigneeStyle(i.assignee).dot}`} />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold">{i.title}</p>
                    <p className="truncate text-xs font-medium text-muted-foreground">
                      {[i.assignee, i.meta].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}