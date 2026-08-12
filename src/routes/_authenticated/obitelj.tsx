import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, LogOut, Pencil, Plus, Shield, UserPlus, X } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { memberStyle } from "@/lib/family";
import { sendFamilyInvite } from "@/lib/invitations.functions";
import { useServerFn } from "@tanstack/react-start";
import {
  addFamilyMember,
  useFamilyMembers,
  useMyFamily,
  useMyFamilyId,
  useMyFamilyRole,
  useMyUserId,
  updateMyDisplayName,
  type FamilyMemberRow,
} from "@/lib/family-workspace";
import {
  VISIBILITY_LABELS,
  saveMemberVisibility,
  useMemberVisibility,
  type VisibilityMode,
} from "@/lib/member-visibility";

export const Route = createFileRoute("/_authenticated/obitelj")({
  head: () => ({
    meta: [
      { title: "Članovi — Family Hub" },
      {
        name: "description",
        content: "Svi članovi zajedničkog prostora: pozovi odrasle i djecu te odredi što tko vidi.",
      },
      { property: "og:title", content: "Članovi — Family Hub" },
      {
        property: "og:description",
        content: "Upravljaj članovima zajedničkog prostora i njihovom vidljivošću.",
      },
    ],
  }),
  component: ClanoviPage,
});

function Row({
  name,
  role,
  onEdit,
  onOpen,
}: {
  name: string;
  role: string;
  onEdit?: (() => void) | undefined;
  onOpen?: (() => void) | undefined;
}) {
  const style = memberStyle(name);
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <span
        className={`flex size-11 items-center justify-center rounded-full text-sm font-bold ${style.chip}`}
      >
        {style.initials}
      </span>
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        className="min-w-0 flex-1 text-left disabled:cursor-default"
      >
        <p className="text-[15px] font-semibold">{name}</p>
        <p className="truncate text-sm text-muted-foreground">{role}</p>
      </button>
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          className="flex shrink-0 items-center gap-1 rounded-2xl border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground"
        >
          <Pencil className="size-3.5" strokeWidth={2.2} />
          Uredi ime
        </button>
      ) : null}
    </div>
  );
}

function ClanoviPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: familyId } = useMyFamilyId();
  const { data: family } = useMyFamily(familyId);
  const { data: myUserId } = useMyUserId();
  const { data: myRole } = useMyFamilyRole();
  const { data: members = [], isLoading } = useFamilyMembers(familyId);
  const { data: visibility = {} } = useMemberVisibility(familyId);
  const invite = useServerFn(sendFamilyInvite);

  const isAdult = myRole === "owner" || myRole === "parent";
  const isOwner = myRole === "owner";

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [memberType, setMemberType] = useState<"parent" | "child">("child");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [inviteFor, setInviteFor] = useState<FamilyMemberRow | "parent" | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteInfo, setInviteInfo] = useState("");
  const [inviting, setInviting] = useState(false);

  const [editingName, setEditingName] = useState<string | null>(null);
  const [nameError, setNameError] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [visibilityFor, setVisibilityFor] = useState<FamilyMemberRow | null>(null);

  const parents = members.filter((m: FamilyMemberRow) => m.member_type === "parent");
  const kids = members.filter((m: FamilyMemberRow) => m.member_type === "child");

  async function handleSaveMyName(e: React.FormEvent) {
    e.preventDefault();
    if (!familyId || editingName === null) return;
    if (!editingName.trim()) {
      setNameError("Unesi svoje ime.");
      return;
    }
    setSavingName(true);
    setNameError("");
    try {
      await updateMyDisplayName(familyId, editingName.trim());
      await queryClient.invalidateQueries({ queryKey: ["family-members", familyId] });
      setEditingName(null);
    } catch {
      setNameError("Spremanje imena nije uspjelo. Pokušaj ponovno.");
    } finally {
      setSavingName(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError("");
    setInviteInfo("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) {
      setInviteError("Unesi ispravnu e-mail adresu.");
      return;
    }
    if (inviting || !inviteFor) return;
    setInviting(true);
    try {
      const child = inviteFor !== "parent";
      await invite({
        data: {
          email: inviteEmail.trim(),
          redirectTo: window.location.origin,
          role: child ? "child" : "parent",
          familyMemberId: child ? inviteFor.id : null,
        },
      });
      setInviteInfo("Poziv je poslan.");
      setInviteEmail("");
      setInviteFor(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setInviteError(message || "Slanje poziva nije uspjelo. Pokušaj ponovno.");
    } finally {
      setInviting(false);
    }
  }

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

  const childRole = (k: FamilyMemberRow) => {
    const mode = (visibility[k.id]?.mode ?? "own_shared") as VisibilityMode;
    const account = k.linked_user_id ? "ima račun" : "bez računa";
    return `Dijete · ${account} · ${VISIBILITY_LABELS[mode]}`;
  };

  return (
    <AppShell>
      <PageHeader
        title="Članovi"
        subtitle={
          family?.name?.trim() ? `${family.name.trim()} · zajednički prostor` : "Zajednički prostor"
        }
      />

      {editingName !== null ? (
        <form onSubmit={handleSaveMyName} className="card-soft mb-6 space-y-4 p-5">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Tvoje ime
            </span>
            <input
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              placeholder="Davor"
              className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-[15px] outline-none focus:border-primary"
            />
          </label>
          {nameError ? <p className="text-sm font-medium text-destructive">{nameError}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setEditingName(null);
                setNameError("");
              }}
              className="flex-1 rounded-3xl border border-border px-4 py-3 text-sm font-semibold text-muted-foreground"
            >
              Odustani
            </button>
            <button
              type="submit"
              disabled={savingName}
              className="flex-1 rounded-3xl px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
              style={{ backgroundImage: "var(--gradient-primary)" }}
            >
              {savingName ? "Spremam…" : "Spremi"}
            </button>
          </div>
        </form>
      ) : null}

      <div className="mb-6 flex items-start gap-3 rounded-2xl bg-primary-soft px-4 py-4">
        <Check className="mt-0.5 size-5 shrink-0 text-accent-foreground" strokeWidth={2.2} />
        <p className="text-sm font-medium text-accent-foreground">
          Odrasli vide sve u prostoru. Djeca vide samo ono što im dopustiš.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Učitavanje članova…</p>
      ) : (
        <>
          {parents.length > 0 && (
            <>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Odrasli
              </h2>
              <div className="card-soft divide-y divide-border">
                {parents.map((p) => (
                  <Row
                    key={p.id}
                    name={p.name?.trim() || "Bez imena"}
                    role={p.linked_user_id ? "Odrasla osoba · ima račun" : "Odrasla osoba"}
                    onEdit={
                      myUserId && p.linked_user_id === myUserId
                        ? () => {
                            setEditingName(p.name ?? "");
                            setNameError("");
                          }
                        : undefined
                    }
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
                  <Row
                    key={k.id}
                    name={k.name?.trim() || "Bez imena"}
                    role={childRole(k)}
                    onOpen={isAdult ? () => setVisibilityFor(k) : undefined}
                    onEdit={
                      myUserId && k.linked_user_id === myUserId
                        ? () => {
                            setEditingName(k.name ?? "");
                            setNameError("");
                          }
                        : undefined
                    }
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {isAdult ? (
        open ? (
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
                    { value: "parent", label: "Odrasla osoba" },
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
        )
      ) : null}

      {isOwner ? (
        <>
          <button
            type="button"
            onClick={() => {
              setInviteFor("parent");
              setInviteEmail("");
              setInviteError("");
              setInviteInfo("");
            }}
            className="mt-7 flex w-full items-center justify-center gap-2 rounded-3xl px-6 py-4 text-base font-bold text-primary-foreground"
            style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-float)" }}
          >
            <UserPlus className="size-5" strokeWidth={2} />
            Pozovi odraslu osobu
          </button>
          {inviteInfo ? (
            <p className="mt-3 text-center text-sm font-semibold text-accent-foreground">
              {inviteInfo}
            </p>
          ) : null}
        </>
      ) : null}

      <button
        type="button"
        onClick={handleSignOut}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-3xl border border-border px-6 py-3 text-sm font-semibold text-muted-foreground"
      >
        <LogOut className="size-4" strokeWidth={2} />
        Odjavi se
      </button>

      {inviteFor ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30">
          <form
            onSubmit={handleInvite}
            className="w-full max-w-md space-y-4 rounded-t-3xl bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight">
                {inviteFor === "parent"
                  ? "Pozovi odraslu osobu"
                  : `Pozovi ${inviteFor.name || "dijete"}`}
              </h2>
              <button
                type="button"
                aria-label="Zatvori"
                onClick={() => setInviteFor(null)}
                className="rounded-xl p-1 text-muted-foreground active:opacity-60"
              >
                <X className="size-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              {inviteFor === "parent"
                ? "Odrasla osoba vidi sve obveze u prostoru."
                : "Dijete dobiva vlastiti račun i vidi samo ono što mu dopustiš."}
            </p>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                E-mail
              </span>
              <input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                type="email"
                autoComplete="email"
                placeholder="ime@primjer.hr"
                className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-[15px] outline-none focus:border-primary"
              />
            </label>
            {inviteError ? (
              <p className="text-sm font-medium text-destructive">{inviteError}</p>
            ) : null}
            <button
              type="submit"
              disabled={inviting}
              className="w-full rounded-3xl px-4 py-4 text-base font-bold text-primary-foreground disabled:opacity-60"
              style={{ backgroundImage: "var(--gradient-primary)" }}
            >
              {inviting ? "Šaljem…" : "Pošalji poziv"}
            </button>
          </form>
        </div>
      ) : null}

      {visibilityFor ? (
        <VisibilitySheet
          member={visibilityFor}
          familyId={familyId ?? ""}
          allMembers={members}
          canInvite={isOwner}
          onInvite={() => {
            const target = visibilityFor;
            setVisibilityFor(null);
            setInviteFor(target);
            setInviteEmail("");
            setInviteError("");
            setInviteInfo("");
          }}
          onClose={() => setVisibilityFor(null)}
        />
      ) : null}
    </AppShell>
  );
}

function VisibilitySheet({
  member,
  familyId,
  allMembers,
  canInvite,
  onInvite,
  onClose,
}: {
  member: FamilyMemberRow;
  familyId: string;
  allMembers: FamilyMemberRow[];
  canInvite: boolean;
  onInvite: () => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: visibility = {} } = useMemberVisibility(familyId);
  const current = visibility[member.id];
  const [mode, setMode] = useState<VisibilityMode>(
    (current?.mode ?? "own_shared") as VisibilityMode,
  );
  const [seeOwn, setSeeOwn] = useState(current?.see_own ?? true);
  const [seeShared, setSeeShared] = useState(current?.see_shared ?? true);
  const [allowed, setAllowed] = useState<string[]>(current?.allowed_member_ids ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const others = allMembers.filter((m) => m.id !== member.id);

  const modes: VisibilityMode[] = ["own", "own_shared", "all", "custom"];

  const save = async () => {
    if (!familyId) return;
    setSaving(true);
    setError("");
    try {
      await saveMemberVisibility(familyId, member.id, {
        mode,
        see_own: seeOwn,
        see_shared: seeShared,
        allowed_member_ids: mode === "custom" ? allowed : [],
      });
      await queryClient.invalidateQueries({ queryKey: ["member-visibility", familyId] });
      onClose();
    } catch {
      setError("Spremanje nije uspjelo. Pokušaj ponovno.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30">
      <div className="max-h-[88vh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-3xl bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">{member.name || "Dijete"}</h2>
          <button
            type="button"
            aria-label="Zatvori"
            onClick={onClose}
            className="rounded-xl p-1 text-muted-foreground active:opacity-60"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex items-start gap-3 rounded-2xl bg-primary-soft px-4 py-3">
          <Shield className="mt-0.5 size-4 shrink-0 text-accent-foreground" strokeWidth={2.2} />
          <p className="text-sm font-medium text-accent-foreground">
            Što ovo dijete vidi kad se prijavi u svoj račun.
          </p>
        </div>

        <div className="space-y-2">
          {modes.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold ${
                mode === m
                  ? "border-primary bg-primary-soft text-accent-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              {VISIBILITY_LABELS[m]}
              {mode === m ? <Check className="size-4" strokeWidth={2.4} /> : null}
            </button>
          ))}
        </div>

        {mode === "custom" ? (
          <div className="space-y-3 rounded-2xl border border-border p-4">
            <label className="flex items-center justify-between text-sm font-semibold">
              Svoje obveze
              <input
                type="checkbox"
                checked={seeOwn}
                onChange={(e) => setSeeOwn(e.target.checked)}
                className="size-5 accent-[var(--color-primary)]"
              />
            </label>
            <label className="flex items-center justify-between text-sm font-semibold">
              Zajedničke obveze
              <input
                type="checkbox"
                checked={seeShared}
                onChange={(e) => setSeeShared(e.target.checked)}
                className="size-5 accent-[var(--color-primary)]"
              />
            </label>
            <div>
              <p className="text-sm font-semibold">Obveze ovih članova</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {others.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() =>
                      setAllowed((prev) =>
                        prev.includes(o.id) ? prev.filter((x) => x !== o.id) : [...prev, o.id],
                      )
                    }
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${
                      allowed.includes(o.id)
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary-soft text-accent-foreground"
                    }`}
                  >
                    {o.name || "Bez imena"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="w-full rounded-3xl px-4 py-4 text-base font-bold text-primary-foreground disabled:opacity-60"
          style={{ backgroundImage: "var(--gradient-primary)" }}
        >
          {saving ? "Spremam…" : "Spremi pravila"}
        </button>

        {canInvite && !member.linked_user_id ? (
          <button
            type="button"
            onClick={onInvite}
            className="flex w-full items-center justify-center gap-2 rounded-3xl border border-border px-4 py-3 text-sm font-semibold text-accent-foreground"
          >
            <UserPlus className="size-4" strokeWidth={2.2} />
            Pozovi na vlastiti račun
          </button>
        ) : null}
      </div>
    </div>
  );
}
