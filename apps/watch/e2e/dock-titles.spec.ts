import { expect, test, type Page } from "@playwright/test";

const TITLES = ["ZONE", "PICKUPS", "FIGHT CALL", "TAKEDOWN LOG"];

async function loadSample(page: Page) {
  await page.goto("/");
  await page.getByTestId("btn-load-sample").click();
  await expect(page.getByTestId("arena-canvas")).toBeVisible({
    timeout: 60_000,
  });
}

test.describe("dock titles stay on one line", () => {
  for (const vp of [
    { width: 1280, height: 720 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    test(`${vp.width}x${vp.height}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await loadSample(page);
      const titles = page.getByTestId("dock-title");
      await expect(titles).toHaveCount(TITLES.length);
      const texts = await titles.allInnerTexts();
      expect(texts.map((t) => t.replace(/\s+/g, " ").trim()).sort()).toEqual(
        [...TITLES].sort(),
      );
      const lines = await titles.evaluateAll((nodes) =>
        nodes.map((node) => node.getClientRects().length),
      );
      expect(lines).toEqual(TITLES.map(() => 1));
    });
  }
});
