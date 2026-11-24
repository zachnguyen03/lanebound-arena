/**
 * R7-6: P1a whole-tick inequality.
 * Under R7-6b, enemy R windups use P1A_READ_MULT=0.5. This file pins the
 * strict whole-tick inequality and non-R full-delay behaviour.
 * M2-33 cases live in s6-r7-6b-m2-33.test.ts.
 */
import { describe, expect, it } from "vitest";
import { reactionDelayS } from "../sim/ai/attributes.js";
import { createCastMemory, evaluateCastPolicy } from "../sim/ai/cast_policy.js";
import { DEFAULT_CONSTANTS } from "../sim/constants.js";
import { emptyStatus } from "../sim/status.js";
import type { MatchState, UnitState } from "../sim/types.js";

const c = DEFAULT_CONSTANTS;

function bare(
  partial: Partial<UnitState> & Pick<UnitState, "id" | "team" | "slot" | "champ">,
): UnitState {
  const u: UnitState = {
    id: partial.id, team: partial.team, slot: partial.slot, index: partial.index ?? 0, champ: partial.champ,
    x: 12, y: 8, vx: 0, vy: 0, hp: 1200, max_hp: 1200, xp: 0, level: 7, alive: true,
    respawn_at: Infinity, spawn_shield_until: 0, auto_cd: 0, auto_windup_left: 0,
    auto_windup_target: null, auto_next_start_t: 0,
    stats: { hp: 1200, regen: 4, atk: 80, pow: 40, pres: 30, mres: 28, as: 0.9, crit: 0.05, range: 1.5, ms: 3.3 },
    attrs: { aim: 70, reflexes: 70, execution: 70, decision: 70, positioning: 70, teamwork: 70 },
    mastery: 50, intent: "Idle", waypoint: null, scripted_wp_i: 0, damage_log: [], assist_log: [],
    last_hit_by: null, status: emptyStatus(), attack_reset_pending: false,
    last_damage_t: -Infinity, last_dealt_t: -Infinity, marks: [],
    cd_q: 0, cd_w: 0, cd_r: 0, cast_left: 0, cast_skill: null, cast_target: null,
    cast_aim_x: 12, cast_aim_y: 8, cast_force_hit: false, cast_seq: 0, cast_snapshot_ids: null,
    break_until: 0, commit_until: 0, rewind_used: false, abandon_scripted_motor: false,
    ai_target_id: null, ai_retreat_suppress_until: 0, walk_from_pad_until: 0,
    ai_at_planner_wp: false, ai_no_trickle_until: 0, flank_buff_until: 0, ai_first_auto_done: true, zone_aura_res: 0,
  };
  Object.assign(u, partial);
  return u;
}

describe("R7-6 P1a whole-tick inequality", () => {
  it("Brannoch W: P1a when lead < left ticks; not when equal (strict)", () => {
    const castStart = 10.0;
    const foe = bare({
      id: "red:mid", team: "red", slot: "mid", champ: "kerrig", x: 14, y: 8, index: 1,
      cast_left: 0.7, cast_skill: "R", cast_seq: 1, cast_aim_x: 12, cast_aim_y: 8,
    });
    const tryAt = (decisionOffset: number) => {
      const me = bare({
        id: "blue:top", team: "blue", slot: "top", champ: "brannoch", x: 12, y: 8, cd_q: 5, cd_r: 5,
        attrs: { aim: 70, reflexes: 90, execution: 70, decision: 70, positioning: 70, teamwork: 70 },
      });
      const decisionTick = Math.round(castStart * 10) + decisionOffset;
      const t = decisionTick / 10;
      foe.cast_left = 0.7 - (t - castStart);
      const mem = createCastMemory();
      mem.castSeen[`${foe.id}|1`] = castStart;
      return evaluateCastPolicy({ t, tick: decisionTick, units: [me, foe] } as MatchState, me, {
        c, focusId: foe.id, commit: "hold", aTrue: 0.5, memory: mem, ignorePerception: true,
      });
    };
    expect(tryAt(2)).toMatchObject({ skill: "W", tier: "P1a", target_id: foe.id });
    expect(tryAt(5)?.tier === "P1a").toBe(false);
  });

  it("non-R Helvar W keeps full reaction delay (Ysol @90 cannot interrupt)", () => {
    const castStart = 10.0;
    const castS = 0.4;
    const foe = bare({
      id: "red:top", team: "red", slot: "top", champ: "helvar", x: 14, y: 8, index: 1,
      cast_left: castS, cast_skill: "W", cast_seq: 1,
    });
    const me = bare({
      id: "blue:support", team: "blue", slot: "support", champ: "ysol", x: 10, y: 8, cd_w: 5, cd_r: 5,
      attrs: { aim: 70, reflexes: 90, execution: 70, decision: 70, positioning: 70, teamwork: 70 },
    });
    const fullGate = Math.ceil(reactionDelayS(90) * 10 - 1e-9);
    expect(fullGate).toBe(4);
    const decisionTick = Math.round(castStart * 10) + fullGate;
    const t = decisionTick / 10;
    foe.cast_left = castS - (t - castStart);
    const mem = createCastMemory();
    mem.castSeen[`${foe.id}|1`] = castStart;
    const got = evaluateCastPolicy({ t, tick: decisionTick, units: [me, foe] } as MatchState, me, {
      c, focusId: foe.id, commit: "hold", aTrue: 0.5, memory: mem, ignorePerception: true,
    });
    expect(got?.tier === "P1a").toBe(false);
  });
});
