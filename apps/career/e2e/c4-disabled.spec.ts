import { expect, test } from "playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => indexedDB.deleteDatabase("lanebound-career"));
  await page.goto("/");
});

test("a disabled Continue does not look enabled", async ({ page }) => {
  const button = page.getByRole("button", { name: "Continue" });
  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute("aria-disabled", "true");
  const style = await button.evaluate((el) => {
    const computed = getComputedStyle(el);
    return { opacity: Number(computed.opacity), cursor: computed.cursor };
  });
  expect(style.opacity).toBeLessThan(1);
  expect(style.cursor).toBe("not-allowed");
});
