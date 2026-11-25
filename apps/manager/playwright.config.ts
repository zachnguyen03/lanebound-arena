import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 600_000,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:4174", headless: true, viewport: { width: 1280, height: 800 } },
  webServer: {
    // Built + preview: no file watchers, same bundle as manager:build.
    command: "npx vite build --config vite.config.ts --logLevel warn && npx vite preview --config vite.config.ts --strictPort",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
