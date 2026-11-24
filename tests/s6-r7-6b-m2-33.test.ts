/**
 * M2-33 / R7-6b: P1a wind-up read on enemy R (P1A_READ_MULT = 0.5).
 * Spec cases (a)–(d). Each case replays identically on the same seed.
 */
import { describe, expect, it } from "vitest";
import { reactionDelayS } from "../sim/ai/attributes.js";
import { createCastMemory, evaluateCastPolicy } from "../sim/ai/cast_policy.js";
import { DEFAULT_CONSTANTS } from "../sim/constants.js";
import { emptyStatus } from "../sim/status.js";
import { defaultEvenConfig, simulate } from "../sim/simulate.js";
import type { MatchConfig, MatchState, UnitId, UnitState } from "../sim/types.js";

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

function readGateTicks(reflexes: number, isR: boolean): number {
  const mult = isR ? c.P1A_READ_MULT : 1;
  return Math.ceil(mult * reactionDelayS(reflexes) * 10 - 1e-9);
}

function windup(
  partial: Partial<UnitState> & Pick<UnitState, "id" | "team" | "slot" | "champ">,
  skill: "Q" | "W" | "R",
  castS: number,
): UnitState {
  return bare({
    ...partial,
    cast_left: castS,
    cast_skill: skill,
    cast_seq: 1,
    level: skill === "R" ? 7 : (partial.level ?? 7),
  });
}

function tryP1a(opts: {
  me: UnitState;
  foe: UnitState;
  castStart: number;
  castS: number;
  isR: boolean;
}) {
  const gate = readGateTicks(opts.me.attrs.reflexes, opts.isR);
  const decisionTick = Math.round(opts.castStart * 10) + gate;
  const t = decisionTick / 10;
  const foe = bare({
    id: opts.foe.id,
    team: opts.foe.team,
    slot: opts.foe.slot,
    champ: opts.foe.champ,
    x: opts.foe.x,
    y: opts.foe.y,
    index: opts.foe.index,
    level: opts.foe.level,
    cast_skill: opts.foe.cast_skill,
    cast_seq: 1,
    cast_left: opts.castS - (t - opts.castStart),
    cast_aim_x: opts.foe.x,
    cast_aim_y: opts.foe.y,
  });
  const mem = createCastMemory();
  mem.castSeen[`${foe.id}|1`] = opts.castStart;
  return {
    decisionTick,
    got: evaluateCastPolicy({ t, tick: decisionTick, units: [opts.me, foe] } as MatchState, opts.me, {
      c,
      focusId: foe.id,
      commit: "hold",
      aTrue: 0.5,
      memory: mem,
      ignorePerception: true,
    }),
  };
}

