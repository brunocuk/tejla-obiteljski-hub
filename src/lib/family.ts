export const WHOLE_FAMILY = "Svi";

/** Colour slots defined in styles.css — assigned deterministically per member name. */
const PALETTE = ["mama", "tata", "lara", "lucija", "korina"] as const;

function slotFor(name: string) {
  const key = name.trim().toLowerCase();
  let sum = 0;
  for (let i = 0; i < key.length; i += 1) sum = (sum * 31 + key.charCodeAt(i)) % 100_000;
  return PALETTE[sum % PALETTE.length]!;
}

export function memberStyle(name: string): { dot: string; chip: string; initials: string } {
  const clean = name.trim();
  const initials = clean
    ? clean
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toUpperCase()
    : "?";
  if (!clean || clean === WHOLE_FAMILY) {
    return { dot: "bg-primary", chip: "bg-primary-soft text-accent-foreground", initials };
  }
  const slot = slotFor(clean);
  return {
    dot: `bg-member-${slot}`,
    chip: `bg-member-${slot}/12 text-member-${slot}`,
    initials,
  };
}

export function assigneeStyle(a: string): { dot: string; chip: string } {
  const s = memberStyle(a);
  return { dot: s.dot, chip: s.chip };
}

/** Maps a free-text person string from AI output to one of the known member names. */
export function resolveAssignee(raw: string, names: string[] = []): string {
  const v = raw.trim().toLowerCase();
  if (!v) return "";
  const found = names.find((n) => n.trim().toLowerCase() === v);
  if (found) return found;
  if (/(cijela\s+obitelj|obitelj|svi|svima)/.test(v)) return WHOLE_FAMILY;
  const partial = names.filter((n) => n.trim() && v.includes(n.trim().toLowerCase()));
  return partial.length === 1 ? partial[0]! : "";
}