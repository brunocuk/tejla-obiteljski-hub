import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BellRing, Check, Share, Smartphone, Plus } from "lucide-react";
import { enablePush, pushStatus, syncSubscription, type PushStatus } from "@/lib/push";
import {
  canPromptInstall,
  detectPlatform,
  getClientKind,
  installStepApplies,
  isInstalled,
  onInstallAvailabilityChange,
  promptInstall,
  type Platform,
} from "@/lib/pwa-install";
import { useMyUserId } from "@/lib/family-workspace";
import { useSetTejlaMessages, useTejlaMessagesEnabled } from "@/lib/notification-prefs";

const storageKey = (uid: string) => `tejla-onboarding-${uid}`;
/** Separate from the preference: records that the question was asked at all. */
const messagesAskedKey = (uid: string) => `tejla-onboarding-messages-${uid}`;

export function onboardingState(uid: string): "done" | "skipped" | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(storageKey(uid));
  return v === "done" || v === "skipped" ? v : null;
}

export function tejlaMessagesAnswered(uid: string): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(messagesAskedKey(uid)) === "answered";
}

export function markTejlaMessagesAnswered(uid: string) {
  try {
    window.localStorage.setItem(messagesAskedKey(uid), "answered");
  } catch {
    /* private mode — worst case the step shows again on a fresh session */
  }
}

function setOnboardingState(uid: string, value: "done" | "skipped") {
  try {
    window.localStorage.setItem(storageKey(uid), value);
  } catch {
    /* private mode — the gate simply shows again next time */
  }
}


