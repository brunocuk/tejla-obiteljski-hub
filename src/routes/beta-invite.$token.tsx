import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { checkBetaInvite, redeemBetaInvite } from "@/lib/beta.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/beta-invite/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Beta pozivnica — Tejla" },
      {
        name: "description",
        content: "Aktiviraj svoju Tejla beta pozivnicu i izradi vlastiti obiteljski prostor.",
      },
      { property: "og:title", content: "Beta pozivnica — Tejla" },
      {
        property: "og:description",
        content: "Aktiviraj svoju Tejla beta pozivnicu i izradi vlastiti obiteljski prostor.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BetaInvitePage,
});

const inputClass =
  "w-full rounded-2xl border border-border bg-card px-4 py-3 text-[15px] outline-none focus:border-primary";

function BetaInvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const check = useServerFn(checkBetaInvite);
  const redeem = useServerFn(redeemBetaInvite);
  const [state, setState] = useState<string>("loading");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void check({ data: { token } })
      .then((res) => setState(res.state))
      .catch(() => setState("invalid"));
  }, [check, token]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== password2) {
      setError("Lozinke se ne podudaraju.");
      return;
    }
    setBusy(true);
    try {
      const res = await redeem({ data: { token, email: email.trim(), password, name } });
      if (!res.ok) {
        if ("existing" in res && res.existing) {
          setError("Račun s ovim e-mailom već postoji. Prijavi se svojim postojećim računom.");
          return;
        }
        setState(res.state);
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError("Račun je izrađen. Prijavi se na ekranu za prijavu.");
        return;
      }
      navigate({ to: "/", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nešto nije prošlo kako treba.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Učitavanje…
      </div>
    );
  }

  if (state !== "valid") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight">Tejla</h1>
        <div className="card-soft mt-6 space-y-2 p-5">
          <p className="text-base font-semibold">Ova beta pozivnica više nije aktivna.</p>
          <p className="text-sm text-muted-foreground">
            Ako misliš da je riječ o pogrešci, zatraži novu pozivnicu.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <h1 className="text-[28px] font-bold leading-tight tracking-tight">Tejla</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Dobrodošao/la u zatvoreno testiranje. Izradi svoj račun i vlastiti obiteljski prostor.
      </p>
      <form onSubmit={onSubmit} className="mt-7 space-y-3">
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
          {busy ? "Izrađujem račun…" : "Izradi svoj Tejla račun"}
        </button>
      </form>
    </main>
  );
}