import { useEffect, useState } from "react";
import { BellRing, BellOff, Check, Share } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { enablePush, pushStatus, syncSubscription, type PushStatus } from "@/lib/push";
import { sendTestPush } from "@/lib/push.functions";

export function NotificationOptIn() {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const testPush = useServerFn(sendTestPush);

  useEffect(() => {
    const current = pushStatus();
    setStatus(current);
    if (current === "granted") void syncSubscription();
  }, []);

  if (status === null || status === "unsupported") return null;

  const card = "card-soft mb-6 flex items-start gap-3 px-4 py-4";
  const icon = "flex size-11 shrink-0 items-center justify-center rounded-2xl";

  if (status === "granted") {
    return (
      <div className={card}>
        <span className={`${icon} bg-primary-soft text-accent-foreground`}>
          <Check className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">Podsjetnici su uključeni</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {note ?? "Family Hub će te podsjetiti na obveze i rokove."}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setNote("Šaljem testnu obavijest…");
              try {
                await syncSubscription();
                const res = (await testPush({ data: undefined })) as {
                  sent: number;
                  total: number;
                };
                setNote(
                  res.sent > 0
                    ? "Testna obavijest je poslana. Provjeri obavijesti."
                    : "Nije bilo moguće poslati testnu obavijest. Pokušaj ponovno.",
                );
              } catch {
                setNote("Nije bilo moguće poslati testnu obavijest. Pokušaj ponovno.");
              }
              setBusy(false);
            }}
            className="mt-3 rounded-2xl bg-primary-soft px-4 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-60"
          >
            Pošalji testnu obavijest
          </button>
        </div>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className={card}>
        <span className={`${icon} bg-warm text-warm-foreground`}>
          <BellOff className="size-5" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">Obavijesti su blokirane</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Uključi ih u postavkama uređaja: Postavke → Obavijesti → Family Hub, pa se vrati u
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
          <p className="text-[15px] font-semibold">Dodaj Family Hub na početni zaslon</p>
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
        <p className="text-[15px] font-semibold">Želiš da Family Hub pamti umjesto tebe?</p>
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
