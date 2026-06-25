import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Build output goes to web/dist, which the Go binary embeds.
// In dev, proxy API + share + health routes to the Go server on :8080.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://localhost:8080",
      "/s": "http://localhost:8080",
      "/healthz": "http://localhost:8080",
    },
  },
});
