import { Sparkles } from "lucide-react";
import { useSetTejlaMessages, useTejlaMessagesEnabled } from "@/lib/notification-prefs";

/** Opt-in switch for Tejla's occasional contextual messages. Default: OFF. */
export function TejlaMessagesToggle() {
  const { data: enabled = false, isLoading } = useTejlaMessagesEnabled();
  const setEnabled = useSetTejlaMessages();

  return (
    <div className="mt-7 flex items-start gap-3 rounded-3xl border border-border px-4 py-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-accent-foreground">
        <Sparkles className="size-4" strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">Tejline poruke</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Povremene korisne i lijepe poruke povezane s tvojim planovima.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Tejline poruke"
        disabled={isLoading || setEnabled.isPending}
        onClick={() => setEnabled.mutate(!enabled)}
        className={`mt-1 flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          enabled ? "bg-accent-foreground" : "bg-muted"
        }`}
      >
        <span
          className={`size-6 rounded-full bg-background transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
