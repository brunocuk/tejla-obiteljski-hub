import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, FileText, Image, Keyboard, Plus, ClipboardPaste } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/inbox")({
  head: () => ({
    meta: [
      { title: "Inbox — Family Hub" },
      {
        name: "description",
        content:
          "Pošalji fotografiju, screenshot, PDF ili tekst i AI izdvaja obiteljske obveze i termine.",
      },
      { property: "og:title", content: "Inbox — Family Hub" },
      {
        property: "og:description",
        content: "Pošalji nam bilo što — AI pronalazi ono što je važno za tvoju obitelj.",
      },
    ],
  }),
  component: InboxPage,
});

const options = [
  { icon: Camera, label: "Fotografiraj", hint: "Slikaj papir ili obavijest" },
  { icon: Image, label: "Screenshot / galerija", hint: "Odaberi iz galerije" },
  { icon: FileText, label: "PDF dokument", hint: "Obavijesti i suglasnosti" },
  { icon: ClipboardPaste, label: "Zalijepi tekst", hint: "Email ili poruka" },
  { icon: Keyboard, label: "Ručno dodaj", hint: "Upiši sam" },
];

function InboxPage() {
  return (
    <AppShell>
      <PageHeader title="Inbox" subtitle="Pošalji nam bilo što. AI će pronaći ono što je važno za tvoju obitelj." />

      <Link
        to="/analiza"
        className="flex w-full items-center justify-center gap-2 rounded-3xl px-6 py-6 text-lg font-bold text-primary-foreground"
        style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-float)" }}
      >
        <Plus className="size-6" strokeWidth={2.4} />
        Dodaj
      </Link>

      <ul className="mt-7 space-y-3">
        {options.map(({ icon: Icon, label, hint }) => (
          <li key={label}>
            <Link
              to="/analiza"
              className="card-soft flex items-center gap-4 px-4 py-4 transition-opacity active:opacity-70"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-accent-foreground">
                <Icon className="size-5" strokeWidth={1.8} />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold">{label}</span>
                <span className="block text-sm text-muted-foreground">{hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}