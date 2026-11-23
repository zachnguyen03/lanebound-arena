import { expect, test, type Locator, type Page } from "@playwright/test";
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

async function visibleInViewportBoxes(page: Page, loc: Locator) {
  const vp = page.viewportSize()!;
  const all = await loc.all();
  const out: Array<ReturnType<typeof rect> & { testid: string | null }> = [];
  for (const el of all) {
    if (!(await el.isVisible())) continue;
    const b = await el.boundingBox();
    if (!b || b.width < 1 || b.height < 1) continue;
    // Must intersect the viewport (scrollable off-screen rows excluded).
    if (b.y + b.height <= 0 || b.y >= vp.height) continue;
    if (b.x + b.width <= 0 || b.x >= vp.width) continue;
    const r = rect(b);
    // Clamp sample point into viewport.
    const cx = Math.min(Math.max(r.x + r.w / 2, 1), vp.width - 1);
    const cy = Math.min(Math.max(r.y + r.h / 2, 1), vp.height - 1);
    out.push({
      ...r,
      x: r.x,
      y: r.y,
      sampleX: cx,
      sampleY: cy,
      testid: await el.getAttribute("data-testid"),
    } as ReturnType<typeof rect> & {
      testid: string | null;
      sampleX: number;
      sampleY: number;
    });
  }
  return out as Array<
    ReturnType<typeof rect> & {
      testid: string | null;
      sampleX: number;
      sampleY: number;
    }
  >;
}

test.describe("Watch overlay vs controls", () => {
  for (const width of [390, 1280] as const) {
    test(`no overlay covers interactive controls at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
      await page.goto("/");
      await expect(page.getByTestId("btn-load-sample")).toBeVisible();
      await page.getByTestId("btn-load-sample").click();
      await expect(page.getByTestId("watch-transport")).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByTestId("arena-canvas")).toBeVisible();

      // Primary transport / load controls (always in shell chrome).
      const controlSel = [
        '[data-testid="btn-play-pause"]',
        '[data-testid="btn-step"]',
        '[data-testid="btn-speed-0.5"]',
        '[data-testid="btn-speed-1"]',
        '[data-testid="btn-speed-2"]',
        '[data-testid="btn-speed-4"]',
        '[data-testid="scrubber"]',
        '[data-testid="btn-pick-file"]',
        '[data-testid="btn-load-sample"]',
        '[data-testid="event-filter"]',
      ].join(", ");

      const controlBoxes = await visibleInViewportBoxes(
        page,
        page.locator(controlSel),
      );
      expect(controlBoxes.length).toBeGreaterThan(3);

      // First few visible event rows (in the side panel viewport).
      const eventBoxes = await visibleInViewportBoxes(
        page,
        page.locator('[data-testid="event-list"] button'),
      );
      const sampleEvents = eventBoxes.slice(0, 5);

      const overlays = await visibleInViewportBoxes(
        page,
        page.locator(
          '[data-overlay="true"], .watch-overlay, [data-testid="banner-overlay"]',
        ),
      );

      const hits: string[] = [];
      const targets = [...controlBoxes, ...sampleEvents];

      for (const o of overlays) {
        for (const c of targets) {
          if (overlaps(o, c)) {
            hits.push(
              `overlay ${o.testid ?? "?"} overlaps control ${c.testid ?? "?"}`,
            );
          }
        }
      }

      for (const c of targets) {
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
          { x: c.sampleX, y: c.sampleY },
        );
        if (!top) {
          hits.push(
            `no element at (${c.sampleX.toFixed(0)},${c.sampleY.toFixed(0)}) for ${c.testid}`,
          );
          continue;
        }
        if (!["BUTTON", "INPUT", "A", "SELECT", "TEXTAREA"].includes(top.tag)) {
          hits.push(
            `control ${c.testid} center hit ${top.tag} testid=${top.testid}`,
          );
        }
      }

      const report = [
        `viewport=${width}x${width === 390 ? 844 : 800}`,
        `controls_in_view=${controlBoxes.length}`,
        `event_rows_sampled=${sampleEvents.length}`,
        `overlays_in_view=${overlays.length}`,
        `hits=${hits.length}`,
        ...hits,
        `PASS=${hits.length === 0}`,
        "",
      ].join("\n");

      fs.mkdirSync(outDir, { recursive: true });
      fs.appendFileSync(path.join(outDir, "bbox-check.txt"), report);

      expect(hits, report).toEqual([]);
    });
  }
});
