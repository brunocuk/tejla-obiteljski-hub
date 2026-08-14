/**
 * Local, deterministic copy for the "Danas" screen. No AI, no network:
 * everything is derived from the day's real state and the local clock.
 */

export type TejlaMessage = { headline: string; sub?: string };

export function greetingFor(date: Date, name?: string | null): string {
  const h = date.getHours();
  const base = h >= 5 && h < 12 ? "Dobro jutro" : h >= 12 && h < 18 ? "Dobar dan" : "Dobra večer";
  const clean = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return clean ? `${base}, ${clean}` : base;
}

/** Rotating brand lines — one per day, stable across refreshes. */
const BRAND_LINES = [
  "Tejla pamti. Ti živiš.",
  "Ja pamtim što je važno.",
  "Ti samo reci. Ja ću zapamtiti.",
  "Ne moraš sve držati u glavi.",
  "Što ne želiš pamtiti, daj meni.",
];

/** Stable per-day index: same ISO day always maps to the same line. */
export function brandLineForDay(isoDay: string): string {
  let hash = 0;
  for (let i = 0; i < isoDay.length; i += 1) hash = (hash * 31 + isoDay.charCodeAt(i)) % 100000;
  return BRAND_LINES[hash % BRAND_LINES.length]!;
}

export type DayState = {
  isoDay: string;
  /** Local "HH:MM" right now. */
  nowTime: string;
  /** Today's events (already filtered to type !== "task"). */
  events: { time: string }[];
  /** Today's relevant tasks. */
  tasks: { completed: boolean }[];
};

export function tejlaMessage(state: DayState): TejlaMessage {
  const openTasks = state.tasks.filter((t) => !t.completed);
  const remainingEvents = state.events.filter((e) => !e.time || e.time >= state.nowTime);
  const totalToday = state.events.length + state.tasks.length;
  const openToday = remainingEvents.length + openTasks.length;

  // 1. Everything for today is done.
  if (totalToday > 0 && openToday === 0)
    return { headline: "Za danas je gotovo.", sub: "Ostalo može čekati sutra." };

  // 2. Nothing at all today.
  if (totalToday === 0)
    return { headline: "Danas je mirno.", sub: "Uživaj. Ako se nečega sjetiš, daj meni." };

  // 3. A busy day.
  if (openToday >= 5)
    return { headline: `Danas imaš ${openToday} stvari.`, sub: "Bez brige. Sve ih držim na oku." };

  // 4. Nothing needs attention until the next event.
  const next = remainingEvents
    .filter((e) => e.time && e.time > state.nowTime)
    .map((e) => e.time)
    .sort()[0];
  if (next && openTasks.length === 0)
    return { headline: `Prvo nešto tek u ${next}.`, sub: "Do tada nemaš ništa." };

  // 5. Standard brand line.
  return { headline: brandLineForDay(state.isoDay) };
}
