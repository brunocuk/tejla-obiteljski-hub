import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  amIAppAdmin,
  createBetaInvite,
  listBetaInvites,
  revokeBetaInvite,
} from "@/lib/beta.functions";

export const Route = createFileRoute("/_authenticated/beta-admin")({
  head: () => ({
    meta: [
      { title: "Beta pozivnice — Tejla" },
      { name: "description", content: "Upravljanje Tejla beta pozivnicama za testere." },
      { property: "og:title", content: "Beta pozivnice — Tejla" },
      { property: "og:description", content: "Upravljanje Tejla beta pozivnicama za testere." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BetaAdminPage,
});

function statusLabel(invite: { status: string; expires_at: string }) {
  if (invite.status === "used") return "Iskorištena";
  if (invite.status === "revoked") return "Opozvana";
  if (new Date(invite.expires_at).getTime() <= Date.now()) return "Istekla";
  return "Aktivna";
}

function formatMoment(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function BetaAdminPage() {
  const queryClient = useQueryClient();
  const checkAdmin = useServerFn(amIAppAdmin);
  const list = useServerFn(listBetaInvites);
  const create = useServerFn(createBetaInvite);
  const revoke = useServerFn(revokeBetaInvite);
  const [label, setLabel] = useState("");
  const [copied, setCopied] = useState("");

  const { data: admin, isLoading } = useQuery({
    queryKey: ["am-i-app-admin"],
    queryFn: () => checkAdmin({ data: undefined }),
  });
  const isAdmin = Boolean(admin?.isAdmin);

  const { data: invites = [] } = useQuery({
    queryKey: ["beta-invites"],
    enabled: isAdmin,
    queryFn: () => list({ data: undefined }),
  });

  if (isLoading) {
    return <p className="px-5 py-10 text-sm text-muted-foreground">Učitavanje…</p>;
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto w-full max-w-md px-5 py-10">
        <p className="text-sm text-muted-foreground">Ova stranica nije dostupna.</p>
      </main>
    );
  }

  async function handleCreate() {
    await create({ data: { label, days: 7 } });
    setLabel("");
    await queryClient.invalidateQueries({ queryKey: ["beta-invites"] });
  }

  async function handleRevoke(id: string) {
    await revoke({ data: { id } });
    await queryClient.invalidateQueries({ queryKey: ["beta-invites"] });
  }

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-28 pt-8">
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Natrag u Tejlu
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">Beta pozivnice</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pozivnica vrijedi 6 tjedana za aktivaciju i može se iskoristiti samo jednom. Nakon
        aktivacije korisnički račun ostaje aktivan.
      </p>

      <div className="card-soft mt-6 space-y-3 p-5">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ime testera (neobavezno)"
          className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-[15px] outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={() => void handleCreate()}
          className="w-full rounded-3xl px-6 py-4 text-base font-bold text-primary-foreground"
          style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-float)" }}
        >
          Generiraj novu pozivnicu
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {invites.map((invite) => {
          const status = statusLabel(invite);
          const link = `${typeof window !== "undefined" ? window.location.origin : ""}/beta-invite/${invite.token}`;
          return (
            <div key={invite.id} className="card-soft space-y-2 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{invite.label || "Beta tester"}</p>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
                  {status}
                </span>
              </div>
              <p className="break-all text-xs text-muted-foreground">{link}</p>
              <div className="space-y-1 rounded-2xl bg-secondary/50 p-3">
                <StatusRow label="Registracija" value={formatMoment(invite.tester?.registered_at)} />
                <StatusRow
                  label="Prostor kreiran"
                  value={invite.tester ? (invite.tester.has_workspace ? "Da" : "Ne") : "—"}
                />
                <StatusRow
                  label="Zadnja prijava"
                  value={formatMoment(invite.tester?.last_sign_in_at)}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(link);
                    setCopied(invite.id);
                  }}
                  className="rounded-2xl border border-border px-4 py-2 text-sm font-semibold"
                >
                  {copied === invite.id ? "Kopirano" : "Kopiraj link"}
                </button>
                {status === "Aktivna" ? (
                  <button
                    type="button"
                    onClick={() => void handleRevoke(invite.id)}
                    className="rounded-2xl border border-border px-4 py-2 text-sm font-semibold text-destructive"
                  >
                    Opozovi
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
        {invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">Još nema generiranih pozivnica.</p>
        ) : null}
      </div>
    </main>
  );
}