/**
 * R7-8: Kerrig Q under Hunt outside Fight Call on an isolated squishy
 * (no perceived living non-banished ally of target within 4.0). Logs P3.
 */
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

describe("R7-8 Kerrig Q isolated under Hunt", () => {
  it("fires P3 on an isolated squishy under Hunt outside engage", () => {
    const me = bare({ id: "blue:mid", team: "blue", slot: "mid", champ: "kerrig", x: 11, y: 8 });
    const foe = bare({
      id: "red:adc",
      team: "red",
      slot: "adc",
      champ: "huntress",
      x: 15,
      y: 8,
      index: 1,
      stats: {
        hp: 1200,
        regen: 4,
        atk: 80,
        pow: 40,
        pres: 30,
        mres: 28,
        as: 0.9,
        crit: 0.05,
        range: 6.5,
        ms: 3.3,
      },
    });
    // Ally of target is far (> 4 tiles) → isolated.
    const friend = bare({
      id: "red:top",
      team: "red",
      slot: "top",
      champ: "helvar",
      x: 22,
      y: 8,
      index: 2,
    });
    const got = evaluateCastPolicy({ t: 10, tick: 100, units: [me, foe, friend] } as MatchState, me, {
      c,
      focusId: foe.id,
      commit: "hold",
      aTrue: 0.3,
      tactic: "hunt",
      ignorePerception: true,
    });
    expect(got).toMatchObject({ skill: "Q", tier: "P3", target_id: foe.id });
  });

  it("does not fire Hunt-isolated Q when an ally of the target is within 4.0", () => {
    const me = bare({ id: "blue:mid", team: "blue", slot: "mid", champ: "kerrig", x: 11, y: 8 });
    const foe = bare({
      id: "red:adc",
      team: "red",
      slot: "adc",
      champ: "huntress",
      x: 15,
      y: 8,
      index: 1,
      stats: {
        hp: 1200,
        regen: 4,
        atk: 80,
        pow: 40,
        pres: 30,
        mres: 28,
        as: 0.9,
        crit: 0.05,
        range: 6.5,
        ms: 3.3,
      },
    });
    const friend = bare({
      id: "red:mid",
      team: "red",
      slot: "mid",
      champ: "maelis",
      x: 16.5,
      y: 8,
      index: 2,
    });
    const got = evaluateCastPolicy({ t: 10, tick: 100, units: [me, foe, friend] } as MatchState, me, {
      c,
      focusId: foe.id,
      commit: "hold",
      aTrue: 0.3,
      tactic: "hunt",
      ignorePerception: true,
    });
    expect(got?.skill === "Q" && got.tier === "P3").toBe(false);
  });
});
