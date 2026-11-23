import { expect, test, type Page } from "playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => indexedDB.deleteDatabase("lanebound-career"));
  await page.reload();
});

test("match tabs show one pane", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await start(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator('[data-testid="match-tabs"]')).toHaveClass(/subtabs/);
  await expectOne(page, "tactics");
  await page.getByRole("button", { name: "Cards" }).click();
  await expectOne(page, "cards");
  await page.getByRole("button", { name: "Draft" }).click();
  await expectOne(page, "draft");
  await page.getByRole("button", { name: "Recap" }).click();
  await expectOne(page, "");
  await expect(page.getByText("No map yet.")).toBeVisible();
});

async function expectOne(page: Page, screen: string) {
  for (const pane of ["tactics", "cards", "draft"]) {
    await expect(page.locator(`[data-screen="${pane}"]`)).toHaveCount(pane === screen ? 1 : 0);
  }
  await expect(page.getByTestId("recap")).toHaveCount(0);
}

async function start(page: Page) {
  await page.getByRole("button", { name: "New career" }).click();
  await page.getByTestId("club-juniper-rush").click();
  await page.getByRole("button", { name: "Start career" }).click();
}
