import { useEffect, useState } from "react";
import { BellRing, BellOff, Share } from "lucide-react";
import { enablePush, pushStatus, type PushStatus } from "@/lib/push";

export function NotificationOptIn() {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    setStatus(pushStatus());
  }, []);

  if (status === null || status === "unsupported" || status === "granted") return null;

  const card = "card-soft mb-6 flex items-start gap-3 px-4 py-4";
  const icon = "flex size-11 shrink-0 items-center justify-center rounded-2xl";

  if (status === "denied") {
    return (
      <div className={card}>
        <span className={`${icon} bg-warm text-warm-foreground`}>
          <BellOff className="size-5" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">Obavijesti su blokirane</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Uključi ih u postavkama uređaja: Postavke → Obavijesti → Tejla, pa se vrati u
            aplikaciju.
          </p>
        </div>
      </div>
    );
  }

  if (status === "needs-install") {
    return (
      <div className={card}>
        <span className={`${icon} bg-primary-soft text-accent-foreground`}>
          <Share className="size-5" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">Dodaj Tejla na početni zaslon</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Na iPhoneu obavijesti rade samo iz instalirane aplikacije. Otvori izbornik Podijeli i
            odaberi „Dodaj na početni zaslon", pa uključi podsjetnike iz te aplikacije.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={card}>
      <span className={`${icon} bg-primary-soft text-accent-foreground`}>
        <BellRing className="size-5" strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">Želiš da Tejla pamti umjesto tebe?</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {note ?? "Uključi podsjetnike za obveze, termine i rokove."}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setNote(null);
            const result = await enablePush();
            if (result === "error") {
              setNote("Podsjetnike nije bilo moguće uključiti. Pokušaj ponovno.");
            } else {
              setStatus(result);
            }
            setBusy(false);
          }}
          className="mt-3 w-full rounded-2xl px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
          style={{ backgroundImage: "var(--gradient-primary)" }}
        >
          {busy ? "Uključujem…" : "Uključi podsjetnike"}
        </button>
      </div>
    </div>
  );
}
