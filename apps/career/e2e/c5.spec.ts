import { expect, test, type Page } from "playwright/test";
import { expectHeaderFits } from "./header";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => indexedDB.deleteDatabase("lanebound-career"));
  await page.reload();
});

test("a Bo3 on the fake runner stays fearless on game 2 and recaps without a replay", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "New career" }).click();
  await page.getByTestId("club-juniper-rush").click();
  await page.getByRole("button", { name: "Start career" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("button", { name: "Hold the Pit" })).toBeVisible();
  await expect(page.locator('[data-screen="cards"]')).toHaveCount(0);
  await expect(page.locator('[data-screen="draft"]')).toHaveCount(0);
  await expect(page.getByTestId("recap")).toHaveCount(0);
  await page.getByRole("button", { name: "Cards" }).click();
  await expect(page.locator('[data-screen="tactics"]')).toHaveCount(0);
  await expect(page.getByText("3 / 6 points")).toBeVisible();
  await expect(page.getByText("3 / 3 cards")).toBeVisible();
  await page.getByRole("button", { name: "Tactics" }).click();

  await playAndRecap(page);
  await expect(page.getByTestId("map-label")).toHaveText("Map 1 of 3");
  await page.getByRole("button", { name: "Draft" }).click();
  await expect(page.getByTestId("map-label")).toHaveText("Map 2 of 3");
  await expect(page.locator('[data-screen="tactics"]')).toHaveCount(0);
  await expect(page.locator('[data-screen="cards"]')).toHaveCount(0);
  await expect(page.getByText("Map 2 cannot repeat map 1.")).toBeVisible();
  await page.getByRole("button", { name: "Cards" }).click();
  await expect(page.locator('section[data-screen="cards"] button').first()).toBeDisabled();
  await page.getByRole("button", { name: "Tactics" }).click();
  await expect(page.getByRole("button", { name: "Hold the Pit" })).toBeDisabled();

  for (let guard = 0; guard < 3; guard++) {
    await playAndRecap(page);
    await page.getByRole("button", { name: "Draft" }).click();
    if ((await page.getByTestId("map-label").innerText()) === "Map 1 of 3") break;
  }
  await expect(page.getByTestId("map-label")).toHaveText("Map 1 of 3");
  await page.getByRole("button", { name: "Cards" }).click();
  await expect(page.locator('section[data-screen="cards"] button').first()).toBeEnabled();
});

test("prep and recap at the three desktop widths", async ({ page }) => {
  const shots: Array<{ name: string; open: (page: Page) => Promise<void> }> = [
    {
      name: "09-tactics",
      open: async (page) => {
        await enter(page);
        await expect(page.locator('section[data-screen="tactics"]')).toBeVisible();
      },
    },
    {
      name: "09c-tactics-cards",
      open: async (page) => {
        await enter(page);
        await page.getByRole("button", { name: "Cards" }).click();
        await expect(page.locator('section[data-screen="cards"]')).toBeVisible();
      },
    },
    {
      name: "04-draft-fearless",
      open: async (page) => {
        await enter(page);
        await page.getByTestId("play-map").click();
        await expect(page.getByTestId("recap")).toBeVisible();
        await page.getByRole("button", { name: "Draft" }).click();
        await expect(page.locator('section[data-screen="draft"]')).toBeVisible();
      },
    },
    {
      name: "15-match-report",
      open: async (page) => {
        await enter(page);
        await page.getByTestId("play-map").click();
        await expect(page.getByTestId("recap")).toBeVisible();
      },
    },
  ];
  for (const [width, height] of [
    [1440, 900],
    [1280, 900],
    [1280, 800],
  ] as const) {
    await page.setViewportSize({ width, height });
    for (const shot of shots) {
      await page.goto("/");
      await page.evaluate(() => indexedDB.deleteDatabase("lanebound-career"));
      await page.reload();
      await shot.open(page);
      await page.screenshot({ path: `../../lab/c5/shots/${shot.name}-${width}x${height}.png` });
    }
  }
});

test("overlays leave their controls on top", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await enter(page);
  await expectHeaderFits(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expectHeaderFits(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.locator('[data-overlay="settings"]')).toBeVisible();
  await expectNoOverlap(page, "settings");
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByTestId("import-file").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{"),
  });
  await expect(page.locator('[data-overlay="error"]')).toBeVisible();
  await expectNoOverlap(page, "error");
});

async function enter(page: Page) {
  await page.getByRole("button", { name: "New career" }).click();
  await page.getByTestId("club-juniper-rush").click();
  await page.getByRole("button", { name: "Start career" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("button", { name: "Hold the Pit" })).toBeVisible();
}

async function playAndRecap(page: Page) {
  await page.getByTestId("play-map").click();
  const recap = page.getByTestId("recap");
  await expect(recap).toContainText("source: fake");
  await expect(recap).toContainText(/Fired|Expired/);
  await expect(recap.locator("td").nth(1)).toContainText(/\d+\.\d/);
  await expect(page.getByRole("button", { name: /replay/i })).toHaveCount(0);
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
