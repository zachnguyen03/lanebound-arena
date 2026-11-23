import { expect, test } from "playwright/test";

const CLUBS = [
  ["iron-lotus", "Iron Lotus"],
  ["hanok-wolves", "Hanok Wolves"],
  ["neon-tide", "Neon Tide"],
  ["vanta-owls", "Vanta Owls"],
  ["juniper-rush", "Juniper Rush"],
  ["sable-comets", "Sable Comets"],
  ["glasswing", "Glasswing"],
  ["kestrel-row", "Kestrel Row"],
] as const;

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => indexedDB.deleteDatabase("lanebound-career"));
  await page.goto("/");
});

test("the player's club is marked in the table, including fifth place", async ({ page }) => {
  for (const [id, name] of CLUBS) {
    await page.evaluate(() => indexedDB.deleteDatabase("lanebound-career"));
    await page.goto("/");
    await page.getByRole("button", { name: "New career" }).click();
    await page.getByTestId(`club-${id}`).click();
    await page.getByRole("button", { name: "Start career" }).click();
    await page.getByRole("button", { name: "Competitions" }).click();
    const row = page.getByTestId("league-table").getByRole("row", { name: new RegExp(name) });
    await expect(row).toHaveClass(/\bme\b/);
    if (id === "juniper-rush") await expect(row).toHaveClass(/\bcut\b/);
  }
});
