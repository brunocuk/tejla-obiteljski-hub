import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { clearTejlaLocalData } from "@/lib/account-local";
import { deleteMyAccount, previewAccountDeletion } from "@/lib/account.functions";

const CONFIRM_WORD = "OBRIŠI";

export function DeleteAccountSheet({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const preview = useServerFn(previewAccountDeletion);
  const runDelete = useServerFn(deleteMyAccount);

  const { data, isLoading } = useQuery({
    queryKey: ["account-deletion-preview"],
    queryFn: () => preview({ data: undefined }),
  });

  const [step, setStep] = useState<"info" | "confirm">("info");
  const [newOwner, setNewOwner] = useState<string>("");
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const blocked = Boolean(data?.blocked);
  const needsOwner = Boolean(data?.needsOwnerTransferFallback ?? data?.needs_owner_transfer);
  const candidates = data?.adult_candidates ?? [];

  async function run() {
    if (word.trim().toUpperCase() !== CONFIRM_WORD) {
      setError(`Za potvrdu upiši ${CONFIRM_WORD}.`);
      return;
    }
    if (needsOwner && !newOwner) {
      setError("Odaberi tko preuzima obiteljski prostor.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await runDelete({ data: { newOwnerUserId: needsOwner ? newOwner : null } });
      clearTejlaLocalData();
      await supabase.auth.signOut().catch(() => undefined);
      clearTejlaLocalData();
      navigate({ to: "/auth", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Brisanje nije uspjelo. Pokušaj ponovno.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30">
      <div className="max-h-[88vh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-3xl bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">Obriši račun</h2>
          <button
            type="button"
            aria-label="Zatvori"
            onClick={onClose}
            className="rounded-xl p-1 text-muted-foreground active:opacity-60"
          >
            <X className="size-5" />
          </button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Provjeravam tvoj račun…</p>
        ) : (
          <>
            <div className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
              <p className="text-sm font-semibold text-destructive">
                Brisanje računa je trajno i ne može se poništiti.
              </p>
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">Trajno nestaje:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>tvoja prijava i profil (ime, e-mail)</li>
                <li>tvoje članstvo u obiteljskom prostoru</li>
                <li>tvoje obavijesti i uređaji za push poruke</li>
                <li>tvoje osobne postavke</li>
              </ul>
              {data?.deletes_family ? (
                <p className="font-semibold text-foreground">
                  Jedini si korisnik ovog prostora, pa se briše i cijeli obiteljski prostor sa svim
                  događajima, zadacima i podsjetnicima.
                </p>
              ) : data?.has_family ? (
                <p>
                  Zajednički obiteljski podaci ostaju drugim članovima. Skidaš se s budućih obaveza,
                  a povijesni zapisi ostaju bez tvojih osobnih podataka.
                </p>
              ) : null}
            </div>

            {blocked ? (
              <div className="rounded-2xl border border-border bg-secondary/40 p-4 text-sm">
                <p className="font-semibold text-foreground">
                  Račun trenutačno nije moguće obrisati.
                </p>
                <p className="mt-1 text-muted-foreground">
                  Vlasnik si prostora u kojem nema druge odrasle osobe. Prvo pozovi odraslu osobu i
                  povezi je s prostorom, pa ponovi brisanje.
                </p>
              </div>
            ) : step === "info" ? (
              <button
                type="button"
                onClick={() => setStep("confirm")}
                className="w-full rounded-3xl border border-destructive/40 px-4 py-3 text-sm font-bold text-destructive"
              >
                Nastavi na brisanje
              </button>
            ) : (
              <div className="space-y-3">
                {needsOwner ? (
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Tko preuzima obiteljski prostor?
                    </span>
                    <select
                      value={newOwner}
                      onChange={(e) => setNewOwner(e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-[15px] outline-none focus:border-primary"
                    >
                      <option value="">Odaberi osobu</option>
                      {candidates.map((c) => (
                        <option key={c.user_id} value={c.user_id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Za potvrdu upiši {CONFIRM_WORD}
                  </span>
                  <input
                    value={word}
                    onChange={(e) => setWord(e.target.value)}
                    placeholder={CONFIRM_WORD}
                    autoCapitalize="characters"
                    className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-[15px] outline-none focus:border-primary"
                  />
                </label>

                <button
                  type="button"
                  onClick={run}
                  disabled={busy || word.trim().toUpperCase() !== CONFIRM_WORD}
                  className="w-full rounded-3xl bg-destructive px-4 py-3 text-sm font-bold text-destructive-foreground disabled:opacity-60"
                >
                  {busy ? "Brišem…" : "Trajno obriši račun"}
                </button>
              </div>
            )}

            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="w-full rounded-3xl border border-border px-4 py-3 text-sm font-semibold text-muted-foreground"
            >
              Odustani
            </button>
          </>
        )}
      </div>
    </div>
  );
}
