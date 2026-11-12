import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { LEGAL_VERSION } from "@/lib/legal";
import { recordLegalAcceptance } from "@/lib/legal.functions";

/**
 * Trazi prihvat Uvjeta/Pravila od prijavljenih korisnika koji za TRENUTNU
 * verziju dokumenata nemaju zapis u evidenciji (postojeci korisnici nakon
 * promjene verzije; nove registracije zapis dobivaju vec pri registraciji).
 * Greska provjere NE zakljucava aplikaciju (fail-open uz log).
 */
export function LegalGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const recordAcceptance = useServerFn(recordLegalAcceptance);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const { data: accepted, isLoading, isError } = useQuery({
    queryKey: ["legal-acceptance", LEGAL_VERSION],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from("legal_acceptances")
        .select("id")
        .eq("doc_version", LEGAL_VERSION)
        .limit(1);
      if (qError) throw qError;
      return data.length > 0;
    },
  });

  if (isLoading) return null;
  if (accepted || isError) return <>{children}</>;

  async function handleAccept() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await recordAcceptance({ data: { method: "potvrda-u-aplikaciji" } });
      queryClient.setQueryData(["legal-acceptance", LEGAL_VERSION], true);
    } catch {
      setError("Spremanje nije uspjelo. Pokušaj ponovno.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Prije nastavka</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Da bi nastavio/la koristiti Tejlu, potvrdi da prihvaćaš važeće dokumente.
      </p>
      <div className="card-soft mt-6 space-y-4 p-5">
        <p className="text-sm text-muted-foreground">
          Nastavkom prihvaćaš{" "}
          <a
            href="/uvjeti"
            target="_blank"
            rel="noreferrer"
            className="font-semibold underline underline-offset-2"
          >
            Uvjete korištenja
          </a>{" "}
          i potvrđuješ da si pročitao/la{" "}
          <a
            href="/privatnost"
            target="_blank"
            rel="noreferrer"
            className="font-semibold underline underline-offset-2"
          >
            Pravila privatnosti
          </a>{" "}
          (verzija {LEGAL_VERSION}).
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleAccept()}
          className="w-full rounded-3xl px-6 py-4 text-base font-bold text-primary-foreground disabled:opacity-60"
          style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-float)" }}
        >
          {busy ? "Spremam…" : "Prihvaćam i nastavljam"}
        </button>
        {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
        <button
          type="button"
          onClick={() => void supabase.auth.signOut().then(() => window.location.assign("/auth"))}
          className="w-full rounded-3xl border border-border px-6 py-3 text-sm font-semibold text-muted-foreground"
        >
          Odjavi se
        </button>
      </div>
    </main>
  );
}
