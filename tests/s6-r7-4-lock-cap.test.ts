/**
 * R7-4 / rule 4: chain cap on the intended target at decision time.
 * Applied Locks (land-relative 5.0 s window) + perceived allied Lock casts.
 * Incidental AoE bodies at 2 Locks do not block; they also do not count as nE.
 */
import { describe, expect, it } from "vitest";
import {
  createCastMemory,
  evaluateCastPolicy,
  notePolicyCast,
  type CastMemory,
} from "../sim/ai/cast_policy.js";
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

function twoLocks(st: UnitState["status"], t0: number, t1: number): void {
  const w = st.dr.find((d) => d.category === "lock")!;
  w.apply_times = [t0, t1];
}

describe("R7-4 chain cap on intended target", () => {
  it("blocks a third Lock on an intended target that already has 2 in the window", () => {
    const me = bare({ id: "blue:mid", team: "blue", slot: "mid", champ: "mirren", x: 11, y: 8 });
    const foe = bare({ id: "red:adc", team: "red", slot: "adc", champ: "huntress", x: 14, y: 8, index: 1 });
    // Second living enemy so the last-enemy exception does not fire.
    const other = bare({
      id: "red:top",
      team: "red",
      slot: "top",
      champ: "helvar",
      x: 18,
      y: 8,
      index: 2,
    });
    twoLocks(foe.status, 8.0, 9.0);
    const state = { t: 10, tick: 100, units: [me, foe, other] } as MatchState;
    const got = evaluateCastPolicy(state, me, {
      c,
      focusId: foe.id,
      commit: "engage",
      aTrue: 0.7,
      tactic: "hold_the_pit",
      fightIds: [me.id, foe.id, other.id],
    });
    expect(got?.skill === "W" && got.tier === "P3").toBe(false);
    expect(got?.skill === "W").not.toBe(true);
  });

  it("also blocks P2c chain onto a target already at 2 counted Locks", () => {
    const me = bare({ id: "blue:top", team: "blue", slot: "top", champ: "brannoch", x: 12, y: 8 });
    const foe = bare({ id: "red:mid", team: "red", slot: "mid", champ: "helvar", x: 14, y: 8, index: 1 });
    const other = bare({
      id: "red:adc",
      team: "red",
      slot: "adc",
      champ: "huntress",
      x: 18,
      y: 8,
      index: 2,
    });
    twoLocks(foe.status, 8.5, 9.5);
    // Live disable so the chain window is open, but cap still blocks.
    foe.status.effects.push({
      kind: "stun",
      category: "lock",
      school: "magic",
      remaining: 0.25,
      raw_duration: 0.9,
      applied_duration: 0.9,
      source_id: "blue:sup",
    });
    const state = { t: 10, tick: 100, units: [me, foe, other] } as MatchState;
    const got = evaluateCastPolicy(state, me, {
      c,
      focusId: foe.id,
      commit: "hold",
      aTrue: 0.5,
      memory: createCastMemory(),
      fightIds: [me.id, foe.id, other.id],
    });
    expect(got?.tier === "P2c" && got.skill === "W").toBe(false);
    expect(got?.skill === "W" && (got.tier === "P2c" || got.tier === "P3")).toBe(false);
  });

  it("incidental AoE body at 2 Locks does not block a clean intended, but does not count toward nE", () => {
    const me = bare({
      id: "blue:sup",
      team: "blue",
      slot: "sup",
      champ: "saelo",
      x: 10,
      y: 8,
      level: 7,
    });
    const intended = bare({
      id: "red:adc",
      team: "red",
      slot: "adc",
      champ: "huntress",
      x: 14,
      y: 8,
      index: 1,
    });
    const capped = bare({
      id: "red:mid",
      team: "red",
      slot: "mid",
      champ: "maelis",
      x: 14.5,
      y: 8.5,
      index: 2,
    });
    twoLocks(capped.status, 8.0, 9.0);
    // Only one clean enemy in the circle → nE after exclusion is 1 → no cast.
    const state = { t: 10, tick: 100, units: [me, intended, capped] } as MatchState;
    const blocked = evaluateCastPolicy(state, me, {
      c,
      focusId: intended.id,
      commit: "engage",
      aTrue: 0.7,
      tactic: "hold_the_pit",
      fightIds: [me.id, intended.id, capped.id],
    });
    expect(blocked?.skill === "R").toBe(false);

    // Add a second clean enemy so nE ≥ 2 among eligible bodies → allowed.
    const clean2 = bare({
      id: "red:top",
      team: "red",
      slot: "top",
      champ: "helvar",
      x: 13.5,
      y: 7.5,
      index: 3,
    });
    const state2 = { t: 10, tick: 100, units: [me, intended, capped, clean2] } as MatchState;
    const ok = evaluateCastPolicy(state2, me, {
      c,
      focusId: intended.id,
      commit: "engage",
      aTrue: 0.7,
      tactic: "hold_the_pit",
      fightIds: [me.id, intended.id, capped.id, clean2.id],
    });
    expect(ok).toMatchObject({ skill: "R", tier: "P3" });
  });

  it("counts a perceived allied in-flight Lock cast toward the intended-target cap", () => {
    const me = bare({ id: "blue:mid", team: "blue", slot: "mid", champ: "mirren", x: 11, y: 8 });
    const ally = bare({
      id: "blue:top",
      team: "blue",
      slot: "top",
      champ: "tolle",
      x: 10,
      y: 8,
      index: 2,
    });
    const foe = bare({ id: "red:adc", team: "red", slot: "adc", champ: "huntress", x: 14, y: 8, index: 1 });
    const other = bare({
      id: "red:top",
      team: "red",
      slot: "top",
      champ: "helvar",
      x: 18,
      y: 8,
      index: 3,
    });
    // One applied Lock + one in-flight allied Lock cast ⇒ 2 counted → block third.
    const w = foe.status.dr.find((d) => d.category === "lock")!;
    w.apply_times = [9.0];
    const mem: CastMemory = createCastMemory();
    notePolicyCast(mem, ally, "Q", foe.id, 9.8);
    ally.cast_left = 0.2;
    ally.cast_skill = "Q";
    ally.cast_target = foe.id;
    const state = { t: 10, tick: 100, units: [me, ally, foe, other] } as MatchState;
    const got = evaluateCastPolicy(state, me, {
      c,
      focusId: foe.id,
      commit: "engage",
      aTrue: 0.7,
      memory: mem,
      ignorePerception: true,
      fightIds: [me.id, ally.id, foe.id, other.id],
    });
    expect(got?.skill === "W").toBe(false);
  });
});
