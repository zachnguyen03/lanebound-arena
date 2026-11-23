import { expect, test } from "playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => indexedDB.deleteDatabase("lanebound-career"));
  await page.goto("/");
});

test("a double-click on Settings New career does not start Neon Tide", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "New career" }).click();
  await page.getByTestId("club-juniper-rush").click();
  await page.getByRole("button", { name: "Start career" }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.locator('[data-overlay="settings"]').getByRole("button", { name: "New career" }).dblclick();
  await expect(page.getByRole("heading", { name: "Choose a club" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start career" })).toBeDisabled();
  await expect(page.getByTestId("club-neon-tide")).not.toHaveClass(/\bon\b/);
  await expect(page.locator("[data-screen=home]")).toHaveCount(0);
});
