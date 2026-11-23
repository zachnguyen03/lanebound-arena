import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../lab/s4",
);

async function measureScale(page: import("@playwright/test").Page) {
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

async function jumpToTick(
  page: import("@playwright/test").Page,
  tick: number,
) {
  const wasOpen = await page.getByTestId("event-drawer").isVisible().catch(() => false);
  if (!wasOpen) {
    await page.getByTestId("btn-toggle-drawer").click();
  }
  await expect(page.getByTestId("event-drawer")).toBeVisible();
  await page.getByTestId("event-filter").fill("level_up");
  await page.locator('[data-testid="event-list"] button').first().click();
  await expect(page.getByTestId("watch-transport")).toContainText(
    `${tick}/`,
  );
}

test("capture Watch screenshots + scale report", async ({ page }) => {
  fs.mkdirSync(outDir, { recursive: true });
  const scaleLines: string[] = [];

  const shots: Array<{
    name: string;
    size: { width: number; height: number };
    tick: number;
    drawer: boolean;
  }> = [
    { name: "watch-1920-t0", size: { width: 1920, height: 1080 }, tick: 0, drawer: false },
    { name: "watch-1920-mid", size: { width: 1920, height: 1080 }, tick: 122, drawer: false },
    { name: "watch-1920-drawer", size: { width: 1920, height: 1080 }, tick: 122, drawer: true },
    { name: "watch-1280-t0", size: { width: 1280, height: 720 }, tick: 0, drawer: false },
    { name: "watch-1280-mid", size: { width: 1280, height: 720 }, tick: 122, drawer: false },
    { name: "watch-1280x800-mid", size: { width: 1280, height: 800 }, tick: 122, drawer: false },
  ];

  for (const shot of shots) {
    await page.setViewportSize(shot.size);
    await page.goto("/");
    await page.getByTestId("btn-load-sample").click();
    await expect(page.getByTestId("arena-canvas")).toBeVisible({
      timeout: 60_000,
    });

    if (shot.tick > 0) {
      await jumpToTick(page, shot.tick);
      const open = await page.getByTestId("event-drawer").isVisible();
      if (shot.drawer && !open) {
        await page.getByTestId("btn-toggle-drawer").click();
      }
      if (!shot.drawer && open) {
        await page.getByTestId("btn-close-drawer").click();
        await expect(page.getByTestId("event-drawer")).toHaveCount(0);
      }
    } else if (shot.drawer) {
      await page.getByTestId("btn-toggle-drawer").click();
      await expect(page.getByTestId("event-drawer")).toBeVisible();
    }

    if (shot.drawer) {
      await expect(page.getByTestId("event-drawer")).toBeVisible();
    } else {
      await expect(page.getByTestId("event-drawer")).toHaveCount(0);
    }

    const scale = await measureScale(page);
    scaleLines.push(
      `${shot.name} viewport=${shot.size.width}x${shot.size.height} intrinsic=${scale.intrinsicW}x${scale.intrinsicH} css=${scale.cssW}x${scale.cssH} scaleX=${scale.scaleX} scaleY=${scale.scaleY}`,
    );

    await page.screenshot({
      path: path.join(outDir, `${shot.name}.png`),
      fullPage: false,
    });
  }

  fs.writeFileSync(
    path.join(outDir, "canvas-scale-screenshots.txt"),
    scaleLines.join("\n") + "\n",
  );
});
