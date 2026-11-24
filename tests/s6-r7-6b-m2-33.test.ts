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
  decisionTick?: number;
}) {
  const gate = readGateTicks(opts.me.attrs.reflexes, opts.isR);
  const decisionTick = opts.decisionTick ?? Math.round(opts.castStart * 10) + gate;
  const t = decisionTick / 10;
  opts.foe.cast_left = opts.castS - (t - opts.castStart);
  const mem = createCastMemory();
  mem.castSeen[`${opts.foe.id}|1`] = opts.castStart;
  return {
    decisionTick,
    got: evaluateCastPolicy(
      { t, tick: decisionTick, units: [opts.me, opts.foe] } as MatchState,
      opts.me,
      {
        c,
        focusId: opts.foe.id,
        commit: "hold",
        aTrue: 0.5,
        memory: mem,
        ignorePerception: true,
      },
    ),
  };
}

describe("M2-33 / R7-6b P1a wind-up read", () => {
  it("gate ticks are 4/3/2 at Reflexes 50/70/90 for R windups", () => {
    expect(c.P1A_READ_MULT).toBe(0.5);
    expect(readGateTicks(50, true)).toBe(4);
    expect(readGateTicks(70, true)).toBe(3);
    expect(readGateTicks(90, true)).toBe(2);
    // Non-R keeps full delay: Reflexes 90 → 0.38 s → 4 ticks.
    expect(readGateTicks(90, false)).toBe(4);
  });

  // (a) Ysol Q vs Kerrig R inside the cone
  it("(a) Ysol Q vs Kerrig R: no P1a at 50; P1a at 70/90", () => {
    const castStart = 10.0;
    const castS = 0.7;
    const foeAt = (x: number, y: number) =>
      windup(
        { id: "red:mid", team: "red", slot: "mid", champ: "kerrig", x, y, index: 1 },
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

    // Cone: Kerrig at 14,8 from Ysol at 10,8 — on-axis inside 7.2 / 80°.
    expect(tryP1a({ me: ysol(50), foe: foeAt(14, 8), castStart, castS, isR: true }).got?.tier === "P1a").toBe(
      false,
    );
    expect(tryP1a({ me: ysol(70), foe: foeAt(14, 8), castStart, castS, isR: true }).got).toMatchObject({
      skill: "Q",
      tier: "P1a",
      target_id: "red:mid",
    });
    expect(tryP1a({ me: ysol(90), foe: foeAt(14, 8), castStart, castS, isR: true }).got).toMatchObject({
      skill: "Q",
      tier: "P1a",
      target_id: "red:mid",
    });
  });

  // (b) Ysol Q vs Huntress R
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
    expect(tryP1a({ me: ysol(70), foe: { ...foe }, castStart, castS, isR: true }).got?.tier === "P1a").toBe(
      false,
    );
    expect(tryP1a({ me: ysol(90), foe: { ...foe }, castStart, castS, isR: true }).got).toMatchObject({
      skill: "Q",
      tier: "P1a",
    });
  });

  // (c) Brannoch W vs Kerrig R at 3.0 tiles, Reflexes 50
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
    // Dist 3.0; W range 3.5.
    expect(tryP1a({ me, foe, castStart, castS, isR: true }).got).toMatchObject({
      skill: "W",
      tier: "P1a",
      target_id: foe.id,
    });
  });

  // (d) Ysol @90 vs Helvar W: full delay, no P1a
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
    // Half-delay would be 2 ticks and would wrongly fire; full delay is 4 → no room.
    const half = tryP1a({
      me,
      foe: { ...foe },
      castStart,
      castS,
      isR: true, // force half gate only for the counterfactual check
      decisionTick: Math.round(castStart * 10) + 2,
    });
    // Real path: isR=false → gate 4 → decision at c+4 → 0 left → no P1a.
    const real = tryP1a({ me, foe: { ...foe }, castStart, castS, isR: false });
    expect(real.decisionTick).toBe(Math.round(castStart * 10) + 4);
    expect(real.got?.tier === "P1a").toBe(false);
    void half;
  });
});

