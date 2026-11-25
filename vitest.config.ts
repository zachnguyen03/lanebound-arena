import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@sim": path.resolve(__dirname, "sim"),
      "@data": path.resolve(__dirname, "data"),
      "@lab": path.resolve(__dirname, "apps/lab/lib"),
      "@watch": path.resolve(__dirname, "apps/watch/src"),
      "@lanebound/match-contract": path.resolve(__dirname, "packages/match-contract/src/index.ts"),
      "@lanebound/career": path.resolve(__dirname, "packages/career/src/index.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts", "packages/**/*.test.ts", "apps/watch/src/**/*.test.ts"],
  },
});

