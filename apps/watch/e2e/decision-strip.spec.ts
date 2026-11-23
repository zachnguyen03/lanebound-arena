import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

async function loadDeaths(page: Page) {
  await page.goto("/");
  const logPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../public/samples/handmade-deaths.jsonl",
  );
  await page.getByTestId("file-input").setInputFiles(logPath);
  await expect(page.getByTestId("arena-canvas")).toBeVisible({
    timeout: 60_000,
  });
  await page.getByTestId("scrubber").fill("12");
  await page.locator('[data-event-type="death"]').first().click();
}

test.describe("death strip stays on screen", () => {
  for (const vp of [
    { width: 1280, height: 720 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    test(`${vp.width}x${vp.height}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await loadDeaths(page);
      const strip = page.getByTestId("decision-strip");
      await expect(strip).toBeVisible();
      const box = await strip.boundingBox();
      expect(box).toBeTruthy();
      expect(box!.x).toBeGreaterThanOrEqual(-0.5);
      expect(box!.y).toBeGreaterThanOrEqual(-0.5);
      expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 0.5);
      expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height + 0.5);
      const cx = box!.x + box!.width / 2;
      const cy = box!.y + box!.height / 2;
      const hit = await page.evaluate(
        ({ x, y }) => {
          const el = document.elementFromPoint(x, y) as HTMLElement | null;
          return !!el?.closest('[data-testid="decision-strip"]');
        },
        { x: cx, y: cy },
      );
      expect(hit).toBe(true);
      const scroll = await page.evaluate(() => {
        const scroller = document.querySelector(
          '[data-testid="watch-root"] > div',
        );
        return {
          windowY: window.scrollY,
          scrollerY: scroller instanceof HTMLElement ? scroller.scrollTop : 0,
        };
      });
      expect(scroll.windowY).toBe(0);
      expect(scroll.scrollerY).toBe(0);
      for (const id of ["btn-speed-1", "scrubber", "btn-play-pause"]) {
        const control = await page.getByTestId(id).boundingBox();
        expect(control, id).toBeTruthy();
        const ok = await page.evaluate(
          ({ x, y, want }) => {
            const el = document.elementFromPoint(x, y) as HTMLElement | null;
            return !!el?.closest(`[data-testid="${want}"]`);
          },
          {
            x: control!.x + control!.width / 2,
            y: control!.y + control!.height / 2,
            want: id,
          },
        );
        expect(ok, id).toBe(true);
      }
    });
  }
});
