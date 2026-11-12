import { createFileRoute } from "@tanstack/react-router";

/** Pokretanje Stripe Checkouta za pretplatu obitelji (samo vlasnik). */
export const Route = createFileRoute("/api/billing/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleCheckoutRequest } = await import("@/lib/billing/checkout.server");
        return handleCheckoutRequest(request);
      },
    },
  },
});
