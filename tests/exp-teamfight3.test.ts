/**
 * exp/teamfight-r3 — round 3 levers (not build-spec acceptance).
 */
import { describe, expect, it } from "vitest";
import { simulate } from "../sim/index.js";
import { evenOvrConfig } from "../sim/match_config.js";
import { TEAMFIGHT_EXPERIMENT } from "../sim/cadence.js";
import { ultWorthIt } from "../sim/ai/round3.js";
import type { MatchState, Teamfight, UnitState } from "../sim/types.js";

const unit = (over: Partial<UnitState>): UnitState =>
  ({ alive: true, team: "blue", id: "blue:mid", champ: "sedge", x: 0, y: 0, hp: 100, max_hp: 100, status: [], ...over }) as UnitState;

describe("exp teamfight round 3", () => {
  it.each<[string, Teamfight]>([
    ["spread", { spread: true }],
    ["lanes", { lanes: true }],
    ["ranged_hold", { ranged_hold: true }],
    ["target_cap", { target_cap: 3 }],
    ["disengage", { disengage: true }],
    ["ult_timing", { ult_timing: true }],
    ["dodge", { dodge: true }],
    ["peel", { peel: true }],
  ])("%s changes a tf2 match and stays deterministic", (_, flag) => {
    const tf2 = { ...evenOvrConfig(20261122), teamfight: { ...TEAMFIGHT_EXPERIMENT } };
    const base = simulate(tf2).digest;
    const cfg = { ...tf2, teamfight: { ...TEAMFIGHT_EXPERIMENT, ...flag } };
    const a = simulate(cfg).digest;
    expect(a).not.toBe(base);
    expect(simulate(cfg).digest).toBe(a);
  });

  it("ult timing vetoes an area R that catches one enemy", () => {
    // Sedge R is an area ult; aim on one lone enemy.
    const me = unit({});
    const lone = unit({ id: "red:adc", team: "red", x: 5, y: 5 });
    const far = unit({ id: "red:top", team: "red", x: 15, y: 5 });
    const near = unit({ id: "red:top", team: "red", x: 5.5, y: 5 });
    const st = (units: UnitState[]) => ({ config: { teamfight: { ult_timing: true } }, units }) as unknown as MatchState;
    const p = { skill: "R" as const, target_id: null, tier: "P3" as const, aim_x: 5, aim_y: 5 };
    expect(ultWorthIt(st([me, lone, far]), me, p)).toBe(false);
    expect(ultWorthIt(st([me, lone, near]), me, p)).toBe(true);
  });
});
