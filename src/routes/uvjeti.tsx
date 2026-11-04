import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { TERMS_SECTIONS, TERMS_TITLE } from "@/lib/legal";

export const Route = createFileRoute("/uvjeti")({
  head: () => ({
    meta: [
      { title: "Uvjeti korištenja · Tejla" },
      {
        name: "description",
        content: "Uvjeti korištenja za zatvoreno testiranje aplikacije Tejla.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage
      title={TERMS_TITLE}
      sections={TERMS_SECTIONS}
      otherLabel="Pravila privatnosti"
      otherTo="/privatnost"
    />
  );
}
