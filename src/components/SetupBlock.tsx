import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, Check, Download, Share } from "lucide-react";
import { enablePush, pushStatus, syncSubscription, type PushStatus } from "@/lib/push";
import {
  canPromptInstall,
  detectPlatform,
  installStepApplies,
  isInstalled,
  onInstallAvailabilityChange,
  promptInstall,
  type Platform,
} from "@/lib/pwa-install";

/** How long a freshly completed step keeps its green check before disappearing. */
const DONE_VISIBLE_MS = 5000;

function Row({
  icon,
  title,
  children,
  done,
}: {
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  done?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-2xl ${
          done ? "bg-sage text-foreground" : "bg-primary-soft text-accent-foreground"
        }`}
      >
        {done ? <Check className="size-4" strokeWidth={2.6} /> : icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">{title}</p>
        {children}
      </div>
    </div>
  );
}

/** Compact onboarding status for Danas — disappears once both steps are done. */
export function SetupBlock() {
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [installNeeded, setInstallNeeded] = useState(false);
  const [promptable, setPromptable] = useState(false);
  const [push, setPush] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Steps that completed while this screen was open — briefly show a check.
  const [justDone, setJustDone] = useState<{ install: boolean; push: boolean }>({
    install: false,
    push: false,
  });
  const prev = useRef<{ install: boolean | null; push: boolean | null }>({
    install: null,
    push: null,
  });

  const refresh = useCallback(() => {
    const nextInstallNeeded = installStepApplies();
    const nextPush = pushStatus();
    setInstallNeeded(nextInstallNeeded);
    setPromptable(canPromptInstall());
    setPush(nextPush);

    if (prev.current.install === true && !nextInstallNeeded) {
      setJustDone((s) => ({ ...s, install: true }));
      window.setTimeout(() => setJustDone((s) => ({ ...s, install: false })), DONE_VISIBLE_MS);
    }
    if (prev.current.push === false && nextPush === "granted") {
      setJustDone((s) => ({ ...s, push: true }));
      window.setTimeout(() => setJustDone((s) => ({ ...s, push: false })), DONE_VISIBLE_MS);
    }
    prev.current = { install: nextInstallNeeded, push: nextPush === "granted" };
  }, []);

  useEffect(() => {
    setPlatform(detectPlatform());
    refresh();
    if (pushStatus() === "granted") void syncSubscription();
    const off = onInstallAvailabilityChange(refresh);
    const id = window.setInterval(refresh, 2000);
    return () => {
      off();
      window.clearInterval(id);
    };
  }, [refresh]);

  if (push === null) return null;

  const pushDone = push === "granted" || push === "unsupported";
  const showInstall = installNeeded || justDone.install;
  const showPush = (!pushDone && push !== "needs-install") || justDone.push;

  if (!showInstall && !showPush) return null;

  return (
    <section className="card-soft mb-6 divide-y divide-border">
      {showInstall ? (
        installNeeded ? (
          <Row icon={<Download className="size-4" strokeWidth={1.9} />} title="Instaliraj Tejlu">
            {platform === "ios" ? (
              <p className="mt-1 text-sm text-muted-foreground">
                U Safariju dodirni Podijeli <Share className="inline size-3.5" /> pa „Dodaj na
                početni zaslon”. Obavijesti rade tek iz instalirane aplikacije.
              </p>
            ) : promptable ? (
              <button
                type="button"
                onClick={async () => {
                  const outcome = await promptInstall();
                  if (outcome === "dismissed") setNote("Instalacija je otkazana.");
                  if (outcome === "unavailable")
                    setNote("Instalacija trenutno nije dostupna u ovom browseru.");
                  refresh();
                }}
                className="mt-2 rounded-2xl px-4 py-2 text-sm font-bold text-primary-foreground"
                style={{ backgroundImage: "var(--gradient-primary)" }}
              >
                Instaliraj
              </button>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                {platform === "android"
                  ? "Otvori izbornik browsera (⋮) i odaberi „Instaliraj aplikaciju”."
                  : "U traci s adresom klikni ikonu za instalaciju."}
              </p>
            )}
            {note ? <p className="mt-2 text-xs text-muted-foreground">{note}</p> : null}
          </Row>
        ) : (
          <Row icon={null} done title="Tejla je instalirana" />
        )
      ) : null}

      {showPush ? (
        push === "granted" ? (
          <Row icon={null} done title="Obavijesti su uključene" />
        ) : push === "denied" ? (
          <Row
            icon={<BellRing className="size-4" strokeWidth={1.9} />}
            title="Obavijesti su blokirane"
          >
            <p className="mt-1 text-sm text-muted-foreground">
              Uključi ih u postavkama uređaja za Tejlu, pa se vrati ovamo.
            </p>
          </Row>
        ) : (
          <Row
            icon={<BellRing className="size-4" strokeWidth={1.9} />}
            title="Uključi obavijesti"
          >
            <p className="mt-1 text-sm text-muted-foreground">
              Podsjetnici i novi zadaci stižu ti odmah na uređaj.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const result = await enablePush();
                if (result !== "error") setPush(result);
                setBusy(false);
                refresh();
              }}
              className="mt-2 rounded-2xl px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
              style={{ backgroundImage: "var(--gradient-primary)" }}
            >
              {busy ? "Uključujem…" : "Uključi obavijesti"}
            </button>
          </Row>
        )
      ) : null}
    </section>
  );
}
