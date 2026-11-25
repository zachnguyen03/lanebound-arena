import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STATIC = "http://127.0.0.1:4175";
const distDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../dist",
);

/**
 * Cloudflare static assets 404 unknown paths. Vite preview does not:
 * it returns 200 HTML. This spec talks to the no-fallback server.
 */
function trackAssets(page: Page) {
  const bad: string[] = [];
  const seen: string[] = [];
  page.on("response", (res) => {
    const url = res.url();
    if (!url.startsWith(STATIC)) return;
    const status = res.status();
    const type = (res.headers()["content-type"] ?? "").toLowerCase();
    const path = new URL(url).pathname;
    seen.push(`${status} ${type.split(";")[0] || "?"} ${path}`);
    if (status >= 400) {
      bad.push(`${status} ${path}`);
      return;
    }
    if (/\.(png|json)$/i.test(path) && type.includes("text/html")) {
      bad.push(`html ${status} ${path}`);
    }
  });
  page.on("requestfailed", (req) => {
    bad.push(`failed ${req.url()}`);
  });
  return { bad, seen };
}

test.describe("asset requests against a 404 static server", () => {
  test.setTimeout(120_000);

  for (const vp of [
    { name: "1280", width: 1280, height: 720 },
    { name: "390", width: 390, height: 720 },
  ]) {
    test(`cold load and match start @${vp.name}`, async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const { bad, seen } = trackAssets(page);

      await page.goto(`${STATIC}/`, { waitUntil: "networkidle" });
      await expect(page.getByTestId("watch-root")).toBeVisible();
      await expect(page.getByTestId("empty-state")).toBeVisible();
      await expect(page.getByTestId("watch-root")).toHaveAttribute(
        "data-art-checked",
        "true",
      );

      await page.getByTestId("btn-start-live").click();
      await expect(page.getByTestId("arena-canvas")).toBeVisible({
        timeout: 60_000,
      });
      await page.waitForLoadState("networkidle");

      const icon = seen.find((line) =>
        line.includes("/champions/kerrig/icons/q-latch-line.png"),
      );
      expect(icon, seen.filter((l) => l.includes("q-latch-line")).join("\n")).toMatch(
        /^200 image\/png /,
      );
      expect(bad, bad.join("\n")).toEqual([]);
      await context.close();
    });
  }

  test("samples/*.jsonl served as application/x-ndjson; _headers in dist", async ({
    request,
  }) => {
    const headersFile = path.join(distDir, "_headers");
    expect(fs.existsSync(headersFile), "_headers missing from dist").toBe(true);
    const headersBody = fs.readFileSync(headersFile, "utf8");
    expect(headersBody).toMatch(/\/samples\/\*\.jsonl/);
    expect(headersBody).toMatch(/Content-Type:\s*application\/x-ndjson/);

    for (const sample of [
      "/samples/seed-20261122.jsonl",
      "/samples/handmade-deaths.jsonl",
    ]) {
      const res = await request.get(`${STATIC}${sample}`);
      expect(res.status(), sample).toBe(200);
      const ct = (res.headers()["content-type"] ?? "").toLowerCase();
      expect(ct, sample).toContain("application/x-ndjson");
    }
  });
});
