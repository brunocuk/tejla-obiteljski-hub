import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createFamily, useMyFamilyId } from "@/lib/family-workspace";

export function FamilyGate({ children }: { children: ReactNode }) {
  const { data: familyId, isLoading } = useMyFamilyId();
  const queryClient = useQueryClient();
  const [familyName, setFamilyName] = useState("");
  const [myName, setMyName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Učitavanje…
      </div>
    );
  }

  if (familyId) return <>{children}</>;

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
      setError(message ? `Stvaranje obitelji nije uspjelo: ${message}` : "Stvaranje obitelji nije uspjelo. Pokušaj ponovno.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Postavi svoju obitelj</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Još nekoliko podataka i tvoj obiteljski prostor je spreman.
      </p>

      <form onSubmit={handleCreate} className="card-soft mt-6 space-y-4 p-5">
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
          {saving ? "Stvaram…" : "Stvori obitelj"}
        </button>
      </form>
    </main>
  );
}