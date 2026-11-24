/** R7-2: Saelo W P1b peel — auto-peel assigned, carry within 6.5, Handicap or diver incoming. */
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

describe("R7-2 Saelo W P1b", () => {
  it("peels the dived carry when assigned and carry has a basic-dispellable Handicap", () => {
    const me = bare({ id: "blue:support", team: "blue", slot: "support", champ: "saelo", x: 10, y: 8, cd_q: 5 });
    const carry = bare({
      id: "blue:adc",
      team: "blue",
      slot: "adc",
      champ: "huntress",
      x: 12,
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
    const diver = bare({
      id: "red:mid",
      team: "red",
      slot: "mid",
      champ: "kerrig",
      x: 12.5,
      y: 8,
      index: 2,
    });
    carry.status.effects.push({
      kind: "silence",
      category: "handicap",
      school: "magic",
      remaining: 0.8,
      raw_duration: 1.0,
      applied_duration: 1.0,
      source_id: diver.id,
    });
    const got = evaluateCastPolicy({ t: 10, tick: 100, units: [me, carry, diver] } as MatchState, me, {
      c,
      focusId: diver.id,
      peelDiverId: diver.id,
      peeling: true,
      commit: "hold",
      aTrue: 0.4,
    });
    expect(got).toMatchObject({ skill: "W", tier: "P1b", target_id: carry.id });
  });

  it("peels when the diver dealt incoming_1s damage to the carry", () => {
    const me = bare({ id: "blue:support", team: "blue", slot: "support", champ: "saelo", x: 10, y: 8, cd_q: 5 });
    const carry = bare({
      id: "blue:adc",
      team: "blue",
      slot: "adc",
      champ: "huntress",
      x: 12,
      y: 8,
      index: 1,
      stats: {
        hp: 1100,
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
      damage_log: [{ source_id: "red:mid", t: 9.7 }],
      recent_taken: [{ t: 9.7, hp: 100 }],
    });
    const diver = bare({
      id: "red:mid",
      team: "red",
      slot: "mid",
      champ: "kerrig",
      x: 12.5,
      y: 8,
      index: 2,
    });
    const got = evaluateCastPolicy({ t: 10, tick: 100, units: [me, carry, diver] } as MatchState, me, {
      c,
      focusId: diver.id,
      peelDiverId: diver.id,
      peeling: true,
      commit: "hold",
      aTrue: 0.4,
    });
    expect(got).toMatchObject({ skill: "W", tier: "P1b", target_id: carry.id });
  });
});
