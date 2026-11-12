import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyFamilyId, useMyFamilyRole } from "@/lib/family-workspace";
import { startBillingFlow } from "@/lib/billing-client";

/**
 * Paywall: kad je naplata ukljucena (billing_settings.enforced) i obitelj
 * NEMA pristup po family_has_access, umjesto aplikacije se prikazuje ekran
 * pretplate. Vlasnik moze platiti ili upravljati pretplatom; ostali clanovi
 * dobivaju poruku. Svaka greska provjere propusta korisnika (fail-open):
 * kvar naplate ne smije zakljucati aplikaciju.
 */
export function BillingGate({ children }: { children: ReactNode }) {
  const { data: familyId, isLoading: familyLoading } = useMyFamilyId();

  const { data: enforced } = useQuery({
    queryKey: ["billing-enforced"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from("billing_settings").select("enforced").maybeSingle();
      return data?.enforced === true;
    },
  });

  const { data: hasAccess } = useQuery({
    queryKey: ["family-has-access", familyId],
    enabled: enforced === true && Boolean(familyId),
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("family_has_access", {
        _family_id: familyId!,
      });
      if (error) throw error;
      return data === true;
    },
  });

  // Paywall se pokazuje tek kad provjera IZRICITO kaze "nema pristupa".
  if (familyLoading || !familyId || enforced !== true || hasAccess !== false) {
    return <>{children}</>;
  }
  return <Paywall familyId={familyId} />;
}

const STATUS_TEXT: Record<string, string> = {
  none: "Za korištenje Tejle potrebna je pretplata.",
  past_due: "Zadnja naplata nije uspjela i pristup je pauziran. Provjeri način plaćanja.",
  canceled: "Pretplata je istekla.",
  unpaid: "Zadnja naplata nije uspjela i pristup je pauziran. Provjeri način plaćanja.",
  incomplete: "Kupnja nije dovršena. Pokušaj ponovno.",
  incomplete_expired: "Kupnja nije dovršena. Pokušaj ponovno.",
  paused: "Pretplata je pauzirana.",
};

function Paywall({ familyId }: { familyId: string }) {
  const { data: myRole } = useMyFamilyRole();
  const isOwner = myRole === "owner";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const { data: subscription } = useQuery({
    queryKey: ["family-subscription", familyId],
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from("family_subscriptions")
        .select("status, stripe_subscription_id")
        .eq("family_id", familyId)
        .maybeSingle();
      if (qError) throw qError;
      return data;
    },
  });

  const status = subscription?.status ?? "none";
  // Portal ima smisla cim postoji Stripe pretplata (naplata/otkaz/kartica);
  // bez nje jedini put je nova kupnja.
  const hasStripeSubscription = Boolean(subscription?.stripe_subscription_id);

  async function open(path: "/api/billing/checkout" | "/api/billing/portal") {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      window.location.assign(await startBillingFlow(path, familyId));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Tejla čeka tebe.</h1>
      <p className="mt-2 text-sm text-muted-foreground">{STATUS_TEXT[status] ?? STATUS_TEXT["none"]}</p>
      <div className="card-soft mt-6 space-y-4 p-5">
        {isOwner ? (
          <>
            {hasStripeSubscription ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void open("/api/billing/portal")}
                className="w-full rounded-3xl px-6 py-4 text-base font-bold text-primary-foreground disabled:opacity-60"
                style={{
                  backgroundImage: "var(--gradient-primary)",
                  boxShadow: "var(--shadow-float)",
                }}
              >
                Upravljaj pretplatom
              </button>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => void open("/api/billing/checkout")}
              className={
                hasStripeSubscription
                  ? "w-full rounded-3xl border border-border px-6 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-60"
                  : "w-full rounded-3xl px-6 py-4 text-base font-bold text-primary-foreground disabled:opacity-60"
              }
              style={
                hasStripeSubscription
                  ? undefined
                  : { backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-float)" }
              }
            >
              Pretplati se
            </button>
            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Pretplatom upravlja vlasnik vašeg obiteljskog prostora. Zamoli ga da je obnovi pa se
            vrati ovdje.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Tvoji podaci su sigurni i čekaju te: ništa se ne briše dok je pretplata neaktivna.
        </p>
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
