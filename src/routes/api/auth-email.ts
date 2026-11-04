import { createFileRoute } from "@tanstack/react-router";

/**
 * Supabase Auth Send Email Hook (nova produkcija). Supabase potpisuje svaki
 * poziv standardwebhooks tajnom; sve ostalo (verifikacija, templati, Resend)
 * živi u @/lib/auth-email.server.
 */
export const Route = createFileRoute("/api/auth-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleAuthEmailRequest } = await import("@/lib/auth-email.server");
        return handleAuthEmailRequest(request);
      },
    },
  },
});
