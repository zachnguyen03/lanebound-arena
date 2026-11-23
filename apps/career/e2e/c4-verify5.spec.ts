import { expect, test } from "playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => indexedDB.deleteDatabase("lanebound-career"));
  await page.goto("/");
});

test("club pick, home, and unsigned players match the verify notes", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "New career" }).click();
  const pill = page.getByTestId("club-juniper-rush").locator(".pill");
  await expect(pill).toHaveText("Mid");
  const shape = await pill.evaluate((el) => {
    const card = el.closest("button");
    const pillBox = el.getBoundingClientRect();
    const cardBox = card?.getBoundingClientRect();
    return {
      tag: el.tagName,
      display: getComputedStyle(el).display,
      narrower: cardBox ? pillBox.width < cardBox.width - 8 : false,
    };
  });
  expect(shape.tag).toBe("SPAN");
  expect(shape.display).toBe("inline");
  expect(shape.narrower).toBe(true);

  const start = page.getByRole("button", { name: "Start career" });
  await expect(start).toBeDisabled();
  const disabledPaint = await start.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(disabledPaint).toBe("rgb(26, 33, 48)");

  await page.getByTestId("club-juniper-rush").click();
  await expect(start).toBeEnabled();
  const enabledPaint = await start.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(enabledPaint).toBe("rgb(242, 193, 78)");
  await start.click();

  await expect(page.getByRole("heading", { name: "Matchday 1 lineup" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Saturday lineup" })).toHaveCount(0);
  await expect(page.locator(".hero .side.r .tname")).toHaveText("Vanta Owls");
  await expect(page.locator(".hero .side").first().locator(".crest")).not.toHaveClass(/\b(blue|red)\b/);
  await expect(page.locator(".hero .side.r .crest")).toHaveClass(/\b(blue|red)\b/);
  const sidePaint = await page.locator(".hero .mid .note span").evaluate((el) => getComputedStyle(el).color);
  const sideWord = await page.locator(".hero .mid .note span").innerText();
  expect(sidePaint).toBe(sideWord.startsWith("Red") ? "rgb(245, 71, 122)" : "rgb(77, 163, 255)");

  const columns = await page.locator(".grid3").evaluate((el) => {
    const tracks = getComputedStyle(el).gridTemplateColumns.split(" ").filter((part) => part.length > 0);
    return { tracks: tracks.length, children: el.children.length };
  });
  expect(columns).toEqual({ tracks: 3, children: 3 });
  await expect(page.locator(".grid3").getByRole("heading", { name: "Next fixtures" })).toBeVisible();

  const pixel = await page.locator(".board tr.me td").nth(1).screenshot();
  const painted = await page.evaluate(async (bytes) => {
    const blob = new Blob([new Uint8Array(bytes)], { type: "image/png" });
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, 0, 0);
    const mid = context.getImageData(Math.floor(bitmap.width / 2), Math.floor(bitmap.height / 2), 1, 1).data;
    return [mid[0], mid[1], mid[2]];
  }, [...pixel]);
  expect(painted).not.toBeNull();
  expect(Math.abs(painted![0] - 40)).toBeLessThan(8);
  expect(Math.abs(painted![1] - 40)).toBeLessThan(8);
  expect(Math.abs(painted![2] - 38)).toBeLessThan(8);

  await page.getByRole("button", { name: "Squad" }).click();
  const signatures = page.locator("[data-testid^=signature-]");
  await expect(signatures.first()).toHaveText("—");

  await page.getByRole("button", { name: "Competitions" }).click();
  await page.getByRole("button", { name: "Bracket" }).click();
  const gap = await page.locator(".bracket + .note").evaluate((el) => Number.parseFloat(getComputedStyle(el).marginTop));
  expect(gap).toBeGreaterThanOrEqual(12);
});
