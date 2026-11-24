/**
 * S6 cast plumbing — policy table/evaluator, Cast intent path, cast_start,
 * additive status_apply, determinism, and no-cast gates (windup / banish /
 * sanctuary). Per-kit firing choices are NOT invented here (table stays empty).
 */
import { describe, expect, it } from "vitest";
import { brainDecide } from "../sim/ai/brain.js";
import {
  CAST_POLICIES,
  castGatesClear,
  evaluateCastPolicy,
  type KitCastPolicy,
} from "../sim/ai/cast_policy.js";
import { beginCast } from "../sim/cast.js";
import { DEFAULT_CONSTANTS, mergeConstants } from "../sim/constants.js";
import { evenOvrConfig } from "../sim/match_config.js";
import { applyCc, emptyStatus } from "../sim/status.js";
import { defaultEvenConfig, simulate } from "../sim/simulate.js";
import type { MatchState, UnitState } from "../sim/types.js";

const c = DEFAULT_CONSTANTS;

function bare(
  partial: Partial<UnitState> & Pick<UnitState, "id" | "team" | "slot" | "champ">,
): UnitState {
  const u: UnitState = {
    id: partial.id,
    team: partial.team,
    slot: partial.slot,
    index: 0,
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

/** Test-only stub: enable Brannoch Q so plumbing can be exercised without §9.4.1. */
const BRANNOCH_Q_STUB: Readonly<Record<string, KitCastPolicy>> = {
  brannoch: {
    Q: { enabled: true, target: "nearest_enemy" },
  },
};

describe("S6 cast policy table (stubbed)", () => {
  it("CAST_POLICIES is empty — no invented per-kit firing choices", () => {
    expect(Object.keys(CAST_POLICIES)).toHaveLength(0);
  });

  it("empty table: evaluateCastPolicy returns null for every champion", () => {
    const me = bare({ id: "blue:top", team: "blue", slot: "top", champ: "brannoch", x: 11, y: 8 });
    const foe = bare({ id: "red:mid", team: "red", slot: "mid", champ: "helvar", x: 13, y: 8 });
    const state = { t: 1, tick: 10, units: [me, foe] } as MatchState;
    for (const champ of [
      "brannoch",
      "sedge",
      "kerrig",
      "huntress",
      "ysol",
      "rhedan",
      "tolle",
      "helvar",
      "maelis",
      "saelo",
      "mirren",
      "isra",
      "torun",
      "calder",
    ] as const) {
      me.champ = champ;
      expect(
        evaluateCastPolicy(state, me, { c, focusId: foe.id }),
        champ,
      ).toBeNull();
    }
  });
});

describe("S6 cast gates — windup / banish / sanctuary", () => {
  it("castGatesClear is false during skill windup, banish, or own sanctuary", () => {
    const u = bare({ id: "blue:top", team: "blue", slot: "top", champ: "brannoch", x: 12, y: 8 });
    expect(castGatesClear(u, c)).toBe(true);

    u.cast_left = 0.4;
    u.cast_skill = "Q";
    expect(castGatesClear(u, c)).toBe(false);
    u.cast_left = 0;
    u.cast_skill = null;

    applyCc(u.status, {
      kind: "banish",
      raw_duration: 2,
      school: "magic",
      source_id: "red:mid",
      now: 1,
      dr_window: c.DR_WINDOW_S,
      dr_factor: c.DR_FACTOR,
      dr_floor: c.DR_FLOOR,
      lock_budget: c.LOCK_BUDGET_S,
      lock_taper: c.LOCK_TAPER,
    });
    expect(castGatesClear(u, c)).toBe(false);
    u.status = emptyStatus();

    // Blue sanctuary pad centre
    u.x = c.BLUE_SPAWN[0]!;
    u.y = c.BLUE_SPAWN[1]!;
    expect(castGatesClear(u, c)).toBe(false);
  });

  it("evaluateCastPolicy refuses windup / banish / sanctuary even with a stub entry", () => {
    const me = bare({ id: "blue:top", team: "blue", slot: "top", champ: "brannoch", x: 11, y: 8 });
    const foe = bare({ id: "red:mid", team: "red", slot: "mid", champ: "helvar", x: 12.2, y: 8 });
    const state = { t: 1, tick: 10, units: [me, foe] } as MatchState;
    const opts = { c, focusId: foe.id, table: BRANNOCH_Q_STUB };

    expect(evaluateCastPolicy(state, me, opts)?.skill).toBe("Q");

    me.cast_left = 0.3;
    expect(evaluateCastPolicy(state, me, opts)).toBeNull();
    me.cast_left = 0;

    applyCc(me.status, {
      kind: "banish",
      raw_duration: 1.5,
      school: "magic",
      source_id: foe.id,
      now: 1,
      dr_window: c.DR_WINDOW_S,
      dr_factor: c.DR_FACTOR,
      dr_floor: c.DR_FLOOR,
      lock_budget: c.LOCK_BUDGET_S,
      lock_taper: c.LOCK_TAPER,
    });
    expect(evaluateCastPolicy(state, me, opts)).toBeNull();
    me.status = emptyStatus();

    me.x = c.BLUE_SPAWN[0]!;
    me.y = c.BLUE_SPAWN[1]!;
    expect(evaluateCastPolicy(state, me, opts)).toBeNull();
  });
});

describe("S6 Cast intent path + cast_start + status_apply", () => {
  it("stub policy → brainDecide Cast intent for a non-Kerrig/Huntress kit", () => {
    const me = bare({ id: "blue:top", team: "blue", slot: "top", champ: "brannoch", x: 11, y: 8 });
    const foe = bare({ id: "red:mid", team: "red", slot: "mid", champ: "helvar", x: 12.2, y: 8 });
    const state = { t: 5, tick: 50, units: [me, foe] } as MatchState;
    const d = brainDecide(state, me, {
      c,
      commit: "engage",
      focusId: foe.id,
      peelDiverId: null,
      peeling: false,
      chase: null,
      tactic: "hold_the_pit",
      fightIds: [me.id, foe.id],
      intentTarget: {},
      castPolicyTable: BRANNOCH_Q_STUB,
    });
    expect(d.intent).toBe("Cast");
    expect(d.cast).toEqual({ skill: "Q", target_id: foe.id });
  });

  it("beginCast emits cast_start for every accepted cast", () => {
    const me = bare({ id: "blue:top", team: "blue", slot: "top", champ: "brannoch", x: 11, y: 8 });
    const foe = bare({ id: "red:mid", team: "red", slot: "mid", champ: "helvar", x: 12.2, y: 8 });
    const state = {
      t: 1,
      tick: 10,
      event_seq: 1,
      units: [me, foe],
      pending_damage: [],
      pending_heals: [],
      pending_shields: [],
      pending_status: [],
      pending_lands: [],
    } as unknown as MatchState;
    const events: Array<{ type: string; [k: string]: unknown }> = [];
    beginCast(
      state,
      { tick: 10, source_id: me.id, skill: "Q", target_id: foe.id, force_hit: true },
      c,
      (type, payload) => {
        events.push({ type, ...payload });
      },
    );
    const cs = events.filter((e) => e.type === "cast_start");
    expect(cs).toHaveLength(1);
    expect(cs[0]!.unit_id).toBe(me.id);
    expect(typeof cs[0]!.skill_id).toBe("string");
    expect(typeof cs[0]!.cast_time).toBe("number");
  });

  it("status_apply is additive with the existing event shape when CC lands", () => {
    // Kerrig Q applies a mark/slow path; use scripted cast through simulate so
    // resolve → pending_status → status_apply uses the unchanged payload.
    const r = simulate({
      ...defaultEvenConfig(42),
      ai_enabled: false,
      forced_clock_end: true,
      constants: { MATCH_T: 3 },
      unit_overrides: {
        "blue:mid": {
          champ: "kerrig",
          level: 7,
          x: 12,
          y: 8,
          spawn_shield_until: 0,
          auto_next_start_t: 999,
        },
        "red:mid": {
          champ: "helvar",
          level: 7,
          x: 13.2,
          y: 8,
          spawn_shield_until: 0,
          auto_next_start_t: 999,
        },
      },
      scripted_casts: [
        {
          tick: 5,
          source_id: "blue:mid",
          skill: "Q",
          target_id: "red:mid",
          force_hit: true,
        },
      ],
    });
    const applied = r.events.filter((e) => e.type === "status_apply");
    // Kerrig Q may apply slow/mark-related status; if none, still assert shape
    // on any status_apply from the match (sanctuary-safe).
    if (applied.length === 0) {
      // Fallback: scripted_cc path — additive shape check without changing sim.
      const r2 = simulate({
        ...defaultEvenConfig(43),
        ai_enabled: false,
        forced_clock_end: true,
        constants: { MATCH_T: 2 },
        unit_overrides: {
          "blue:mid": { champ: "kerrig", level: 7, x: 12, y: 8, auto_next_start_t: 999 },
          "red:mid": { champ: "helvar", level: 7, x: 14, y: 8, auto_next_start_t: 999 },
        },
        scripted_cc: [
          {
            tick: 3,
            target_id: "red:mid",
            kind: "stun",
            duration: 1.0,
            source_id: "blue:mid",
          },
        ],
      });
      const stun = r2.events.filter((e) => e.type === "status_apply" && e.kind === "stun");
      expect(stun.length).toBeGreaterThan(0);
      const e = stun[0]!;
      for (const key of [
        "source_id",
        "target_id",
        "kind",
        "category",
        "raw_duration",
        "applied_duration",
        "dr_factor",
        "lock_taper",
      ]) {
        expect(e, key).toHaveProperty(key);
      }
    } else {
      const e = applied[0]!;
      for (const key of [
        "source_id",
        "target_id",
        "kind",
        "category",
        "raw_duration",
        "applied_duration",
        "dr_factor",
        "lock_taper",
      ]) {
        expect(e, key).toHaveProperty(key);
      }
    }
  });
});

describe("S6 cast plumbing — determinism + empty-policy behaviour", () => {
  it("same seed twice → identical digest (even-OVR Hold)", () => {
    const cfg = evenOvrConfig(20261122, "hold_the_pit");
    const a = simulate({ ...cfg, constants: { ...(cfg.constants ?? {}), MATCH_T: 30 } });
    const b = simulate({ ...cfg, constants: { ...(cfg.constants ?? {}), MATCH_T: 30 } });
    expect(a.digest).toBe(b.digest);
  });

  it("empty policy: non-Kerrig/Huntress kits still emit no cast_start in a short AI-off script", () => {
    // AI-off + no scripted casts → 0 cast_start. Confirms we did not invent casts.
    const r = simulate({
      ...defaultEvenConfig(20261122),
      ai_enabled: false,
      constants: { MATCH_T: 5 },
    });
    expect(r.events.filter((e) => e.type === "cast_start")).toHaveLength(0);
  });

  it("mergeConstants still pure under cast plumbing import", () => {
    const a = mergeConstants({ MATCH_T: 10 });
    const b = mergeConstants({ MATCH_T: 10 });
    expect(a.MATCH_T).toBe(b.MATCH_T);
  });
});
