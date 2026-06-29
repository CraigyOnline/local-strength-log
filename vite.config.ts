import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Replaces @lovable.dev/vite-tanstack-config with direct plugin calls.
// Each plugin maps to one feature the Lovable wrapper provided:
//
//   tanstackStart  — SSR dev server, HTML injection, shellComponent, file-based
//                    routing codegen (includes @tanstack/router-plugin internally)
//   react()        — JSX transform
//   tailwindcss()  — Tailwind v4 CSS processing
//   tsconfigPaths  — resolves @/* to src/*
//
// Intentionally omitted (Lovable-only, not needed outside the editor):
//   - componentTagger      (visual editor overlay)
//   - VITE_* env injection (no import.meta.env usage exists in this codebase)
//   - sandbox port/host    (Lovable iframe detection)
//   - error logger plugin  (build-time Lovable editor integration)
//
// Nitro / cloudflare Worker build is kept via tanstackStart's default behaviour.
// src/server.ts is still the server entry, passed via the server option below.
// Nothing about the running application changes in this commit.

export default defineConfig({
  plugins: [
    tanstackStart({
      // Keep identical to what the Lovable wrapper was passing:
      // points TanStack Start's Nitro build at src/server.ts
      server: { entry: "server" },
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  resolve: {
    // Prevent duplicate React/router instances — previously handled by the wrapper.
    dedupe: ["react", "react-dom", "@tanstack/react-router"],
  },
});
