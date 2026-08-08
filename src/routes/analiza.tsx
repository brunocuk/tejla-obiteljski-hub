import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { memberStyles, type MemberName } from "@/lib/family";

export const Route = createFileRoute("/analiza")({
  head: () => ({
    meta: [
      { title: "AI analiza — Family Hub" },
      {
        name: "description",
        content:
          "AI je iz screenshota školskog sustava izdvojio ispite, lektiru i izlet s datumima i podsjetnicima.",
      },
      { property: "og:title", content: "AI analiza — Family Hub" },
      {
        property: "og:description",
        content: "Pregledaj što je AI pronašao i dodaj sve u obiteljski kalendar.",
      },
    ],
  }),
  component: AnalizaPage,
});

const found: { id: string; who: MemberName; subject: string; type: string; date: string; note?: string }[] = [
  { id: "1", who: "Lara", subject: "Matematika", type: "pisana provjera", date: "14. rujna" },
  { id: "2", who: "Lara", subject: "Priroda", type: "ispit", date: "17. rujna" },
  { id: "3", who: "Lucija", subject: "Hrvatski", type: "lektira", date: "18. rujna" },
  {
    id: "4",
    who: "Korina",
    subject: "Izlet",
    type: "izlet",
    date: "22. rujna",
    note: "Ponijeti 12 €, bocu vode i kapu",
  },
];

function AnalizaPage() {
  const [selected, setSelected] = useState<string[]>(found.map((f) => f.id));
  const [added, setAdded] = useState(false);

  return (
    <AppShell>
      <PageHeader title="AI analiza" subtitle="Screenshot iz e-Dnevnika · obrađeno prije 1 min" />

      <div className="mb-6 flex items-center gap-3 rounded-2xl bg-primary-soft px-4 py-3">
        <Sparkles className="size-5 shrink-0 text-accent-foreground" strokeWidth={1.8} />
        <p className="text-sm font-medium text-accent-foreground">
          Pronašli smo 4 obveze za tvoju obitelj.
        </p>
      </div>

      <ul className="space-y-3">
        {found.map((f) => {
          const checked = selected.includes(f.id);
          return (
            <li key={f.id}>
              <button
                type="button"
                onClick={() =>
                  setSelected((s) => (s.includes(f.id) ? s.filter((x) => x !== f.id) : [...s, f.id]))
                }
                className={`card-soft flex w-full items-start gap-3 px-4 py-4 text-left transition-all ${
                  checked ? "ring-1 ring-primary/40" : "opacity-70"
                }`}
              >
                <span
                  className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                    checked ? "border-primary bg-primary" : "border-border bg-background"
                  }`}
                >
                  {checked ? <Check className="size-3.5 text-primary-foreground" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${memberStyles[f.who].chip}`}
                    >
                      {f.who}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">{f.date}</span>
                  </span>
                  <span className="mt-2 block text-[15px] font-semibold">
                    {f.subject} — {f.type}
                  </span>
                  {f.note ? (
                    <span className="mt-1 block text-sm text-muted-foreground">{f.note}</span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="fixed inset-x-0 bottom-[84px] z-10 mx-auto max-w-md px-5">
        <button
          type="button"
          onClick={() => setAdded(true)}
          disabled={selected.length === 0}
          className="w-full rounded-3xl px-6 py-4 text-base font-bold text-primary-foreground disabled:opacity-40"
          style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-float)" }}
        >
          {added ? "Dodano u kalendar ✓" : `Dodaj sve (${selected.length})`}
        </button>
      </div>
    </AppShell>
  );
}