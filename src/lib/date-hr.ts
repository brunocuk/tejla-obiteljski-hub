const MONTHS_GEN = [
  "siječnja",
  "veljače",
  "ožujka",
  "travnja",
  "svibnja",
  "lipnja",
  "srpnja",
  "kolovoza",
  "rujna",
  "listopada",
  "studenoga",
  "prosinca",
];

/** "2026-09-01" -> "1. rujna 2026." Non-ISO input is returned unchanged. */
export function formatCroatianDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso ?? "").trim());
  if (!m) return iso ?? "";
  const month = MONTHS_GEN[Number(m[2]) - 1];
  if (!month) return iso;
  return `${Number(m[3])}. ${month} ${m[1]}.`;
}

export const isIsoDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test((v ?? "").trim());
