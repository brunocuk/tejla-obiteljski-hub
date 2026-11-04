import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { PRIVACY_SECTIONS, PRIVACY_TITLE } from "@/lib/legal";

export const Route = createFileRoute("/privatnost")({
  head: () => ({
    meta: [
      { title: "Pravila privatnosti · Tejla" },
      {
        name: "description",
        content: "Pravila privatnosti za zatvoreno testiranje aplikacije Tejla.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage
      title={PRIVACY_TITLE}
      sections={PRIVACY_SECTIONS}
      otherLabel="Uvjeti korištenja"
      otherTo="/uvjeti"
    />
  );
}
