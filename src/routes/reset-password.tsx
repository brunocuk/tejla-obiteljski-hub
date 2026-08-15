import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Nova lozinka — Tejla" },
      {
        name: "description",
        content: "Postavi novu lozinku za svoj Tejla prostor i nastavi tamo gdje si stala.",
      },
      { property: "og:title", content: "Nova lozinka — Tejla" },
      {
        property: "og:description",
        content: "Postavi novu lozinku za svoj Tejla prostor i nastavi tamo gdje si stala.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

const inputClass =
  "w-full rounded-2xl border border-border bg-card px-4 py-3 text-[15px] outline-none focus:border-primary";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<"checking" | "ok" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
      const search = new URLSearchParams(window.location.search);

      // Explicit error from the recovery link (expired / already used).
      if (params.get("error") || search.get("error")) {
        if (!cancelled) setReady("invalid");
        return;
      }

      // Implicit flow: tokens arrive in the URL hash.
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error: err } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!cancelled) setReady(err ? "invalid" : "ok");
        return;
      }

      // PKCE flow: ?code=... is exchanged for a session.
      const code = search.get("code");
      if (code) {
        const { error: err } = await supabase.auth.exchangeCodeForSession(code);
        if (!cancelled) setReady(err ? "invalid" : "ok");
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!cancelled) setReady(data.session ? "ok" : "invalid");
    };

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Lozinka mora imati najmanje 8 znakova.");
      return;
    }
    if (password !== password2) {
      setError("Lozinke se ne podudaraju.");
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) {
        setError("Lozinku nije bilo moguće promijeniti. Zatraži novi link i pokušaj ponovno.");
        return;
      }
      setDone(true);
      await supabase.auth.signOut();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center bg-background px-5 py-10">
      <h1 className="text-[28px] font-bold leading-tight tracking-tight text-foreground">Tejla</h1>
      <p className="mt-1 text-sm text-muted-foreground">Postavi novu lozinku.</p>

      {ready === "checking" ? (
        <p className="mt-7 text-sm text-muted-foreground">Provjeravam link…</p>
      ) : null}

      {ready === "invalid" ? (
        <div className="card-soft mt-7 space-y-3 p-5">
          <p className="text-sm font-semibold">Link je istekao ili je već iskorišten.</p>
          <p className="text-sm text-muted-foreground">
            Zatraži novi link za promjenu lozinke i otvori ga na istom uređaju.
          </p>
          <button
            type="button"
            onClick={() => navigate({ to: "/auth", replace: true })}
            className="w-full rounded-3xl px-6 py-4 text-base font-bold text-primary-foreground"
            style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-float)" }}
          >
            Natrag na prijavu
          </button>
        </div>
      ) : null}

      {ready === "ok" && !done ? (
        <form onSubmit={onSubmit} className="mt-7 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Nova lozinka
            </span>
            <input
              className={inputClass}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Ponovi lozinku
            </span>
            <input
              className={inputClass}
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              autoComplete="new-password"
            />
          </label>

          {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

          <button
            type="submit"
            disabled={busy}
            className="mt-2 w-full rounded-3xl px-6 py-4 text-base font-bold text-primary-foreground disabled:opacity-60"
            style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-float)" }}
          >
            {busy ? "Spremam…" : "Spremi novu lozinku"}
          </button>
        </form>
      ) : null}

      {done ? (
        <div className="card-soft mt-7 space-y-3 p-5">
          <p className="text-sm font-semibold">Lozinka je promijenjena.</p>
          <p className="text-sm text-muted-foreground">Prijavi se novom lozinkom.</p>
          <button
            type="button"
            onClick={() => navigate({ to: "/auth", replace: true })}
            className="w-full rounded-3xl px-6 py-4 text-base font-bold text-primary-foreground"
            style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-float)" }}
          >
            Idi na prijavu
          </button>
        </div>
      ) : null}
    </div>
  );
}
