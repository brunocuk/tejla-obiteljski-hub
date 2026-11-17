import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { clearTejlaLocalData } from "@/lib/account-local";
import { confirmSixteen, revokeChildAccountConsent } from "@/lib/consents.functions";
import { CONSENT_HELP_CONTACT } from "@/lib/consents";
import { HealthConsentSection } from "@/components/HealthConsentSection";
import type { FamilyMemberRow } from "@/lib/family-workspace";

/**
 * Privole djecjeg racuna u vlastitim postavkama (Clanovi): samoizjava
 * "Navrsio/la sam 16 godina" (varijanta A iz maila "PRIVOLE" 16.11.),
 * povlacenje privole za racun nakon 16. i vlastite zdravstvene opcije za
 * 16-17. Prikazuje se samo djetetu u njegovom racunu.
 */
export function ConsentSettingsCard({
  member,
  familyId,
  familyName,
  myUserId,
}: {
  member: FamilyMemberRow;
  familyId: string;
  familyName: string;
  myUserId: string | null | undefined;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const confirmAge = useServerFn(confirmSixteen);
  const revokeAccount = useServerFn(revokeChildAccountConsent);
  const [step, setStep] = useState<null | "sixteen" | "revoke">(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (member.member_type !== "child" || member.linked_user_id !== myUserId) return null;

  const isSixteenPlus = member.age_group === "16-17" || Boolean(member.sixteen_confirmed_at);

  const handleSixteen = async () => {
    setBusy(true);
    setError("");
    try {
      await confirmAge({ data: undefined });
      await queryClient.invalidateQueries({ queryKey: ["family-members", familyId] });
      setStep(null);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Potvrda nije uspjela.");
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async () => {
    setBusy(true);
    setError("");
    try {
      await revokeAccount({ data: { familyMemberId: member.id } });
      await supabase.auth.signOut();
      clearTejlaLocalData();
      navigate({ to: "/auth", replace: true });
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Povlačenje nije uspjelo.");
      setBusy(false);
    }
  };

  return (
    <section className="card-soft mt-7 space-y-4 p-5">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <ShieldCheck className="size-4" strokeWidth={2.2} />
        Tvoje privole
      </h2>

      {isSixteenPlus ? (
        <HealthConsentSection
          member={member}
          familyId={familyId}
          familyName={familyName}
          myUserId={myUserId}
          iAmFamilyAdult={false}
        />
      ) : null}

      {!isSixteenPlus ? (
        step === "sixteen" ? (
          <div className="space-y-3 rounded-2xl bg-primary-soft p-4">
            <p className="text-sm leading-relaxed text-accent-foreground">
              Potvrđuješ da si navršio/la 16 godina. Nakon potvrde sam/a upravljaš svojim
              privolama i možeš povući privolu koju je za tvoj račun dao roditelj ili skrbnik.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setStep(null)}
                className="flex-1 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-muted-foreground"
              >
                Odustani
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleSixteen}
                className="flex-1 rounded-2xl px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
                style={{ backgroundImage: "var(--gradient-primary)" }}
              >
                {busy ? "Spremam…" : "Potvrđujem"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setStep("sixteen");
              setError("");
            }}
            className="w-full rounded-2xl border border-border px-4 py-3 text-sm font-semibold text-accent-foreground"
          >
            Navršio/la sam 16 godina
          </button>
        )
      ) : step === "revoke" ? (
        <div className="space-y-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm font-bold text-destructive">Povući privolu za svoj račun?</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Tvoj račun se zatvara i više se nećeš moći prijaviti. Tvoj profil i obveze ostaju u
            prostoru {familyName}, njima dalje upravljaju odrasli članovi.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setStep(null)}
              className="flex-1 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-muted-foreground"
            >
              Odustani
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleRevoke}
              className="flex-1 rounded-2xl bg-destructive px-4 py-2.5 text-sm font-bold text-destructive-foreground disabled:opacity-60"
            >
              {busy ? "Povlačim…" : "Povuci privolu"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setStep("revoke");
            setError("");
          }}
          className="w-full rounded-2xl border border-border px-4 py-3 text-sm font-semibold text-muted-foreground"
        >
          Povuci privolu za svoj račun
        </button>
      )}

      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

      <p className="text-xs leading-relaxed text-muted-foreground">
        {!isSixteenPlus
          ? "Privolu za tvoj račun dao je tvoj roditelj ili skrbnik i može je povući u postavkama. "
          : "Ako je privolu za tvoj račun ranije dao roditelj ili skrbnik, ona vrijedi dok je ne povučeš. "}
        Za pomoć se javi na {CONSENT_HELP_CONTACT}.
      </p>
    </section>
  );
}
