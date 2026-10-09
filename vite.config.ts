// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

// Vite only injects VITE_* values by default. Load the server-only Supabase
// settings into the Node process so server functions can read them from
// process.env; they are deliberately not added to Vite's client define map.
const serverEnv = loadEnv("development", process.cwd(), "");
for (const name of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "OPENAI_API_KEY", "OPENAI_MODEL"] as const) {
  if (!process.env[name] && serverEnv[name]) process.env[name] = serverEnv[name];
}

export default defineConfig({
  // Build the existing TanStack Start server for Vercel Functions.
  nitro: { preset: "vercel" },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