describe("M2-33 sim cancel + seed replay", () => {
  function interruptCfg(opts: {
    seed: number;
    reflexes: number;
    foeChamp: "kerrig" | "huntress";
    ysol: UnitId;
    foe: UnitId;
  }): MatchConfig {
    const castTick = 20;
    return {
      ...defaultEvenConfig(opts.seed),
      ai_enabled: true,
      forced_clock_end: true,
      constants: { MATCH_T: 4.0 },
      unit_overrides: {
        [opts.ysol]: {
          champ: "ysol",
          x: 10,
          y: 8,
          level: 7,
          spawn_shield_until: 0,
          auto_next_start_t: 999,
          attrs: {
            aim: 70,
            reflexes: opts.reflexes,
            execution: 70,
            decision: 99,
            positioning: 70,
            teamwork: 70,
          },
        },
        [opts.foe]: {
          champ: opts.foeChamp,
          x: 14,
          y: 8,
          level: 7,
          spawn_shield_until: 0,
          auto_next_start_t: 999,
        },
      },
      scripted_casts: [
        {
          tick: castTick,
          source_id: opts.foe,
          skill: "R",
          aim_x: 10,
          aim_y: 8,
          force_hit: true,
        },
      ],
    };
  }

  it("(a) sim: Ysol @70 cancels Kerrig R with silence at c+6; seed-stable", () => {
    const ysol = "blue:support" as UnitId;
    const foe = "red:mid" as UnitId;
    const cfg = interruptCfg({ seed: 20261122, reflexes: 70, foeChamp: "kerrig", ysol, foe });
    // Mute other units so only Ysol can interrupt.
    for (const id of ["blue:top", "blue:jungle", "blue:mid", "blue:adc", "red:top", "red:jungle", "red:adc", "red:support"] as UnitId[]) {
      cfg.unit_overrides![id] = {
        ...(cfg.unit_overrides![id] ?? {}),
        x: id.startsWith("blue") ? 2 : 22,
        y: 2,
        spawn_shield_until: 0,
        auto_next_start_t: 999,
      };
    }
    const r1 = simulate(cfg);
    const r2 = simulate(cfg);
    expect(r1.digest).toBe(r2.digest);

    const starts = r1.events.filter((e) => e.type === "cast_start" && e.unit_id === ysol && e.tier === "P1a");
    expect(starts.length).toBeGreaterThanOrEqual(1);
    const cancel = r1.events.find(
      (e) => e.type === "cast_cancel" && e.unit_id === foe && e.reason === "silence",
    );
    expect(cancel).toBeTruthy();
    // cast_start of Kerrig R at tick 20 → cancel at c+6 = tick 26.
    const foeStart = r1.events.find((e) => e.type === "cast_start" && e.unit_id === foe);
    expect(foeStart).toBeTruthy();
    expect(Number(cancel!.tick)).toBe(Number(foeStart!.tick) + 6);
  });

  it("(c) sim: Brannoch @50 cancels Kerrig R with lock at c+6; seed-stable", () => {
    const bran = "blue:top" as UnitId;
    const foe = "red:mid" as UnitId;
    const cfg: MatchConfig = {
      ...defaultEvenConfig(20261123),
      ai_enabled: true,
      forced_clock_end: true,
      constants: { MATCH_T: 4.0 },
      unit_overrides: {
        [bran]: {
          champ: "brannoch",
          x: 12,
          y: 8,
          level: 7,
          spawn_shield_until: 0,
          auto_next_start_t: 999,
          attrs: {
            aim: 70,
            reflexes: 50,
            execution: 70,
            decision: 99,
            positioning: 70,
            teamwork: 70,
          },
        },
        [foe]: {
          champ: "kerrig",
          x: 15,
          y: 8,
          level: 7,
          spawn_shield_until: 0,
          auto_next_start_t: 999,
        },
      },
      scripted_casts: [
        { tick: 20, source_id: foe, skill: "R", aim_x: 12, aim_y: 8, force_hit: true },
      ],
    };
    for (const id of ["blue:jungle", "blue:mid", "blue:adc", "blue:support", "red:top", "red:jungle", "red:adc", "red:support"] as UnitId[]) {
      cfg.unit_overrides![id] = {
        x: id.startsWith("blue") ? 2 : 22,
        y: 2,
        spawn_shield_until: 0,
        auto_next_start_t: 999,
      };
    }
    const r1 = simulate(cfg);
    const r2 = simulate(cfg);
    expect(r1.digest).toBe(r2.digest);
    const cancel = r1.events.find(
      (e) => e.type === "cast_cancel" && e.unit_id === foe && e.reason === "lock",
    );
    expect(cancel).toBeTruthy();
    const foeStart = r1.events.find((e) => e.type === "cast_start" && e.unit_id === foe);
    expect(Number(cancel!.tick)).toBe(Number(foeStart!.tick) + 6);
  });
});
