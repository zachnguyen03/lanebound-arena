import { expect, test } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../lab/s4",
);

async function loadMid(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByTestId("btn-load-sample").click();
  await expect(page.getByTestId("arena-canvas")).toBeVisible({
    timeout: 60_000,
  });
  await page.getByTestId("btn-toggle-drawer").click();
  await expect(page.getByTestId("event-drawer")).toBeVisible();
  await page.getByTestId("event-filter").fill("level_up");
  await page.locator('[data-testid="event-list"] button').first().click();
  await expect(page.getByTestId("watch-transport")).toContainText("122/");
  await page.getByTestId("btn-close-drawer").click();
}

test("dummy body screenshots + map crop", async ({ page }) => {
  // 1920 mid-match
  await page.setViewportSize({ width: 1920, height: 1080 });
  await loadMid(page);
  await expect(page.getByTestId("dev-panel")).toContainText("none");
  await page.screenshot({
    path: path.join(outDir, "watch-1920-mid-dummy.png"),
    fullPage: false,
  });

  // Crop around the map showing blue + red dummies
  const map = page.getByTestId("arena-map-slot");
  await expect(map).toBeVisible();
  await map.screenshot({
    path: path.join(outDir, "watch-dummy-map-crop.png"),
  });

  // 1280 mid-match
  await page.setViewportSize({ width: 1280, height: 720 });
  await loadMid(page);
  await page.screenshot({
    path: path.join(outDir, "watch-1280-mid-dummy.png"),
    fullPage: false,
  });
});
