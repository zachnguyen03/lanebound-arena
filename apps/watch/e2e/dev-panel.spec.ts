import { expect, test } from "@playwright/test";

test("production build hides the dev fallbacks panel", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await expect(page.getByTestId("watch-root")).toHaveAttribute(
    "data-art-checked",
    "true",
  );
  await expect(page.getByTestId("dev-panel")).toHaveCount(0);
  await expect(page.getByText("DEV · FALLBACKS")).toHaveCount(0);
  await expect(page.getByTestId("missing-assets")).toHaveCount(0);

  await page.getByTestId("btn-load-sample").click();
  await expect(page.getByTestId("arena-canvas")).toBeVisible();
  await expect(page.getByTestId("dev-panel")).toHaveCount(0);
  await expect(page.getByTestId("missing-assets")).toHaveCount(0);
});
