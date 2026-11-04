// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Server routes (email, webhooks) need non-VITE_ env vars in process.env.
Object.assign(process.env, loadEnv(process.env["NODE_ENV"] ?? "development", process.cwd(), ""));

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Napomena (3.11.2026., selidba s Lovablea): raniji alias blok za "entities"
  // (lib/decode.js, lib/encode.js) uklonjen je jer novi entities (v5+) ima
  // exports mapu ("entities/decode") koju je alias zaobilazio i rušio nitro
  // build. Resolucija sada ide standardnim putem.
});
