import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../lab/s4",
);

async function loadSample(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("btn-load-sample")).toBeVisible();
  await page.getByTestId("btn-load-sample").click();
  await expect(page.getByTestId("arena-canvas")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("watch-transport")).toBeVisible();
}

async function measureCanvasScale(page: Page) {
  return page.getByTestId("arena-canvas").evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const r = c.getBoundingClientRect();
    return {
      cssW: r.width,
      cssH: r.height,
      intrinsicW: c.width,
      intrinsicH: c.height,
      scaleX: r.width / c.width,
      scaleY: r.height / c.height,
    };
  });
}

const HUD_CONTROLS = [
  "btn-play-pause",
  "btn-step",
  "btn-speed-0.5",
  "btn-speed-1",
  "btn-speed-2",
  "btn-speed-4",
  "btn-speed-8",
  "scrubber",
  "btn-toggle-drawer",
] as const;

async function assertControlHit(page: Page, testId: string): Promise<string | null> {
  const loc = page.getByTestId(testId);
  await expect(loc).toBeVisible();
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  if (!b) return `${testId} missing box`;
  const vp = page.viewportSize()!;
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  if (cx < 0 || cy < 0 || cx > vp.width || cy > vp.height) {
    return `${testId} centre outside viewport (${cx.toFixed(1)},${cy.toFixed(1)})`;
  }
  const top = await page.evaluate(
    ({ x, y, want }) => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      if (!el) return { inWant: false, testid: null as string | null };
      return {
        inWant: !!el.closest(`[data-testid="${want}"]`),
        testid: (el.closest("[data-testid]") as HTMLElement | null)?.getAttribute(
          "data-testid",
        ),
      };
    },
    { x: cx, y: cy, want: testId },
  );
  if (!top.inWant) return `${testId} hit ${top.testid}`;
  return null;
}

