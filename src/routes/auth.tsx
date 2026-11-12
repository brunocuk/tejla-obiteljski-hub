import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { recordLegalAcceptance } from "@/lib/legal.functions";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Prijava — Tejla" },
      {
        name: "description",
        content: "Prijavi se u Tejla i povjeri joj sve što moraš zapamtiti — termine, zadatke i podsjetnike.",
      },
      { property: "og:title", content: "Prijava — Tejla" },
      {
        property: "og:description",
        content: "Prijavi se u Tejla i povjeri joj sve što moraš zapamtiti — termine, zadatke i podsjetnike.",
      },
    ],
  }),
  component: AuthPage,
});

const inputClass =
  "w-full rounded-2xl border border-border bg-card px-4 py-3 text-[15px] outline-none focus:border-primary";

function AuthPage() {
  const navigate = useNavigate();
  const recordAcceptance = useServerFn(recordLegalAcceptance);
  const mode = "login" as const;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  // Invitation links arrive with #type=invite (or recovery) and an active session.
  const [inviteMode, setInviteMode] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    const isInvite = hash.includes("type=invite") || hash.includes("type=recovery");
    if (isInvite) {
      setInviteMode(true);
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function onSetPassword(event: FormEvent) {
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
      const { error: err } = await supabase.auth.updateUser({
        password,
        ...(name.trim() ? { data: { name: name.trim() } } : {}),
      });
      if (err) {
        setError("Postavljanje lozinke nije uspjelo. Otvori poziv ponovno iz e-maila.");
        return;
      }
      // Evidencija prihvata (recenica iznad gumba); neuspjeh ne blokira,
      // LegalGate trazi potvrdu ponovno ako zapis ne postoji.
      try {
        await recordAcceptance({ data: { method: "obiteljska-pozivnica-registracija" } });
      } catch {
        // namjerno progutano
      }
      navigate({ to: "/", replace: true });
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Unesi ispravnu e-mail adresu.");
      return;
    }
    if (password.length < 8) {
      setError("Lozinka mora imati najmanje 8 znakova.");
      return;
    }

    setBusy(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) {
        setError("Neispravan e-mail ili lozinka.");
        return;
      }
      navigate({ to: "/", replace: true });
    } finally {
      setBusy(false);
    }
  }

  async function onForgot(event: FormEvent) {
    event.preventDefault();
    setError("");
    setInfo("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Unesi ispravnu e-mail adresu.");
      return;
    }
    setBusy(true);
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      // Never reveal whether the address exists.
      setInfo(
        "Ako taj e-mail postoji u Tejli, poslali smo link za promjenu lozinke. Provjeri i mapu neželjene pošte.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center bg-background px-5 py-10">
      <h1 className="text-[28px] font-bold leading-tight tracking-tight text-foreground">
        Tejla
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {inviteMode
          ? "Pozvan/a si u obiteljski prostor. Postavi lozinku i završi prijavu."
          : forgotMode
            ? "Upiši svoj e-mail i poslat ćemo ti link za novu lozinku."
            : "Prijavi se u svoj Tejla prostor."}
      </p>

      {inviteMode ? (
        <form onSubmit={onSetPassword} className="mt-7 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Ime
            </span>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Lozinka
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

          <p className="pt-1 text-xs leading-relaxed text-muted-foreground">
            Nastavkom prihvaćaš{" "}
            <a
              href="/uvjeti"
              target="_blank"
              rel="noreferrer"
              className="font-semibold underline underline-offset-2"
            >
              Uvjete korištenja
            </a>{" "}
            i potvrđuješ da si pročitao/la{" "}
            <a
              href="/privatnost"
              target="_blank"
              rel="noreferrer"
              className="font-semibold underline underline-offset-2"
            >
              Pravila privatnosti
            </a>
            .
          </p>

          <button
            type="submit"
            disabled={busy}
            className="mt-2 w-full rounded-3xl px-6 py-4 text-base font-bold text-primary-foreground disabled:opacity-60"
            style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-float)" }}
          >
            Pridruži se obitelji
          </button>
        </form>
      ) : forgotMode ? (
        <>
          <form onSubmit={onForgot} className="mt-7 space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                E-mail
              </span>
              <input
                className={inputClass}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>

            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
            {info ? <p className="text-sm font-medium text-accent-foreground">{info}</p> : null}

            <button
              type="submit"
              disabled={busy}
              className="mt-2 w-full rounded-3xl px-6 py-4 text-base font-bold text-primary-foreground disabled:opacity-60"
              style={{
                backgroundImage: "var(--gradient-primary)",
                boxShadow: "var(--shadow-float)",
              }}
            >
              {busy ? "Šaljem…" : "Pošalji link za novu lozinku"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setForgotMode(false);
              setError("");
              setInfo("");
            }}
            className="mt-4 text-sm font-semibold text-muted-foreground underline underline-offset-4"
          >
            Natrag na prijavu
          </button>
        </>
      ) : (
        <>
          <form onSubmit={onSubmit} className="mt-7 space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                E-mail
              </span>
              <input
                className={inputClass}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Lozinka
              </span>
              <input
                className={inputClass}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>

            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
            {info ? <p className="text-sm font-medium text-accent-foreground">{info}</p> : null}

            <button
              type="submit"
              disabled={busy}
              className="mt-2 w-full rounded-3xl px-6 py-4 text-base font-bold text-primary-foreground disabled:opacity-60"
              style={{
                backgroundImage: "var(--gradient-primary)",
                boxShadow: "var(--shadow-float)",
              }}
            >
              Prijavi se
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setForgotMode(true);
              setError("");
              setInfo("");
            }}
            className="mt-4 text-sm font-semibold text-muted-foreground underline underline-offset-4"
          >
            Zaboravljena lozinka?
          </button>

          <div className="card-soft mt-6 space-y-1 p-5">
            <p className="text-sm font-semibold">Tejla je trenutno u zatvorenom testiranju.</p>
            <p className="text-sm text-muted-foreground">Uskoro otvaramo vrata.</p>
          </div>
        </>
      )}

      <p className="mt-8 text-center text-xs text-muted-foreground">
        <a href="/privatnost" className="underline underline-offset-2">
          Pravila privatnosti
        </a>{" "}
        ·{" "}
        <a href="/uvjeti" className="underline underline-offset-2">
          Uvjeti korištenja
        </a>
      </p>
    </div>
  );
}
