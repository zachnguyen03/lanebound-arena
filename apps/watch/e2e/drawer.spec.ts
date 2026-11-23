import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../lab/s4",
);

/** HUD controls that must stay in-viewport and hittable with the drawer open (push mode). */
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

async function loadSample(page: Page) {
  await page.goto("/");
  await page.getByTestId("btn-load-sample").click();
  await expect(page.getByTestId("arena-canvas")).toBeVisible({
    timeout: 60_000,
  });
}

async function hitTestId(
  page: Page,
  testId: string,
): Promise<{ ok: boolean; detail: string }> {
  const loc = page.getByTestId(testId);
  const box = await loc.boundingBox();
  if (!box) return { ok: false, detail: `${testId} missing box` };
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  // Must be inside the viewport (no scroll required).
  const vp = page.viewportSize()!;
  if (cx < 0 || cy < 0 || cx > vp.width || cy > vp.height) {
    return {
      ok: false,
      detail: `${testId} centre (${cx},${cy}) outside viewport ${vp.width}x${vp.height}`,
    };
  }
  const top = await page.evaluate(
    ({ x, y, want }) => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      if (!el) return { hit: null as string | null, tag: null as string | null };
      const node =
        (el.closest(`[data-testid="${want}"]`) as HTMLElement | null) ??
        (el.closest(
          "button, input, [role='button'], a, select, textarea",
        ) as HTMLElement | null) ??
        el;
      return {
        hit: node.getAttribute("data-testid"),
        tag: node.tagName,
        inWant: !!el.closest(`[data-testid="${want}"]`),
      };
    },
    { x: cx, y: cy, want: testId },
  );
  if (!top.inWant) {
    return {
      ok: false,
      detail: `${testId} centre hit testid=${top.hit} tag=${top.tag}`,
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

      fs.mkdirSync(outDir, { recursive: true });
      await page.screenshot({
        path: path.join(outDir, `watch-${vp.name}-drawer.png`),
        fullPage: false,
      });

      if (vp.kind === "push") {
        const hits: string[] = [];
        for (const id of HUD_CONTROLS) {
          const r = await hitTestId(page, id);
          if (!r.ok) hits.push(r.detail);
        }
        // Takedown panel edge must also remain hittable.
        const kf = await hitTestId(page, "kill-feed");
        if (!kf.ok) hits.push(kf.detail);
        expect(hits, hits.join("\n")).toEqual([]);

        // Click 8x with drawer open — speed must change.
        await page.getByTestId("btn-speed-8").click();
        await expect(page.getByTestId("btn-speed-8")).toHaveClass(/border-paper/);
      } else {
        // Modal: backdrop covers stage; Close is hittable; close then click 8x.
        await expect(page.getByTestId("drawer-backdrop")).toBeVisible();
        const closeHit = await hitTestId(page, "btn-close-drawer");
        expect(closeHit.ok, closeHit.detail).toBe(true);
        // Stage control centres must NOT be the transport while modal is up.
        const speedBox = await page.getByTestId("btn-speed-8").boundingBox();
        expect(speedBox).toBeTruthy();
        const covered = await page.evaluate(
          ({ x, y }) => {
            const el = document.elementFromPoint(x, y) as HTMLElement | null;
            return el?.closest('[data-testid="event-drawer"]') != null;
          },
          {
            x: speedBox!.x + speedBox!.width / 2,
            y: speedBox!.y + speedBox!.height / 2,
          },
        );
        expect(covered).toBe(true);
        await page.getByTestId("btn-close-drawer").click();
        await expect(page.getByTestId("event-drawer")).toHaveCount(0);
        await page.getByTestId("btn-speed-8").click();
        await expect(page.getByTestId("btn-speed-8")).toHaveClass(/border-paper/);
      }
    });
  }
});
