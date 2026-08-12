import { createFileRoute, redirect } from "@tanstack/react-router";

// AI analysis now lives inside the Inbox flow; keep the old path working.
export const Route = createFileRoute("/_authenticated/analiza")({
  beforeLoad: () => {
    throw redirect({ to: "/inbox" });
  },
});
