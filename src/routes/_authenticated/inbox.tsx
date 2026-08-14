import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, ClipboardPaste, FileText, Image, Keyboard, Mic, Plus, X } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { AnalysisResults } from "@/components/AnalysisResults";
import { ManualEventForm } from "@/components/ManualEventForm";
import { VoiceCapture } from "@/components/VoiceCapture";
import { normalizeItem, type ExtractedItem } from "@/lib/hub-store";
import { applyRelativeReminders } from "@/lib/relative-time";
import { useFamilyMembers, useMyFamilyId, useMyUserId } from "@/lib/family-workspace";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({
    meta: [
      { title: "Inbox — Tejla" },
      {
        name: "description",
        content:
          "Ubaci fotografiju, screenshot, PDF ili tekst — AI izdvaja obveze i termine, a ti ih odmah spremaš.",
      },
      { property: "og:title", content: "Inbox — Tejla" },
      {
        property: "og:description",
        content: "Ubaci bilo što — AI pronalazi ono što je važno i sprema u kalendar.",
      },
    ],
  }),
  component: InboxPage,
});

const RECENT_KEY = "family-hub-recent";

type RecentEntry = { id: string; label: string; at: string; count: number };

function readRecent(): RecentEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as RecentEntry[]).slice(0, 8) : [];
  } catch {
    return [];
  }
}

function writeRecent(entries: RecentEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(entries.slice(0, 8)));
  } catch {
    // History is a convenience only.
  }
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read error"));
    reader.readAsDataURL(file);
  });
}

