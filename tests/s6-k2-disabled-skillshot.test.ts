/**
 * K-2 disabled-target skillshot override (§8.4 L935–944 / test 19c).
 * Target stunned → Reflexes ignored; hit% piecewise in eff_Aim.
 * Aim 30/60/70/90 → 70/80/90/95% ±2 pts; identical at Reflexes 30 and 90.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_CONSTANTS, defaultEvenConfig, simulate } from "../sim/index.js";
import { hitChanceDisabled } from "../sim/stats.js";
import { sha256Hex } from "../sim/sha256.js";
import type { MatchConfig, UnitId } from "../sim/types.js";

const N = 2000;
const SEED = 20261122;
const TOL = 0.02;

function disabledAimLab(
  seed: number,
  aim: number,
  targetReflexes: number,
  n = N,
): { hits: number; rate: number; replayDigest: string; hitChance: number } {
  const caster = "blue:adc" as UnitId;
  const target = "red:adc" as UnitId;
  const cfg: MatchConfig = {
    ...defaultEvenConfig(seed),
    constants: { MATCH_T: 2.0 },
    unit_overrides: {
      [caster]: {
        x: 12,
        y: 8,
        champ: "huntress",
        spawn_shield_until: 0,
        auto_next_start_t: 999,
        attrs: { aim, reflexes: 70, execution: 70, decision: 70, positioning: 70, teamwork: 70 },
      },
      [target]: {
        x: 13,
        y: 8,
        spawn_shield_until: 0,
        auto_next_start_t: 999,
        attrs: {
          aim: 70,
          reflexes: targetReflexes,
          execution: 70,
          decision: 70,
          positioning: 70,
          teamwork: 70,
        },
      },
    },
    // Stun lands before the skillshot batch so K-2 applies at roll time.
    scripted_cc: [
      {
        tick: 1,
        target_id: target,
        kind: "stun",
        duration: 10,
        source_id: caster,
      },
    ],
    scripted_skillshots: [{ tick: 2, source_id: caster, target_id: target, count: n }],
  };
  const r = simulate(cfg);
  const rolls = r.events.filter((e) => e.type === "skillshot_roll" && e.skill_id === "lab_skillshot");
  const hits = rolls.filter((e) => e.hit === true).length;
  const bits = rolls.map((e) => (e.hit ? 1 : 0)).join("");
  return {
    hits,
    rate: hits / n,
    replayDigest: sha256Hex(bits),
    hitChance: hitChanceDisabled(aim),
  };
}

describe("K-2 disabled-target skillshot hit% (§8.4 L935–944)", () => {
  it("formula: Aim 30/45/60/70/75 → 70/75/80/90/95%", () => {
    expect(hitChanceDisabled(30)).toBeCloseTo(0.7, 12);
    expect(hitChanceDisabled(20)).toBeCloseTo(0.7, 12);
    expect(hitChanceDisabled(45)).toBeCloseTo(0.75, 12);
    expect(hitChanceDisabled(60)).toBeCloseTo(0.8, 12);
    expect(hitChanceDisabled(70)).toBeCloseTo(0.9, 12);
    expect(hitChanceDisabled(75)).toBeCloseTo(0.95, 12);
    expect(hitChanceDisabled(90)).toBeCloseTo(0.95, 12);
  });

  for (const [aim, expected] of [
    [30, 0.7],
    [60, 0.8],
    [70, 0.9],
    [90, 0.95],
  ] as const) {
    it(`Aim ${aim} → ~${(expected * 100).toFixed(0)}% ±2 over 2000 rolls; Reflexes 30 ≡ 90`, () => {
      const a30 = disabledAimLab(SEED, aim, 30);
      const a90 = disabledAimLab(SEED, aim, 90);
      const b30 = disabledAimLab(SEED, aim, 30);
      expect(a30.hitChance).toBeCloseTo(expected, 12);
      expect(Math.abs(a30.rate - expected)).toBeLessThanOrEqual(TOL);
      expect(Math.abs(a90.rate - expected)).toBeLessThanOrEqual(TOL);
      // Same seed + same Aim → identical bits regardless of target Reflexes.
      expect(a30.replayDigest).toBe(a90.replayDigest);
      expect(a30.hits).toBe(a90.hits);
      expect(a30.replayDigest).toBe(b30.replayDigest);
    });
  }

  it("non-disabled target still uses Aim vs Reflexes (control)", () => {
    const caster = "blue:adc" as UnitId;
    const target = "red:adc" as UnitId;
    const cfg: MatchConfig = {
      ...defaultEvenConfig(SEED),
      constants: { MATCH_T: 1.0 },
      unit_overrides: {
        [caster]: {
          x: 12,
          y: 8,
          champ: "huntress",
          spawn_shield_until: 0,
          auto_next_start_t: 999,
          attrs: { aim: 60, reflexes: 70, execution: 70, decision: 70, positioning: 70, teamwork: 70 },
        },
        [target]: {
          x: 13,
          y: 8,
          spawn_shield_until: 0,
          auto_next_start_t: 999,
          attrs: { aim: 70, reflexes: 60, execution: 70, decision: 70, positioning: 70, teamwork: 70 },
        },
      },
      scripted_skillshots: [{ tick: 1, source_id: caster, target_id: target, count: N }],
    };
    const r = simulate(cfg);
    const rolls = r.events.filter((e) => e.type === "skillshot_roll" && e.skill_id === "lab_skillshot");
    const rate = rolls.filter((e) => e.hit === true).length / N;
    // 60 vs 60 → 55% (locked formula); must NOT be the K-2 80%.
    expect(Math.abs(rate - 0.55)).toBeLessThanOrEqual(TOL);
    expect(Math.abs(rate - 0.8)).toBeGreaterThan(TOL);
  });

  void DEFAULT_CONSTANTS;
});
