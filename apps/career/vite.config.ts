import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@lanebound/career": new URL("../../packages/career/src/index.ts", import.meta.url).pathname,
      "@lanebound/match-contract": new URL("../../packages/match-contract/src/index.ts", import.meta.url).pathname,
    },
  },
  server: { host: "127.0.0.1", port: 5174 },
});
