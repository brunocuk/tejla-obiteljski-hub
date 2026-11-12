import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { startBillingFlow } from "@/lib/billing-client";

const STATUS_LABELS: Record<string, string> = {
  active: "Aktivna",
  trialing: "Probno razdoblje",
  past_due: "Čeka naplatu",
  canceled: "Otkazana",
  unpaid: "Neplaćena",
  incomplete: "Nedovršena kupnja",
  incomplete_expired: "Nedovršena kupnja",
  paused: "Pauzirana",
  none: "Nije aktivirana",
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("hr-HR", { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return null;
  }
}

/**
 * Kartica pretplate na stranici Članovi. Vidi je samo vlasnik (platitelj), i
 * to tek kad naplata postane relevantna: kad postoji zapis pretplate ili kad
 * je enforcement ukljucen. Beta korisnici je prije lansiranja ne vide.
 */
export function SubscriptionCard({
  familyId,
  isOwner,
}: {
  familyId: string | undefined;
  isOwner: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const { data: subscription } = useQuery({
    queryKey: ["family-subscription", familyId],
    enabled: Boolean(familyId) && isOwner,
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from("family_subscriptions")
        .select("status, cancel_at_period_end, current_period_end")
        .eq("family_id", familyId!)
        .maybeSingle();
      if (qError) throw qError;
      return data;
    },
  });

  const { data: enforced = false } = useQuery({
    queryKey: ["billing-enforced"],
    enabled: isOwner,
    queryFn: async () => {
      const { data } = await supabase.from("billing_settings").select("enforced").maybeSingle();
      return data?.enforced === true;
    },
  });

  if (!familyId || !isOwner) return null;
  if (!subscription && !enforced) return null;

  const status = subscription?.status ?? "none";
  const hasLiveSubscription = ["active", "trialing", "past_due"].includes(status);
  const periodEnd = formatDate(subscription?.current_period_end ?? null);

  async function open(path: "/api/billing/checkout" | "/api/billing/portal") {
    setBusy(true);
    setError("");
    try {
      window.location.assign(await startBillingFlow(path, familyId!));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <section className="mt-7 rounded-3xl border border-border p-5">
      <div className="flex items-center gap-2">
        <CreditCard className="size-5 text-accent-foreground" strokeWidth={2} />
        <h2 className="text-base font-bold tracking-tight">Pretplata</h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Status: <span className="font-semibold">{STATUS_LABELS[status] ?? status}</span>
        {status === "active" && subscription?.cancel_at_period_end && periodEnd
          ? ` · vrijedi do ${periodEnd}`
          : status === "active" && periodEnd
            ? ` · obnavlja se ${periodEnd}`
            : status === "canceled" && periodEnd
              ? ` · pristup do ${periodEnd}`
              : null}
      </p>
      {hasLiveSubscription ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void open("/api/billing/portal")}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-3xl border border-border px-6 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-60"
        >
          Upravljaj pretplatom
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => void open("/api/billing/checkout")}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-3xl px-6 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
          style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-float)" }}
        >
          Pretplati se
        </button>
      )}
      {error ? (
        <p className="mt-3 text-center text-sm font-semibold text-destructive">{error}</p>
      ) : null}
    </section>
  );
}
