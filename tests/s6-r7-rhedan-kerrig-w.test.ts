/**
 * Rhedan W P4s spill (rule-1 disable basic) + Kerrig W prefers own
 * Q mark/leash target within 1.8 (root cause of low W volume).
 */
import { describe, expect, it } from "vitest";
import { createCastMemory, evaluateCastPolicy } from "../sim/ai/cast_policy.js";
import { DEFAULT_CONSTANTS } from "../sim/constants.js";
import { applyMark } from "../sim/marks.js";
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

describe("Rhedan W P4s + Kerrig W leash targeting", () => {
  it("Rhedan W spills as P4s after 4 s ready in fight", () => {
    const me = bare({ id: "blue:top", team: "blue", slot: "top", champ: "rhedan", x: 11, y: 8 });
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
    const mem = createCastMemory();
    mem.readySince[`${me.id}|W`] = 5;
    const got = evaluateCastPolicy({ t: 10, tick: 100, units: [me, foe] } as MatchState, me, {
      c,
      focusId: foe.id,
      commit: "hold",
      aTrue: 0.4,
      memory: mem,
    });
    expect(got).toMatchObject({ skill: "W", tier: "P4s", target_id: foe.id });
  });

  it("Kerrig W P2 prefers the Q-leashed target within 1.8 even when focus is elsewhere", () => {
    const me = bare({
      id: "blue:mid",
      team: "blue",
      slot: "mid",
      champ: "kerrig",
      x: 13,
      y: 8,
      cd_q: 5,
    });
    const leashed = bare({
      id: "red:adc",
      team: "red",
      slot: "adc",
      champ: "huntress",
      x: 14,
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
    const focusFar = bare({
      id: "red:mid",
      team: "red",
      slot: "mid",
      champ: "maelis",
      x: 20,
      y: 8,
      index: 2,
    });
    leashed.status.effects.push({
      kind: "leash",
      category: "bind",
      school: "physical",
      remaining: 2.0,
      raw_duration: 2.8,
      applied_duration: 2.8,
      source_id: me.id,
    });
    applyMark(leashed.marks, "kerrig", me.id, 10, 2.8);
    const mem = createCastMemory();
    mem.applyAt[`${leashed.id}|leash`] = 9.5;
    const got = evaluateCastPolicy(
      { t: 10, tick: 100, units: [me, leashed, focusFar] } as MatchState,
      me,
      { c, focusId: focusFar.id, commit: "hold", aTrue: 0.5, memory: mem },
    );
    expect(got).toMatchObject({ skill: "W", tier: "P2", target_id: leashed.id });
  });

  it("Kerrig W P4 uses nearest-in-1.8 when focus T is out of range and not X", () => {
    const me = bare({ id: "blue:mid", team: "blue", slot: "mid", champ: "kerrig", x: 12, y: 8 });
    const near = bare({
      id: "red:top",
      team: "red",
      slot: "top",
      champ: "helvar",
      x: 13.2,
      y: 8,
      index: 1,
    });
    const focusFar = bare({
      id: "red:adc",
      team: "red",
      slot: "adc",
      champ: "huntress",
      x: 20,
      y: 8,
      index: 2,
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
    const got = evaluateCastPolicy(
      { t: 10, tick: 100, units: [me, near, focusFar] } as MatchState,
      me,
      { c, focusId: focusFar.id, currentTarget: focusFar.id, commit: "hold", aTrue: 0.5 },
    );
    expect(got).toMatchObject({ skill: "W", tier: "P4", target_id: near.id });
  });
});
