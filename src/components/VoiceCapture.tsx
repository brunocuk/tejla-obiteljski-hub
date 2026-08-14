import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";

/** Records a short Croatian voice note and returns the transcript. */
export function VoiceCapture({
  onTranscript,
  onCancel,
}: {
  onTranscript: (text: string) => void;
  onCancel: () => void;
}) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [state, setState] = useState<"idle" | "recording" | "working">("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state !== "recording") return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [state]);

  useEffect(
    () => () => {
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const start = async () => {
    setError(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Ovaj preglednik ne podržava snimanje glasa.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm", "audio/mp4"].find(
        (t) => MediaRecorder.isTypeSupported?.(t) ?? false,
      );
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = recorder.mimeType || "audio/webm";
        void send(new Blob(chunksRef.current, { type }), type);
      };
      recorderRef.current = recorder;
      setSeconds(0);
      recorder.start();
      setState("recording");
    } catch {
      setError("Nemamo pristup mikrofonu. Dopusti pristup u postavkama preglednika.");
    }
  };

  const send = async (blob: Blob, type: string) => {
    setState("working");
    try {
      const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
      const form = new FormData();
      form.append("file", new File([blob], `glas.${ext}`, { type }));
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { text?: string };
      const text = (data.text ?? "").trim();
      if (!text) {
        setError("Nismo čuli ništa. Pokušaj ponovno.");
        setState("idle");
        return;
      }
      onTranscript(text);
    } catch {
      setError("Prepoznavanje govora nije uspjelo. Pokušaj ponovno.");
      setState("idle");
    }
  };

  const stop = () => recorderRef.current?.stop();

  return (
    <section className="card-soft mt-5 space-y-4 p-5 text-center">
      <div>
        <p className="text-[15px] font-semibold">Reci glasom</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Ispričaj što treba zapamtiti — npr. „Lara ima zubara sutra u 8 navečer”.
        </p>
      </div>

      {state === "working" ? (
        <p className="text-sm font-semibold">Slušam i pretvaram u tekst…</p>
      ) : (
        <button
          type="button"
          onClick={state === "recording" ? stop : start}
          className="mx-auto flex size-20 items-center justify-center rounded-full text-primary-foreground"
          style={{
            backgroundImage: "var(--gradient-primary)",
            boxShadow: "var(--shadow-float)",
          }}
          aria-label={state === "recording" ? "Zaustavi snimanje" : "Započni snimanje"}
        >
          {state === "recording" ? (
            <Square className="size-7" strokeWidth={2.4} />
          ) : (
            <Mic className="size-8" strokeWidth={2} />
          )}
        </button>
      )}

      {state === "recording" ? (
        <p className="text-sm font-semibold text-accent-foreground">
          Snimam… {String(Math.floor(seconds / 60)).padStart(2, "0")}:
          {String(seconds % 60).padStart(2, "0")} · dodirni za kraj
        </p>
      ) : null}

      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

      <button
        type="button"
        onClick={() => {
          recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
          onCancel();
        }}
        className="w-full rounded-2xl px-4 py-2 text-sm font-semibold text-muted-foreground"
      >
        Odustani
      </button>
    </section>
  );
}
