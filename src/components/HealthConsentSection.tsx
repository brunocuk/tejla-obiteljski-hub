import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { HeartPulse } from "lucide-react";
import {
  canManageHealthConsents,
  healthAiConsentText,
  healthSaveConsentText,
  useMemberConsents,
  type HealthPurpose,
} from "@/lib/consents";
import { grantHealthConsent, revokeHealthConsent } from "@/lib/consents.functions";
import type { FamilyMemberRow } from "@/lib/family-workspace";

/**
 * Dvije zdravstvene opcije po clanu (mail "PRIVOLE" 16.11.): spremanje
 * zdravstvenih termina i AI izdvajanje iz uputnice/slike. Obje su pocetno
 * iskljucene; ukljucivanje trazi izricitu privolu (tekst se prikazuje prije
 * potvrde), povlacenje ide odmah. Tko smije mijenjati odreduje
 * canManageHealthConsents (server provjerava isto pravilo).
 */
export function HealthConsentSection({
  member,
  familyId,
  familyName,
  myUserId,
  iAmFamilyAdult,
}: {
  member: FamilyMemberRow;
  familyId: string;
  familyName: string;
  myUserId: string | null | undefined;
  iAmFamilyAdult: boolean;
}) {
  const queryClient = useQueryClient();
  const grant = useServerFn(grantHealthConsent);
  const revoke = useServerFn(revokeHealthConsent);
  const { data: consents = {} } = useMemberConsents(familyId);
  const state = consents[member.id] ?? { save: false, ai: false, account: null };
  const [confirming, setConfirming] = useState<HealthPurpose | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canManage = canManageHealthConsents(
    {
      id: member.id,
      member_type: member.member_type,
      linked_user_id: member.linked_user_id,
      age_group: member.age_group ?? null,
      sixteen_confirmed_at: member.sixteen_confirmed_at ?? null,
    },
    myUserId,
    iAmFamilyAdult,
  );

  const isSelf = Boolean(myUserId && member.linked_user_id === myUserId);
  const teenManagesOwn =
    member.member_type === "child" &&
    Boolean(member.linked_user_id) &&
    (member.age_group === "16-17" || Boolean(member.sixteen_confirmed_at));

  const name = member.name?.trim() || "člana";
  const texts: Record<HealthPurpose, string> = {
    "zdravstveno-spremanje": healthSaveConsentText(name, familyName),
    "zdravstveno-ai": healthAiConsentText(name, familyName),
  };
  const labels: Record<HealthPurpose, string> = {
    "zdravstveno-spremanje": "Spremanje zdravstvenih termina",
    "zdravstveno-ai": "AI izdvajanje termina iz uputnice ili slike",
  };
  const active: Record<HealthPurpose, boolean> = {
    "zdravstveno-spremanje": state.save,
    "zdravstveno-ai": state.ai,
  };

  const apply = async (purpose: HealthPurpose, enable: boolean) => {
    setBusy(true);
    setError("");
    try {
      if (enable) await grant({ data: { familyMemberId: member.id, purpose } });
      else await revoke({ data: { familyMemberId: member.id, purpose } });
      await queryClient.invalidateQueries({ queryKey: ["member-consents", familyId] });
      setConfirming(null);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Spremanje nije uspjelo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <HeartPulse className="size-4" strokeWidth={2.2} />
        Zdravstveni termini
      </h3>
      {!canManage ? (
        <p className="rounded-2xl border border-border px-4 py-3 text-sm font-medium text-muted-foreground">
          {teenManagesOwn
            ? `Ove opcije uključuje i isključuje ${name} u svojem računu. Trenutno: spremanje ${state.save ? "uključeno" : "isključeno"}, AI izdvajanje ${state.ai ? "uključeno" : "isključeno"}.`
            : "Ove opcije potvrđuje svaki punoljetni član za sebe."}
        </p>
      ) : (
        (Object.keys(labels) as HealthPurpose[]).map((purpose) => (
          <div key={purpose} className="rounded-2xl border border-border p-4">
            <label className="flex items-center justify-between gap-3 text-sm font-semibold">
              {labels[purpose]}
              <input
                type="checkbox"
                checked={active[purpose]}
                disabled={busy}
                onChange={(e) => {
                  if (e.target.checked) {
                    setConfirming(purpose);
                  } else {
                    void apply(purpose, false);
                  }
                }}
                className="size-5 shrink-0 accent-[var(--color-primary)]"
              />
            </label>
            {confirming === purpose && !active[purpose] ? (
              <div className="mt-3 space-y-3 rounded-2xl bg-primary-soft p-4">
                {isSelf && teenManagesOwn ? (
                  <p className="text-xs font-medium text-accent-foreground">
                    Kad uključiš ovu opciju, zdravstveni unos za tebe može napraviti i tvoj
                    ovlašteni roditelj ili skrbnik u ovom prostoru.
                  </p>
                ) : null}
                <p className="text-sm leading-relaxed text-accent-foreground">{texts[purpose]}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirming(null)}
                    className="flex-1 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-muted-foreground"
                  >
                    Odustani
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void apply(purpose, true)}
                    className="flex-1 rounded-2xl px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
                    style={{ backgroundImage: "var(--gradient-primary)" }}
                  >
                    {busy ? "Spremam…" : "Izričito pristajem"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ))
      )}
      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Obje opcije su početno isključene i mogu se povući zasebno u bilo kojem trenutku. Obične
        obveze rade i bez njih.
      </p>
    </div>
  );
}
