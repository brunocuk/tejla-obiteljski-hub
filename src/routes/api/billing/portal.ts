import { createFileRoute } from "@tanstack/react-router";

/** Stripe customer portal (upravljanje pretplatom, samo vlasnik). */
export const Route = createFileRoute("/api/billing/portal")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handlePortalRequest } = await import("@/lib/billing/checkout.server");
        return handlePortalRequest(request);
      },
    },
  },
});
