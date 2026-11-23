import { expect, test } from "@playwright/test";

test("production event log hides debug position and move rows", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await page.getByTestId("btn-start-live").click();
  await expect(page.getByTestId("watch-root")).toHaveAttribute(
    "data-match-end",
    "first_to_10",
    { timeout: 120_000 },
  );
  await page.getByTestId("btn-toggle-drawer").click();
  const list = page.getByTestId("event-list");
  await expect(list).toBeVisible();
  await expect(list.locator('[data-label="Position"]')).toHaveCount(0);
  await expect(list.locator('[data-label="Move"]')).toHaveCount(0);
  await expect(list).not.toContainText("Position");
  await expect(list).not.toContainText("Move");
  await expect(list.locator('[data-label="Match start"]')).toHaveCount(1);
});
