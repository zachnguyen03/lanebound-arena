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
  const target = page.getByTestId("match-tabs");
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
  const caretSet = await mark.locator(".coachcaret").evaluate((el) => el.style.left !== "" || el.style.top !== "");
  expect(caretSet).toBe(true);
  const markLeft = () => mark.evaluate((el) => Number.parseFloat(el.style.left));
  const wideLeft = await markLeft();
  await page.setViewportSize({ width: 560, height: 800 });
  await expect.poll(markLeft).not.toBe(wideLeft);
  const panel = await page.getByTestId("recap").boundingBox();
  const caret = await mark.locator(".coachcaret").boundingBox();
  expect(panel).not.toBeNull();
  expect(caret).not.toBeNull();
  expect(caret!.y).toBeGreaterThan(panel!.y);
  expect(caret!.y).toBeLessThan(panel!.y + panel!.height);
  expect(Math.abs(caret!.x - (panel!.x + panel!.width))).toBeLessThan(80);
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
  await expect(page.getByTestId("scoreline")).toHaveText(/^JNR \d+–\d+ \S+$/);
  await expect(page.locator(".ratecols table").first()).toContainText("Juniper Rush");
  await expect(page.getByRole("heading", { name: "Cards" })).toBeVisible();
  const gap = await page.locator(".cardgap").evaluate((el) => Number.parseFloat(getComputedStyle(el).marginTop));
  expect(gap).toBeGreaterThanOrEqual(16);
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
  const faces = await page.locator(".pickedfaces").boundingBox();
  const points = await page.locator(".cardtop .meta").boundingBox();
  expect(faces).not.toBeNull();
  expect(points).not.toBeNull();
  expect(points!.x).toBeGreaterThan(faces!.x + faces!.width - 2);
  expect(points!.x - (faces!.x + faces!.width)).toBeLessThan(40);
  expect(points!.y + points!.height).toBeGreaterThan(faces!.y);
  expect(points!.y).toBeLessThan(faces!.y + faces!.height);
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
  const fade = await page.locator(".poolwrap").evaluate((el) => {
    const style = getComputedStyle(el, "::after");
    return { height: style.height, events: style.pointerEvents, image: style.backgroundImage };
  });
  expect(fade.height).toBe("24px");
  expect(fade.events).toBe("none");
  expect(fade.image).toContain("gradient");
});

test("tactics use the segment control and grey out when locked", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await start(page);
  await page.getByRole("button", { name: "Continue" }).click();
  const seg = page.getByTestId("tactic-seg");
  await expect(seg).toHaveClass(/seg/);
  await expect(seg.getByRole("button", { name: "Hold the Pit" })).toHaveClass(/on/);
  await expect(page.locator(".tacticline")).toHaveText("Occupy and defend the zone; orbs on the way only");
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
  await expect(page.getByTestId("map-label")).toHaveText("Map 1 of 3");
  await expect(page.getByTestId("coach-mark")).toContainText("Map 1 of 3");
  await page.getByRole("button", { name: "Tactics" }).click();
  await expect(page.getByTestId("coach-mark")).toHaveCount(0);
  await expect(page.getByTestId("map-label")).toHaveText("Map 2 of 3");
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

test("card events are a padded table with a side chip and status colour", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByTestId("play-map").click();
  const table = page.getByTestId("card-events");
  await expect(table.locator("th")).toHaveText(["Card", "Side", "Status"]);
  const chip = table.locator(".sidechip").first();
  const paint = await chip.evaluate((el) => {
    const style = getComputedStyle(el);
    const probe = document.createElement("div");
    probe.style.background = el.classList.contains("red") ? "var(--c-red)" : "var(--c-blue)";
    document.body.append(probe);
    const background = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return { background: style.backgroundColor, expected: background };
  });
  expect(paint.background).toBe(paint.expected);
  const status = table.locator("td.fired, td.expired").first();
  const colour = await status.evaluate((el) => {
    const style = getComputedStyle(el);
    const probe = document.createElement("div");
    probe.style.color = el.classList.contains("fired") ? "var(--c-text)" : "var(--c-faint)";
    document.body.append(probe);
    const expected = getComputedStyle(probe).color;
    probe.remove();
    return { color: style.color, expected };
  });
  expect(colour.color).toBe(colour.expected);
});

test("squad tables do not use the me row", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "Squad" }).click();
  await expect(page.locator("main table tr.me")).toHaveCount(0);
  const pad = await page.locator(".splitline").evaluate((el) => getComputedStyle(el).paddingLeft);
  expect(pad).toBe("18px");
  await page.getByRole("button", { name: "Contracts" }).click();
  await expect(page.locator("main table tr.me")).toHaveCount(0);
});

test("Play map stays in view with and without the coach mark", async ({ page }) => {
  for (const [width, height] of [
    [1280, 720],
    [1280, 800],
    [1920, 1080],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await page.evaluate(() => indexedDB.deleteDatabase("lanebound-career"));
    await page.reload();
    await start(page);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByTestId("coach-mark")).toHaveCount(0);
    await expectInView(page, height);
    await page.getByRole("button", { name: "Cards" }).click();
    await expectInView(page, height);
    await page.getByTestId("play-map").click();
    await expect(page.getByTestId("coach-mark")).toBeVisible();
    await expectInView(page, height);
  }
});

