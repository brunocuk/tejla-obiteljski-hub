import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  acceptPendingInvitation,
  createFamily,
  updateMyDisplayName,
  useFamilyMembers,
  useMyFamilyId,
  useMyUserId,
  usePendingInvitation,
} from "@/lib/family-workspace";

/** Asks an invited parent for their name once, when no profile name exists yet. */
function NamePrompt({ familyId }: { familyId: string }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Unesi svoje ime.");
      return;
    }
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await updateMyDisplayName(familyId, name.trim());
      await queryClient.invalidateQueries({ queryKey: ["family-members", familyId] });
    } catch {
      setError("Spremanje imena nije uspjelo. Pokušaj ponovno.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Kako se zoveš?</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Tvoje ime vidjet će ostali članovi obitelji.
      </p>
      <form onSubmit={handleSave} className="card-soft mt-6 space-y-4 p-5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Davor"
          className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-[15px] outline-none focus:border-primary"
        />
        {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-3xl px-6 py-4 text-base font-bold text-primary-foreground disabled:opacity-60"
          style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-float)" }}
        >
          {saving ? "Spremam…" : "Spremi"}
        </button>
      </form>
    </main>
  );
}

export function FamilyGate({ children }: { children: ReactNode }) {
  const { data: familyId, isLoading } = useMyFamilyId();
  const queryClient = useQueryClient();
  // A pending invitation for this e-mail joins the existing family instead of creating a new one.
  const { data: joinedFamilyId, isLoading: joining } = useQuery({
    queryKey: ["accept-invitation"],
    enabled: !isLoading && !familyId,
    retry: false,
    queryFn: acceptPendingInvitation,
  });
  const [familyName, setFamilyName] = useState("");
  const [myName, setMyName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const activeFamilyId = familyId ?? joinedFamilyId ?? null;
  const { data: myUserId } = useMyUserId();
  const { data: members = [], isLoading: membersLoading } = useFamilyMembers(activeFamilyId);

  useEffect(() => {
    if (joinedFamilyId) {
      void queryClient.invalidateQueries({ queryKey: ["my-family-id"] });
      void queryClient.invalidateQueries({ queryKey: ["my-family-role"] });
    }
  }, [joinedFamilyId, queryClient]);

  if (isLoading || (!familyId && joining)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Učitavanje…
      </div>
    );
  }

  if (activeFamilyId) {
    const me = members.find((m) => m.linked_user_id && m.linked_user_id === myUserId);
    if (!membersLoading && me && !me.name.trim()) {
      return <NamePrompt familyId={activeFamilyId} />;
    }
    return <>{children}</>;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!familyName.trim() || !myName.trim()) {
      setError("Ispuni naziv obitelji i svoje ime.");
      return;
    }
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await createFamily(familyName.trim(), myName.trim());
      await queryClient.invalidateQueries({ queryKey: ["my-family-id"] });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(
        message
          ? `Stvaranje obitelji nije uspjelo: ${message}`
          : "Stvaranje obitelji nije uspjelo. Pokušaj ponovno.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Tu si.</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Trenutno nemaš aktivan obiteljski prostor. Tvoj Tejla račun ostaje isti — možeš stvoriti
        svoj prostor ili se pridružiti postojećem.
      </p>

      <form onSubmit={handleCreate} className="card-soft mt-6 space-y-4 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Stvori svoj prostor
        </p>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Naziv obitelji
          </span>
          <input
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            placeholder="Obitelj Horvat"
            className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-[15px] outline-none focus:border-primary"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Tvoje ime
          </span>
          <input
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            placeholder="Mateja"
            className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-[15px] outline-none focus:border-primary"
          />
        </label>

        {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-3xl px-6 py-4 text-base font-bold text-primary-foreground disabled:opacity-60"
          style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-float)" }}
        >
          {saving ? "Stvaram…" : "Stvori svoj prostor"}
        </button>
      </form>

      <div className="card-soft mt-4 space-y-1 p-5">
        <p className="text-sm font-semibold">Pridruži se prostoru</p>
        <p className="text-sm text-muted-foreground">
          Zamoli osobu koja vodi prostor da te pozove na ovu e-mail adresu. Čim poziv stigne,
          prijava ovim istim računom te odmah ubaci u taj prostor.
        </p>
      </div>
    </main>
  );
}
