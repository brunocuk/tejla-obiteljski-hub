import { createFileRoute } from "@tanstack/react-router";

// Public VAPID key only — the private key never leaves the server.
export const Route = createFileRoute("/api/public/vapid-key")({
  server: {
    handlers: {
      GET: () => Response.json({ key: process.env["VAPID_PUBLIC_KEY"] ?? "" }),
    },
  },
});
