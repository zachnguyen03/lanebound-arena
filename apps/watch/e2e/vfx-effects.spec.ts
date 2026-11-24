import { expect, test } from "@playwright/test";

/**
 * Seed 20261122 live match: Latch Line cast_start lands at tick 27
 * (t=2.7, cast_time 0.3). Assert VFX state is present while FX is on.
 */
const LATCH_TICK = 27;

test.describe("Watch skill VFX", () => {
  test.setTimeout(180_000);

  test("effects render at known tick of seed 20261122", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.getByTestId("btn-start-live").click();
    await expect(page.getByTestId("watch-root")).toHaveAttribute(
      "data-match-end",
      /.+/,
      { timeout: 120_000 },
    );
    await expect(page.getByTestId("arena-canvas")).toBeVisible();
    await expect(page.getByTestId("watch-root")).toHaveAttribute(
      "data-vfx",
      "true",
    );

    await page.getByTestId("scrubber").fill(String(LATCH_TICK));
    await expect(page.getByTestId("watch-transport")).toContainText(
      `${LATCH_TICK}/`,
    );

    const count = await page
      .getByTestId("watch-root")
      .getAttribute("data-vfx-count");
    expect(Number(count)).toBeGreaterThan(0);

    // Toggle off clears the attribute path for render; count stays (state),
    // but data-vfx flips.
    await page.getByTestId("btn-toggle-vfx").click();
    await expect(page.getByTestId("watch-root")).toHaveAttribute(
      "data-vfx",
      "false",
    );
    await page.getByTestId("btn-toggle-vfx").click();
    await expect(page.getByTestId("watch-root")).toHaveAttribute(
      "data-vfx",
      "true",
    );

    // HUD controls remain hittable (effects must not cover them).
    for (const id of [
      "btn-toggle-vfx",
      "btn-toggle-overlays",
      "btn-play-pause",
      "scrubber",
    ]) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box, id).toBeTruthy();
      const cx = box!.x + box!.width / 2;
      const cy = box!.y + box!.height / 2;
      const ok = await page.evaluate(
        ({ x, y, want }) => {
          const el = document.elementFromPoint(x, y) as HTMLElement | null;
          return !!el?.closest(`[data-testid="${want}"]`);
        },
        { x: cx, y: cy, want: id },
      );
      expect(ok, id).toBe(true);
    }
  });
});
