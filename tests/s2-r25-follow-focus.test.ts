/**
 * Held-out killers for box mutate-s2 needles S2R25 / S2R25b / S2R25c / S2R26.
 *
 * Official `10-gd-rulings-r4.test.ts` L192 used to catch these via aimed autos on
 * disengage. §9.2 dwell now forces mobile Retreat with a null target before
 * `pickUnitTarget`, so that assert is vacuous. These tests pin
 * `shouldFollowFocus` and its `pickUnitTarget` callers directly.
 *
 * Do not edit tests/acceptance/s2.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_CONSTANTS } from "../sim/constants.js";
import { pickUnitTarget, shouldFollowFocus } from "../sim/ai/target.js";
import { emptyStatus } from "../sim/status.js";
import type { UnitState } from "../sim/types.js";

const c = DEFAULT_CONSTANTS;

function bare(
  partial: Omit<Partial<UnitState>, "attrs" | "stats"> &
    Pick<UnitState, "id" | "team" | "slot"> & {
      attrs?: Partial<UnitState["attrs"]>;
      stats?: Partial<UnitState["stats"]>;
    },
): UnitState {
  const { stats: statsPatch, attrs: attrsPatch, ...rest } = partial;
  return {
    index: 0,
    champ: "huntress",
    x: 12,
    y: 4,
    vx: 0,
    vy: 0,
    hp: 900,
    max_hp: 900,
    xp: 0,
    level: 7,
    alive: true,
    respawn_at: Infinity,
    spawn_shield_until: 0,
    auto_cd: 0,
    auto_windup_left: 0,
    auto_windup_target: null,
    auto_next_start_t: 0,
    stats: {
      hp: 900,
      regen: 4,
      atk: 72,
      pow: 8,
      pres: 26,
      mres: 24,
      as: 1.2,
      crit: 0.08,
      range: 2.5,
      ms: 3.3,
      ...(statsPatch ?? {}),
    },
    attrs: {
      aim: 70,
      reflexes: 70,
      execution: 70,
      decision: 70,
      positioning: 70,
      teamwork: 70,
      ...(attrsPatch ?? {}),
    },
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
    cd_r: 0,
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
    ...rest,
  };
}

describe("S2R25 — shouldFollowFocus comparison (local < call×slack)", () => {
  it("follows when local is strictly worse; freelances when local is strictly better (TW≥50 → slack=1)", () => {
    // Needle: invert `<` → `>` (or flip the predicate).
    expect(shouldFollowFocus(/*call*/ 10, /*local*/ 9, 90)).toBe(true);
    expect(shouldFollowFocus(/*call*/ 10, /*local*/ 11, 90)).toBe(false);
    expect(shouldFollowFocus(/*call*/ 10, /*local*/ 10, 90)).toBe(false);
  });
});

describe("S2R25b — Teamwork 50 threshold inside slack", () => {
  it("at Teamwork 60, slack is 1.0 (threshold 50), so a 5% greener local freelances", () => {
    // Correct: slack = 1 + 0.01*max(0, 50-60) = 1.0 → 10.5 < 10.0*1.0 ? false
    // Needle raising the floor to 100: slack = 1.4 → 10.5 < 14 ? true (wrong follow)
    expect(shouldFollowFocus(10, 10.5, 60)).toBe(false);
    // Below 50 the real slack opens: TW=0 → slack=1.5 → 14 < 15 ? true
    expect(shouldFollowFocus(10, 14, 0)).toBe(true);
    expect(shouldFollowFocus(10, 16, 0)).toBe(false);
  });
});

describe("S2R25c — Math.max keeps slack ≥ 1 at high Teamwork", () => {
  it("at Teamwork 90, slack stays 1.0 (not 0.6); equal-rest call 1.30 beats local 1.00", () => {
    // Needle dropping Math.max: slack = 1 + 0.01*(50-90) = 0.6
    // → 1.00 < 1.30*0.6 = 0.78 ? false (wrong freelance on equal-rest)
    expect(shouldFollowFocus(1.3, 1.0, 90)).toBe(true);
    expect(shouldFollowFocus(1.3, 1.3, 90)).toBe(false);
  });
});

describe("S2R26 — commitDisengage hard-follows focus in pickUnitTarget", () => {
  it("disengage returns the focus even when a much greener local is in range", () => {
    // Geometry mirrors official R4 case-(1): BA next to RM, focus is far RA.
    const self = bare({
      id: "blue:adc",
      team: "blue",
      slot: "adc",
      x: 8.5,
      y: 4,
      attrs: { teamwork: 90, decision: 70 },
      stats: { range: 6.25, ms: 3.3, hp: 900, regen: 4, atk: 72, pow: 8, pres: 26, mres: 24, as: 1.2, crit: 0.08 },
    });
    const focus = bare({
      id: "red:adc",
      team: "red",
      slot: "adc",
      x: 15.8,
      y: 4,
      champ: "huntress",
      stats: { range: 6.25, ms: 3.3, hp: 900, regen: 4, atk: 72, pow: 8, pres: 26, mres: 24, as: 1.2, crit: 0.08 },
    });
    const local = bare({
      id: "red:mid",
      team: "red",
      slot: "mid",
      x: 9.3,
      y: 4,
      champ: "huntress",
      hp: 200,
      max_hp: 900,
      stats: { range: 6.25, ms: 3.3, hp: 900, regen: 4, atk: 72, pow: 8, pres: 26, mres: 24, as: 1.2, crit: 0.08 },
    });
    const all = [self, focus, local];
    const got = pickUnitTarget(self, [focus, local], {
      c,
      focusId: focus.id,
      peeling: false,
      peelDiverId: null,
      tactic: "hunt",
      currentTarget: null,
      zoneCenter: c.ZONE_CENTER,
      zoneR: c.ZONE_RADIUS,
      all,
      intentTarget: {},
      teamwork: 90,
      commitDisengage: true,
    });
    expect(got).toBe(focus.id);
  });
});
