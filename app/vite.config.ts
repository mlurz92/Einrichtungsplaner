import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import pkg from "./package.json" with { type: "json" };

// Tauri erwartet einen festen Port und keine Bildschirmlöschung im Dev-Modus.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  // Große Datendateien (Katalog, Konzepte) als JSON.parse-String: deutlich schnelleres Parsen als Objektliterale
  json: { stringify: true },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("node_modules/three/")) return "three";
          if (id.includes("@react-three") || id.includes("postprocessing") || id.includes("n8ao")) return "r3f";
          if (id.includes("/src/data/") && id.endsWith(".json")) return "data";
          return undefined;
        },
      },
    },
  },
  test: { environment: "node" },
});
