import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, FileText, Image, Keyboard, Plus, ClipboardPaste } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { normalizeItem, setAnalysis, type ExtractedItem } from "@/lib/hub-store";

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read error"));
    reader.readAsDataURL(file);
  });
}

export const Route = createFileRoute("/inbox")({
  head: () => ({
    meta: [
      { title: "Inbox — Family Hub" },
      {
        name: "description",
        content:
          "Pošalji fotografiju, screenshot, PDF ili tekst i AI izdvaja obiteljske obveze i termine.",
      },
      { property: "og:title", content: "Inbox — Family Hub" },
      {
        property: "og:description",
        content: "Pošalji nam bilo što — AI pronalazi ono što je važno za tvoju obitelj.",
      },
    ],
  }),
  component: InboxPage,
});

const options = [
  { icon: Camera, label: "Fotografiraj", hint: "Slikaj papir ili obavijest" },
  { icon: Image, label: "Screenshot / galerija", hint: "Odaberi iz galerije" },
  { icon: FileText, label: "PDF dokument", hint: "Obavijesti i suglasnosti" },
  { icon: ClipboardPaste, label: "Zalijepi tekst", hint: "Email ili poruka" },
  { icon: Keyboard, label: "Ručno dodaj", hint: "Upiši sam" },
];

function InboxPage() {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ url: string; name: string; file: File } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url);
  }, [preview]);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPreview({ url: URL.createObjectURL(file), name: file.name, file });
    e.target.value = "";
  };

  const analyze = async () => {
    if (!preview) return;
    setLoading(true);
    setError(null);
    try {
      const dataUrl = await readAsDataUrl(preview.file);
      const res = await fetch("/api/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl, mimeType: preview.file.type }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { items?: Partial<ExtractedItem>[] };
      setAnalysis((data.items ?? []).map(normalizeItem));
      await navigate({ to: "/analiza" });
    } catch {
      setError("Analiza nije uspjela. Pokušaj ponovno.");
    } finally {
      setLoading(false);
    }
  };

  const openPicker = (label: string) => {
    if (label === "Fotografiraj") cameraRef.current?.click();
    else if (label === "Screenshot / galerija") galleryRef.current?.click();
  };

  return (
    <AppShell>
      <PageHeader title="Inbox" subtitle="Pošalji nam bilo što. AI će pronaći ono što je važno za tvoju obitelj." />

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

      {preview ? (
        <section className="mb-7">
          <div className="card-soft overflow-hidden">
            <img src={preview.url} alt="Odabrana slika" className="max-h-80 w-full object-contain" />
            <p className="truncate px-4 py-3 text-sm text-muted-foreground">{preview.name}</p>
          </div>
          <button
            type="button"
            onClick={analyze}
            disabled={loading}
            className="mt-4 flex w-full items-center justify-center rounded-3xl px-6 py-4 text-base font-bold text-primary-foreground disabled:opacity-60"
            style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-float)" }}
          >
            {loading ? "Analiziram…" : "Analiziraj"}
          </button>
          {error ? (
            <p className="mt-3 text-center text-sm font-medium text-destructive">{error}</p>
          ) : null}
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="mt-3 w-full rounded-2xl px-4 py-2 text-sm font-semibold text-muted-foreground"
          >
            Ukloni sliku
          </button>
        </section>
      ) : null}

      <Link
        to="/analiza"
        className="flex w-full items-center justify-center gap-2 rounded-3xl px-6 py-6 text-lg font-bold text-primary-foreground"
        style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-float)" }}
      >
        <Plus className="size-6" strokeWidth={2.4} />
        Dodaj
      </Link>

      <ul className="mt-7 space-y-3">
        {options.map(({ icon: Icon, label, hint }) => (
          <li key={label}>
            {label === "Fotografiraj" || label === "Screenshot / galerija" ? (
              <button
                type="button"
                onClick={() => openPicker(label)}
                className="card-soft flex w-full items-center gap-4 px-4 py-4 text-left transition-opacity active:opacity-70"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-accent-foreground">
                  <Icon className="size-5" strokeWidth={1.8} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold">{label}</span>
                  <span className="block text-sm text-muted-foreground">{hint}</span>
                </span>
              </button>
            ) : (
              <Link
                to="/analiza"
                className="card-soft flex items-center gap-4 px-4 py-4 transition-opacity active:opacity-70"
              >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-accent-foreground">
                <Icon className="size-5" strokeWidth={1.8} />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold">{label}</span>
                <span className="block text-sm text-muted-foreground">{hint}</span>
              </span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </AppShell>
  );
}