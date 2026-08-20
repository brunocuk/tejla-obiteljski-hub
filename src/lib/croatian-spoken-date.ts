/**
 * Deterministic parser for spoken Croatian dates ("dvadesetog osmog").
 *
 * Only day/month recognition lives here. Nothing in this module touches the
 * database format (YYYY-MM-DD), reminder timestamps or timezone handling — it
 * simply tells the caller which day and month the speaker actually said, or
 * that the phrase is too ambiguous to decide without asking the user.
 */

const deaccent = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();

/** Ordinal stems 1-19 plus the tens that also exist as ordinals (20, 30). */
const ORDINAL_STEMS: Record<string, number> = {
  prv: 1,
  drug: 2,
  trec: 3,
  cetvrt: 4,
  pet: 5,
  sest: 6,
  sedm: 7,
  osm: 8,
  devet: 9,
  deset: 10,
  jedanaest: 11,
  dvanaest: 12,
  trinaest: 13,
  cetrnaest: 14,
  petnaest: 15,
  sesnaest: 16,
  sedamnaest: 17,
  osamnaest: 18,
  devetnaest: 19,
  dvadeset: 20,
  trideset: 30,
};

const ORDINAL_SUFFIXES = ["og", "oga", "eg", "ega", "om", "em", "omu", "oj", "im", "i", "a", "e", "u"];

const ORDINALS: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  for (const [stem, value] of Object.entries(ORDINAL_STEMS)) {
    for (const suffix of ORDINAL_SUFFIXES) out[`${stem}${suffix}`] = value;
  }
  return out;
})();

/** Bare cardinal tens open a compound ordinal: "dvadeset (i) prvog" = 21. */
const TENS_CARDINAL: Record<string, number> = { dvadeset: 20, trideset: 30 };

const MONTH_NAMES: Record<string, number> = {
  sijecanj: 1,
  sijecnja: 1,
  veljaca: 2,
  veljace: 2,
  ozujak: 3,
  ozujka: 3,
  travanj: 4,
  travnja: 4,
  svibanj: 5,
  svibnja: 5,
  lipanj: 6,
  lipnja: 6,
  srpanj: 7,
  srpnja: 7,
  kolovoz: 8,
  kolovoza: 8,
  rujan: 9,
  rujna: 9,
  listopad: 10,
  listopada: 10,
  studeni: 11,
  studenog: 11,
  studenoga: 11,
  prosinac: 12,
  prosinca: 12,
};

/** Words that may sit inside a spoken date without breaking it apart. */
const FILLERS = new Set(["mjeseca", "mjesec", "dana", "dan", "u", "na"]);

export type SpokenDateResult =
  | { status: "found"; day: number; month: number; expression: string }
  | { status: "ambiguous"; expression: string }
  | { status: "none" };

type NumToken = { value: number; word: string };

/**
 * Reads a spoken Croatian day/month out of free text.
 *
 * Rules applied:
 * - a plain ordinal is its own number ("dvadesetog" = 20, "petnaestog" = 15);
 * - a bare cardinal ten followed by a unit ordinal is a compound ordinal
 *   ("dvadeset osmog" = 28, "trideset i prvog" = 31), with or without "i";
 * - the first number in a run is the day, the second the month;
 * - anything that produces several candidate runs, more than two numbers in a
 *   run, or an out-of-range day/month is reported as ambiguous instead of a
 *   guess.
 */
export function parseSpokenCroatianDate(text: string): SpokenDateResult {
  const words = deaccent(String(text ?? "")).split(/[^a-z0-9]+/).filter(Boolean);
  if (words.length === 0) return { status: "none" };

  const runs: NumToken[][] = [];
  let current: NumToken[] = [];
  let sawStrayTens = false;

  const closeRun = () => {
    if (current.length > 0) runs.push(current);
    current = [];
  };

  for (let i = 0; i < words.length; i += 1) {
    const w = words[i]!;

    // Compound ordinal: tens cardinal (+ optional "i") + unit ordinal.
    const tens = TENS_CARDINAL[w];
    if (tens !== undefined) {
      let j = i + 1;
      if (words[j] === "i") j += 1;
      const next = words[j] ? ORDINALS[words[j]!] : undefined;
      if (next !== undefined && next >= 1 && next <= 9) {
        current.push({ value: tens + next, word: words.slice(i, j + 1).join(" ") });
        i = j;
        continue;
      }
      // A stray "dvadeset" that is not part of a compound: do not guess.
      sawStrayTens = true;
      closeRun();
      continue;
    }

    const ordinal = ORDINALS[w];
    if (ordinal !== undefined) {
      current.push({ value: ordinal, word: w });
      continue;
    }

    const month = MONTH_NAMES[w];
    if (month !== undefined) {
      current.push({ value: month, word: w });
      continue;
    }

    if (FILLERS.has(w) && current.length > 0) continue;

    closeRun();
  }
  closeRun();

  const pairs = runs.filter((r) => r.length === 2);
  const long = runs.filter((r) => r.length > 2);
  const expressionOf = (run: NumToken[]) => run.map((n) => n.word).join(" ");

  if (long.length > 0) return { status: "ambiguous", expression: expressionOf(long[0]!) };
  if (pairs.length > 1) return { status: "ambiguous", expression: expressionOf(pairs[0]!) };
  if (pairs.length === 0) {
    if (sawStrayTens && runs.length > 0) {
      return { status: "ambiguous", expression: expressionOf(runs[0]!) };
    }
    return { status: "none" };
  }

  const [dayTok, monthTok] = pairs[0]! as [NumToken, NumToken];
  const day = dayTok.value;
  const month = monthTok.value;
  const expression = expressionOf(pairs[0]!);
  if (day < 1 || day > 31 || month < 1 || month > 12) return { status: "ambiguous", expression };
  return { status: "found", day, month, expression };
}
