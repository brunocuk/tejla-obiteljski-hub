export type MemberName = "Mama" | "Tata" | "Lara" | "Lucija" | "Korina";

export const memberStyles: Record<MemberName, { dot: string; chip: string; initials: string }> = {
  Mama: { dot: "bg-member-mama", chip: "bg-member-mama/12 text-member-mama", initials: "MA" },
  Tata: { dot: "bg-member-tata", chip: "bg-member-tata/12 text-member-tata", initials: "TA" },
  Lara: { dot: "bg-member-lara", chip: "bg-member-lara/12 text-member-lara", initials: "LA" },
  Lucija: { dot: "bg-member-lucija", chip: "bg-member-lucija/12 text-member-lucija", initials: "LU" },
  Korina: { dot: "bg-member-korina", chip: "bg-member-korina/12 text-member-korina", initials: "KO" },
};

export function MemberChip({ name }: { name: MemberName }) {
  return null;
}