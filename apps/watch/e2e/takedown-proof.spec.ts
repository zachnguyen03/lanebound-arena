import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../lab/s4",
);

test("handmade death log: takedown rows show team + score", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  await expect(page.getByTestId("btn-pick-file")).toBeVisible();

  const logPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../public/samples/handmade-deaths.jsonl",
  );
  await page.getByTestId("file-input").setInputFiles(logPath);
  await expect(page.getByTestId("arena-canvas")).toBeVisible({
    timeout: 60_000,
  });

  // Scrub to after the first takedown.
  await page.getByTestId("scrubber").fill("12");
  const feed = page.getByTestId("kill-feed");
  await expect(feed).toContainText("B MID → R ADC");
  await expect(feed).toContainText("BLUE scores · 1–0");
  await expect(feed).not.toContainText("B ?");

  await page.getByTestId("scrubber").fill("50");
  await expect(feed).toContainText("BLUE scores · 2–1");
  await expect(feed).toContainText("RED scores · 1–1");

  fs.mkdirSync(outDir, { recursive: true });
  await page.screenshot({
    path: path.join(outDir, "watch-1920-takedown-proof.png"),
    fullPage: false,
  });
  await feed.screenshot({
    path: path.join(outDir, "watch-takedown-log-crop.png"),
  });
});
