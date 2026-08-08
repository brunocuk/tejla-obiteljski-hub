import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { assigneeStyle, memberStyles, type MemberName } from "@/lib/family";
import { useHubStore } from "@/lib/hub-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Danas — Family Hub" },
      {
        name: "description",
        content:
          "Svi obiteljski termini, obveze i zadaci na jednom mjestu. Pregled dana za cijelu obitelj.",
      },
      { property: "og:title", content: "Danas — Family Hub" },
      {
        property: "og:description",
        content: "Svi obiteljski termini, obveze i zadaci na jednom mjestu.",
      },
    ],
  }),
  component: Danas,
});

const events: { time: string; who: MemberName; what: string }[] = [
  { time: "08:00", who: "Lara", what: "škola" },
  { time: "16:30", who: "Korina", what: "zubar" },
  { time: "18:00", who: "Lucija", what: "trening" },
];

const initialTasks: { id: string; title: string; who?: MemberName }[] = [
  { id: "t1", title: "Uplatiti izlet 12 € do četvrtka", who: "Tata" },
  { id: "t2", title: "Kupiti bilježnicu za Laru", who: "Mama" },
  { id: "t3", title: "Potpisati suglasnost za izlet" },
];

const upcoming: { date: string; who: MemberName; what: string }[] = [
  { date: "14. rujna", who: "Lara", what: "Matematika — pisana provjera" },
  { date: "17. rujna", who: "Lara", what: "Priroda — ispit" },
  { date: "18. rujna", who: "Lucija", what: "Hrvatski — lektira" },
];

function Danas() {
  const [done, setDone] = useState<string[]>([]);
  const { confirmed } = useHubStore();

  return (
    <AppShell>
      <header className="mb-7">
        <p className="text-sm font-medium text-muted-foreground">Petak, 12. rujna</p>
        <h1 className="mt-1 text-[30px] font-bold leading-tight tracking-tight">Dobro jutro</h1>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Danas
        </h2>
        <div className="card-soft divide-y divide-border">
          {events.map((e) => (
            <div key={e.time} className="flex items-center gap-4 px-5 py-4">
              <span className="w-12 text-sm font-semibold tabular-nums text-foreground">
                {e.time}
              </span>
              <span className={`size-2 rounded-full ${memberStyles[e.who].dot}`} />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold">{e.who}</p>
                <p className="truncate text-sm text-muted-foreground">{e.what}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Za napraviti
        </h2>
        <ul className="space-y-3">
          {initialTasks.map((t) => {
            const checked = done.includes(t.id);
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() =>
                    setDone((d) => (d.includes(t.id) ? d.filter((x) => x !== t.id) : [...d, t.id]))
                  }
                  className="card-soft flex w-full items-center gap-3 px-4 py-4 text-left transition-opacity active:opacity-70"
                >
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                      checked ? "border-primary bg-primary" : "border-border bg-background"
                    }`}
                  >
                    {checked ? <Check className="size-3.5 text-primary-foreground" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-[15px] font-medium ${checked ? "text-muted-foreground line-through" : ""}`}
                    >
                      {t.title}
                    </span>
                  </span>
                  {t.who ? (
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${memberStyles[t.who].chip}`}
                    >
                      {t.who}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-warm px-2.5 py-1 text-[11px] font-semibold text-warm-foreground">
                      Nedodijeljeno
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {confirmed.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Dodano iz AI analize
          </h2>
          <div className="card-soft divide-y divide-border">
            {confirmed.map((c) => (
              <div key={c.id} className="flex items-center gap-4 px-5 py-4">
                <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                  {c.time || "—"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{c.title || "Bez naziva"}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[c.date || c.notes].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {c.assignee ? (
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${assigneeStyle(c.assignee).chip}`}
                  >
                    {c.assignee}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Sljedećih 7 dana
        </h2>
        <div className="card-soft divide-y divide-border">
          {upcoming.map((u) => (
            <div key={u.what} className="flex items-center gap-4 px-5 py-4">
              <span className={`size-2 rounded-full ${memberStyles[u.who].dot}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{u.who}</p>
                <p className="truncate text-sm text-muted-foreground">{u.what}</p>
              </div>
              <span className="shrink-0 text-xs font-semibold text-muted-foreground">{u.date}</span>
            </div>
          ))}
        </div>
        <Link
          to="/kalendar"
          className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-primary-soft px-4 py-3 text-sm font-semibold text-accent-foreground"
        >
          Otvori kalendar <ArrowRight className="size-4" />
        </Link>
      </section>
    </AppShell>
  );
}
