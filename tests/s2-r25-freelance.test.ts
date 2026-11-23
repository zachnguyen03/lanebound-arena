/**
 * Held-out killers for box mutate-s2 needles S2R25 / S2R25b / S2R25c / S2R26.
 *
 * Official `10-gd-rulings-r4.test.ts` disengage assert (≈L192) uses `aimedAt`,
 * which treats an empty hit list + Retreat intents as success. The §9.2 dwell
 * path makes BA Retreat immediately, so that assert no longer exercises
 * `ai_no_freelance` / `pickAutoTarget`. These tests pin the gate directly.
 *
 * Do not edit tests/acceptance/s2.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_CONSTANTS } from "../sim/constants.js";
import { pickAutoTarget } from "../sim/combat.js";
import { emptyStatus } from "../sim/status.js";
import { defaultEvenConfig, simulate } from "../sim/index.js";
import type { MatchConfig, MatchState, UnitState } from "../sim/types.js";

const c = DEFAULT_CONSTANTS;
const PIT = { x: 12, y: 4 };
const BA = "blue:adc";
const BM = "blue:mid";
const BJ = "blue:jungle";
const RA = "red:adc";
const RM = "red:mid";
const RJ = "red:jungle";
const SAME = "huntress";

function bare(
  partial: Partial<UnitState> & Pick<UnitState, "id" | "team" | "slot">,
): UnitState {
  const {
    id,
    team,
    slot,
    index = 0,
    champ = "huntress",
    x = 12,
    y = 4,
    hp = 400,
    intent = "Retreat",
    ai_target_id = null,
    ai_retreat_suppress_until = 0,
    ai_no_freelance,
    ...rest
  } = partial;
  return {
    id,
    team,
    slot,
    index,
    champ,
    x,
    y,
    vx: 0,
    vy: 0,
    hp,
    max_hp: 900,
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
      hp: 900,
      regen: 4,
      atk: 72,
      pow: 8,
      pres: 26,
      mres: 24,
      as: 1.2,
      crit: 0.08,
      range: 2.5,
      ms: 0,
    },
    attrs: {
      aim: 70,
      reflexes: 70,
      execution: 70,
      decision: 90,
      positioning: 70,
      teamwork: 90,
    },
    mastery: 50,
    intent,
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
    cast_aim_x: 0,
    cast_aim_y: 0,
    cast_force_hit: false,
    cast_seq: 0,
    cast_snapshot_ids: null,
    break_until: 0,
    commit_until: 0,
    rewind_used: false,
    abandon_scripted_motor: false,
    ai_target_id,
    ai_retreat_suppress_until,
    walk_from_pad_until: 0,
    ai_at_planner_wp: false,
    ai_no_trickle_until: 0,
    ai_first_auto_done: false,
    zone_aura_res: 0,
    flank_buff_until: 0,
    ai_no_freelance,
    ...rest,
  } as UnitState;
}

/**
 * Case-(1) disengage geometry from 10-gd-rulings-r4: focus_id stays the Focus
 * slot (RA). BA is glued mid-map next to greener local RM (ms=0).
 */
function stuckDisengageConfig(T = 1.0): MatchConfig {
  const base = defaultEvenConfig(20261122);
  return {
    ...base,
    ai_enabled: true,
    blue: {
      ...base.blue,
      tactics: { ...base.blue.tactics, preset: "hunt", focus: "adc", aggression: 0 },
    },
    constants: { MATCH_T: T },
    unit_overrides: {
      [BM]: {
        champ: SAME,
        level: 7,
        x: 15.0,
        y: PIT.y,
        hp: 40,
        spawn_shield_until: 0,
        auto_next_start_t: 999,
        attrs: { teamwork: 90, decision: 90 },
      },
      [BJ]: {
        champ: SAME,
        level: 7,
        x: 14.4,
        y: PIT.y + 0.6,
        hp: 40,
        spawn_shield_until: 0,
        auto_next_start_t: 999,
        attrs: { teamwork: 90 },
      },
      [BA]: {
        champ: SAME,
        level: 7,
        x: 8.5,
        y: PIT.y,
        hp: 40,
        range: 2.5,
        as: 2.0,
        ms: 0,
        spawn_shield_until: 0,
        auto_next_start_t: 0,
        attrs: { teamwork: 90, decision: 70 },
      },
      [RA]: {
        champ: SAME,
        level: 7,
        x: 15.8,
        y: PIT.y,
        spawn_shield_until: 0,
        auto_next_start_t: 999,
      },
      [RM]: {
        champ: SAME,
        level: 7,
        x: 9.0,
        y: PIT.y,
        spawn_shield_until: 0,
        auto_next_start_t: 999,
      },
      [RJ]: {
        champ: SAME,
        level: 7,
        x: 14.6,
        y: PIT.y + 0.8,
        spawn_shield_until: 0,
        auto_next_start_t: 999,
      },
      "blue:top": { x: 2, y: 2, spawn_shield_until: 0, auto_next_start_t: 999 },
      "blue:support": { x: 2, y: 12, spawn_shield_until: 0, auto_next_start_t: 999 },
      "red:top": { x: 22, y: 2, spawn_shield_until: 0, auto_next_start_t: 999 },
      "red:support": { x: 22, y: 12, spawn_shield_until: 0, auto_next_start_t: 999 },
    },
  };
}

