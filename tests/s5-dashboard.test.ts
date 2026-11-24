/**
 * S5 D1–D4: dashboard rows, isolation deltas, sanctuary, sample sizes.
 */
import { describe, expect, it } from "vitest";
import {
  defaultEvenBatchConfig,
  runBatch,
} from "../apps/lab/lib/batch-runner.js";
import { buildDashboard } from "../apps/lab/lib/dashboard.js";
import { runIsolation } from "../apps/lab/lib/isolation.js";
import { dashboardToCsv, summariesToCsv, batchResultToJson } from "../apps/lab/lib/csv.js";
import { parsePresetJson, serializePreset, createPreset } from "../apps/lab/lib/presets.js";

const REQUIRED_ROW_IDS = [
  "match_length",
  "zone_share",
  "per_champion",
  "archetype_matrix",
  "attribute_isolation",
  "auto_peel",
  "sanctuary",
  "claim_deny",
  "level_timings",
];

describe("S5 dashboard D1–D4", () => {
  it("D1: 100-game even batch writes every §6.5 row with mark + sample size; CSV/JSON parse", () => {
    const result = runBatch(defaultEvenBatchConfig(100, 20261122));
    expect(result.n_finished).toBe(100);
    const ids = result.dashboard.rows.map((r) => r.id);
    for (const id of REQUIRED_ROW_IDS) {
      expect(ids).toContain(id);
    }
    for (const row of result.dashboard.rows) {
      expect(row.sample_size, row.id).toBeTypeOf("number");
      expect(
        ["pass", "fail", "under-powered", "report"].includes(row.mark),
        `${row.id} mark`,
      ).toBe(true);
    }
    // Preview N → under-powered on champ / isolation at least
    const champ = result.dashboard.rows.find((r) => r.id === "per_champion");
    expect(champ?.mark).toBe("under-powered");
    const sanc = result.dashboard.rows.find((r) => r.id === "sanctuary");
    expect(sanc?.value).toBe("0");
    expect(sanc?.mark).toBe("pass");

    const json = batchResultToJson(result);
    const parsed = JSON.parse(json);
    expect(parsed.summaries).toHaveLength(100);
    expect(parsed.dashboard.rows).toHaveLength(result.dashboard.rows.length);

    const csv = summariesToCsv(result.summaries);
    expect(csv.startsWith("seed,")).toBe(true);
    const dashCsv = dashboardToCsv(result.dashboard.rows);
    expect(dashCsv).toContain("sample_size");
    expect(dashCsv).toContain("match_length");
  }, 300_000);

  it("D2: isolation preset produces six attribute deltas", () => {
    // Preview N=5 plain — still six deltas; mark under-powered for the claim band.
    const iso = runIsolation({
      nPerArm: 5,
      seedStart: 20261122,
      pairing: "plain",
      includeMirrorControl: false,
    });
    expect(iso.deltas).toHaveLength(6);
    const attrs = iso.deltas.map((d) => d.attr).sort();
    expect(attrs).toEqual([
      "aim",
      "decision",
      "execution",
      "positioning",
      "reflexes",
      "teamwork",
    ]);
    for (const d of iso.deltas) {
      expect(d.n).toBe(5);
      expect(Number.isFinite(d.delta_pp)).toBe(true);
    }
    const dash = buildDashboard(iso.arms.control!.summaries, {
      isolation: iso.dashboard,
    });
    const row = dash.rows.find((r) => r.id === "attribute_isolation");
    expect(row).toBeTruthy();
    expect(row!.mark).toBe("under-powered");
    expect(row!.value).toMatch(/aim/);
  }, 180_000);

  it("D3: sanctuary mark fails when violations > 0; sample_size always present", () => {
    const { rows } = buildDashboard([
      {
        seed: 1,
        digest: "abc",
        winner: "red",
        reason: "first_to_10",
        duration_s: 80,
        score_blue: 0,
        score_red: 10,
        score_parts: {
          blue: { kills: 0, ticks: 0, claims: 0 },
          red: { kills: 4, ticks: 6, claims: 0 },
        },
        archetypes: { blue: "Other", red: "Other" },
        champ_ids: Array(10).fill("huntress"),
        peel_fired: 0,
        peel_eligible: 0,
        sanctuary_violations: 2,
        claim_opened: 0,
        claim_denied: 0,
        claim_paid: 0,
        t_first_R: null,
        t_L7: null,
        kda: Array.from({ length: 10 }, () => ({ k: 0, d: 0, a: 0, dmg: 0 })),
        fight_quality: {
          f1_teamfights: 0,
          f2_combo_chains: 0,
          f3_clutch_moments: 0,
          f4_close_finish: 0,
          lead_changes: 0,
          contested_pit_share: 0,
          f4_comeback: 0,
          f4_shutout: 0,
          f4_multikills: 0,
        },
      },
    ]);
    const sanc = rows.find((r) => r.id === "sanctuary");
    expect(sanc?.mark).toBe("fail");
    expect(sanc?.value).toBe("2");
    for (const row of rows) {
      expect(Object.prototype.hasOwnProperty.call(row, "sample_size")).toBe(
        true,
      );
    }
  });

  it("preset file used by lab round-trips (proof artefact shape)", () => {
    const preset = createPreset(
      "s5-xp-probe",
      { TIME_XP_PER_S: 12 },
      "S5 proof",
    );
    const again = parsePresetJson(serializePreset(preset));
    expect(again).toEqual(preset);
  });

  it("buildDashboard marks empty batch under-powered / report without throwing", () => {
    const { rows } = buildDashboard([]);
    expect(rows.length).toBeGreaterThanOrEqual(REQUIRED_ROW_IDS.length - 0);
    for (const id of REQUIRED_ROW_IDS) {
      expect(rows.find((r) => r.id === id)).toBeTruthy();
    }
  });
});
