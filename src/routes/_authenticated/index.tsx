import { formatDayMonth, formatTime, formatWeekday } from "@/lib/date-hr";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { assigneeStyle } from "@/lib/family";
import { setEventCompleted, useFamilyEvents, type FamilyEvent } from "@/lib/family-events";
import { useQueryClient } from "@tanstack/react-query";
import { EventDetailSheet } from "@/components/EventDetailSheet";
import { useMyFamilyId, useMyUserId, useFamilyMembers } from "@/lib/family-workspace";
import { greetingFor, tejlaMessage } from "@/lib/tejla-voice";
import { SetupBlock } from "@/components/SetupBlock";
import { ReminderBadge } from "@/components/ReminderBadge";
import { useFamilyReminders } from "@/lib/reminders";
import { AllTasksSheet } from "@/components/AllTasksSheet";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Danas — Tejla" },
      {
        name: "description",
        content: "Sve što te čeka danas — termini, obveze i rokovi na jednom mjestu.",
      },
      { property: "og:title", content: "Danas — Tejla" },
      {
        property: "og:description",
        content: "Sve što te čeka, na jednom mjestu.",
      },
    ],
  }),
  component: Danas,
});


const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const capitalizeFirst = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function Danas() {
  // Deep link from an assignment push: /?zadatak=<event id>. This subtree is
  // client-only, so reading the URL directly is safe.
  const [openId, setOpenId] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("zadatak"),
  );
  const [tasksOpen, setTasksOpen] = useState(false);
  const { data: familyId } = useMyFamilyId();
  const { data: myUserId } = useMyUserId();
  const { data: members = [] } = useFamilyMembers(familyId);
  const { data: events, isPending } = useFamilyEvents(familyId);
  const { data: reminderMap = {} } = useFamilyReminders(familyId);
  const queryClient = useQueryClient();
  const toggleTask = async (t: FamilyEvent) => {
    await setEventCompleted(t.id, !t.completed);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["family-events", familyId] }),
      queryClient.invalidateQueries({ queryKey: ["family-reminders", familyId] }),
    ]);
  };
  const titleOf = (id: string) =>
    (events ?? []).find((e) => e.id === id)?.title ?? "povezani događaj";
  const openEvent: FamilyEvent | null = (events ?? []).find((e) => e.id === openId) ?? null;

  const now = new Date();
  const today = isoDay(now);
  // Dovršeni zadaci ostaju vidljivi točno 24 sata od trenutka dovršavanja.
  const completedVisibleUntil = now.getTime() - 24 * 60 * 60 * 1000;
  const isRecentlyCompleted = (t: FamilyEvent) =>
    !!t.completed_at && new Date(t.completed_at).getTime() > completedVisibleUntil;
  const in7 = isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7));
  const allRows = events ?? [];
  // Tasks live in their own section; they must not clutter the calendar lists.
  const all = allRows.filter((e) => e.type !== "task");
  const allTasks = allRows.filter((e) => e.type === "task");
  const tasks = allRows
    .filter((e) => e.type === "task")
    .sort(
      (a, b) =>
        Number(a.completed) - Number(b.completed) ||
        (a.date || "9999").localeCompare(b.date || "9999"),
    )
    .filter((t) => (t.completed ? isRecentlyCompleted(t) : true));
  const todayEvents = all
    .filter((e) => e.date === today)
    .sort((a, b) => a.time.localeCompare(b.time));
  const upcoming = all
    .filter((e) => e.date > today && e.date <= in7)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const undated = all.filter((e) => !e.date);

  const myName = members.find((m) => m.linked_user_id && m.linked_user_id === myUserId)?.name ?? "";
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const nowTime = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  const todayTasks = allTasks.filter((t) => t.date === today || (!t.date && !t.completed));
  const message = tejlaMessage({
    isoDay: today,
    nowTime,
    events: todayEvents.map((e) => ({ time: e.time })),
    tasks: todayTasks.map((t) => ({ completed: t.completed })),
  });
  const calmDay = todayEvents.length + todayTasks.length === 0;

  const dayDiff = (iso: string) =>
    Math.round(
      (new Date(`${iso}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) /
        86_400_000,
    );
  const soon = all
    .filter((e) => {
      const d = e.deadline || e.date;
      if (!d || d <= today) return false;
      const diff = dayDiff(d);
      return diff >= 1 && diff <= 3;
    })
    .sort((a, b) => (a.deadline || a.date).localeCompare(b.deadline || b.date))
    .slice(0, 4);

  const soonLabel = (e: FamilyEvent) => {
    const diff = dayDiff(e.deadline || e.date);
    if (e.deadline && (!e.date || e.deadline <= e.date))
      return diff === 1 ? "Rok sutra" : `Rok za ${diff} dana`;
    return diff === 1 ? "Sutra" : `Za ${diff} dana`;
  };

  return (
    <AppShell>
      <header className="mb-5">
        <p className="text-sm font-medium text-muted-foreground">
          {capitalizeFirst(formatWeekday(now))}, {formatDayMonth(now)}
        </p>
        <h1 className="mt-1 text-[30px] font-bold leading-tight tracking-tight">
          {greetingFor(now, myName)}
        </h1>
        <p className="mt-2 text-[15px] font-medium text-foreground/70">{message.headline}</p>
        {message.sub ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{message.sub}</p>
        ) : null}
      </header>

      <SetupBlock />

      {calmDay && !isPending ? null : (
      <section className="mb-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Danas
        </h2>
        <div className="card-soft divide-y divide-border">
          {isPending ? (
            <p className="px-5 py-6 text-center text-sm text-muted-foreground">Učitavam obveze…</p>
          ) : todayEvents.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-muted-foreground">
              Danas nema obveza.
            </p>
          ) : (
            todayEvents.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setOpenId(e.id)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left active:opacity-70"
              >
                <span className="w-12 text-sm font-semibold tabular-nums text-foreground">
                  {e.time ? formatTime(e.time) : "—"}
                </span>
                <span className={`size-2 rounded-full ${assigneeStyle(e.members[0] ?? "").dot}`} />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold">
                    {e.members.join(", ") || "Cijela obitelj"}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{e.title}</p>
                  <ReminderBadge reminders={reminderMap[e.id]} />
                </div>
              </button>
            ))
          )}
        </div>
      </section>
      )}

      {allTasks.length > 0 ? (
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Zadaci
            </h2>
            <button
              type="button"
              onClick={() => setTasksOpen(true)}
              className="text-xs font-semibold text-accent-foreground"
            >
              Svi zadaci
            </button>
          </div>
          <div className="card-soft divide-y divide-border">
            {tasks.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-muted-foreground">
                Nema aktivnih zadataka za danas.
              </p>
            ) : null}
            {tasks.map((t) => (
              <div key={`task-${t.id}`} className="flex items-center gap-3 px-5 py-4">
                <button
                  type="button"
                  aria-label={t.completed ? "Označi kao nedovršeno" : "Označi kao riješeno"}
                  aria-pressed={t.completed}
                  onClick={() => void toggleTask(t)}
                  className={`flex size-7 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                    t.completed ? "border-primary bg-primary" : "border-border bg-background"
                  }`}
                >
                  {t.completed ? <Check className="size-4 text-primary-foreground" /> : null}
                </button>
                <button
                  type="button"
                  onClick={() => setOpenId(t.id)}
                  className="min-w-0 flex-1 text-left active:opacity-70"
                >
                  <p
                    className={`truncate text-[15px] font-semibold ${t.completed ? "text-muted-foreground line-through" : ""}`}
                  >
                    {t.title || "Bez naziva"}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[t.members.join(", "), t.linked_event_id ? `uz ${titleOf(t.linked_event_id)}` : ""]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {t.completed ? null : <ReminderBadge reminders={reminderMap[t.id]} />}
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {soon.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Uskoro
          </h2>
          <div className="card-soft divide-y divide-border">
            {soon.map((e) => (
              <button
                key={`soon-${e.id}`}
                type="button"
                onClick={() => setOpenId(e.id)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left active:opacity-70"
              >
                <span className="w-24 shrink-0 text-xs font-semibold text-muted-foreground">
                  {soonLabel(e)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">
                    {[e.members.join(", "), e.title].filter(Boolean).join(" · ")}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[e.category, e.time ? formatTime(e.time) : "", e.amount].filter(Boolean).join(" · ")}
                  </p>
                  <ReminderBadge reminders={reminderMap[e.id]} />
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {undated.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Bez datuma
          </h2>
          <div className="card-soft divide-y divide-border">
            {undated.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setOpenId(c.id)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left active:opacity-70"
              >
                <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                  {c.time ? formatTime(c.time) : "—"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{c.title || "Bez naziva"}</p>
                  <p className="truncate text-sm text-muted-foreground">{c.notes}</p>
                  <ReminderBadge reminders={reminderMap[c.id]} />
                </div>
                {c.members.length > 0 ? (
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${assigneeStyle(c.members[0] ?? "").chip}`}
                  >
                    {c.members.join(", ")}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </section>
      ) : null}


      {openEvent ? <EventDetailSheet event={openEvent} onClose={() => setOpenId(null)} /> : null}
      {tasksOpen ? (
        <AllTasksSheet
          tasks={allTasks}
          reminderMap={reminderMap}
          familyId={familyId}
          onOpenTask={(id) => {
            setTasksOpen(false);
            setOpenId(id);
          }}
          onClose={() => setTasksOpen(false)}
        />
      ) : null}
    </AppShell>
  );
}