test("back and forward move between screens and do not replay play", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await start(page);
  await expect(page.locator("[data-screen='home']")).toBeVisible();
  await page.getByRole("button", { name: "Squad" }).click();
  await page.getByRole("button", { name: "Lineup" }).click();
  await expect(page.getByTestId("lineup")).toBeVisible();
  await page.goBack();
  await expect(page.locator("[data-screen='players']")).toBeVisible();
  await page.goForward();
  await expect(page.getByTestId("lineup")).toBeVisible();
  await page.goBack();
  await page.goBack();
  await expect(page.locator("[data-screen='home']")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByTestId("map-label")).toHaveText("Map 1 of 3");
  await page.getByTestId("play-map").click();
  await expect(page.getByTestId("map-label")).toHaveText("Map 1 of 3");
  await page.goBack();
  await page.goForward();
  await expect(page.getByTestId("map-label")).toHaveText("Map 1 of 3");
  await expect(page.getByTestId("recap")).toBeVisible();
  for (let step = 0; step < 8; step++) await page.goBack();
  expect(page.url()).toContain("127.0.0.1");
  expect(page.url()).not.toBe("about:blank");
  await expect(page.getByText("Lanebound").first()).toBeVisible();
  await page.reload();
  if (await page.locator("[data-screen='menu']").isVisible()) {
    await page.getByRole("button", { name: "Continue" }).click();
  }
  if (await page.locator("[data-screen='home']").isVisible()) {
    await page.getByRole("button", { name: "Continue" }).click();
  }
  await expect(page.getByTestId("map-label")).toHaveText("Map 2 of 3");
});

test("the map 1 coach mark leaves every status cell clear at 1440x900", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await start(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByTestId("play-map").click();
  await expect(page.getByTestId("coach-mark")).toBeVisible();
  const cells = page.getByTestId("card-events").locator("th:last-child, td:last-child");
  const count = await cells.count();
  expect(count).toBeGreaterThan(1);
  for (let i = 0; i < count; i++) {
    const clear = await cells.nth(i).evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const found = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return !!found && (el.contains(found) || found.contains(el));
    });
    expect(clear).toBe(true);
  }
});

test("a cold load gets a favicon", async ({ page }) => {
  const response = await page.request.get("/favicon.ico");
  expect(response.status()).toBe(200);
  const type = response.headers()["content-type"] ?? "";
  expect(type).toMatch(/icon|image/);
  expect((await response.body()).byteLength).toBeGreaterThan(32);
});

test("coach marks follow the step, survive dismissal, and leave controls clear", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await start(page);
  await page.getByRole("button", { name: "Continue" }).click();
  const steps = [
    { tab: "Recap", label: "Map 1 of 3" },
    { tab: "Recap", label: "Map 2 of 3" },
    { tab: "Draft", label: "" },
    { tab: "Tactics", label: "" },
  ];
  for (const step of steps) {
    await page.getByTestId("play-map").click();
    if (step.tab !== "Recap") await page.getByRole("button", { name: step.tab }).click();
    const label = await page.getByTestId("map-label").innerText();
    if (step.label) expect(label).toBe(step.label);
    await expect(page.getByTestId("coach-mark")).toContainText(label);
    for (const other of ["Tactics", "Cards", "Draft", "Recap"]) {
      if (other === step.tab) continue;
      await page.getByRole("button", { name: other }).click();
      await expect(page.getByTestId("coach-mark")).toHaveCount(0);
    }
    await page.getByRole("button", { name: step.tab }).click();
    await expect(page.getByTestId("coach-mark")).toBeVisible();
    await expectClear(page, step.tab);
    if (step.tab === "Recap" && step.label === "Map 1 of 3") {
      await page.getByRole("button", { name: "Got it" }).click();
      await page.waitForFunction(async () => {
        const request = indexedDB.open("lanebound-career");
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        const json = await new Promise<unknown>((resolve, reject) => {
          const get = db.transaction("save").objectStore("save").get("current");
          get.onsuccess = () => resolve(get.result);
          get.onerror = () => reject(get.error);
        });
        return typeof json === "string" && json.includes('"coach_dismissed":[1]');
      });
      await page.reload();
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByRole("button", { name: "Recap" }).click();
      await expect(page.getByTestId("coach-mark")).toHaveCount(0);
      await page.getByRole("button", { name: "Tactics" }).click();
    } else {
      await page.getByRole("button", { name: "Got it" }).click();
    }
  }
});

async function expectClear(page: Page, tab: string) {
  await expectHits(page, page.getByTestId("play-map"));
  if (tab === "Tactics") {
    await expectHits(page, page.getByRole("button", { name: "Hold the Pit" }));
    await expectHits(page, page.locator("section[data-screen='tactics'] h3"));
  }
  if (tab === "Draft") {
    await expectHits(page, page.getByTestId("draft").locator("th").first());
    await expectHits(page, page.getByTestId("draft").locator("tbody tr").nth(1).locator("td").first());
  }
  if (tab === "Recap") {
    await expectHits(page, page.locator(".ratecols th").first());
    await expectHits(page, page.locator(".ratecols tbody tr").nth(1).locator("td").first());
  }
}

async function expectHits(page: Page, locator: ReturnType<Page["locator"]>) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const point = { x: box!.x + Math.min(box!.width / 2, 40), y: box!.y + Math.min(box!.height / 2, 10) };
  const hit = await locator.evaluate((el, at) => {
    const found = document.elementFromPoint(at.x, at.y);
    return found ? el.contains(found) || found.contains(el) : false;
  }, point);
  expect(hit).toBe(true);
}

async function expectInView(page: Page, height: number) {
  const box = await page.getByTestId("play-map").boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(height);
}

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
