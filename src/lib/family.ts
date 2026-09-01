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

/**
 * Single source of truth for "who does this imported draft belong to".
 *
 * Explicit member ids win. Older drafts (and current AI output) only carry the
 * legacy single `assignee` string, so those still resolve through the name /
 * WHOLE_FAMILY fallback. Result is always a subset of the allowed member rows.
 */
export function resolveMemberIds(
  item: { assignee_ids?: string[] | undefined; assignee?: string | undefined },
  members: { id: string; name: string }[],
): string[] {
  const allowed = new Set(members.map((m) => m.id));
  const explicit = (item.assignee_ids ?? []).filter((id) => allowed.has(id));
  if (explicit.length > 0) return members.filter((m) => explicit.includes(m.id)).map((m) => m.id);
  const legacy = (item.assignee ?? "").trim();
  if (!legacy) return [];
  if (legacy === WHOLE_FAMILY) return members.map((m) => m.id);
  return members
    .filter((m) => m.name.trim().toLowerCase() === legacy.toLowerCase())
    .map((m) => m.id);
}

/** Legacy label kept in sync with an explicit id selection (display + dedupe only). */
export function labelForMemberIds(ids: string[], members: { id: string; name: string }[]): string {
  if (ids.length === 0) return "";
  if (members.length > 0 && ids.length === members.length) return WHOLE_FAMILY;
  const names = members.filter((m) => ids.includes(m.id)).map((m) => m.name);
  return names.join(", ");
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
