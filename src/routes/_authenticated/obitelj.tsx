import { createFileRoute } from "@tanstack/react-router";
import { Check, UserPlus } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { memberStyles, type MemberName } from "@/lib/family";

export const Route = createFileRoute("/_authenticated/obitelj")({
  head: () => ({
    meta: [
      { title: "Obitelj — Family Hub" },
      {
        name: "description",
        content:
          "Članovi obitelji na zajedničkom prostoru: Mama i Tata dijele isti obiteljski kalendar i obveze.",
      },
      { property: "og:title", content: "Obitelj — Family Hub" },
      {
        property: "og:description",
        content: "Zajednički obiteljski prostor za oba roditelja i troje djece.",
      },
    ],
  }),
  component: ObiteljPage,
});

const parents: { name: MemberName; role: string }[] = [
  { name: "Mama", role: "Roditelj · administrator" },
  { name: "Tata", role: "Roditelj · administrator" },
];

const kids: { name: MemberName; role: string }[] = [
  { name: "Lara", role: "5. razred · OŠ Trnsko" },
  { name: "Lucija", role: "3. razred · OŠ Trnsko" },
  { name: "Korina", role: "Vrtić · Sunce" },
];

function Row({ name, role }: { name: MemberName; role: string }) {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <span
        className={`flex size-11 items-center justify-center rounded-full text-sm font-bold ${memberStyles[name].chip}`}
      >
        {memberStyles[name].initials}
      </span>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold">{name}</p>
        <p className="truncate text-sm text-muted-foreground">{role}</p>
      </div>
    </div>
  );
}

function ObiteljPage() {
  return (
    <AppShell>
      <PageHeader title="Obitelj" subtitle="Obitelj Horvat · zajednički prostor" />

      <div className="mb-6 flex items-start gap-3 rounded-2xl bg-primary-soft px-4 py-4">
        <Check className="mt-0.5 size-5 shrink-0 text-accent-foreground" strokeWidth={2.2} />
        <p className="text-sm font-medium text-accent-foreground">
          Mama i Tata dijele isti obiteljski prostor — sve obveze, termini i zadaci vidljivi su
          objema stranama u stvarnom vremenu.
        </p>
      </div>

      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Roditelji
      </h2>
      <div className="card-soft divide-y divide-border">
        {parents.map((p) => (
          <Row key={p.name} {...p} />
        ))}
      </div>

      <h2 className="mb-3 mt-7 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Djeca
      </h2>
      <div className="card-soft divide-y divide-border">
        {kids.map((k) => (
          <Row key={k.name} {...k} />
        ))}
      </div>

      <button
        type="button"
        className="mt-7 flex w-full items-center justify-center gap-2 rounded-3xl px-6 py-4 text-base font-bold text-primary-foreground"
        style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-float)" }}
      >
        <UserPlus className="size-5" strokeWidth={2} />
        Pozovi roditelja
      </button>
    </AppShell>
  );
}