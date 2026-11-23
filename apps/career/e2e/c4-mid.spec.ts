import { expect, test } from "playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => indexedDB.deleteDatabase("lanebound-career"));
  await page.goto("/");
});

test("difficulty says Mid", async ({ page }) => {
  await page.getByRole("button", { name: "New career" }).click();
  await expect(page.getByTestId("club-juniper-rush")).toContainText("Mid");
  await expect(page.getByTestId("club-juniper-rush")).not.toContainText("Mid-table");
  await expect(page.getByText("Mid-table")).toHaveCount(0);
});
