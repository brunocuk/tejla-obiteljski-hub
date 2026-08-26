/**
 * Croatian calendar exceptions for recurring series (Phase 6, UI + AI layer).
 *
 * The only exception rules that exist are the three codes below; they are the
 * exact whitelist the database CHECK constraint on
 * `family_events.recurrence_exclude` accepts and the only ones
 * `is_excluded_hr()` knows how to resolve. Everything else stays free text in
 * `exception_note`, so Tejla never has to invent concrete dates.
 *
 * This module has no imports on purpose: it runs in the browser, in the server
 * route that sanitizes the model output, and in tests.
 */

export const RECURRENCE_EXCLUDE_CODES = [
  "school_breaks_hr",
  "public_holidays_hr",
  "weekends",
] as const;

export type RecurrenceExcludeCode = (typeof RECURRENCE_EXCLUDE_CODES)[number];

/** Short chip label shown on a recurring card. */
export const EXCLUDE_LABELS: Record<RecurrenceExcludeCode, string> = {
  school_breaks_hr: "Bez školskih praznika",
  public_holidays_hr: "Bez blagdana",
  weekends: "Bez vikenda",
};

/** Toggle labels in the repeat editor. */
export const EXCLUDE_TOGGLE_LABELS: Record<RecurrenceExcludeCode, string> = {
  school_breaks_hr: "Preskoči školske odmore",
  public_holidays_hr: "Preskoči blagdane",
  weekends: "Preskoči vikende",
};

/**
 * Whitelist + dedupe + canonical order. Anything unknown is dropped, which is
 * what keeps a hallucinated rule from ever reaching the database.
 */
export function sanitizeExcludeCodes(raw: unknown): RecurrenceExcludeCode[] {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  for (const v of list) seen.add(String(v).trim().toLowerCase());
  return RECURRENCE_EXCLUDE_CODES.filter((c) => seen.has(c));
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(/[čć]/g, "c")
    .replace(/đ/g, "d")
    .replace(/š/g, "s")
    .replace(/ž/g, "z");

type Rule = {
  re: RegExp;
  codes: RecurrenceExcludeCode[];
  /** Weekly Mon–Fri rule instead of an exclusion ("svaki radni dan"). */
  workdays?: boolean;
};

// Order matters: "školskih praznika" must win over the generic "praznik",
// and "neradnih dana" must win over "radni dan".
const RULES: Rule[] = [
  { re: /skolsk\w*\s+(praznik\w*|odmor\w*|raspust\w*)/, codes: ["school_breaks_hr"] },
  { re: /(praznik\w*|odmor\w*|raspust\w*)\s+u\s+skol\w*/, codes: ["school_breaks_hr"] },
  { re: /kad\w*\s+nema\s+(skole|nastave)/, codes: ["school_breaks_hr"] },
  { re: /nema\s+(skole|nastave)/, codes: ["school_breaks_hr"] },
  { re: /nerad\w*\s+dan\w*/, codes: ["public_holidays_hr", "weekends"] },
  { re: /blagdan\w*/, codes: ["public_holidays_hr"] },
  { re: /praznik\w*\s+ne\s+rad\w*/, codes: ["public_holidays_hr"] },
  { re: /drzavn\w*\s+praznik\w*/, codes: ["public_holidays_hr"] },
  { re: /vikend\w*/, codes: ["weekends"] },
  { re: /radn\w*\s+dan\w*/, codes: [], workdays: true },
  { re: /radnim\s+danima/, codes: [], workdays: true },
];

export type ExceptionMapping = {
  /** Whitelisted exclusion codes recognized in the text. */
  exclude: RecurrenceExcludeCode[];
  /** Whatever could NOT be mapped, kept verbatim as the fallback note. */
  note: string;
  /** True when the text asks for a working-day rule ("svaki radni dan"). */
  workdays: boolean;
};

/**
 * Maps a free-text Croatian exception onto the whitelist. Unmapped remainders
 * stay in `note` so the user still sees what Tejla read.
 */
export function mapExceptionText(text: string): ExceptionMapping {
  const original = String(text ?? "").trim();
  if (!original) return { exclude: [], note: "", workdays: false };

  let rest = fold(original);
  const codes: RecurrenceExcludeCode[] = [];
  let workdays = false;
  let matched = false;

  for (const rule of RULES) {
    const hit = rest.match(rule.re);
    if (!hit) continue;
    matched = true;
    if (rule.workdays) workdays = true;
    codes.push(...rule.codes);
    rest = rest.replace(rule.re, " ");
  }

  if (!matched) return { exclude: [], note: original, workdays: false };

  // Leftover connective words are noise, not a second exception.
  const leftover = rest
    .replace(/\b(osim|kada|kad|za|vrijeme|vrijeme|te|i|ni|niti|u|na|se|su|je|dana|dan|svaki|svakog)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  return {
    exclude: sanitizeExcludeCodes(codes),
    note: leftover.length > 3 ? original : "",
    workdays,
  };
}