describe("S2R25b — pickAutoTarget respects ai_no_freelance", () => {
  it("returns null when the flag is set and the brain named no target", () => {
    const atk = bare({
      id: BA,
      team: "blue",
      slot: "adc",
      x: 8.5,
      y: 4,
      ai_target_id: null,
      ai_no_freelance: true,
      ai_retreat_suppress_until: 0,
    });
    const local = bare({ id: RM, team: "red", slot: "mid", x: 9.3, y: 4, index: 6 });
    const focus = bare({ id: RA, team: "red", slot: "adc", x: 15.8, y: 4, index: 8 });
    const state = { t: 5, units: [atk, local, focus] } as MatchState;
    expect(pickAutoTarget(state, atk, c)).toBeNull();
  });

  it("selects the nearest in-range foe when the flag is clear", () => {
    const atk = bare({
      id: BA,
      team: "blue",
      slot: "adc",
      x: 8.5,
      y: 4,
      ai_target_id: null,
      ai_no_freelance: false,
      ai_retreat_suppress_until: 0,
    });
    const local = bare({ id: RM, team: "red", slot: "mid", x: 9.3, y: 4, index: 6 });
    const focus = bare({ id: RA, team: "red", slot: "adc", x: 15.8, y: 4, index: 8 });
    const state = { t: 5, units: [atk, local, focus] } as MatchState;
    expect(pickAutoTarget(state, atk, c)?.id).toBe(RM);
  });
});

describe("S2R25 / S2R25c — tick arms ai_no_freelance on mobile disengage Retreat", () => {
  it("stuck mid-map BA ends the short window with ai_no_freelance true and Retreat", () => {
    const r = simulate(stuckDisengageConfig(1.0));
    const call = r.events.find(
      (e) => e.type === "fight_call" && e.team === "blue" && e.commit === "disengage",
    );
    expect(call, "expected blue disengage").toBeTruthy();
    expect(call!.focus_id).toBe(RA);

    const ba = r.state.units.find((u) => u.id === BA)!;
    expect(ba.x).toBeCloseTo(8.5, 1);
    expect(ba.intent).toBe("Retreat");
    expect(ba.ai_target_id).toBeNull();
    // Kills: `u.ai_no_freelance = false` / skipping the retreating assign.
    expect(ba.ai_no_freelance, "mobile disengage Retreat must set ai_no_freelance").toBe(true);
    expect(ba.ai_retreat_suppress_until).toBeGreaterThan(r.state.t);
  });
});

describe("S2R26 — disengage Retreat path must arm (brain follow + retreating predicate)", () => {
  it("BA Retreats after disengage; freelance flag stays armed (not cleared by a soft hold)", () => {
    const r = simulate(stuckDisengageConfig(1.0));
    const call = r.events.find(
      (e) => e.type === "fight_call" && e.team === "blue" && e.commit === "disengage",
    );
    expect(call).toBeTruthy();
    const t0 = call!.t as number;
    const retreats = r.events.filter(
      (e) =>
        e.type === "intent" &&
        e.unit_id === BA &&
        e.intent === "Retreat" &&
        (e.t as number) >= t0,
    );
    expect(retreats.length).toBeGreaterThan(0);

    const ba = r.state.units.find((u) => u.id === BA)!;
    expect(ba.intent).toBe("Retreat");
    expect(ba.ai_no_freelance).toBe(true);

    // No offensive intent onto the greener local during the window.
    const badIntent = r.events.filter(
      (e) =>
        e.type === "intent" &&
        e.unit_id === BA &&
        (e.t as number) >= t0 &&
        e.target_id === RM &&
        (e.intent === "Engage" || e.intent === "Chase" || e.intent === "Approach"),
    );
    expect(badIntent.length).toBe(0);
  });
});
