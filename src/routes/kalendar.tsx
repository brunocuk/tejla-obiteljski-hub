import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { assigneeStyle, memberStyles, type MemberName } from "@/lib/family";
import { useHubStore } from "@/lib/hub-store";

export const Route = createFileRoute("/kalendar")({
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

const days: { label: string; sub: string; items: { time: string; who: MemberName; what: string }[] }[] = [
  {
    label: "Danas",
    sub: "petak, 12. rujna",
    items: [
      { time: "08:00", who: "Lara", what: "Škola" },
      { time: "16:30", who: "Korina", what: "Zubar" },
      { time: "18:00", who: "Lucija", what: "Trening" },
    ],
  },
  {
    label: "Sutra",
    sub: "subota, 13. rujna",
    items: [
      { time: "10:00", who: "Lucija", what: "Turnir — dvorana Trnsko" },
      { time: "17:00", who: "Mama", what: "Roditeljski sastanak" },
    ],
  },
  {
    label: "Ponedjeljak",
    sub: "14. rujna",
    items: [{ time: "09:45", who: "Lara", what: "Matematika — pisana provjera" }],
  },
  {
    label: "Četvrtak",
    sub: "17. rujna",
    items: [
      { time: "11:20", who: "Lara", what: "Priroda — ispit" },
      { time: "20:00", who: "Tata", what: "Uplata izleta — rok" },
    ],
  },
  {
    label: "Ponedjeljak",
    sub: "22. rujna",
    items: [{ time: "07:30", who: "Korina", what: "Izlet — 12 €, voda, kapa" }],
  },
];

function KalendarPage() {
  const { confirmed } = useHubStore();
  return (
    <AppShell>
      <PageHeader title="Kalendar" subtitle="Rujan 2025 · cijela obitelj" />

      <div className="mb-6 flex flex-wrap gap-2">
        {(Object.keys(memberStyles) as MemberName[]).map((m) => (
          <span
            key={m}
            className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground"
          >
            <span className={`size-2 rounded-full ${memberStyles[m].dot}`} />
            {m}
          </span>
        ))}
      </div>

      {confirmed.length > 0 ? (
        <section className="mb-7">
          <div className="mb-3 flex items-baseline gap-2">
            <h2 className="text-[15px] font-bold tracking-tight">Dodano iz AI analize</h2>
          </div>
          <div className="card-soft divide-y divide-border">
            {confirmed.map((c) => (
              <div key={c.id} className="flex items-center gap-4 px-5 py-4">
                <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                  {c.time || "—"}
                </span>
                <span className={`h-8 w-1 rounded-full ${assigneeStyle(c.assignee).dot}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{c.title || "Bez naziva"}</p>
                  <p className="text-xs font-medium text-muted-foreground">
                    {[c.assignee, c.date || c.notes].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="space-y-7">
        {days.map((d) => (
          <section key={d.label + d.sub}>
            <div className="mb-3 flex items-baseline gap-2">
              <h2 className="text-[15px] font-bold tracking-tight">{d.label}</h2>
              <span className="text-xs font-medium text-muted-foreground">{d.sub}</span>
            </div>
            <div className="card-soft divide-y divide-border">
              {d.items.map((i) => (
                <div key={i.time + i.what} className="flex items-center gap-4 px-5 py-4">
                  <span className="w-12 text-sm font-semibold tabular-nums text-muted-foreground">
                    {i.time}
                  </span>
                  <span className={`h-8 w-1 rounded-full ${memberStyles[i.who].dot}`} />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold">{i.what}</p>
                    <p className="text-xs font-medium text-muted-foreground">{i.who}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}