import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@sim": path.resolve(__dirname, "sim"),
      "@data": path.resolve(__dirname, "data"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts", "apps/watch/src/**/*.test.ts"],
  },
});

