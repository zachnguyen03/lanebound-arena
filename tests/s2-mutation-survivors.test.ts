/**
 * Extra S2 behaviour pins outside tests/acceptance/s2.
 */
import { describe, expect, it } from "vitest";
import { hystS } from "../sim/ai/attributes.js";
import { chaseShouldStop, type ChaseState } from "../sim/ai/brain.js";
import { dummy5sDamage, dpsEst } from "../sim/ai/dps.js";
import { shouldRunL1 } from "../sim/ai/fight.js";
import { reachFactor } from "../sim/ai/target.js";
import { DEFAULT_CONSTANTS } from "../sim/index.js";
import { inOwnSanctuary } from "../sim/map.js";
import { emptyStatus } from "../sim/status.js";
import type { DummyStats, UnitState } from "../sim/types.js";

const c = DEFAULT_CONSTANTS;

function bare(
  partial: Partial<UnitState> & Pick<UnitState, "id" | "team" | "slot" | "champ">,
): UnitState {
  const baseStats: DummyStats = {
    hp: 900,
    regen: 4,
    atk: 72,
    pow: 8,
    pres: 26,
    mres: 24,
    as: 0.84,
    crit: 0.08,
    range: 6.25,
    ms: 3.3,
  };
  return {
    id: partial.id,
    team: partial.team,
    slot: partial.slot,
    index: partial.index ?? 0,
    champ: partial.champ,
    x: partial.x ?? 12,
    y: partial.y ?? 8,
    vx: 0,
    vy: 0,
    hp: partial.hp ?? 900,
    max_hp: partial.max_hp ?? 900,
    xp: 0,
    level: partial.level ?? 7,
    alive: true,
    respawn_at: Infinity,
    spawn_shield_until: 0,
    auto_cd: 0,
    auto_windup_left: 0,
    auto_windup_target: null,
    auto_next_start_t: 0,
    stats: { ...baseStats, ...(partial.stats ?? {}) },
    attrs: { aim: 70, reflexes: 70, execution: 70, decision: 70, positioning: 70, teamwork: 70 },
    mastery: 50,
    intent: "Idle",
    waypoint: null,
    scripted_wp_i: 0,
    damage_log: [],
    assist_log: [],
    last_hit_by: null,
    status: emptyStatus(),
    attack_reset_pending: false,
    last_damage_t: -Infinity,
    last_dealt_t: -Infinity,
    marks: [],
    cd_q: 0,
    cd_w: 0,
    cd_r: partial.cd_r ?? 0,
    cast_left: 0,
    cast_skill: null,
    cast_target: null,
    cast_aim_x: 0,
    cast_aim_y: 0,
    cast_force_hit: false,
    cast_seq: 0,
    cast_snapshot_ids: null,
    break_until: 0,
    commit_until: 0,
    rewind_used: false,
    abandon_scripted_motor: false,
    ai_target_id: null,
    ai_retreat_suppress_until: 0,
    walk_from_pad_until: 0,
    ai_at_planner_wp: false,
    ai_no_trickle_until: 0,
    ai_first_auto_done: false,
    zone_aura_res: 0,
    flank_buff_until: 0,
  };
}

describe("S2 behaviour pins", () => {
  it("chase stops for sanctuary when the target is in their own pad", () => {
    const chaser = bare({
      id: "blue:mid",
      team: "blue",
      slot: "mid",
      champ: "kerrig",
      x: 14,
      y: 8,
    });
    const target = bare({
      id: "red:adc",
      team: "red",
      slot: "adc",
      champ: "maelis",
      x: c.SANCTUARY_RED_X[0]! + 0.2,
      y: c.RED_SPAWN[1]!,
    });
    expect(inOwnSanctuary(target.team, target.x, target.y, c)).toBe(true);

    const chase: ChaseState = {
      target_id: target.id,
      start_x: chaser.x,
      start_y: chaser.y,
    };
    const ttk = 0.5;
    const result = chaseShouldStop(chaser, target, chase, c, ttk, false);

    expect(result.stop).toBe(true);
    expect(result.reason).toBe("sanctuary");
    expect(ttk).toBeLessThan(c.CHASE_TTK_STOP);
    const travelled = Math.hypot(chaser.x - chase.start_x, chaser.y - chase.start_y);
    expect(travelled).toBeLessThan(c.CHASE_LEASH);
  });

  it("L1 does not run at t=0 (sim loop starts at DT)", () => {
    expect(shouldRunL1(0, c, false, -Infinity)).toBe(false);
  });

  it("hysteresis at Decision 5 sits on the 0.4 floor", () => {
    expect(hystS(5)).toBeCloseTo(0.4, 6);
    expect(hystS(5)).toBeGreaterThan(0.35);
  });

  it("level-4 dummy 5s damage is auto-only (R is not included below level 5)", () => {
    const u = bare({
      id: "blue:mid",
      team: "blue",
      slot: "mid",
      champ: "kerrig",
      level: 4,
      cd_r: 0,
    });
    const withR = dummy5sDamage(u);
    const autoOnly =
      u.stats.atk * u.stats.as * 5 * (1 + Math.min(u.stats.crit, 0.8) * 0.75);
    expect(withR).toBeCloseTo(autoOnly, 4);
    expect(dpsEst(u)).toBeCloseTo(autoOnly / 5, 4);
  });

  it("reachFactor uses the rational far-eta curve 1/(1+0.4·dd+0.08·dd²)", () => {
    const self = bare({
      id: "blue:adc",
      team: "blue",
      slot: "adc",
      champ: "huntress",
      x: 0,
      y: 0,
      stats: { range: 3, ms: 5 } as DummyStats,
    });
    self.stats.range = 3;
    self.stats.ms = 5;
    const target = bare({
      id: "red:adc",
      team: "red",
      slot: "adc",
      champ: "maelis",
      x: 20,
      y: 0,
    });
    // eta = 20/5 = 4; dd = 2.5 → 1/(1+1+0.5) = 0.4
    expect(reachFactor(self, target)).toBeCloseTo(0.4, 5);
  });
});
