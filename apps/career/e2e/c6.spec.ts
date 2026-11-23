import { expect, test, type Page } from "playwright/test";

const COACH = [
  "Watch the map.",
  "Read the recap.",
  "The draft is on the screen.",
  "The plan stays locked",
  "You are the coach now.",
];

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => indexedDB.deleteDatabase("lanebound-career"));
  await page.reload();
});

test("coach marks run through map 5 and then stop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await start(page, "juniper-rush");
  await page.getByRole("button", { name: "Continue" }).click();
  const tab = ["Recap", "Recap", "Draft", "Tactics", "Recap"];
  for (let map = 0; map < 5; map++) {
    await page.getByTestId("play-map").click();
    if (tab[map] !== "Recap") await page.getByRole("button", { name: tab[map] }).click();
    const label = await page.getByTestId("map-label").innerText();
    await expect(page.getByTestId("coach-mark")).toContainText(label);
    await expect(page.getByTestId("coach-mark")).toContainText(COACH[map]!);
    await page.getByRole("button", { name: "Got it" }).click();
  }
  await page.getByTestId("play-map").click();
  await expect(page.getByTestId("coach-mark")).toHaveCount(0);
});

test("a scripted season end keeps the signature and carries the contracts", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await start(page, "iron-lotus");
  await page.getByRole("button", { name: "Competitions" }).click();
  await page.getByRole("button", { name: "Awards" }).click();
  await expect(page.getByTestId("awards-empty")).toContainText("Not announced yet");
  await page.getByRole("button", { name: "Continue" }).click();
  for (let guard = 0; guard < 40; guard++) {
    const skip = page.getByTestId("skip-series");
    if (!(await skip.isEnabled())) break;
    await skip.click();
    if (await page.getByText("Season complete", { exact: true }).isVisible()) break;
    if (await page.locator('[data-overlay="signature"]').isVisible()) break;
    await page.getByRole("button", { name: "Tactics" }).click();
  }
  const overlay = page.locator('[data-overlay="signature"]');
  await expect(overlay).toBeVisible();
  await expect(overlay.locator(".sigfaces img")).toHaveCount(2);
  await expect(overlay.getByRole("button", { name: /^Keep / })).toBeVisible();
  await expect(overlay.getByRole("button", { name: /^Take / })).toBeVisible();
  await expect(overlay.locator("button.btn-primary")).toHaveCount(0);
  await expect(overlay).toContainText("The other card leaves the archive.");
  await expectNoOverlap(page, "signature");
  const held = (await page.getByTestId("held-signature").textContent())?.trim() ?? "";
  const player = ((await overlay.locator("p").first().innerText()).split(" holds ")[0] ?? "").trim();
  expect(held.length).toBeGreaterThan(0);
  expect(player.length).toBeGreaterThan(0);
  expect(held).not.toBe("Finals Poise");
  await page.getByRole("button", { name: "Keep" }).click();
  await expect(overlay).toHaveCount(0);
  await page.getByRole("button", { name: "Squad" }).click();
  await expect(page.getByRole("row", { name: player })).toContainText(held);
  await expect(page.locator('[data-composed="split-stub"]')).toContainText("Opens after the first Split");
  await page.getByRole("button", { name: "Contracts" }).click();
  const before = await page.getByTestId("contracts").innerText();
  await page.getByRole("button", { name: "Competitions" }).click();
  await page.getByRole("button", { name: "Awards" }).click();
  for (const name of ["Split MVP", "Finals MVP", "Zonekeeper", "Deadeye", "Shepherd"]) {
    await expect(page.getByTestId("awards")).toContainText(name);
  }
  const awardRows = page.getByTestId("awards").locator("tbody tr");
  const awardCount = await awardRows.count();
  let ours = 0;
  for (let i = 0; i < awardCount; i++) {
    const row = awardRows.nth(i);
    if ((await row.locator("td").count()) < 3) continue;
    const club = (await row.locator("td").nth(2).innerText()).trim();
    if (club === "Iron Lotus") {
      ours += 1;
      await expect(row).toHaveClass(/\bme\b/);
    } else if (club) {
      await expect(row).not.toHaveClass(/\bme\b/);
    }
  }
  expect(ours).toBeGreaterThan(0);
  await expect(page.locator("header .btn-primary")).toHaveCount(0);
  await expect(page.getByTestId("advance-season")).toHaveClass(/btn-primary/);
  await page.getByTestId("advance-season").click();
  await expect(page.getByText("Contracts carried into next season.")).toBeVisible();
  await page.getByRole("button", { name: "Squad" }).click();
  await page.getByRole("button", { name: "Contracts" }).click();
  expect(await page.getByTestId("contracts").innerText()).not.toBe(before);
  await page.reload();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Squad" }).click();
  await expect(page.getByRole("row", { name: player })).toContainText(held);
  await page.getByRole("button", { name: "Competitions" }).click();
  await page.getByRole("button", { name: "League" }).click();
  await expect(page.getByTestId("league-table")).not.toContainText("Points");
});

