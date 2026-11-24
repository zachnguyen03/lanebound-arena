/**
 * Rule 2 / L1200: never waste a disable on a time-stopped intended,
 * except as a chain timed to the time-stop's end (R7-4 adjacency).
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

function withTimestop(u: UnitState, rem: number): void {
  u.status.effects.push({
    kind: "timestop",
    category: "lock",
    school: "magic",
    remaining: rem,
    raw_duration: rem,
    applied_duration: rem,
    source_id: "blue:support",
  });
}

describe("Rule 2 — never waste on time-stopped intended", () => {
  it("blocks P3/P4 AoE disable when intended is time-stopped with rem ≫ chain_err", () => {
    const me = bare({ id: "blue:jungle", team: "blue", slot: "jungle", champ: "sedge", x: 10, y: 8, level: 7 });
    const intended = bare({
      id: "red:adc",
      team: "red",
      slot: "adc",
      champ: "huntress",
      x: 14,
      y: 8,
      index: 1,
    });
    const other = bare({
      id: "red:mid",
      team: "red",
      slot: "mid",
      champ: "maelis",
      x: 15,
      y: 8.5,
      index: 2,
    });
    withTimestop(intended, 2.0); // 20 ticks ≫ lead(6) + chain_err(~3)
    const state = { t: 10, tick: 100, units: [me, intended, other] } as MatchState;
    const got = evaluateCastPolicy(state, me, {
      c,
      focusId: intended.id,
      commit: "engage",
      aTrue: 0.7,
      tactic: "hold_the_pit",
      fightIds: [me.id, intended.id, other.id],
    });
    expect(got?.skill === "R").toBe(false);
  });

  it("allows a chain disable timed to the time-stop's end (inChainWindow)", () => {
    const me = bare({ id: "blue:top", team: "blue", slot: "top", champ: "brannoch", x: 12, y: 8 });
    const foe = bare({ id: "red:mid", team: "red", slot: "mid", champ: "helvar", x: 14, y: 8, index: 1 });
    // rem ticks ≤ lead(2) + chain_err(~3) → chain window open.
    withTimestop(foe, 0.4);
    const state = { t: 10, tick: 100, units: [me, foe] } as MatchState;
    const got = evaluateCastPolicy(state, me, {
      c,
      focusId: foe.id,
      commit: "hold",
      aTrue: 0.5,
    });
    expect(got).toMatchObject({ skill: "W", tier: "P2c", target_id: foe.id });
  });
});
