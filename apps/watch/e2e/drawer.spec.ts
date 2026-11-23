import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../lab/s4",
);

const SLOTS = ["top", "jungle", "mid", "adc", "support"] as const;

/** HUD controls + both rails + every rail frame. */
function hudControls(): string[] {
  const ids = [
    "btn-play-pause",
    "btn-step",
    "btn-speed-0.5",
    "btn-speed-1",
    "btn-speed-2",
    "btn-speed-4",
    "btn-speed-8",
    "scrubber",
    "btn-toggle-drawer",
    "kill-feed",
    "rail-only-blue",
    "rail-only-red",
  ];
  for (const team of ["blue", "red"] as const) {
    for (const slot of SLOTS) {
      ids.push(`frame-${team}:${slot}`);
    }
  }
  return ids;
}

async function loadSample(page: Page) {
  await page.goto("/");
  await page.getByTestId("btn-load-sample").click();
  await expect(page.getByTestId("arena-canvas")).toBeVisible({
    timeout: 60_000,
  });
}

async function assertFullyInViewport(
  page: Page,
  testId: string,
): Promise<string | null> {
  const loc = page.getByTestId(testId);
  const box = await loc.boundingBox();
  if (!box) return `${testId} missing box`;
  const vp = page.viewportSize()!;
  if (box.x < -0.5 || box.y < -0.5) {
    return `${testId} origin (${box.x},${box.y}) outside viewport`;
  }
  if (box.x + box.width > vp.width + 0.5) {
    return `${testId} right edge ${box.x + box.width} > ${vp.width}`;
  }
  if (box.y + box.height > vp.height + 0.5) {
    return `${testId} bottom edge ${box.y + box.height} > ${vp.height}`;
  }
  return null;
}

async function hitTestId(
  page: Page,
  testId: string,
): Promise<{ ok: boolean; detail: string }> {
  const boundsErr = await assertFullyInViewport(page, testId);
  if (boundsErr) return { ok: false, detail: boundsErr };

  const loc = page.getByTestId(testId);
  const box = await loc.boundingBox();
  if (!box) return { ok: false, detail: `${testId} missing box` };
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const top = await page.evaluate(
    ({ x, y, want }) => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      if (!el) return { inWant: false, hit: null as string | null };
      return {
        inWant: !!el.closest(`[data-testid="${want}"]`),
        hit: (el.closest("[data-testid]") as HTMLElement | null)?.getAttribute(
          "data-testid",
        ),
      };
    },
    { x: cx, y: cy, want: testId },
  );
  if (!top.inWant) {
    return {
      ok: false,
      detail: `${testId} centre hit testid=${top.hit}`,
    };
  }
  return { ok: true, detail: `${testId} ok` };
}

test.describe("drawer open: controls hittable / modal", () => {
  for (const vp of [
    { name: "1920x1080", width: 1920, height: 1080, kind: "push" as const },
    { name: "1280x720", width: 1280, height: 720, kind: "modal" as const },
    { name: "1280x800", width: 1280, height: 800, kind: "modal" as const },
  ]) {
    test(`${vp.name}: drawer behaviour + screenshots`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await loadSample(page);
      await page.getByTestId("btn-toggle-drawer").click();
      await expect(page.getByTestId("event-drawer")).toBeVisible();
      await expect(page.getByTestId("watch-root")).toHaveAttribute(
        "data-drawer-mode",
        vp.kind === "push" ? "push" : "modal",
      );
      await expect(page.getByTestId("event-drawer")).toHaveAttribute(
        "data-drawer-kind",
        vp.kind,
      );

      if (vp.kind === "push") {
        const transform = await page
          .getByTestId("hud-stage")
          .evaluate((el) => getComputedStyle(el).transform);
        expect(
          transform === "none" || transform === "matrix(1, 0, 0, 1, 0, 0)",
        ).toBe(true);
        // Stage fits remaining width (1920 − 320 = 1600).
        const stageBox = await page.getByTestId("hud-stage").boundingBox();
        expect(stageBox).toBeTruthy();
        expect(stageBox!.width).toBe(1600);
        expect(stageBox!.x).toBeGreaterThanOrEqual(0);
      }

      fs.mkdirSync(outDir, { recursive: true });
      await page.screenshot({
        path: path.join(outDir, `watch-${vp.name}-drawer.png`),
        fullPage: false,
      });

      // Drawer open: every HUD + rail control fully in viewport and hittable.
      const hits: string[] = [];
      for (const id of hudControls()) {
        const r = await hitTestId(page, id);
        if (!r.ok) hits.push(r.detail);
      }
      expect(hits, hits.join("\n")).toEqual([]);

      if (vp.kind === "push") {
        await page.getByTestId("btn-speed-8").click();
        await expect(page.getByTestId("btn-speed-8")).toHaveClass(
          /border-paper/,
        );
        await expect(page.getByTestId("event-log-panel")).toContainText(
          "Hide XP gains",
        );
        await expect(page.getByTestId("event-log-panel")).not.toContainText(
          "Hide xp_gain",
        );
        await expect(page.getByTestId("event-list")).toContainText("Level up");
        await expect(page.getByTestId("event-list")).not.toContainText(
          "level_up",
        );
      } else {
        await expect(page.getByTestId("drawer-backdrop")).toBeVisible();
        const closeHit = await hitTestId(page, "btn-close-drawer");
        expect(closeHit.ok, closeHit.detail).toBe(true);
        // 8× is hittable through the dim (pointer-events: none on backdrop).
        await page.getByTestId("btn-speed-8").click();
        await expect(page.getByTestId("btn-speed-8")).toHaveClass(
          /border-paper/,
        );
      }
    });
  }
});
