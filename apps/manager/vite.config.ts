import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Lanebreak Manager: plain-JS UI plus the Watch match view (React) on the Lanebound sim.
// Watch's public dir supplies the arena art, champion portraits and HUD fonts.
export default defineConfig({
  root: path.resolve(__dirname),
  publicDir: path.resolve(__dirname, "../watch/public"),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@sim": path.resolve(__dirname, "../../sim"),
      "@data": path.resolve(__dirname, "../../data"),
      "@watch": path.resolve(__dirname, "../watch/src"),
    },
  },
  worker: { format: "es" },
  server: { port: 5174, host: "127.0.0.1" },
  preview: { port: 4174, host: "127.0.0.1" },
  build: { outDir: "dist", emptyOutDir: true, sourcemap: false },
});
