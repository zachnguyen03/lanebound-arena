import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../lab/s4",
);

test("cold load at 1280x720 has a clean console (no 404)", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 720 });

  const consoleLines: string[] = [];
  const failed: string[] = [];
  const status404: string[] = [];

  page.on("console", (msg) => {
    consoleLines.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => {
    consoleLines.push(`[pageerror] ${err.message}`);
  });
  page.on("requestfailed", (req) => {
    failed.push(`${req.failure()?.errorText ?? "fail"} ${req.url()}`);
  });
  page.on("response", (res) => {
    if (res.status() === 404) status404.push(res.url());
  });

  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByTestId("watch-root")).toBeVisible();
  // Idle a beat for late font/favicon fetches.
  await page.waitForTimeout(500);

  const report = [
    "# Cold load console @1280x720",
    "",
    "## console",
    ...(consoleLines.length ? consoleLines : ["(empty)"]),
    "",
    "## requestfailed",
    ...(failed.length ? failed : ["(none)"]),
    "",
    "## http 404",
    ...(status404.length ? status404 : ["(none)"]),
    "",
  ].join("\n");

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "cold-load-console.txt"), report);

  expect(status404, report).toEqual([]);
  expect(failed, report).toEqual([]);
  await context.close();
});
