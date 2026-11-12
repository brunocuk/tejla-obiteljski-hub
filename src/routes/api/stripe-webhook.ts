import { createFileRoute } from "@tanstack/react-router";

/**
 * Stripe webhook (Faza 1): potpis, idempotencija i sync stanja pretplata
 * zive u @/lib/billing/webhook.server.
 */
export const Route = createFileRoute("/api/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleStripeWebhookRequest } = await import("@/lib/billing/webhook.server");
        return handleStripeWebhookRequest(request);
      },
    },
  },
});
