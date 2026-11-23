import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@sim": path.resolve(__dirname, "../../sim"),
      "@watch": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["apps/watch/src/**/*.test.ts"],
    root: path.resolve(__dirname, "../.."),
  },
});
