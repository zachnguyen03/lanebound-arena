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

test("the recap leads with the result and splits ratings by team", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await start(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByTestId("play-map").click();
  const strip = page.getByTestId("result-strip");
  await expect(strip).toBeVisible();
  await expect(strip.locator(".disp")).toHaveText(/^[WL]$/);
  await expect(strip).toContainText(/\d+–\d+/);
  await expect(strip).toContainText(/Map \d+ of \d+/);
  await expect(strip.locator(".crest")).toHaveCount(2);
  const blue = await page.getByTestId("ratings-blue").innerText();
  const red = await page.getByTestId("ratings-red").innerText();
  expect(blue).toMatch(/\d+\.\d/);
  expect(red).toMatch(/\d+\.\d/);
  expect(blue).not.toBe(red);
});

test("picked cards sit beside the points and signatures stay out of the pool", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await start(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Cards" }).click();
  await expect(page.locator(".pickedfaces img")).toHaveCount(3);
  await expect(page.getByText("3 / 6 points")).toBeVisible();
  const face = await page.locator("[data-testid='card-pool'] img").first().boundingBox();
  expect(face).not.toBeNull();
  expect(Math.round(face!.width)).toBe(120);
  expect(Math.round(face!.height)).toBe(168);
  const names = await page.locator("[data-testid='card-pool'] img").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("alt")));
  for (const signature of ["Pillar of the Split", "Finals Poise", "Crown of the Split", "Convergence Crown"]) {
    expect(names).not.toContain(signature);
  }
  const pool = await page.getByTestId("card-pool").evaluate((el) => getComputedStyle(el).overflowY);
  expect(pool).toBe("auto");
});

test("tactics use the segment control and grey out when locked", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await start(page);
  await page.getByRole("button", { name: "Continue" }).click();
  const seg = page.getByTestId("tactic-seg");
  await expect(seg).toHaveClass(/seg/);
  await expect(seg.getByRole("button", { name: "Hold the Pit" })).toHaveClass(/on/);
  await expect(seg.locator("button.btn-primary")).toHaveCount(0);
  await page.getByTestId("play-map").click();
  await page.getByRole("button", { name: "Tactics" }).click();
  await expect(seg.getByRole("button", { name: "Hold the Pit" })).toBeDisabled();
  const faded = await seg.getByRole("button", { name: "Hunt", exact: true }).evaluate((el) => getComputedStyle(el).opacity);
  expect(Number(faded)).toBeLessThan(1);
});

test("the match uses Map N of N and never Game or MAP", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByTestId("map-label")).toHaveText("Map 1 of 3");
  await page.getByTestId("play-map").click();
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/\bGame \d/);
  expect(text).not.toMatch(/\bMAP \d/);
  await expect(page.getByTestId("map-label")).toHaveText("Map 2 of 3");
  await expect(page.getByTestId("coach-mark")).toContainText("Map 1 of 3");
});

test("the draft is a padded table of role, player, champion, and status", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByTestId("play-map").click();
  await page.getByRole("button", { name: "Draft" }).click();
  const table = page.getByTestId("draft").locator("table");
  await expect(table).toContainText("Role");
  await expect(table).toContainText("Player");
  await expect(table).toContainText("Champion");
  await expect(table).toContainText("Status");
  const champion = (await table.locator("tr").nth(1).locator("td").nth(2).innerText()).trim();
  expect(champion).toMatch(/^[A-Z]/);
  expect(champion).not.toBe(champion.toLowerCase());
  const pad = await page.locator(".inset").evaluate((el) => getComputedStyle(el).paddingLeft);
  expect(pad).toBe("18px");
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
