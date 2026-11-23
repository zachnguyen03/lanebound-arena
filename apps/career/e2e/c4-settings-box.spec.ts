import { expect, test } from "playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => indexedDB.deleteDatabase("lanebound-career"));
  await page.goto("/");
});

test("the settings gear stays inside its box", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "New career" }).click();
  await page.getByTestId("club-juniper-rush").click();
  await page.getByRole("button", { name: "Start career" }).click();
  const gear = page.getByRole("button", { name: "Settings" });
  const box = await gear.evaluate((el) => {
    const self = el.getBoundingClientRect();
    const date = document.querySelector("header .date")?.getBoundingClientRect();
    return {
      label: el.getAttribute("aria-label"),
      text: (el.textContent || "").replace(/\s+/g, ""),
      overflow: el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1,
      crossesDate: date ? self.right > date.left + 1 && self.left < date.right - 1 && self.bottom > date.top + 1 && self.top < date.bottom - 1 : true,
    };
  });
  expect(box.label).toBe("Settings");
  expect(box.text).toBe("");
  expect(box.overflow).toBe(false);
  expect(box.crossesDate).toBe(false);
});
