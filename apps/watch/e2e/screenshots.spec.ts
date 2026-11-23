import { expect, test } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../lab/s4",
);

test("capture Watch screenshots at 1920 / 1280 / 390", async ({ page }) => {
  for (const [name, size] of [
    ["1920", { width: 1920, height: 1080 }],
    ["1280", { width: 1280, height: 800 }],
    ["390", { width: 390, height: 844 }],
  ] as const) {
    await page.setViewportSize(size);
    await page.goto("/");
    await page.getByTestId("btn-load-sample").click();
    await expect(page.getByTestId("arena-canvas")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByTestId("watch-transport")).toBeVisible();
    // Jump via event log to the first level_up (tick 122 on the sample).
    await page.getByTestId("event-filter").fill("level_up");
    await page.locator('[data-testid="event-list"] button').first().click();
    await expect(page.getByTestId("watch-transport")).toContainText("tick 122/");
    await page.waitForTimeout(200);
    await page.screenshot({
      path: path.join(outDir, `watch-${name}.png`),
      fullPage: true,
    });
    await page.screenshot({
      path: path.join(outDir, `watch-${name}-viewport.png`),
      fullPage: false,
    });

  }
});
