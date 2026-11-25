import { expect, test, type Page } from "@playwright/test";

// New career -> every tab -> one match through card select, draft, live, post-game and report -> rest of season -> review.
// Set SHOTS=<dir> to save screenshots of the key screens.
const SHOTS = process.env.SHOTS;
const shot = async (page: Page, name: string) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };

async function fits(page: Page, where: string) {
  const h = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, document.getElementById("app")!.scrollHeight));
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(h, `${where}: page height`).toBeLessThanOrEqual(800);
  expect(w, `${where}: page width`).toBeLessThanOrEqual(1280);
  await expect(page.getByText("Something went wrong drawing this screen"), where).toHaveCount(0);
}

const SCREENS = [
  "home", "squad/players", "squad/lineup", "squad/contracts", "squad/academy", "training", "tactics",
  "transfers/market", "transfers/shortlist", "transfers/offers",
  "competitions/league", "competitions/bracket", "competitions/international", "competitions/schedule", "competitions/awards", "competitions/meta",
  "stats/overview", "stats/players", "stats/champions", "stats/teams", "stats/games", "stats/replays", "stats/economy",
  "club", "inbox", "settings",
];

test("career: tabs, a full match, the rest of the season", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("/#/menu");
  await page.getByRole("link", { name: "New career" }).click();
  await page.locator("a.region").first().click();
  await page.locator("#start").click();
  await expect(page.locator("header.top")).toBeVisible();

  for (const s of SCREENS) {
    await page.goto(`/#/${s}`);
    await page.waitForTimeout(150);
    await fits(page, s);
    if (["home", "tactics", "competitions/meta", "stats/players"].includes(s)) await shot(page, s.replace("/", "-"));
  }

  // Sim to the first fixture, then play every game of the series.
  while ((await page.locator("#continue").textContent())?.includes("Continue")) {
    await page.locator("#simmenu").click();
    await page.locator('[data-mode="match"]').click();
    await expect(page.locator("#continue")).toBeVisible({ timeout: 120_000 });
  }
  await page.locator("#continue").click();
  for (let game = 0; game < 5; game++) {
    // Tactic Cards: the analyst pre-loads a legal loadout; cards loaded earlier in the series are greyed out.
    await expect(page.locator(".cards-select")).toBeVisible();
    await fits(page, "card select");
    if (game === 0) await shot(page, "cards");
    expect(await page.locator(".cs-card.on").count()).toBeGreaterThan(0);
    if (game > 0) expect(await page.locator(".cs-card.used").count()).toBeGreaterThan(0);
    await page.locator("#lockcards").click();
    await expect(page.locator(".draft")).toBeVisible();
    if (game === 0) await shot(page, "draft");
    while (!(await page.locator("#start").count())) {
      if (await page.locator("#lock").count()) await page.locator("#lock").click();
      else await page.waitForTimeout(200);
    }
    await fits(page, "draft");
    await page.locator("#start").click();
    await expect(page.locator(".live canvas")).toBeVisible();
    await page.locator('[data-speed="4"]').click();
    await page.waitForTimeout(4000);
    await fits(page, "live");
    if (game === 0) await shot(page, "live");
    await page.locator("#skip").click();
    await expect(page.locator(".post-head")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".post-cards")).toBeVisible();
    await fits(page, "post-game");
    if (game === 0) {
      await shot(page, "post-game");
      await page.getByRole("link", { name: "Match report" }).click();
      await expect(page.locator(".r-watch canvas")).toBeVisible();
      const chip = page.locator("[data-seek]").first();
      if (await chip.count()) await chip.click();
      await page.waitForTimeout(1500);
      await fits(page, "report");
      await shot(page, "report");
      await page.goBack();
      await expect(page.locator(".post-head")).toBeVisible();
    }
    if (await page.locator("#done").count()) { await page.locator("#done").click(); break; }
    await page.locator("#next").click();
  }
  await expect(page.locator("header.top")).toBeVisible();
  await page.goto("/#/stats/replays");
  await fits(page, "replays");

  // Rest of the season (auto-plays the user's matches) to the season review.
  const t0 = Date.now();
  const review = page.getByRole("heading", { name: /in review/ });
  while (!(await review.count())) { // the sim pauses on new offers: resume until the review
    await page.locator("#simmenu").click();
    await page.locator('[data-mode="season"]').click();
    await expect(review.or(page.locator("#continue"))).toBeVisible({ timeout: 540_000 });
  }
  console.log(`rest of season: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await fits(page, "season review");
  await shot(page, "season-review");
  await page.locator("#ok").click();
  await expect(page.locator("header.top")).toBeVisible();

  expect(errors).toEqual([]);
});
