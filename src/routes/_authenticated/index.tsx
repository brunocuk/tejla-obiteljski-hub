import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { assigneeStyle, memberStyles, type MemberName } from "@/lib/family";
import { useFamilyEvents, type FamilyEvent } from "@/lib/family-events";
import { EventDetailSheet } from "@/components/EventDetailSheet";
import { useMyFamilyId } from "@/lib/family-workspace";

export const Route = createFileRoute("/_authenticated/")({
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

const initialTasks: { id: string; title: string; who?: MemberName }[] = [
  { id: "t1", title: "Uplatiti izlet 12 € do četvrtka", who: "Tata" },
  { id: "t2", title: "Kupiti bilježnicu za Laru", who: "Mama" },
  { id: "t3", title: "Potpisati suglasnost za izlet" },
];

const MONTHS_GEN = [
  "siječnja", "veljače", "ožujka", "travnja", "svibnja", "lipnja",
  "srpnja", "kolovoza", "rujna", "listopada", "studenoga", "prosinca",
];
const WEEKDAYS = ["Nedjelja", "Ponedjeljak", "Utorak", "Srijeda", "Četvrtak", "Petak", "Subota"];

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function Danas() {
  const [done, setDone] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: familyId } = useMyFamilyId();
  const { data: events, isPending } = useFamilyEvents(familyId);

  const now = new Date();
  const today = isoDay(now);
  const in7 = isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7));
  const all = events ?? [];
  const todayEvents = all
    .filter((e) => e.date === today)
    .sort((a, b) => a.time.localeCompare(b.time));
  const upcoming = all
    .filter((e) => e.date > today && e.date <= in7)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const undated = all.filter((e) => !e.date);

  return (
    <AppShell>
      <header className="mb-7">
        <p className="text-sm font-medium text-muted-foreground">
          {WEEKDAYS[now.getDay()]}, {now.getDate()}. {MONTHS_GEN[now.getMonth()]}
        </p>
        <h1 className="mt-1 text-[30px] font-bold leading-tight tracking-tight">Dobro jutro</h1>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Danas
        </h2>
        <div className="card-soft divide-y divide-border">
          {isPending ? (
            <p className="px-5 py-6 text-center text-sm text-muted-foreground">Učitavam obveze…</p>
          ) : todayEvents.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-muted-foreground">
              Danas nema obveza.
            </p>
          ) : (
            todayEvents.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setOpenId(e.id)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left active:opacity-70"
              >
                <span className="w-12 text-sm font-semibold tabular-nums text-foreground">
                  {e.time || "—"}
                </span>
                <span className={`size-2 rounded-full ${assigneeStyle(e.members[0] ?? "").dot}`} />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold">
                    {e.members.join(", ") || "Cijela obitelj"}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{e.title}</p>
                </div>
              </button>
            ))
          )}
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

      {undated.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Bez datuma
          </h2>
          <div className="card-soft divide-y divide-border">
            {undated.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setOpenId(c.id)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left active:opacity-70"
              >
                <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                  {c.time || "—"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{c.title || "Bez naziva"}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {c.notes}
                  </p>
                </div>
                {c.members.length > 0 ? (
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${assigneeStyle(c.members[0] ?? "").chip}`}
                  >
                    {c.members.join(", ")}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Sljedećih 7 dana
        </h2>
        <div className="card-soft divide-y divide-border">
          {isPending ? (
            <p className="px-5 py-6 text-center text-sm text-muted-foreground">Učitavam obveze…</p>
          ) : upcoming.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-muted-foreground">
              Nema obveza u sljedećih 7 dana.
            </p>
          ) : (
            upcoming.map((u) => {
              const d = new Date(`${u.date}T00:00:00`);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setOpenId(u.id)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left active:opacity-70"
                >
                  <span className={`size-2 rounded-full ${assigneeStyle(u.members[0] ?? "").dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">
                      {u.members.join(", ") || "Cijela obitelj"}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">{u.title}</p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                    {d.getDate()}. {MONTHS_GEN[d.getMonth()]}
                  </span>
                </button>
              );
            })
          )}
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
