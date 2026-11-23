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
    return { opacity: Number(computed.opacity), cursor: computed.cursor, background: computed.backgroundColor, color: computed.color };
  });
  expect(style.cursor).toBe("not-allowed");
  expect(style.opacity).toBe(1);
  expect(style.background).toBe("rgb(26, 33, 48)");
  expect(style.color).toBe("rgb(135, 146, 166)");
});
