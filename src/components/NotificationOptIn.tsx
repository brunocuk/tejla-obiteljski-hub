import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { enablePush, pushStatus } from "@/lib/push";

export function NotificationOptIn() {
  const [status, setStatus] = useState<"unsupported" | "granted" | "denied" | "default" | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStatus(pushStatus());
  }, []);

  if (status === null || status === "granted" || status === "unsupported") return null;

  if (status === "denied") {
    return (
      <div className="card-soft mb-6 px-4 py-4">
        <p className="text-sm text-muted-foreground">
          Podsjetnici su isključeni. Možeš ih uključiti u postavkama uređaja.
        </p>
      </div>
    );
  }

  return (
    <div className="card-soft mb-6 flex items-start gap-3 px-4 py-4">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-accent-foreground">
        <BellRing className="size-5" strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">Želiš da Family Hub pamti umjesto tebe?</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Uključi podsjetnike za obveze, termine i rokove.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const result = await enablePush();
            setStatus(result === "granted" ? "granted" : result === "denied" ? "denied" : "default");
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