import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, Check, Sparkles } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { assigneeOptions } from "@/lib/family";
import { addConfirmed, useHubStore, type ExtractedItem } from "@/lib/hub-store";

export const Route = createFileRoute("/analiza")({
  head: () => ({
    meta: [
      { title: "AI analiza — Family Hub" },
      {
        name: "description",
        content:
          "AI iz fotografije ili screenshota izdvaja obiteljske obveze — ispite, termine, izlete i uplate.",
      },
      { property: "og:title", content: "AI analiza — Family Hub" },
      {
        property: "og:description",
        content: "Pregledaj i uredi što je AI pronašao, pa dodaj sve u obiteljski kalendar.",
      },
    ],
  }),
  component: AnalizaPage,
});

function AnalizaPage() {
  const { analysis } = useHubStore();
  const [items, setItems] = useState<ExtractedItem[]>(analysis);
  const [selected, setSelected] = useState<number[]>(analysis.map((_, i) => i));
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setItems(analysis);
    setSelected(analysis.map((_, i) => i));
    setAdded(false);
    setError("");
  }, [analysis]);

  const update = (idx: number, field: keyof ExtractedItem, value: string) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));

  const toggle = (idx: number) =>
    setSelected((s) => (s.includes(idx) ? s.filter((x) => x !== idx) : [...s, idx]));

  if (items.length === 0) {
    return (
      <AppShell>
        <PageHeader title="AI analiza" subtitle="Još nema rezultata analize." />
        <div className="card-soft px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Pošalji fotografiju ili screenshot u Inboxu i pokreni analizu.
          </p>
          <Link
            to="/inbox"
            className="mt-5 inline-flex rounded-2xl bg-primary-soft px-4 py-3 text-sm font-semibold text-accent-foreground"
          >
            Otvori Inbox
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="AI analiza" subtitle="Rezultati analize tvoje slike" />

      <div className="mb-6 flex items-center gap-3 rounded-2xl bg-primary-soft px-4 py-3">
        <Sparkles className="size-5 shrink-0 text-accent-foreground" strokeWidth={1.8} />
        <p className="text-sm font-medium text-accent-foreground">
          Pronašli smo {items.length} obveza za tvoju obitelj.
        </p>
      </div>

      <ul className="space-y-3 pb-8">
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
                    {it.category ? (
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground">
                        {it.category}
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
                        it.assignee ? "bg-secondary/60" : "bg-warm text-warm-foreground font-semibold"
                      }`}
                    >
                      <option value="">Odaberi člana obitelji</option>
                      {assigneeOptions.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={it.date}
                      onChange={(e) => update(idx, "date", e.target.value)}
                      placeholder="Datum"
                      className="w-full rounded-xl bg-secondary/60 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/40"
                    />
                    <input
                      value={it.time}
                      onChange={(e) => update(idx, "time", e.target.value)}
                      placeholder="Vrijeme"
                      className="w-full rounded-xl bg-secondary/60 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/40"
                    />
                  </div>
                  <textarea
                    value={it.notes}
                    onChange={(e) => update(idx, "notes", e.target.value)}
                    placeholder="Napomena"
                    rows={2}
                    className="w-full resize-none rounded-xl bg-secondary/60 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/40"
                  />

                  {(it.location || it.amount || it.things_to_bring.length > 0 || it.deadline) ? (
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
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="fixed inset-x-0 bottom-[84px] z-10 mx-auto max-w-md px-5">
        {error ? (
          <p className="mb-2 rounded-2xl bg-warm px-4 py-2.5 text-center text-sm font-semibold text-warm-foreground">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => {
            const chosen = items.filter((_, i) => selected.includes(i));
            if (chosen.some((c) => !c.assignee)) {
              setError("Odaberi kome pripada ova obaveza.");
              return;
            }
            setError("");
            addConfirmed(chosen);
            setAdded(true);
          }}
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
