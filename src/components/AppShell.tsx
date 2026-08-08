import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { CalendarDays, Home, Inbox, Sparkles, Users } from "lucide-react";

const items = [
  { to: "/", label: "Danas", icon: Home },
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/analiza", label: "AI", icon: Sparkles },
  { to: "/kalendar", label: "Kalendar", icon: CalendarDays },
  { to: "/obitelj", label: "Obitelj", icon: Users },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <main className="flex-1 px-5 pt-8 pb-32">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-border bg-card/90 px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
        <ul className="flex items-stretch justify-between">
          {items.map(({ to, label, icon: Icon }) => (
            <li key={to} className="flex-1">
              <Link
                to={to}
                activeOptions={{ exact: to === "/" }}
                className="group flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-muted-foreground transition-colors data-[status=active]:text-primary"
              >
                <Icon className="size-5" strokeWidth={1.8} />
                <span className="text-[11px] font-medium tracking-tight">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-[28px] font-bold leading-tight tracking-tight text-foreground">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
    </header>
  );
}