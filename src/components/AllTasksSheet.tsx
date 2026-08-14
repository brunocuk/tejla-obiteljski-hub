import { useState } from "react";
import { Check, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { setEventCompleted, type FamilyEvent } from "@/lib/family-events";
import { formatCroatianDate } from "@/lib/date-hr";
import { ReminderBadge } from "@/components/ReminderBadge";
import type { ReminderRow } from "@/lib/reminders";

type Filter = "active" | "done" | "all";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "active", label: "Aktivni" },
  { id: "done", label: "Riješeni" },
  { id: "all", label: "Svi" },
];

/** Full task list with simple filters. Events and the calendar stay untouched. */
export function AllTasksSheet({
  tasks,
  reminderMap,
  familyId,
  onOpenTask,
  onClose,
}: {
  tasks: FamilyEvent[];
  reminderMap: Record<string, ReminderRow[]>;
  familyId: string | null | undefined;
  onOpenTask: (id: string) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("active");
  const queryClient = useQueryClient();

  const toggle = async (t: FamilyEvent) => {
    await setEventCompleted(t.id, !t.completed);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["family-events", familyId] }),
      queryClient.invalidateQueries({ queryKey: ["family-reminders", familyId] }),
    ]);
  };

  const list = tasks
    .filter((t) => (filter === "all" ? true : filter === "done" ? t.completed : !t.completed))
    .sort(
      (a, b) =>
        Number(a.completed) - Number(b.completed) ||
        (a.date || a.deadline || "9999").localeCompare(b.date || b.deadline || "9999"),
    );

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-foreground/30" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-background pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <h2 className="text-lg font-bold">Svi zadaci</h2>
          <button
            type="button"
            aria-label="Zatvori"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex gap-2 px-5 pb-4">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                filter === f.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="divide-y divide-border border-t border-border">
          {list.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nema zadataka.</p>
          ) : (
            list.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-4">
                <button
                  type="button"
                  aria-label={t.completed ? "Označi kao nedovršeno" : "Označi kao riješeno"}
                  aria-pressed={t.completed}
                  onClick={() => void toggle(t)}
                  className={`flex size-7 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                    t.completed ? "border-primary bg-primary" : "border-border bg-background"
                  }`}
                >
                  {t.completed ? <Check className="size-4 text-primary-foreground" /> : null}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenTask(t.id)}
                  className="min-w-0 flex-1 text-left active:opacity-70"
                >
                  <p
                    className={`truncate text-[15px] font-semibold ${
                      t.completed ? "text-muted-foreground line-through" : ""
                    }`}
                  >
                    {t.title || "Bez naziva"}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[
                      t.members.join(", ") || "Cijela obitelj",
                      t.date ? formatCroatianDate(t.date) : "",
                      t.deadline ? `rok ${formatCroatianDate(t.deadline)}` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {t.completed ? null : <ReminderBadge reminders={reminderMap[t.id]} />}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}