describe("M2-33 / R7-6b P1a wind-up read", () => {
  it("gate ticks are 4/3/2 at Reflexes 50/70/90 for R windups", () => {
    expect(c.P1A_READ_MULT).toBe(0.5);
    expect(readGateTicks(50, true)).toBe(4);
    expect(readGateTicks(70, true)).toBe(3);
    expect(readGateTicks(90, true)).toBe(2);
    expect(readGateTicks(90, false)).toBe(4);
  });

  it("(a) Ysol Q vs Kerrig R: no P1a at 50; P1a at 70 and 90", () => {
    const castStart = 10.0;
    const castS = 0.7;
    const foe = windup(
      { id: "red:mid", team: "red", slot: "mid", champ: "kerrig", x: 14, y: 8, index: 1 },
      "R",
      castS,
    );
    const ysol = (reflexes: number) =>
      bare({
        id: "blue:support",
        team: "blue",
        slot: "support",
        champ: "ysol",
        x: 10,
        y: 8,
        cd_w: 99,
        cd_r: 99,
        attrs: { aim: 70, reflexes, execution: 70, decision: 90, positioning: 70, teamwork: 70 },
      });

    expect(tryP1a({ me: ysol(50), foe, castStart, castS, isR: true }).got?.tier === "P1a").toBe(false);
    expect(tryP1a({ me: ysol(70), foe, castStart, castS, isR: true }).got).toMatchObject({
      skill: "Q",
      tier: "P1a",
      target_id: "red:mid",
    });
    expect(tryP1a({ me: ysol(90), foe, castStart, castS, isR: true }).got).toMatchObject({
      skill: "Q",
      tier: "P1a",
      target_id: "red:mid",
    });
  });

  it("(b) Ysol Q vs Huntress R: no P1a at 70; P1a at 90", () => {
    const castStart = 10.0;
    const castS = 0.6;
    const foe = windup(
      { id: "red:adc", team: "red", slot: "adc", champ: "huntress", x: 14, y: 8, index: 1 },
      "R",
      castS,
    );
    const ysol = (reflexes: number) =>
      bare({
        id: "blue:support",
        team: "blue",
        slot: "support",
        champ: "ysol",
        x: 10,
        y: 8,
        cd_w: 99,
        cd_r: 99,
        attrs: { aim: 70, reflexes, execution: 70, decision: 90, positioning: 70, teamwork: 70 },
      });
    expect(tryP1a({ me: ysol(70), foe, castStart, castS, isR: true }).got?.tier === "P1a").toBe(false);
    expect(tryP1a({ me: ysol(90), foe, castStart, castS, isR: true }).got).toMatchObject({
      skill: "Q",
      tier: "P1a",
    });
  });

  it("(c) Brannoch W vs Kerrig R at 3.0 tiles, Reflexes 50: P1a", () => {
    const castStart = 10.0;
    const castS = 0.7;
    const foe = windup(
      { id: "red:mid", team: "red", slot: "mid", champ: "kerrig", x: 15, y: 8, index: 1 },
      "R",
      castS,
    );
    const me = bare({
      id: "blue:top",
      team: "blue",
      slot: "top",
      champ: "brannoch",
      x: 12,
      y: 8,
      cd_q: 99,
      cd_r: 99,
      attrs: { aim: 70, reflexes: 50, execution: 70, decision: 90, positioning: 70, teamwork: 70 },
    });
    expect(tryP1a({ me, foe, castStart, castS, isR: true }).got).toMatchObject({
      skill: "W",
      tier: "P1a",
      target_id: foe.id,
    });
  });

  it("(d) Ysol Reflexes 90 vs Helvar W: full delay, no P1a", () => {
    const castStart = 10.0;
    const castS = 0.4;
    const foe = windup(
      { id: "red:top", team: "red", slot: "top", champ: "helvar", x: 14, y: 8, index: 1 },
      "W",
      castS,
    );
    const me = bare({
      id: "blue:support",
      team: "blue",
      slot: "support",
      champ: "ysol",
      x: 10,
      y: 8,
      cd_w: 99,
      cd_r: 99,
      attrs: { aim: 70, reflexes: 90, execution: 70, decision: 90, positioning: 70, teamwork: 70 },
    });
    const real = tryP1a({ me, foe, castStart, castS, isR: false });
    expect(real.decisionTick).toBe(Math.round(castStart * 10) + 4);
    expect(real.got?.tier === "P1a").toBe(false);
  });
});