test("awards and the empty state at the three desktop widths", async ({ page }) => {
  test.setTimeout(180_000);
  await start(page, "juniper-rush");
  for (const [width, height] of [
    [1440, 900],
    [1280, 900],
    [1280, 800],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.getByRole("button", { name: "Competitions" }).click();
    await page.getByRole("button", { name: "Awards" }).click();
    await expect(page.getByTestId("awards-empty")).toBeVisible();
    await page.screenshot({ path: `../../lab/c6/shots/state-empty-awards-${width}x${height}.png` });
    await page.getByRole("button", { name: "Squad" }).click();
    await page.locator('[data-composed="split-stub"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `../../lab/c6/shots/split-stub-${width}x${height}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByTestId("play-map").click();
  await expect(page.getByTestId("coach-mark")).toBeVisible();
  await page.screenshot({ path: "../../lab/c6/shots/coach-mark-1440x900.png" });
  await page.getByRole("button", { name: "Got it" }).click();
  await page.getByTestId("play-map").click();
  await page.getByRole("button", { name: "Got it" }).click();
  await page.getByTestId("play-map").click();
  await page.getByRole("button", { name: "Draft" }).click();
  await page.getByRole("button", { name: "Got it" }).click();
  await page.getByTestId("play-map").click();
  await page.getByRole("button", { name: "Tactics" }).click();
  await expect(page.getByTestId("coach-mark")).toBeVisible();
  await expect(page.locator("section[data-screen='tactics']")).toBeVisible();
  for (const [width, height] of [
    [1440, 900],
    [1280, 800],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: `../../lab/c6/shots/prep-coach-${width}x${height}.png` });
  }
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "New career" }).click();
  await page.getByTestId("club-iron-lotus").click();
  await page.getByRole("button", { name: "Start career" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  for (let guard = 0; guard < 40; guard++) {
    const skip = page.getByTestId("skip-series");
    if (!(await skip.isEnabled())) break;
    await skip.click();
    if (await page.getByText("Season complete", { exact: true }).isVisible()) break;
    if (await page.locator('[data-overlay="signature"]').isVisible()) break;
    await page.getByRole("button", { name: "Tactics" }).click();
  }
  await expect(page.locator('[data-overlay="signature"]')).toBeVisible();
  for (const [width, height] of [
    [1440, 900],
    [1280, 900],
    [1280, 800],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: `../../lab/c6/shots/signature-choice-${width}x${height}.png` });
  }
  await page.getByRole("button", { name: "Keep" }).click();
  await page.getByRole("button", { name: "Competitions" }).click();
  await page.getByRole("button", { name: "Awards" }).click();
  await expect(page.getByTestId("awards")).toBeVisible();
  for (const [width, height] of [
    [1440, 900],
    [1280, 900],
    [1280, 800],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: `../../lab/c6/shots/07-awards-${width}x${height}.png` });
  }
});

async function start(page: Page, clubId: string) {
  await page.getByRole("button", { name: "New career" }).click();
  await page.getByTestId(`club-${clubId}`).click();
  await page.getByRole("button", { name: "Start career" }).click();
}

async function expectNoOverlap(page: Page, overlay: string) {
  const controls = page.locator(`[data-overlay="${overlay}"]`).locator("button, label");
  await expect(controls.first()).toBeVisible();
  const count = await controls.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const box = await controls.nth(i).boundingBox();
    expect(box).not.toBeNull();
    const hit = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return el ? el.closest("button, label, a") !== null : false;
    }, { x: box!.x + box!.width / 2, y: box!.y + Math.min(box!.height / 2, 12) });
    expect(hit).toBe(true);
  }
}
