import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, LogOut, Plus, UserPlus } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { memberStyles, type MemberName } from "@/lib/family";
import {
  addFamilyMember,
  useFamilyMembers,
  useMyFamilyId,
  type FamilyMemberRow,
} from "@/lib/family-workspace";

export const Route = createFileRoute("/_authenticated/obitelj")({
  head: () => ({
    meta: [
      { title: "Obitelj — Family Hub" },
      {
        name: "description",
        content:
          "Članovi obitelji na zajedničkom prostoru: Mama i Tata dijele isti obiteljski kalendar i obveze.",
      },
      { property: "og:title", content: "Obitelj — Family Hub" },
      {
        property: "og:description",
        content: "Zajednički obiteljski prostor za oba roditelja i troje djece.",
      },
    ],
  }),
  component: ObiteljPage,
});

function styleFor(name: string) {
  const known = (Object.keys(memberStyles) as MemberName[]).find(
    (m) => m.toLowerCase() === name.trim().toLowerCase(),
  );
  if (known) return memberStyles[known];
  return {
    chip: "bg-primary-soft text-accent-foreground",
    initials: name.trim().slice(0, 2).toUpperCase() || "?",
    dot: "bg-primary",
  };
}

function Row({ name, role }: { name: string; role: string }) {
  const style = styleFor(name);
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <span
        className={`flex size-11 items-center justify-center rounded-full text-sm font-bold ${style.chip}`}
      >
        {style.initials}
      </span>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold">{name}</p>
        <p className="truncate text-sm text-muted-foreground">{role}</p>
      </div>
    </div>
  );
}

function ObiteljPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: familyId } = useMyFamilyId();
  const { data: members = [], isLoading } = useFamilyMembers(familyId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [memberType, setMemberType] = useState<"parent" | "child">("child");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const parents = members.filter((m: FamilyMemberRow) => m.member_type === "parent");
  const kids = members.filter((m: FamilyMemberRow) => m.member_type === "child");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!familyId) return;
    if (!name.trim()) {
      setError("Unesi ime člana.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await addFamilyMember(familyId, name.trim(), memberType);
      await queryClient.invalidateQueries({ queryKey: ["family-members", familyId] });
      setName("");
      setMemberType("child");
      setOpen(false);
    } catch {
      setError("Dodavanje nije uspjelo. Pokušaj ponovno.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <AppShell>
      <PageHeader title="Obitelj" subtitle="Obitelj Horvat · zajednički prostor" />

      <div className="mb-6 flex items-start gap-3 rounded-2xl bg-primary-soft px-4 py-4">
        <Check className="mt-0.5 size-5 shrink-0 text-accent-foreground" strokeWidth={2.2} />
        <p className="text-sm font-medium text-accent-foreground">
          Mama i Tata dijele isti obiteljski prostor — sve obveze, termini i zadaci vidljivi su
          objema stranama u stvarnom vremenu.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Učitavanje članova…</p>
      ) : (
        <>
          {parents.length > 0 && (
            <>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Roditelji
              </h2>
              <div className="card-soft divide-y divide-border">
                {parents.map((p) => (
                  <Row
                    key={p.id}
                    name={p.name}
                    role={p.linked_user_id ? "Roditelj · ima račun" : "Roditelj"}
                  />
                ))}
              </div>
            </>
          )}

          {kids.length > 0 && (
            <>
              <h2 className="mb-3 mt-7 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Djeca
              </h2>
              <div className="card-soft divide-y divide-border">
                {kids.map((k) => (
                  <Row key={k.id} name={k.name} role="Dijete" />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {open ? (
        <form onSubmit={handleAdd} className="card-soft mt-6 space-y-4 p-5">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Ime
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Lara"
              className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-[15px] outline-none focus:border-primary"
            />
          </label>
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Vrsta člana
            </span>
            <div className="mt-2 flex gap-2">
              {(
                [
                  { value: "parent", label: "Roditelj" },
                  { value: "child", label: "Dijete" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMemberType(opt.value)}
                  className={`flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                    memberType === opt.value
                      ? "border-primary bg-primary-soft text-accent-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-3xl border border-border px-4 py-3 text-sm font-semibold text-muted-foreground"
            >
              Odustani
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-3xl px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
              style={{ backgroundImage: "var(--gradient-primary)" }}
            >
              {saving ? "Spremam…" : "Spremi"}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-3xl border border-border px-6 py-3 text-sm font-semibold text-accent-foreground"
        >
          <Plus className="size-4" strokeWidth={2.2} />
          Dodaj člana
        </button>
      )}

      <button
        type="button"
        className="mt-7 flex w-full items-center justify-center gap-2 rounded-3xl px-6 py-4 text-base font-bold text-primary-foreground"
        style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-float)" }}
      >
        <UserPlus className="size-5" strokeWidth={2} />
        Pozovi roditelja
      </button>

      <button
        type="button"
        onClick={handleSignOut}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-3xl border border-border px-6 py-3 text-sm font-semibold text-muted-foreground"
      >
        <LogOut className="size-4" strokeWidth={2} />
        Odjavi se
      </button>
    </AppShell>
  );
}