function StepCard({
  index,
  title,
  done,
  neutral = false,
  children,
}: {
  index: number;
  title: string;
  done: boolean;
  /** Answered but intentionally off — no green check, no "todo" emphasis. */
  neutral?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="card-soft p-5">
      <div className="flex items-center gap-3">
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            done
              ? "bg-sage text-foreground"
              : neutral
                ? "bg-muted text-muted-foreground"
                : "bg-primary-soft text-accent-foreground"
          }`}
        >
          {done ? <Check className="size-4" strokeWidth={2.4} /> : index}
        </span>
        <p className="text-[16px] font-semibold">{title}</p>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}


/** Step 1 — put Tejla on the home screen. Real state, no manual checkbox. */
export function InstallStep({ index = 1 }: { index?: number }) {
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [installed, setInstalled] = useState(false);
  const [promptable, setPromptable] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(isInstalled());
    setPromptable(canPromptInstall());
    return onInstallAvailabilityChange(() => {
      setPromptable(canPromptInstall());
      setInstalled(isInstalled());
    });
  }, []);

  if (installed) {
    return (
      <StepCard index={index} title="Tejla je na početnom zaslonu" done>
        <p className="text-sm text-muted-foreground">Otvaraš je kao pravu aplikaciju.</p>
      </StepCard>
    );
  }

  return (
    <StepCard index={index} title="Postavi Tejlu na početni zaslon" done={false}>
      {platform === "ios" ? (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Na iPhoneu to radi samo ručno, u Safariju:</p>
          <ol className="space-y-1.5">
            <li className="flex items-center gap-2">
              <Share className="size-4 shrink-0" strokeWidth={1.8} /> 1. Dodirni gumb Podijeli
              (strelica) u traci.
            </li>
            <li className="flex items-center gap-2">
              <Plus className="size-4 shrink-0" strokeWidth={1.8} /> 2. Odaberi „Dodaj na početni
              zaslon”.
            </li>
            <li className="flex items-center gap-2">
              <Smartphone className="size-4 shrink-0" strokeWidth={1.8} /> 3. Potvrdi „Dodaj” i
              otvori Tejlu s početnog zaslona.
            </li>
          </ol>
          <p>Obavijesti na iPhoneu rade tek iz te instalirane aplikacije.</p>
        </div>
      ) : promptable ? (
        <>
          <p className="text-sm text-muted-foreground">
            {note ?? "Instaliraj Tejlu kao aplikaciju — brže se otvara i prima obavijesti."}
          </p>
          <button
            type="button"
            onClick={async () => {
              const outcome = await promptInstall();
              if (outcome === "dismissed") setNote("Instalacija je otkazana. Možeš pokušati opet.");
              if (outcome === "unavailable")
                setNote("Instalacija trenutno nije dostupna u ovom browseru.");
              setInstalled(isInstalled());
            }}
            className="mt-3 w-full rounded-2xl px-4 py-3 text-sm font-bold text-primary-foreground"
            style={{ backgroundImage: "var(--gradient-primary)" }}
          >
            Postavi
          </button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {platform === "android"
            ? "Otvori izbornik browsera (⋮) i odaberi „Instaliraj aplikaciju” ili „Dodaj na početni zaslon”."
            : "U traci s adresom klikni ikonu za instalaciju ili u izborniku browsera odaberi „Instaliraj Tejlu”."}
        </p>
      )}
    </StepCard>
  );
}

/** Step 2 — real browser permission + existing Tejla push subscription. */
export function NotificationsStep({ index = 2 }: { index?: number }) {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const s = pushStatus();
    setStatus(s);
    // Keep the stored subscription fresh for an already-allowed device.
    if (s === "granted") void syncSubscription();
  }, []);

  if (status === "granted") {
    return (
      <StepCard index={index} title="Obavijesti su uključene" done>
        <p className="text-sm text-muted-foreground">Tejla ti se javlja kad je zatrebaš.</p>
      </StepCard>
    );
  }

  if (status === "denied") {
    return (
      <StepCard index={index} title="Obavijesti su blokirane" done={false}>
        <p className="text-sm text-muted-foreground">
          Browser ih više ne može tražiti. Uključi ih ručno: Postavke → Obavijesti → Tejla (iPhone),
          odnosno ikona pored adrese → Obavijesti → Dopusti (Android/desktop), pa se vrati ovamo.
        </p>
      </StepCard>
    );
  }

  if (status === "needs-install") {
    return (
      <StepCard index={index} title="Uključi obavijesti" done={false}>
        <p className="text-sm text-muted-foreground">
          Na iPhoneu obavijesti rade tek kad Tejlu otvoriš s početnog zaslona. Dovrši prvi korak, pa
          se vrati ovdje.
        </p>
      </StepCard>
    );
  }

  if (status === "unsupported") {
    return (
      <StepCard index={index} title="Uključi obavijesti" done={false}>
        <p className="text-sm text-muted-foreground">
          Ovaj browser ne podržava obavijesti. Otvori Tejlu u Chromeu, Edgeu ili Safariju.
        </p>
      </StepCard>
    );
  }

  return (
    <StepCard index={index} title="Uključi obavijesti" done={false}>
      <p className="text-sm text-muted-foreground">
        {note ?? "Podsjetnici i novi zadaci stižu ti odmah na uređaj."}
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setNote(null);
          const result = await enablePush();
          if (result === "error") setNote("Nije uspjelo. Pokušaj ponovno.");
          else setStatus(result);
          setBusy(false);
        }}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
        style={{ backgroundImage: "var(--gradient-primary)" }}
      >
        <BellRing className="size-4" strokeWidth={2} />
        {busy ? "Uključujem…" : "Uključi obavijesti"}
      </button>
    </StepCard>
  );
}

/**
 * Step 3 — Tejla's occasional messages. Pure preference write, never touches
 * push permission or the user's own reminders.
 */
export function TejlaMessagesStep({ index, uid }: { index: number; uid: string }) {
  const { data: enabled, isLoading } = useTejlaMessagesEnabled();
  const setEnabled = useSetTejlaMessages();
  const [answered, setAnswered] = useState(false);

  // A device without local onboarding state must respect the stored preference.
  // The status always mirrors the real preference, never just "step completed".
  if (enabled === true) {
    return (
      <StepCard index={index} title="Tejline poruke su uključene ✨" done>
        <p className="text-sm text-muted-foreground">
          Povremene poruke izvan tvojih podsjetnika.
        </p>
      </StepCard>
    );
  }

  if (answered) {
    return (
      <StepCard index={index} title="Tejline poruke nisu uključene" done={false} neutral>
        <p className="text-sm text-muted-foreground">
          Možeš ih uključiti kasnije na ekranu Članovi.
        </p>
      </StepCard>
    );
  }


  return (
    <StepCard index={index} title="Tejline poruke ✨" done={false}>
      <p className="text-sm text-muted-foreground">Ovo nisu podsjetnici za tvoje obveze.</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Tejla ti ponekad pošalje lijepu ili korisnu poruku povezanu s tvojim planovima — primjerice
        da se bliži putovanje ili da ti je sutra kalendar prazan.
      </p>
      <button
        type="button"
        disabled={isLoading || setEnabled.isPending}
        onClick={async () => {
          await setEnabled.mutateAsync(true);
          markTejlaMessagesAnswered(uid);
          setAnswered(true);
        }}
        className="mt-3 w-full rounded-2xl px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
        style={{ backgroundImage: "var(--gradient-primary)" }}
      >
        Želim Tejline poruke
      </button>
      <button
        type="button"
        disabled={setEnabled.isPending}
        onClick={() => {
          // "Ne sada" writes nothing — the default stays false.
          markTejlaMessagesAnswered(uid);
          setAnswered(true);
        }}
        className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm font-semibold disabled:opacity-60"
      >
        Ne sada
      </button>
      <p className="mt-3 text-xs text-muted-foreground">
        Podsjetnici za tvoje obveze rade neovisno o ovoj postavci.
      </p>
    </StepCard>
  );
}

/** Install + notifications, reusable in Postavke. Tejla messages live in Članovi. */
export function SetupSteps() {
  const [webClient, setWebClient] = useState(true);
  useEffect(() => setWebClient(getClientKind() === "web"), []);
  return (
    <div className="space-y-3">
      {webClient ? <InstallStep /> : null}
      <NotificationsStep index={webClient ? 2 : 1} />
    </div>
  );
}

function OnboardingScreen({
  uid,
  onDone,
  onSkip,
}: {
  uid: string;
  onDone: () => void;
  onSkip: () => void;
}) {
  const [ready, setReady] = useState(false);
  const [bothDone, setBothDone] = useState(false);

  const [webClient, setWebClient] = useState(true);

  const refresh = useCallback(() => {
    setWebClient(getClientKind() === "web");
    setBothDone(!installStepApplies() && pushStatus() === "granted");
  }, []);


  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 1500);
    return () => window.clearInterval(id);
  }, [refresh]);

  if (ready) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight">Tejla je spremna.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Što prvo više ne želiš pamtiti?
        </p>
        <Link
          to="/inbox"
          onClick={onDone}
          className="mt-8 w-full rounded-3xl px-6 py-4 text-center text-base font-bold text-primary-foreground"
          style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-float)" }}
        >
          Daj Tejli prvu stvar
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <h1 className="text-[28px] font-bold leading-tight tracking-tight">
        {webClient ? "Još samo par koraka" : "Još samo dva koraka"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Da ti se Tejla može javiti kad je zatrebaš.
      </p>

      <div className="mt-6 space-y-3">
        {webClient ? <InstallStep /> : null}
        <NotificationsStep index={webClient ? 2 : 1} />
        <TejlaMessagesStep index={webClient ? 3 : 2} uid={uid} />
      </div>

      <button
        type="button"
        onClick={() => setReady(true)}
        className="mt-6 w-full rounded-3xl px-6 py-4 text-base font-bold text-primary-foreground"
        style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-float)" }}
      >
        {bothDone ? "Nastavi" : "Gotovo, nastavi"}
      </button>
      <button
        type="button"
        onClick={onSkip}
        className="mt-3 w-full rounded-3xl px-6 py-3 text-sm font-semibold text-muted-foreground"
      >
        Preskoči zasad
      </button>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Ove korake kasnije nađeš na ekranu Danas.
      </p>
    </main>
  );
}

/** Shows the setup steps once per account, right after the first sign-in. */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const { data: uid } = useMyUserId();
  const [decided, setDecided] = useState<"done" | "skipped" | null | undefined>(undefined);

  useEffect(() => {
    if (!uid) return;
    const stored = onboardingState(uid);
    if (stored) {
      setDecided(stored);
      return;
    }
    // Nothing left to set up AND the Tejla-messages question already answered.
    // The answer flag is separate from the preference itself, because "false"
    // is a legitimate answer ("Ne sada").
    if (!installStepApplies() && pushStatus() === "granted" && tejlaMessagesAnswered(uid)) {
      setOnboardingState(uid, "done");
      setDecided("done");
      return;
    }
    setDecided(null);
  }, [uid]);

  if (!uid || decided === undefined) return <>{children}</>;
  if (decided) return <>{children}</>;

  return (
    <OnboardingScreen
      uid={uid}

      onDone={() => {
        setOnboardingState(uid, "done");
        setDecided("done");
      }}
      onSkip={() => {
        setOnboardingState(uid, "skipped");
        setDecided("skipped");
      }}
    />
  );
}
