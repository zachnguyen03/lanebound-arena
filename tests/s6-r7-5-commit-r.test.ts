/** R7-5: commit-R lifts only nA ≤ 1; nE ≥ 2 always required. */
import { describe, expect, it } from "vitest";
import { evaluateCastPolicy } from "../sim/ai/cast_policy.js";
import { DEFAULT_CONSTANTS } from "../sim/constants.js";
import { emptyStatus } from "../sim/status.js";
import type { MatchState, UnitState } from "../sim/types.js";

const c = DEFAULT_CONSTANTS;

function bare(
  partial: Partial<UnitState> & Pick<UnitState, "id" | "team" | "slot" | "champ">,
): UnitState {
  const u: UnitState = {
    id: partial.id,
    team: partial.team,
    slot: partial.slot,
    index: partial.index ?? 0,
    champ: partial.champ,
    x: 12,
    y: 8,
    vx: 0,
    vy: 0,
    hp: 1200,
    max_hp: 1200,
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
      hp: 1200,
      regen: 4,
      atk: 80,
      pow: 40,
      pres: 30,
      mres: 28,
      as: 0.9,
      crit: 0.05,
      range: 1.5,
      ms: 3.3,
    },
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
    cd_r: 0,
    cast_left: 0,
    cast_skill: null,
    cast_target: null,
    cast_aim_x: 12,
    cast_aim_y: 8,
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
    flank_buff_until: 0,
    ai_first_auto_done: true,
    zone_aura_res: 0,
  };
  Object.assign(u, partial);
  return u;
}

describe("R7-5 commit-R lifts only nA ≤ 1", () => {
  it("commit-R true + nE=1 → no Saelo R", () => {
    const me = bare({ id: "blue:support", team: "blue", slot: "support", champ: "saelo", x: 10, y: 8, level: 7 });
    const foe = bare({ id: "red:adc", team: "red", slot: "adc", champ: "huntress", x: 14, y: 8, index: 1 });
    const ally1 = bare({ id: "blue:adc", team: "blue", slot: "adc", champ: "maelis", x: 13.5, y: 8, index: 2 });
    const ally2 = bare({ id: "blue:mid", team: "blue", slot: "mid", champ: "helvar", x: 14.2, y: 8.5, index: 3 });
    // Three fight enemies listed so commitR's ≥3 check can pass, but only one is
    // in the circle (nE=1). Extra fight foes sit far away.
    const far1 = bare({ id: "red:top", team: "red", slot: "top", champ: "torun", x: 2, y: 2, index: 4 });
    const far2 = bare({ id: "red:jungle", team: "red", slot: "jungle", champ: "sedge", x: 2, y: 14, index: 5 });
    const state = { t: 10, tick: 100, units: [me, foe, ally1, ally2, far1, far2] } as MatchState;
    const got = evaluateCastPolicy(state, me, {
      c,
      focusId: foe.id,
      commit: "engage",
      aTrue: 0.85,
      tactic: "hold_the_pit",
      fightIds: [me.id, foe.id, ally1.id, ally2.id, far1.id, far2.id],
    });
    expect(got?.skill === "R").toBe(false);
  });

  it("commit-R true + nE=2 + nA=2 → allowed (nA cap lifted)", () => {
    const me = bare({
      id: "blue:support",
      team: "blue",
      slot: "support",
      champ: "saelo",
      x: 10,
      y: 8,
      level: 7,
      cd_q: 5,
      cd_w: 5,
    });
    const foe1 = bare({ id: "red:adc", team: "red", slot: "adc", champ: "huntress", x: 14, y: 8, index: 1 });
    const foe2 = bare({ id: "red:mid", team: "red", slot: "mid", champ: "maelis", x: 14.5, y: 8.5, index: 2 });
    const foe3 = bare({ id: "red:top", team: "red", slot: "top", champ: "helvar", x: 3, y: 3, index: 3 });
    const ally1 = bare({ id: "blue:adc", team: "blue", slot: "adc", champ: "isra", x: 13.5, y: 8, index: 4 });
    const ally2 = bare({ id: "blue:mid", team: "blue", slot: "mid", champ: "helvar", x: 14.2, y: 8.2, index: 5 });
    const state = { t: 10, tick: 100, units: [me, foe1, foe2, foe3, ally1, ally2] } as MatchState;
    const got = evaluateCastPolicy(state, me, {
      c,
      focusId: foe1.id,
      commit: "engage",
      aTrue: 0.85,
      tactic: "hold_the_pit",
      fightIds: [me.id, foe1.id, foe2.id, foe3.id, ally1.id, ally2.id],
    });
    expect(got).toMatchObject({ skill: "R" });
    expect(got?.tier === "P3" || got?.tier === "P4").toBe(true);
  });
});