describe("M2-33 cancel landing + seed replay", () => {
  function parkOthers(cfg: MatchConfig, keep: UnitId[]) {
    const keepSet = new Set(keep);
    for (const id of [
      "blue:top", "blue:jungle", "blue:mid", "blue:adc", "blue:support",
      "red:top", "red:jungle", "red:mid", "red:adc", "red:support",
    ] as UnitId[]) {
      if (keepSet.has(id)) continue;
      cfg.unit_overrides![id] = {
        x: id.startsWith("blue") ? 1.5 : 22.5,
        y: 1.5,
        spawn_shield_until: 0,
        auto_next_start_t: 999,
      };
    }
  }

  it("(a) Ysol @70: silence cancel on Kerrig R at c+6; seed-stable", () => {
    const ysol = "blue:support" as UnitId;
    const foe = "red:mid" as UnitId;
    const victim = "blue:adc" as UnitId;
    const cTick = 20;
    const cfg: MatchConfig = {
      ...defaultEvenConfig(20261122),
      ai_enabled: false,
      forced_clock_end: true,
      constants: { MATCH_T: 5.0 },
      unit_overrides: {
        [ysol]: { champ: "ysol", x: 10, y: 8, level: 7, spawn_shield_until: 0, auto_next_start_t: 999 },
        [foe]: { champ: "kerrig", x: 14, y: 8, level: 7, spawn_shield_until: 0, auto_next_start_t: 999 },
        [victim]: { champ: "huntress", x: 12, y: 8, level: 7, spawn_shield_until: 0, auto_next_start_t: 999, hp: 5000 },
      },
      scripted_casts: [
        { tick: 10, source_id: foe, skill: "Q", target_id: victim, force_hit: true },
        { tick: cTick, source_id: foe, skill: "R", target_id: victim, force_hit: true },
        { tick: cTick + 3, source_id: ysol, skill: "Q", target_id: foe, force_hit: true },
      ],
    };
    parkOthers(cfg, [ysol, foe, victim]);
    const r1 = simulate(cfg);
    const r2 = simulate(cfg);
    expect(r1.digest).toBe(r2.digest);
    const foeStart = r1.events.find(
      (e) => e.type === "cast_start" && e.unit_id === foe && String(e.skill_id).includes("Reeling"),
    );
    expect(foeStart).toBeTruthy();
    const cancel = r1.events.find(
      (e) => e.type === "cast_cancel" && e.unit_id === foe && e.reason === "silence",
    );
    expect(cancel).toBeTruthy();
    expect(Number(cancel!.tick)).toBe(Number(foeStart!.tick) + 6);
  });

  it("(a) Ysol @90: silence cancel on Kerrig R at c+5; seed-stable", () => {
    const ysol = "blue:support" as UnitId;
    const foe = "red:mid" as UnitId;
    const victim = "blue:adc" as UnitId;
    const cTick = 20;
    const cfg: MatchConfig = {
      ...defaultEvenConfig(20261122),
      ai_enabled: false,
      forced_clock_end: true,
      constants: { MATCH_T: 5.0 },
      unit_overrides: {
        [ysol]: { champ: "ysol", x: 10, y: 8, level: 7, spawn_shield_until: 0, auto_next_start_t: 999 },
        [foe]: { champ: "kerrig", x: 14, y: 8, level: 7, spawn_shield_until: 0, auto_next_start_t: 999 },
        [victim]: { champ: "huntress", x: 12, y: 8, level: 7, spawn_shield_until: 0, auto_next_start_t: 999, hp: 5000 },
      },
      scripted_casts: [
        { tick: 10, source_id: foe, skill: "Q", target_id: victim, force_hit: true },
        { tick: cTick, source_id: foe, skill: "R", target_id: victim, force_hit: true },
        { tick: cTick + 2, source_id: ysol, skill: "Q", target_id: foe, force_hit: true },
      ],
    };
    parkOthers(cfg, [ysol, foe, victim]);
    const r1 = simulate(cfg);
    const r2 = simulate(cfg);
    expect(r1.digest).toBe(r2.digest);
    const foeStart = r1.events.find(
      (e) => e.type === "cast_start" && e.unit_id === foe && String(e.skill_id).includes("Reeling"),
    )!;
    const cancel = r1.events.find(
      (e) => e.type === "cast_cancel" && e.unit_id === foe && e.reason === "silence",
    )!;
    expect(Number(cancel.tick)).toBe(Number(foeStart.tick) + 5);
  });

  it("(c) Brannoch @50: lock cancel on Kerrig R at c+6; seed-stable", () => {
    const bran = "blue:top" as UnitId;
    const foe = "red:mid" as UnitId;
    const victim = "blue:adc" as UnitId;
    const cTick = 20;
    const cfg: MatchConfig = {
      ...defaultEvenConfig(20261123),
      ai_enabled: false,
      forced_clock_end: true,
      constants: { MATCH_T: 5.0 },
      unit_overrides: {
        [bran]: { champ: "brannoch", x: 12, y: 8, level: 7, spawn_shield_until: 0, auto_next_start_t: 999 },
        [foe]: { champ: "kerrig", x: 15, y: 8, level: 7, spawn_shield_until: 0, auto_next_start_t: 999 },
        [victim]: { champ: "huntress", x: 13, y: 8, level: 7, spawn_shield_until: 0, auto_next_start_t: 999, hp: 5000 },
      },
      scripted_casts: [
        { tick: 10, source_id: foe, skill: "Q", target_id: victim, force_hit: true },
        { tick: cTick, source_id: foe, skill: "R", target_id: victim, force_hit: true },
        { tick: cTick + 4, source_id: bran, skill: "W", target_id: foe, force_hit: true },
      ],
    };
    parkOthers(cfg, [bran, foe, victim]);
    const r1 = simulate(cfg);
    const r2 = simulate(cfg);
    expect(r1.digest).toBe(r2.digest);
    const foeStart = r1.events.find(
      (e) => e.type === "cast_start" && e.unit_id === foe && String(e.skill_id).includes("Reeling"),
    )!;
    const cancel = r1.events.find(
      (e) => e.type === "cast_cancel" && e.unit_id === foe && e.reason === "lock",
    )!;
    expect(cancel).toBeTruthy();
    expect(Number(cancel.tick)).toBe(Number(foeStart.tick) + 6);
  });
});
