import { expect, test } from "playwright/test";
import { expectHeaderFits } from "./header";

const PROMISE: Record<string, string> = {
  "iron-lotus": "Win this year, or close.",
  "hanok-wolves": "Contend from day one, with Neon Tide in the way.",
  "neon-tide": "A title team, if you can get past the Wolves.",
  "vanta-owls": "Close to the top. Beat Iron Lotus and people listen.",
  "juniper-rush": "Build toward a title in three to five seasons.",
  "sable-comets": "A steady climb, with Juniper Rush as the yardstick.",
  glasswing: "A long climb. Start by beating Kestrel Row.",
  "kestrel-row": "A long climb, first title around season six or seven.",
};

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

async function enter(page: import("playwright").Page) {
  const continueButton = page.getByRole("button", { name: "Continue" });
  if (await continueButton.isEnabled()) {
    await continueButton.click();
    return;
  }
  await page.getByRole("button", { name: "New career" }).click();
  await page.getByTestId("club-juniper-rush").click();
  await page.getByRole("button", { name: "Start career" }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => indexedDB.deleteDatabase("lanebound-career"));
  await page.goto("/");
});

test("eight clubs, Juniper highlighted, table, fixtures, save and reload", async ({ page }) => {
  test.setTimeout(60_000);
  await page.getByRole("button", { name: "New career" }).click();
  await expect(page.getByTestId("club-juniper-rush")).toHaveClass(/rec/);
  await expect(page.getByTestId("club-juniper-rush")).toContainText("Recommended");
  await expect(page.getByTestId("club-juniper-rush")).toContainText("Build toward a title in three to five seasons.");
  await expect(page.getByRole("button", { name: "Start career" })).toBeDisabled();
  for (const [id, name] of CLUBS) {
    await page.getByTestId(`club-${id}`).click();
    await expect(page.getByTestId(`club-${id}`)).toContainText(PROMISE[id]);
    await page.getByRole("button", { name: "Start career" }).click();
    await expect(page.getByTestId("league-table").getByRole("row")).toHaveCount(9);
    await expect(page.getByText("Top 4 to the bracket")).toBeVisible();
    await page.getByRole("button", { name: "Competitions" }).click();
    await page.getByRole("button", { name: "Fixtures" }).click();
    await expect(page.getByRole("heading", { name: "Matchday 7" })).toBeVisible();
    await expect(page.getByText("Playoff days open after matchday 7")).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(name).first()).toBeVisible();
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("button", { name: "New career" }).click();
  }
});

test("screens at the three desktop widths", async ({ page }) => {
  const shots: Array<{ name: string; open: () => Promise<void> }> = [
    { name: "01-main-menu", open: async () => {} },
    {
      name: "16b-new-career-club",
      open: async () => {
        await page.getByRole("button", { name: "New career" }).click();
      },
    },
    {
      name: "03-dashboard",
      open: async () => {
        await page.getByRole("button", { name: "New career" }).click();
        await page.getByTestId("club-juniper-rush").click();
        await page.getByRole("button", { name: "Start career" }).click();
      },
    },
    {
      name: "02-shell-squad",
      open: async () => {
        await enter(page);
        await page.getByRole("button", { name: "Squad" }).click();
      },
    },
    {
      name: "18-squad-contracts",
      open: async () => {
        await enter(page);
        await page.getByRole("button", { name: "Squad" }).click();
        await page.getByRole("button", { name: "Contracts" }).click();
      },
    },
    {
      name: "19-league-pyramid",
      open: async () => {
        await enter(page);
        await page.getByRole("button", { name: "Competitions" }).click();
      },
    },
    {
      name: "06-tournament-bracket",
      open: async () => {
        await enter(page);
        await page.getByRole("button", { name: "Competitions" }).click();
        await page.getByRole("button", { name: "Bracket" }).click();
      },
    },
    {
      name: "12-schedule",
      open: async () => {
        await enter(page);
        await page.getByRole("button", { name: "Competitions" }).click();
        await page.getByRole("button", { name: "Fixtures" }).click();
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
      await shot.open();
      if (await page.locator("header.top").count()) await expectHeaderFits(page);
      await page.screenshot({ path: `../../lab/c4/shots/${shot.name}-${width}x${height}.png` });
    }
  }
});

test("overlays leave their controls on top", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "New career" }).click();
  await page.getByTestId("club-juniper-rush").click();
  await page.getByRole("button", { name: "Start career" }).click();
  await expectHeaderFits(page);
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.locator('[data-overlay="settings"]')).toBeVisible();
  await expectNoOverlap(page, "settings");
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.locator('[data-overlay="settings"]')).toBeVisible();
  await page.getByTestId("import-file").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{"),
  });
  await expect(page.locator('[data-overlay="error"]')).toBeVisible();
  await expectNoOverlap(page, "error");
});

async function expectNoOverlap(page: import("playwright").Page, overlay: string) {
  const controls = page.locator(`[data-overlay="${overlay}"]`).locator("button, label");
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

test("a tampered save is rejected", async ({ page }) => {
  await page.getByRole("button", { name: "New career" }).click();
  await page.getByTestId("club-juniper-rush").click();
  await page.getByRole("button", { name: "Start career" }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByTestId("import-file").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"save_format":1,"contract_version":"career-match/1","series":[{"source":"sim"}]}'),
  });
  await expect(page.locator("[data-screen=state-error-save]")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download save file" })).toBeVisible();
  await page.getByRole("button", { name: "Keep playing unsaved" }).click();
  await expect(page.getByText("Juniper Rush").first()).toBeVisible();
});
