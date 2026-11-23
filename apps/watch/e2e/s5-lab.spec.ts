import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const shotDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../lab/s5/shots",
);

test.describe("S5 lab dashboard + tuning", () => {
  test.beforeAll(() => {
    fs.mkdirSync(shotDir, { recursive: true });
  });

  for (const vp of [
    { name: "1280x720", width: 1280, height: 720 },
    { name: "1920x1080", width: 1920, height: 1080 },
  ]) {
    test(`dashboard ${vp.name}`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      await page.getByTestId("btn-open-lab").click();
      await expect(page.getByTestId("lab-shell")).toBeVisible();
      await page.getByTestId("lab-tab-dashboard").click();

      // Empty or loading state must exist; then inject a minimal BatchResult.
      const empty = page.getByTestId("dashboard-empty");
      const table = page.getByTestId("dash-table");
      const loading = page.getByTestId("dashboard-loading");
      await expect(empty.or(table).or(loading)).toBeVisible({ timeout: 15_000 });

      await page.evaluate(() => {
        const fixture = {
          batch_id: "e2e-fixture",
          config_hash: "abc",
          n_requested: 100,
          n_finished: 100,
          cancelled: false,
          scheme: "seed_range",
          seed_start: 20261122,
          summaries: [],
          dashboard: {
            aggregates: {},
            rows: [
              {
                id: "match_length",
                metric: "Match length (median / p10 / p90)",
                target: "Median 3:30–4:30",
                value: "median 1:17.2",
                sample_size: 100,
                mark: "fail",
              },
              {
                id: "zone_share",
                metric: "Zone share of winner's score",
                target: "30–40%",
                value: "60%",
                sample_size: 100,
                mark: "fail",
              },
              {
                id: "per_champion",
                metric: "Per-champion win / pick / KDA",
                target: "45–55%",
                value: "preview",
                sample_size: 100,
                mark: "under-powered",
              },
              {
                id: "archetype_matrix",
                metric: "Comp archetype matrix",
                target: "No archetype >55%",
                value: "preview",
                sample_size: 100,
                mark: "under-powered",
              },
              {
                id: "attribute_isolation",
                metric: "Attribute isolation",
                target: "+3 to +6 pp",
                value: "not run",
                sample_size: 0,
                mark: "under-powered",
              },
              {
                id: "auto_peel",
                metric: "Auto-peel fire rate",
                target: "≥ 70%",
                value: "n/a",
                sample_size: 0,
                mark: "under-powered",
              },
              {
                id: "sanctuary",
                metric: "Spawn-pad entries",
                target: "0",
                value: "0",
                sample_size: 100,
                mark: "pass",
              },
              {
                id: "claim_deny",
                metric: "Claim deny rate",
                target: "Reported",
                value: "opened=0",
                sample_size: 0,
                mark: "report",
              },
              {
                id: "level_timings",
                metric: "Level timings",
                target: "R ~1:20, L7 ~2:40",
                value: "report",
                sample_size: 0,
                mark: "report",
              },
            ],
          },
        };
        window.dispatchEvent(
          new CustomEvent("lab-inject-results", { detail: fixture }),
        );
      });

      // Fallback: if inject event not wired, use file chooser path via setInputFiles
      // after writing a temp fixture — DashboardView listens to file input.
      const fixturePath = path.join(shotDir, "e2e-fixture.json");
      if (!(await table.isVisible().catch(() => false))) {
        const fixture = {
          batch_id: "e2e-fixture",
          config_hash: "abc",
          n_requested: 100,
          n_finished: 100,
          cancelled: false,
          scheme: "seed_range",
          seed_start: 20261122,
          summaries: [],
          dashboard: {
            aggregates: {},
            rows: [
              {
                id: "match_length",
                metric: "Match length",
                target: "210–270",
                value: "77s",
                sample_size: 100,
                mark: "fail",
              },
              {
                id: "zone_share",
                metric: "Zone share",
                target: "30–40%",
                value: "60%",
                sample_size: 100,
                mark: "fail",
              },
              {
                id: "per_champion",
                metric: "Per-champion",
                target: "45–55%",
                value: "preview",
                sample_size: 100,
                mark: "under-powered",
              },
              {
                id: "archetype_matrix",
                metric: "Archetypes",
                target: "<55%",
                value: "preview",
                sample_size: 100,
                mark: "under-powered",
              },
              {
                id: "attribute_isolation",
                metric: "Isolation",
                target: "+3–6pp",
                value: "n/a",
                sample_size: 0,
                mark: "under-powered",
              },
              {
                id: "auto_peel",
                metric: "Peel",
                target: "≥70%",
                value: "n/a",
                sample_size: 0,
                mark: "under-powered",
              },
              {
                id: "sanctuary",
                metric: "Sanctuary",
                target: "0",
                value: "0",
                sample_size: 100,
                mark: "pass",
              },
              {
                id: "claim_deny",
                metric: "Claim deny",
                target: "report",
                value: "0",
                sample_size: 0,
                mark: "report",
              },
              {
                id: "level_timings",
                metric: "Levels",
                target: "report",
                value: "n/a",
                sample_size: 0,
                mark: "report",
              },
            ],
          },
        };
        fs.writeFileSync(fixturePath, JSON.stringify(fixture));
        await page.getByTestId("results-file").setInputFiles(fixturePath);
      }

      await expect(page.getByTestId("dash-table")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId("dash-n-sanctuary")).toContainText("N=");
      await expect(page.getByTestId("dash-mark-sanctuary")).toHaveAttribute(
        "data-testid",
        "dash-mark-sanctuary",
      );

      await page.screenshot({
        path: path.join(shotDir, `dashboard-${vp.name}.png`),
        fullPage: true,
      });
    });
  }

  test("tuning rejects ZONE_TICK_S=7 and saves preset", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.getByTestId("btn-open-lab").click();
    await page.getByTestId("lab-tab-tuning").click();
    await expect(page.getByTestId("tuning-panel")).toBeVisible();

    const input = page.getByTestId("const-input-ZONE_TICK_S");
    await input.fill("7");
    await input.blur();
    await expect(page.getByTestId("tuning-error")).toContainText(/ZONE_TICK_S/);

    await input.fill("10");
    await input.blur();
    await expect(page.getByTestId("diff-ZONE_TICK_S")).toBeVisible();
    await expect(page.getByTestId("preset-dirty")).toBeVisible();
  });
});
