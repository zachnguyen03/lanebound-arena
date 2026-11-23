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

test("the match footer stays on screen and Play map is the only gold button", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await start(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByTestId("play-map").click();
  await expect(page.getByTestId("coach-mark")).toBeVisible();
  const footer = page.getByTestId("match-footer");
  const box = await footer.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(800);
  const paint = await footer.evaluate((el) => {
    const probe = document.createElement("div");
    probe.style.background = "var(--c-panel)";
    probe.style.borderTop = "1px solid var(--c-line)";
    document.body.append(probe);
    const expected = getComputedStyle(probe);
    const style = getComputedStyle(el);
    const result = {
      position: style.position,
      background: style.backgroundColor,
      borderTop: style.borderTopColor,
      panel: expected.backgroundColor,
      line: expected.borderTopColor,
    };
    probe.remove();
    return result;
  });
  expect(paint.position).toBe("sticky");
  expect(paint.background).toBe(paint.panel);
  expect(paint.borderTop).toBe(paint.line);
  const play = await page.getByTestId("play-map").boundingBox();
  expect(play).not.toBeNull();
  const hit = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    return el ? el.closest("[data-testid='play-map']") !== null : false;
  }, { x: play!.x + play!.width / 2, y: play!.y + play!.height / 2 });
  expect(hit).toBe(true);
  await expect(page.locator("button.btn-primary:not([disabled])")).toHaveCount(1);
});

test("the coach mark floats and leaves its target where it was", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await start(page);
  await page.getByRole("button", { name: "Continue" }).click();
  const target = page.locator("[data-coach-target='recap']");
  const before = await target.boundingBox();
  await page.getByTestId("play-map").click();
  const mark = page.getByTestId("coach-mark");
  await expect(mark).toBeVisible();
  const after = await target.boundingBox();
  expect(before).not.toBeNull();
  expect(after).toEqual(before);
  const place = await mark.evaluate((el) => getComputedStyle(el).position);
  expect(place === "fixed" || place === "absolute").toBe(true);
  await expect(mark.locator(".coachcaret")).toBeVisible();
  const width = await mark.evaluate((el) => el.getBoundingClientRect().width);
  expect(width).toBeLessThanOrEqual(320);
});

async function expectOne(page: Page, screen: string) {
  for (const pane of ["tactics", "cards", "draft"]) {
    await expect(page.locator(`section[data-screen="${pane}"]`)).toHaveCount(pane === screen ? 1 : 0);
  }
  await expect(page.getByTestId("recap")).toHaveCount(0);
}

async function start(page: Page) {
  await page.getByRole("button", { name: "New career" }).click();
  await page.getByTestId("club-juniper-rush").click();
  await page.getByRole("button", { name: "Start career" }).click();
}
