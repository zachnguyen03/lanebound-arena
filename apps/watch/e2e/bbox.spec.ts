import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../lab/s4",
);

function rect(box: { x: number; y: number; width: number; height: number }) {
  return {
    x: box.x,
    y: box.y,
    w: box.width,
    h: box.height,
    r: box.x + box.width,
    b: box.y + box.height,
  };
}

function overlaps(
  a: ReturnType<typeof rect>,
  b: ReturnType<typeof rect>,
): boolean {
  return !(a.r <= b.x || b.r <= a.x || a.b <= b.y || b.b <= a.y);
}

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

const CONTROL_SELECTORS = [
  '[data-testid="btn-play-pause"]',
  '[data-testid="btn-step"]',
  '[data-testid="btn-speed-0.5"]',
  '[data-testid="btn-speed-1"]',
  '[data-testid="btn-speed-2"]',
  '[data-testid="btn-speed-4"]',
  '[data-testid="btn-speed-8"]',
  '[data-testid="scrubber"]',
  '[data-testid="btn-pick-file"]',
  '[data-testid="btn-load-sample"]',
  '[data-testid="btn-toggle-drawer"]',
];

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
      await expect(page.getByTestId("hud-stage")).toHaveAttribute(
        "data-testid",
        "hud-stage",
      );
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

  for (const viewport of [
    { name: "1920x1080", width: 1920, height: 1080 },
    { name: "1280x720", width: 1280, height: 720 },
  ] as const) {
    test(`no overlay covers controls at ${viewport.name} (drawer closed + open)`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await loadSample(page);

      const runPass = async (drawerOpen: boolean) => {
        if (drawerOpen) {
          await page.getByTestId("btn-toggle-drawer").click();
          await expect(page.getByTestId("event-drawer")).toBeVisible();
          await expect(page.getByTestId("event-list")).toBeVisible();
        } else if (await page.getByTestId("event-drawer").count()) {
          await page.getByTestId("btn-close-drawer").click();
          await expect(page.getByTestId("event-drawer")).toHaveCount(0);
        }

        const hits: string[] = [];
        const overlays = page.locator('[data-overlay="drawer"]');
        const overlayBoxes: ReturnType<typeof rect>[] = [];
        for (const el of await overlays.all()) {
          if (!(await el.isVisible())) continue;
          const b = await el.boundingBox();
          if (b) overlayBoxes.push(rect(b));
        }

        for (const sel of CONTROL_SELECTORS) {
          const loc = page.locator(sel).first();
          await loc.scrollIntoViewIfNeeded();
          await expect(loc).toBeVisible();
          const b = await loc.boundingBox();
          if (!b) {
            hits.push(`${sel} missing box`);
            continue;
          }
          const c = rect(b);
          for (const o of overlayBoxes) {
            // Drawer is allowed to exist; it must not intersect transport/controls.
            // When open, the stage is pushed — controls must sit left of the drawer.
            if (overlaps(o, c)) {
              hits.push(`${sel} intersects overlay`);
            }
          }
          const cx = c.x + c.w / 2;
          const cy = c.y + c.h / 2;
          const top = await page.evaluate(
            ({ x, y }) => {
              const el = document.elementFromPoint(x, y) as HTMLElement | null;
              if (!el) return null;
              const interactive = el.closest(
                "button, input, [role='button'], a, select, textarea",
              ) as HTMLElement | null;
              const node = interactive ?? el;
              return {
                tag: node.tagName,
                testid: node.getAttribute("data-testid"),
              };
            },
            { x: cx, y: cy },
          );
          if (!top) {
            hits.push(`${sel} no elementFromPoint`);
            continue;
          }
          if (
            !["BUTTON", "INPUT", "A", "SELECT", "TEXTAREA"].includes(top.tag)
          ) {
            hits.push(
              `${sel} center hit ${top.tag} testid=${top.testid}`,
            );
          }
        }

        // With drawer open, also check event-filter and a few event rows.
        if (drawerOpen) {
          const filter = page.getByTestId("event-filter");
          await filter.scrollIntoViewIfNeeded();
          await expect(filter).toBeVisible();
          const rows = page.locator('[data-testid="event-list"] button');
          const n = Math.min(5, await rows.count());
          expect(n).toBeGreaterThan(0);
          for (let i = 0; i < n; i++) {
            await rows.nth(i).scrollIntoViewIfNeeded();
            await expect(rows.nth(i)).toBeVisible();
          }
        }

        const report = [
          `viewport=${viewport.name}`,
          `drawerOpen=${drawerOpen}`,
          `overlays=${overlayBoxes.length}`,
          `hits=${hits.length}`,
          ...hits,
          `PASS=${hits.length === 0}`,
          "",
        ].join("\n");
        fs.mkdirSync(outDir, { recursive: true });
        fs.appendFileSync(path.join(outDir, "bbox-check.txt"), report);
        expect(hits, report).toEqual([]);
      };

      await runPass(false);
      await runPass(true);
    });
  }

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
    // Spacer fills the under-HUD band; loader starts at/after the fold.
    expect(spacerBox!.y).toBeGreaterThanOrEqual(stageBox!.y + stageBox!.height - 1);
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
