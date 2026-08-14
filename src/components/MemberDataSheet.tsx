import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCroatianDate } from "@/lib/date-hr";
import {
  purgeMemberData,
  useMemberDataCounts,
  type PurgeScope,
} from "@/lib/member-data";
import type { FamilyMemberRow } from "@/lib/family-workspace";

type Filter = "all" | "tasks" | "events";

const SCOPES: { scope: PurgeScope; label: string }[] = [
  { scope: "tasks", label: "Izbriši sve zadatke" },
  { scope: "events", label: "Izbriši sve događaje" },
  { scope: "reminders", label: "Izbriši sve podsjetnike" },
];

function useMemberItems(memberId: string, filter: Filter) {
  return useQuery({
    queryKey: ["member-items", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_members")
        .select("family_events(id, title, type, date, time, completed)")
        .eq("family_member_id", memberId);
      if (error) throw error;
      return (data ?? [])
        .map((r) => (r as { family_events: unknown }).family_events)
        .filter(Boolean) as {
        id: string;
        title: string;
        type: string;
        date: string | null;
        time: string | null;
        completed: boolean;
      }[];
    },
    select: (rows) =>
      filter === "all"
        ? rows
        : rows.filter((r) => (filter === "tasks" ? r.type === "task" : r.type !== "task")),
  });
}

export function MemberDataSheet({
  member,
  onClose,
}: {
  member: FamilyMemberRow;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const name = member.name?.trim() || "ovaj član";
  const { data: counts } = useMemberDataCounts(member.id);
  const [filter, setFilter] = useState<Filter>("all");
  const { data: items = [] } = useMemberItems(member.id, filter);
  const [confirm, setConfirm] = useState<PurgeScope | null>(null);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const confirmText = useMemo(() => {
    if (confirm === "all") {
      return `Ovo će trajno izbrisati sve podatke za ${name}. ${name} će ostati član obitelji.`;
    }
    if (confirm === "tasks") return `Ovo će trajno izbrisati sve zadatke za ${name}.`;
    if (confirm === "events") return `Ovo će trajno izbrisati sve događaje za ${name}.`;
    if (confirm === "reminders") return `Ovo će trajno izbrisati sve podsjetnike za ${name}.`;
    return "";
  }, [confirm, name]);

  async function run() {
    if (!confirm) return;
    if (confirm === "all" && !ack) return;
    setBusy(true);
    setError("");
    try {
      const res = await purgeMemberData(member.id, confirm);
      setInfo(
        `Izbrisano: ${res.deleted_events} obveza, ${res.deleted_reminders} podsjetnika.` +
          (res.unlinked_events > 0
            ? ` ${res.unlinked_events} zajedničkih obveza zadržano (uklonjena samo veza).`
            : ""),
      );
      setConfirm(null);
      setAck(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["member-data-counts", member.id] }),
        queryClient.invalidateQueries({ queryKey: ["member-items", member.id] }),
        queryClient.invalidateQueries({ queryKey: ["family-events"] }),
        queryClient.invalidateQueries({ queryKey: ["event-reminders"] }),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Brisanje nije uspjelo. Pokušaj ponovno.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30">
      <div className="max-h-[88vh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-3xl bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">Upravljanje podacima</h2>
          <button
            type="button"
            aria-label="Zatvori"
            onClick={onClose}
            className="rounded-xl p-1 text-muted-foreground active:opacity-60"
          >
            <X className="size-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          Podaci za <span className="font-semibold text-foreground">{name}</span>. Brisanje je
          nepovratno. Član obitelji i njegov račun ostaju.
        </p>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Zadaci", value: counts?.tasks ?? 0 },
            { label: "Događaji", value: counts?.events ?? 0 },
            { label: "Podsjetnici", value: counts?.reminders ?? 0 },
          ].map((c) => (
            <div key={c.label} className="rounded-2xl bg-primary-soft px-3 py-3 text-center">
              <p className="text-lg font-bold text-accent-foreground">{c.value}</p>
              <p className="text-xs font-semibold text-accent-foreground">{c.label}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          {(
            [
              { value: "all", label: "Sve" },
              { value: "tasks", label: "Zadaci" },
              { value: "events", label: "Događaji" },
            ] as const
          ).map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`flex-1 rounded-2xl border px-3 py-2 text-sm font-semibold ${
                filter === f.value
                  ? "border-primary bg-primary-soft text-accent-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="max-h-48 space-y-2 overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nema zapisa za ovaj filter.</p>
          ) : (
            items.map((it) => (
              <div key={it.id} className="rounded-2xl border border-border px-4 py-3">
                <p className="text-sm font-semibold">{it.title}</p>
                <p className="text-xs text-muted-foreground">
                  {it.type === "task" ? "Zadatak" : "Događaj"}
                  {it.date ? ` · ${formatCroatianDate(it.date)}` : ""}
                  {it.time ? ` · ${it.time.slice(0, 5)}` : ""}
                </p>
              </div>
            ))
          )}
        </div>

        {info ? <p className="text-sm font-semibold text-accent-foreground">{info}</p> : null}
        {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

        {confirm ? (
          <div className="space-y-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" strokeWidth={2.2} />
              <p className="text-sm font-semibold text-destructive">{confirmText}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Zajedničke obveze s drugim članovima neće biti izbrisane — uklonit će se samo veza s
              osobom {name}. Ova radnja je nepovratna.
            </p>
            {confirm === "all" ? (
              <label className="flex items-start gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                  className="mt-0.5 size-5 accent-[var(--color-primary)]"
                />
                Razumijem da je brisanje nepovratno.
              </label>
            ) : null}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirm(null);
                  setAck(false);
                }}
                className="flex-1 rounded-3xl border border-border px-4 py-3 text-sm font-semibold text-muted-foreground"
              >
                Odustani
              </button>
              <button
                type="button"
                onClick={run}
                disabled={busy || (confirm === "all" && !ack)}
                className="flex-1 rounded-3xl bg-destructive px-4 py-3 text-sm font-bold text-destructive-foreground disabled:opacity-50"
              >
                {busy ? "Brišem…" : "Da, izbriši"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {SCOPES.map((s) => (
              <button
                key={s.scope}
                type="button"
                onClick={() => {
                  setInfo("");
                  setError("");
                  setConfirm(s.scope);
                }}
                className="flex w-full items-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm font-semibold text-muted-foreground"
              >
                <Trash2 className="size-4" strokeWidth={2.2} />
                {s.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setInfo("");
                setError("");
                setConfirm("all");
              }}
              className="flex w-full items-center justify-center gap-2 rounded-3xl bg-destructive px-4 py-4 text-base font-bold text-destructive-foreground"
            >
              <Trash2 className="size-5" strokeWidth={2} />
              Izbriši sve podatke ovog člana
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
