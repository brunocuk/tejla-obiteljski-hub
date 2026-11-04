import { Link } from "@tanstack/react-router";
import { LEGAL_INTRO, LEGAL_VERSION, type LegalSection } from "@/lib/legal";

type LegalPageProps = {
  title: string;
  sections: LegalSection[];
  otherLabel: string;
  otherTo: string;
};

export function LegalPage({ title, sections, otherLabel, otherTo }: LegalPageProps) {
  return (
    <main className="mx-auto w-full max-w-2xl bg-background px-5 py-10">
      <p className="text-sm font-semibold text-muted-foreground">Tejla</p>
      <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight text-foreground">
        {title}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Zatvorena, besplatna beta · Verzija {LEGAL_VERSION}
      </p>
      <p className="mt-4 text-sm text-muted-foreground">{LEGAL_INTRO}</p>

      <div className="mt-8 space-y-6">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-base font-bold text-foreground">{section.title}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-foreground/90">{section.body}</p>
          </section>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-6 text-sm font-semibold">
        <Link to={otherTo} className="text-primary underline underline-offset-4">
          {otherLabel}
        </Link>
        <Link to="/auth" className="text-muted-foreground underline underline-offset-4">
          Natrag na prijavu
        </Link>
      </div>
    </main>
  );
}
