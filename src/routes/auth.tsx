import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Prijava — Family Hub" },
      {
        name: "description",
        content: "Prijavi se ili izradi račun i vodi sve obiteljske obveze na jednom mjestu.",
      },
      { property: "og:title", content: "Prijava — Family Hub" },
      {
        property: "og:description",
        content: "Prijavi se u Family Hub i vodi obiteljske obveze na jednom mjestu.",
      },
    ],
  }),
  component: AuthPage,
});

const inputClass =
  "w-full rounded-2xl border border-border bg-card px-4 py-3 text-[15px] outline-none focus:border-primary";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
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
    setInfo("");
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
      navigate({ to: "/", replace: true });
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setInfo("");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Unesi ispravnu e-mail adresu.");
      return;
    }
    if (password.length < 8) {
      setError("Lozinka mora imati najmanje 8 znakova.");
      return;
    }
    if (mode === "register") {
      if (!name.trim()) {
        setError("Unesi svoje ime.");
        return;
      }
      if (password !== password2) {
        setError("Lozinke se ne podudaraju.");
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === "login") {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) {
          setError("Neispravan e-mail ili lozinka.");
          return;
        }
        navigate({ to: "/", replace: true });
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { name: name.trim() },
          },
        });
        if (err) {
          setError(
            err.message.toLowerCase().includes("registered")
              ? "Račun s ovim e-mailom već postoji."
              : "Registracija nije uspjela. Pokušaj ponovno.",
          );
          return;
        }
        if (data.session) {
          navigate({ to: "/", replace: true });
          return;
        }
        setInfo("Provjeri e-mail i potvrdi račun kako bi se mogao prijaviti.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center bg-background px-5 py-10">
      <h1 className="text-[28px] font-bold leading-tight tracking-tight text-foreground">
        Family Hub
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {inviteMode
          ? "Pozvan/a si u obiteljski prostor. Postavi lozinku i završi prijavu."
          : mode === "login"
            ? "Prijavi se u svoj obiteljski prostor."
            : "Izradi svoj račun."}
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

          <button
            type="submit"
            disabled={busy}
            className="mt-2 w-full rounded-3xl px-6 py-4 text-base font-bold text-primary-foreground disabled:opacity-60"
            style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-float)" }}
          >
            Pridruži se obitelji
          </button>
        </form>
      ) : (
      <>

      <form onSubmit={onSubmit} className="mt-7 space-y-3">
        {mode === "register" ? (
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
        ) : null}

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
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </label>

        {mode === "register" ? (
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
        ) : null}

        {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
        {info ? <p className="text-sm font-medium text-accent-foreground">{info}</p> : null}

        <button
          type="submit"
          disabled={busy}
          className="mt-2 w-full rounded-3xl px-6 py-4 text-base font-bold text-primary-foreground disabled:opacity-60"
          style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-float)" }}
        >
          {mode === "login" ? "Prijavi se" : "Izradi račun"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "login" ? "register" : "login");
          setError("");
          setInfo("");
        }}
        className="mt-5 text-sm font-semibold text-primary"
      >
        {mode === "login" ? "Nemaš račun? Registriraj se" : "Već imaš račun? Prijavi se"}
      </button>
      </>
      )}
    </div>
  );
}