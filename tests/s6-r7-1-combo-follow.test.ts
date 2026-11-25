/**
 * R7-1: when T is X and the skill has a P2 row, "P4 on cooldown" waits for
 * combo_follow and logs P2. Own disable: apply + round(combo_follow_s×10).
 * Ally disable: §9.4.1.3 P2 bound.
 */
import { describe, expect, it } from "vitest";
import { comboFollowS } from "../sim/ai/attributes.js";
import { createCastMemory, evaluateCastPolicy } from "../sim/ai/cast_policy.js";
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

function followTicks(ex: number): number {
  return Math.round(comboFollowS(ex) * 10 + 1e-9);
}

describe("R7-1 combo_follow wins over P4 on cooldown", () => {
  it.each([30, 60, 90])(
    "Kerrig W after own Q leash fires at apply+combo_follow as P2 (eff_E=%i)",
    (execution) => {
      const me = bare({
        id: "blue:mid",
        team: "blue",
        slot: "mid",
        champ: "kerrig",
        x: 13,
        y: 8,
        cd_q: 5,
        attrs: { aim: 70, reflexes: 70, execution, decision: 70, positioning: 70, teamwork: 70 },
        mastery: 50,
      });
      const foe = bare({
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
      const applyAt = 10.0;
      const wait = followTicks(execution) / 10;
      foe.status.effects.push({
        kind: "leash",
        category: "bind",
        school: "physical",
        remaining: 2.0,
        raw_duration: 2.8,
        applied_duration: 2.8,
        source_id: me.id,
      });
      const mem = createCastMemory();
      mem.applyAt[`${foe.id}|leash`] = applyAt;

      // Too early: must not fire as P4.
      const earlyT = applyAt + Math.max(0, wait - 0.2);
      const early = evaluateCastPolicy(
        { t: earlyT, tick: Math.round(earlyT * 10), units: [me, foe] } as MatchState,
        me,
        { c, focusId: foe.id, commit: "hold", aTrue: 0.5, memory: mem },
      );
      expect(early?.skill === "W" && early.tier === "P4").toBe(false);
      if (wait > 0.15) {
        expect(early?.skill === "W").toBe(false);
      }

      // At apply + combo_follow (±1 tick): fires as P2.
      const readyT = applyAt + wait;
      const ready = evaluateCastPolicy(
        { t: readyT, tick: Math.round(readyT * 10), units: [me, foe] } as MatchState,
        me,
        { c, focusId: foe.id, commit: "hold", aTrue: 0.5, memory: mem },
      );
      expect(ready).toMatchObject({ skill: "W", tier: "P2", target_id: foe.id });
    },
  );

  it("Maelis Q after ally stun waits the ally P2 bound, then fires as P2", () => {
    const me = bare({
      id: "blue:adc",
      team: "blue",
      slot: "adc",
      champ: "maelis",
      x: 10,
      y: 8,
      attrs: { aim: 70, reflexes: 70, execution: 60, decision: 70, positioning: 70, teamwork: 70 },
    });
    const ally = bare({
      id: "blue:top",
      team: "blue",
      slot: "top",
      champ: "tolle",
      x: 11,
      y: 8,
      index: 2,
    });
    const foe = bare({
      id: "red:mid",
      team: "red",
      slot: "mid",
      champ: "helvar",
      x: 14,
      y: 8,
      index: 1,
    });
    const applyAt = 10.0;
    const castStart = 9.7;
    foe.status.effects.push({
      kind: "stun",
      category: "lock",
      school: "magic",
      remaining: 0.8,
      raw_duration: 0.9,
      applied_duration: 0.9,
      source_id: ally.id,
    });
    const mem = createCastMemory();
    mem.applyAt[`${foe.id}|stun`] = applyAt;
    mem.casts.push({
      t: castStart,
      caster: ally.id,
      skill: "Q",
      target: foe.id,
      disable: true,
      lock: true,
    });

    // Reaction at Reflexes 70 ≈ 0.54 s → earliest = max(apply, cast+react, apply+follow).
    const react = 0.54;
    const follow = followTicks(60) / 10;
    const earliest = Math.max(applyAt, castStart + react, applyAt + follow);

    const early = evaluateCastPolicy(
      { t: earliest - 0.15, tick: Math.round((earliest - 0.15) * 10), units: [me, ally, foe] } as MatchState,
      me,
      { c, focusId: foe.id, commit: "hold", aTrue: 0.5, memory: mem, ignorePerception: true },
    );
    expect(early?.skill === "Q" && early.tier === "P4").toBe(false);

    const ready = evaluateCastPolicy(
      { t: earliest + 0.02, tick: Math.round((earliest + 0.02) * 10), units: [me, ally, foe] } as MatchState,
      me,
      { c, focusId: foe.id, commit: "hold", aTrue: 0.5, memory: mem, ignorePerception: true },
    );
    expect(ready).toMatchObject({ skill: "Q", tier: "P2", target_id: foe.id });
  });
});
