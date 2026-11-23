import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../lab/s4/final",
);
const shotDir = path.join(outDir, "shots");

async function hit(page: Page, testId: string) {
  const box = await page.getByTestId(testId).boundingBox();
  expect(box, testId).toBeTruthy();
  const vp = page.viewportSize()!;
  expect(box!.x).toBeGreaterThanOrEqual(-0.5);
  expect(box!.y).toBeGreaterThanOrEqual(-0.5);
  expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 0.5);
  expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height + 0.5);
  const cx = box!.x + box!.width / 2;
  const cy = box!.y + box!.height / 2;
  const ok = await page.evaluate(
    ({ x, y, want }) => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      return !!el?.closest(`[data-testid="${want}"]`);
    },
    { x: cx, y: cy, want: testId },
  );
  expect(ok, testId).toBe(true);
}

test.describe("S4 live evenOvr match", () => {
  test.setTimeout(180_000);

  for (const vp of [
    { name: "1920x1080", width: 1920, height: 1080 },
    { name: "1440x900", width: 1440, height: 900 },
    { name: "1280x720", width: 1280, height: 720 },
  ]) {
    test(`${vp.name} mid-match and match_end`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      await page.getByTestId("btn-start-live").click();
      await expect(page.getByTestId("watch-root")).toHaveAttribute(
        "data-match-end",
        "first_to_10",
        { timeout: 120_000 },
      );
      await expect(page.getByTestId("arena-canvas")).toBeVisible();
      const digest = await page
        .getByTestId("watch-root")
        .getAttribute("data-digest");
      expect(digest).toMatch(/^[0-9a-f]{64}$/);

      await page.getByTestId("btn-play-pause").click();
      await page.getByTestId("btn-play-pause").click();
      for (let i = 0; i < 20; i++) {
        await page.getByTestId("btn-step").click();
      }

      await page.getByTestId("btn-toggle-overlays").click();
      await expect(page.getByTestId("watch-root")).toHaveAttribute(
        "data-overlays",
        "true",
      );
      for (const id of ["btn-speed-8", "btn-toggle-overlays", "scrubber"]) {
        await hit(page, id);
      }

      fs.mkdirSync(outDir, { recursive: true });
      fs.mkdirSync(shotDir, { recursive: true });
      await page.getByTestId("scrubber").fill("200");
      await expect(page.getByTestId("portrait-blue:adc")).toBeVisible();
      await expect(page.getByTestId("portrait-red:top")).toBeVisible();
      const portrait = page.getByTestId("portrait-blue:adc");
      const portraitBox = await portrait.boundingBox();
      expect(portraitBox?.width).toBe(vp.width >= 1920 ? 64 : 24);
      expect(portraitBox?.height).toBe(portraitBox?.width);
      await page.screenshot({
        path: path.join(outDir, `watch-${vp.name}-mid.png`),
      });
      if (vp.name === "1280x720" || vp.name === "1920x1080") {
        await page.screenshot({
          path: path.join(shotDir, `watch-${vp.name}-mid.png`),
        });
      }
      const max = await page.getByTestId("scrubber").getAttribute("max");
      await page.getByTestId("scrubber").fill(max ?? "200");
      await page.screenshot({
        path: path.join(outDir, `watch-${vp.name}-end.png`),
      });

      const death = page.locator('[data-event-type="death"]').first();
      await expect(death).toBeVisible();
      await death.click();
      await expect(page.getByTestId("decision-strip")).toBeVisible();

      await page.getByTestId("btn-export-config").click();
      await expect(page.getByTestId("exported-config")).toContainText(
        "forced_clock_end",
      );
    });
  }

  test("missing forced_clock_end is shown in the UI", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");
    await page.getByTestId("config-file").setInputFiles({
      name: "missing-clock.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ seed: 1 })),
    });
    const err = page.getByTestId("config-error");
    await expect(err).toContainText("clock-end");
    await expect(err).not.toContainText("S3-R5");
  });

  test("invalid JSON replaces the previous config error", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");
    const input = page.getByTestId("config-file");
    await input.setInputFiles({
      name: "missing-clock.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ seed: 1 })),
    });
    await expect(page.getByTestId("config-error")).toContainText("clock-end");
    await input.setInputFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from("not json{"),
    });
    const err = page.getByTestId("config-error");
    await expect(err).toContainText("not valid JSON");
    await expect(err).not.toContainText("clock-end");
  });
});
