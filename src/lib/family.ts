export type MemberName = "Mama" | "Tata" | "Lara" | "Lucija" | "Korina";

export const memberStyles: Record<MemberName, { dot: string; chip: string; initials: string }> = {
  Mama: { dot: "bg-member-mama", chip: "bg-member-mama/12 text-member-mama", initials: "MA" },
  Tata: { dot: "bg-member-tata", chip: "bg-member-tata/12 text-member-tata", initials: "TA" },
  Lara: { dot: "bg-member-lara", chip: "bg-member-lara/12 text-member-lara", initials: "LA" },
  Lucija: { dot: "bg-member-lucija", chip: "bg-member-lucija/12 text-member-lucija", initials: "LU" },
  Korina: { dot: "bg-member-korina", chip: "bg-member-korina/12 text-member-korina", initials: "KO" },
};

export const WHOLE_FAMILY = "Cijela obitelj";

export type Assignee = MemberName | typeof WHOLE_FAMILY;

export const assigneeOptions: Assignee[] = [
  "Mama",
  "Tata",
  "Lara",
  "Lucija",
  "Korina",
  WHOLE_FAMILY,
];

export function assigneeStyle(a: string): { dot: string; chip: string } {
  if (a in memberStyles) {
    const s = memberStyles[a as MemberName];
    return { dot: s.dot, chip: s.chip };
  }
  return { dot: "bg-primary", chip: "bg-primary-soft text-accent-foreground" };
}

/** Maps a free-text person string from AI output to a known family member, or "" if unclear. */
export function resolveAssignee(raw: string): Assignee | "" {
  const v = raw.trim().toLowerCase();
  if (!v) return "";
  const found = assigneeOptions.find((o) => o.toLowerCase() === v);
  if (found) return found;
  if (/(cijela\s+obitelj|obitelj|svi)/.test(v)) return WHOLE_FAMILY;
  const match = assigneeOptions.filter((o) => o !== WHOLE_FAMILY && v.includes(o.toLowerCase()));
  return match.length === 1 ? match[0]! : "";
}