test.describe("Watch layout guards (desktop)", () => {
  for (const viewport of [
    { name: "1920x1080", width: 1920, height: 1080, mode: "1080" },
    { name: "1280x720", width: 1280, height: 720, mode: "720" },
    { name: "1280x800", width: 1280, height: 800, mode: "720" },
  ] as const) {
    test(`integer 1:1 canvas scale at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await loadSample(page);
      const scale = await measureCanvasScale(page);
      const report = [
        `viewport=${viewport.name}`,
        `mode=${viewport.mode}`,
        `intrinsic=${scale.intrinsicW}x${scale.intrinsicH}`,
        `css=${scale.cssW}x${scale.cssH}`,
        `scaleX=${scale.scaleX}`,
        `scaleY=${scale.scaleY}`,
        `integer=${Number.isInteger(scale.scaleX) && Number.isInteger(scale.scaleY)}`,
        "",
      ].join("\n");
      fs.mkdirSync(outDir, { recursive: true });
      fs.appendFileSync(path.join(outDir, "canvas-scale.txt"), report);

      expect(scale.scaleX, report).toBe(1);
      expect(scale.scaleY, report).toBe(1);
      expect(scale.cssW).toBe(scale.intrinsicW);
      expect(scale.cssH).toBe(scale.intrinsicH);
      if (viewport.mode === "720") {
        expect(scale.intrinsicH).toBe(520);
      } else {
        expect(scale.intrinsicH).toBe(580);
      }
    });
  }

  test("drawer closed: HUD controls hittable @1920 and @1280", async ({
    page,
  }) => {
    for (const vp of [
      { width: 1920, height: 1080 },
      { width: 1280, height: 720 },
    ]) {
      await page.setViewportSize(vp);
      await loadSample(page);
      const hits: string[] = [];
      for (const id of HUD_CONTROLS) {
        const err = await assertControlHit(page, id);
        if (err) hits.push(err);
      }
      expect(hits, hits.join("\n")).toEqual([]);
    }
  });

  test("HUD controls hittable @390 / @1280 / @1920; banner pinned @390", async ({
    page,
  }) => {
    const EMPTY_CONTROLS = [
      "btn-start-live",
      "btn-start-live-seed2",
      "btn-start-clock-ai",
      "btn-open-lab",
      "btn-load-sample",
    ] as const;

    for (const vp of [
      { width: 390, height: 844 },
      { width: 1280, height: 720 },
      { width: 1920, height: 1080 },
    ]) {
      await page.setViewportSize(vp);
      await page.goto("/");
      await expect(page.getByTestId("btn-load-sample")).toBeVisible({
        timeout: 60_000,
      });

      if (vp.width < 1280) {
        const notice = page.getByTestId("desktop-notice");
        await expect(notice).toBeVisible();
        const nb = await notice.boundingBox();
        expect(nb, "banner box").toBeTruthy();
        expect(nb!.x).toBeGreaterThanOrEqual(-0.5);
        expect(nb!.y).toBeLessThanOrEqual(1);
        expect(nb!.x + nb!.width).toBeLessThanOrEqual(vp.width + 0.5);
      }

      const emptyHits: string[] = [];
      for (const id of EMPTY_CONTROLS) {
        const err = await assertControlHit(page, id);
        if (err) emptyHits.push(err);
      }
      expect(emptyHits, `empty @${vp.width}: ${emptyHits.join("\n")}`).toEqual(
        [],
      );

      await page.getByTestId("btn-load-sample").click();
      await expect(page.getByTestId("arena-canvas")).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByTestId("watch-transport")).toBeVisible();

      if (vp.width < 1280) {
        // Scroll the page body; banner must stay pinned in the viewport.
        await page.evaluate(() => window.scrollTo(0, 400));
        const notice = page.getByTestId("desktop-notice");
        const nb = await notice.boundingBox();
        expect(nb, "banner after scroll").toBeTruthy();
        expect(nb!.y).toBeLessThanOrEqual(1);
        expect(nb!.x).toBeGreaterThanOrEqual(-0.5);
        await page.evaluate(() => window.scrollTo(0, 0));
      }

      const hits: string[] = [];
      for (const id of HUD_CONTROLS) {
        const err = await assertControlHit(page, id);
        if (err) hits.push(err);
      }
      expect(hits, `match @${vp.width}: ${hits.join("\n")}`).toEqual([]);
    }
  });

  test("1280 top-bar clock stays ≥2px inside the 44px bar", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await loadSample(page);
    const bar = page.getByTestId("top-bar");
    const clock = page.getByTestId("top-bar-clock");
    const barBox = await bar.boundingBox();
    const clockBox = await clock.boundingBox();
    expect(barBox).toBeTruthy();
    expect(clockBox).toBeTruthy();
    expect(barBox!.height).toBe(44);
    expect(clockBox!.y).toBeGreaterThanOrEqual(barBox!.y + 2 - 0.5);
    expect(clockBox!.y + clockBox!.height).toBeLessThanOrEqual(
      barBox!.y + barBox!.height - 2 + 0.5,
    );
  });

  test("1280x800: utilities sit fully below the 720 HUD (no peek)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loadSample(page);
    const stage = page.getByTestId("hud-stage");
    const loader = page.getByTestId("log-loader").last();
    const spacer = page.getByTestId("under-hud-spacer");
    await expect(spacer).toBeVisible();
    const stageBox = await stage.boundingBox();
    const spacerBox = await spacer.boundingBox();
    const loaderBox = await loader.boundingBox();
    expect(stageBox).toBeTruthy();
    expect(spacerBox).toBeTruthy();
    expect(loaderBox).toBeTruthy();
    expect(spacerBox!.y).toBeGreaterThanOrEqual(
      stageBox!.y + stageBox!.height - 1,
    );
    expect(spacerBox!.height).toBeGreaterThanOrEqual(79);
    expect(loaderBox!.y).toBeGreaterThanOrEqual(800 - 1);
  });

  test("takedown log is empty on quiet S0 sample (no level_up filler)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await loadSample(page);
    await expect(page.getByTestId("kill-feed-empty")).toHaveText(
      "No takedowns yet",
    );
    await expect(page.getByTestId("kill-feed")).not.toContainText("level_up");
  });
});