const relative = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "upravo sad";
  if (mins < 60) return `prije ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `prije ${hours} h`;
  return `prije ${Math.round(hours / 24)} d`;
};

const localToday = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

type Mode = "idle" | "voice" | "text" | "manual" | "results";

function InboxPage() {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("idle");
  const [preview, setPreview] = useState<{ url: string | null; name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [analysis, setAnalysis] = useState<ExtractedItem[]>([]);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const { data: familyId } = useMyFamilyId();
  const { data: userId } = useMyUserId();
  const { data: familyMembers } = useFamilyMembers(familyId);
  const speaker = (familyMembers ?? []).find((m) => m.linked_user_id === userId)?.name ?? "";
  const memberNames = (familyMembers ?? []).map((m) => m.name);

  useEffect(() => setRecent(readRecent()), []);

  const logRecent = (label: string, count: number) => {
    const next = [
      { id: `${Date.now()}`, label, at: new Date().toISOString(), count },
      ...readRecent(),
    ];
    writeRecent(next);
    setRecent(next.slice(0, 8));
  };

  const runAnalysis = async (
    payload: { image: string; mimeType: string } | { text: string },
    label: string,
  ) => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          today: localToday(),
          nowTime: new Date().toTimeString().slice(0, 5),
          speaker,
          members: memberNames,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { items?: Partial<ExtractedItem>[] };
      const spoken = "text" in payload ? payload.text : "";
      const items = applyRelativeReminders(
        (data.items ?? []).map(normalizeItem),
        spoken,
        new Date(),
      );
      setAnalysis(items);
      setMode("results");
      logRecent(label, items.length);
    } catch {
      setError("Analiza nije uspjela. Pokušaj ponovno.");
    } finally {
      setLoading(false);
    }
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSheetOpen(false);
    const isImage = file.type.startsWith("image/");
    setPreview({ url: isImage ? URL.createObjectURL(file) : null, name: file.name });
    const dataUrl = await readAsDataUrl(file);
    await runAnalysis({ image: dataUrl, mimeType: file.type }, file.name);
  };

  const reset = () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setAnalysis([]);
    setText("");
    setError(null);
    setMode("idle");
  };

  const openOption = (key: string) => {
    setSheetOpen(false);
    setError(null);
    setInfo(null);
    if (key === "camera") cameraRef.current?.click();
    else if (key === "gallery") galleryRef.current?.click();
    else if (key === "pdf") pdfRef.current?.click();
    else if (key === "voice") setMode("voice");
    else if (key === "text") setMode("text");
    else if (key === "manual") setMode("manual");
  };

  const options = [
    { key: "voice", icon: Mic, label: "Reci glasom", hint: "Ispričaj što treba zapamtiti" },
    { key: "camera", icon: Camera, label: "Fotografiraj", hint: "Slikaj papir ili obavijest" },
    { key: "gallery", icon: Image, label: "Screenshot / galerija", hint: "Odaberi iz galerije" },
    { key: "pdf", icon: FileText, label: "PDF dokument", hint: "Obavijesti i suglasnosti" },
    { key: "text", icon: ClipboardPaste, label: "Zalijepi tekst", hint: "Email ili poruka" },
    { key: "manual", icon: Keyboard, label: "Ručno dodaj", hint: "Upiši sam" },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Inbox"
        subtitle="Ubaci bilo što — AI pronalazi ono što je važno i sprema u kalendar."
      />

      <input
        ref={cameraRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        capture="environment"
        onChange={onPick}
        className="hidden"
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={onPick}
        className="hidden"
      />
      <input
        ref={pdfRef}
        type="file"
        accept="application/pdf"
        onChange={onPick}
        className="hidden"
      />

      {mode === "idle" && !loading ? (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-3xl px-6 py-6 text-lg font-bold text-primary-foreground"
          style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-float)" }}
        >
          <Plus className="size-6" strokeWidth={2.4} />
          Ubaci
        </button>
      ) : null}

      {info ? (
        <p className="mt-4 rounded-2xl bg-primary-soft px-4 py-3 text-center text-sm font-semibold text-accent-foreground">
          {info}
        </p>
      ) : null}

      {preview ? (
        <section className="mt-5">
          <div className="card-soft overflow-hidden">
            {preview.url ? (
              <img
                src={preview.url}
                alt="Odabrana datoteka"
                className="max-h-72 w-full object-contain"
              />
            ) : null}
            <p className="truncate px-4 py-3 text-sm text-muted-foreground">{preview.name}</p>
          </div>
        </section>
      ) : null}

      {loading ? (
        <div className="card-soft mt-5 px-5 py-8 text-center">
          <p className="text-sm font-semibold">Pregledavam…</p>
          <p className="mt-1 text-sm text-muted-foreground">AI čita sadržaj i traži obveze.</p>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4">
          <p className="text-center text-sm font-medium text-destructive">{error}</p>
          <button
            type="button"
            onClick={reset}
            className="mt-3 w-full rounded-2xl px-4 py-2 text-sm font-semibold text-muted-foreground"
          >
            Počni ispočetka
          </button>
        </div>
      ) : null}

      {mode === "text" && !loading ? (
        <section className="card-soft mt-5 space-y-3 p-4">
          <label className="block text-sm font-semibold">
            Zalijepi tekst
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={7}
              placeholder="Zalijepi email, poruku iz grupe ili obavijest…"
              className="mt-1 w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-[15px] outline-none focus:border-primary"
            />
          </label>
          <button
            type="button"
            disabled={!text.trim()}
            onClick={() => runAnalysis({ text: text.trim() }, "Zalijepljeni tekst")}
            className="w-full rounded-3xl px-6 py-4 text-base font-bold text-primary-foreground disabled:opacity-40"
            style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-float)" }}
          >
            Analiziraj tekst
          </button>
          <button
            type="button"
            onClick={reset}
            className="w-full rounded-2xl px-4 py-2 text-sm font-semibold text-muted-foreground"
          >
            Odustani
          </button>
        </section>
      ) : null}

      {mode === "voice" && !loading ? (
        <VoiceCapture
          onTranscript={(transcript) => runAnalysis({ text: transcript }, "Glasovni unos")}
          onCancel={reset}
        />
      ) : null}

      {mode === "manual" ? <ManualEventForm onClose={reset} /> : null}

      {mode === "results" && !loading ? (
        <div className="mt-6">
          <AnalysisResults
            analysis={analysis}
            onSaved={(count) => {
              reset();
              setInfo(`Spremljeno u kalendar (${count}).`);
            }}
            onDiscard={reset}
          />
        </div>
      ) : null}

      {mode === "idle" && !loading && recent.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Nedavno
          </h2>
          <ul className="card-soft divide-y divide-border">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{r.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {relative(r.at)} · {r.count} obveza
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sheetOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30">
          <div className="w-full max-w-md rounded-t-3xl bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight">Što želiš ubaciti?</h2>
              <button
                type="button"
                aria-label="Zatvori"
                onClick={() => setSheetOpen(false)}
                className="rounded-xl p-1 text-muted-foreground active:opacity-60"
              >
                <X className="size-5" />
              </button>
            </div>
            <ul className="space-y-3">
              {options.map(({ key, icon: Icon, label, hint }) => (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => openOption(key)}
                    className="card-soft flex w-full items-center gap-4 px-4 py-4 text-left active:opacity-70"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-accent-foreground">
                      <Icon className="size-5" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold">{label}</span>
                      <span className="block text-sm text-muted-foreground">{hint}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
