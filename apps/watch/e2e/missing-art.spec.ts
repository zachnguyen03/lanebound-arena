import { expect, test } from "@playwright/test";

test("missing champion art lists paths the SPA would otherwise 200", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  const panel = page.getByTestId("missing-assets");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("/champions/huntress/atlas.json");
  await expect(panel).toContainText("/champions/huntress/portrait.png");
  await expect(panel).toContainText("/champions/brannoch/atlas.json");
  await expect(panel.locator("li")).toHaveCount(20);
});
