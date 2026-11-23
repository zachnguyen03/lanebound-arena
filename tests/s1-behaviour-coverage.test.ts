/**
 * S1 behavioural coverage — one focused test per QA gate.
 * Each cites a build-spec line and asserts observable sim behaviour so a
 * regression in that rule turns the test red. Own tests only (not acceptance/).
 */
import { describe, expect, it } from "vitest";
import { KITS } from "../data/champions/kits.js";
import { canStartAuto } from "../sim/combat.js";
import { applyMark, consumeMark, hasMark } from "../sim/marks.js";
import { DEFAULT_CONSTANTS, defaultEvenConfig, simulate } from "../sim/index.js";
import { applyCc, emptyStatus } from "../sim/status.js";
import { kitBase } from "../sim/fixture.js";
import { statsAtLevel } from "../sim/stats.js";
import type { MatchConfig, UnitId, UnitState } from "../sim/types.js";

function shortCfg(partial: Partial<MatchConfig> = {}): MatchConfig {
  return {
    ...defaultEvenConfig(20261122),
    constants: { MATCH_T: 4.0, ...(partial.constants as object) },
    ai_enabled: false,
    ...partial,
  };
}

const ccOpts = {
  school: "magic" as const,
  source_id: "blue:mid" as UnitId,
  now: 1,
  dr_window: DEFAULT_CONSTANTS.DR_WINDOW_S,
  dr_factor: DEFAULT_CONSTANTS.DR_FACTOR,
  dr_floor: DEFAULT_CONSTANTS.DR_FLOOR,
  lock_budget: DEFAULT_CONSTANTS.LOCK_BUDGET_S,
  lock_taper: DEFAULT_CONSTANTS.LOCK_TAPER,
};

function bareForGates(partial: Partial<UnitState> = {}): UnitState {
  const u: UnitState = {
    id: "blue:adc",
    team: "blue",
    slot: "adc",
    index: 0,
    champ: "huntress",
    x: 12,
    y: 8,
    vx: 0,
    vy: 0,
    hp: 900,
    max_hp: 900,
    xp: 0,
    level: 1,
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
      as: 0.84,
      crit: 0.08,
      range: 6.25,
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
    zone_aura_res: 0,
    walk_from_pad_until: 0,
    flank_buff_until: 0,
    ai_at_planner_wp: false,
    ai_no_trickle_until: 0,
    ai_first_auto_done: false,
  };
  Object.assign(u, partial);
  return u;
}

describe("S1 behaviour coverage", () => {
  it("banish: target is invulnerable — scripted damage during banish deals no hit (spec L444, L1716 item 11)", () => {
    const victim = "red:adc" as UnitId;
    const src = "blue:adc" as UnitId;
    const r = simulate(
      shortCfg({
        constants: { MATCH_T: 2.0 },
        unit_overrides: {
          [src]: { x: 12, y: 8, spawn_shield_until: 0, auto_next_start_t: 999 },
          [victim]: { x: 13, y: 8, spawn_shield_until: 0, auto_next_start_t: 999, hp: 2000 },
        },
        scripted_cc: [{ tick: 1, target_id: victim, kind: "banish", duration: 1.8, source_id: src }],
        scripted_damage: [{ tick: 5, source_id: src, target_id: victim, raw: 500 }],
      }),
    );
    expect(r.events.some((e) => e.type === "status_apply" && e.kind === "banish" && e.target_id === victim)).toBe(
      true,
    );
    expect(r.events.some((e) => e.type === "hit" && e.target_id === victim && e.tick === 5)).toBe(false);
    const u = r.state.units.find((x) => x.id === victim)!;
    expect(u.hp).toBe(u.max_hp);
  });

  it("Blind: autos complete windup but miss (raw 0 / miss:true) — §6.1 / §6.5 L348, L458", () => {
    const adc = "blue:adc" as UnitId;
    const foe = "red:adc" as UnitId;
    const r = simulate(
      shortCfg({
        constants: { MATCH_T: 3.0 },
        unit_overrides: {
          [adc]: { x: 12, y: 8, champ: "huntress", spawn_shield_until: 0, auto_next_start_t: 0, range: 8, as: 2.0 },
          [foe]: { x: 12.5, y: 8, spawn_shield_until: 0, auto_next_start_t: 999, hp: 5000 },
        },
        scripted_cc: [{ tick: 1, target_id: adc, kind: "blind", duration: 5 }],
      }),
    );
    const misses = r.events.filter((e) => e.type === "hit" && e.skill_id === "auto" && e.miss === true);
    expect(misses.length).toBeGreaterThan(0);
    expect(misses.every((e) => (e.raw as number) === 0)).toBe(true);
    const dmg = r.events.filter(
      (e) => e.type === "hit" && e.skill_id === "auto" && e.miss !== true && (e.mitigated as number) > 0,
    );
    expect(dmg.length).toBe(0);
  });

  it("consumeMark: live mark is removed and Huntress R emits mark_consume +35% (spec L393, L556, L1712 item 7)", () => {
    const list: { kind: "huntress" | "kerrig"; source_id: UnitId; expires_t: number }[] = [];
    applyMark(list, "huntress", "blue:adc", 1.0, 4.0);
    expect(hasMark(list, "huntress", 1.0)).toBe(true);
    expect(consumeMark(list, "huntress", 1.0)).toBe(true);
    expect(hasMark(list, "huntress", 1.0)).toBe(false);
    expect(consumeMark(list, "huntress", 1.0)).toBe(false);

    const hunter = "blue:adc" as UnitId;
    const victim = "red:adc" as UnitId;
    const r = simulate(
      shortCfg({
        unit_overrides: {
          [hunter]: { x: 12, y: 8, level: 7, champ: "huntress", spawn_shield_until: 0, auto_next_start_t: 999 },
          [victim]: { x: 13, y: 8, level: 7, champ: "maelis", spawn_shield_until: 0, auto_next_start_t: 999, hp: 5000 },
        },
        scripted_casts: [
          { tick: 2, source_id: hunter, skill: "Q", target_id: victim, force_hit: true },
          { tick: 12, source_id: hunter, skill: "R", aim_x: 13, aim_y: 8, force_hit: true },
        ],
      }),
    );
    expect(r.events.some((e) => e.type === "mark_consume" && e.target_id === victim && e.kind === "huntress")).toBe(
      true,
    );
    const hit = r.events.find(
      (e) => e.type === "hit" && e.skill_id === KITS.huntress!.R.name && e.target_id === victim,
    )!;
    const s = statsAtLevel("huntress", 7);
    const base = kitBase("huntress", "R", s.atk, s.pow);
    expect(hit.raw as number).toBeCloseTo(base * 1.35, 6);
  });

  it("canStartAuto under time-stop is false (spec L448, L506)", () => {
    const u = bareForGates();
    expect(canStartAuto(u, u.status)).toBe(true);
    applyCc(u.status, { kind: "timestop", raw_duration: 2, ...ccOpts });
    expect(canStartAuto(u, u.status)).toBe(false);
  });

  it("canStartAuto under Disarm is false (spec L458, L506)", () => {
    const u = bareForGates();
    expect(canStartAuto(u, u.status)).toBe(true);
    applyCc(u.status, { kind: "disarm", raw_duration: 2, ...ccOpts });
    expect(canStartAuto(u, u.status)).toBe(false);
  });

  it("Isra R sanctuary: aim into enemy pad → sanctuary_clip and 0 damage to pad occupant (spec L215, L1714 item 9)", () => {
    const isra = "blue:adc" as UnitId;
    const victim = "red:support" as UnitId;
    const r = simulate(
      shortCfg({
        constants: { MATCH_T: 5.0 },
        unit_overrides: {
          [isra]: { x: 10, y: 8, level: 7, champ: "isra", spawn_shield_until: 0, auto_next_start_t: 999 },
          [victim]: { x: 22.5, y: 8, level: 1, champ: "saelo", spawn_shield_until: 0, auto_next_start_t: 999, hp: 5000 },
        },
        scripted_casts: [{ tick: 2, source_id: isra, skill: "R", aim_x: 22.5, aim_y: 8, force_hit: true }],
      }),
    );
    expect(r.events.some((e) => e.type === "sanctuary_clip" && e.skill_id === KITS.isra!.R.name)).toBe(true);
    expect(
      r.events.filter((e) => e.type === "hit" && e.skill_id === KITS.isra!.R.name && e.target_id === victim).length,
    ).toBe(0);
  });

  it("Sedge R self-exclusion: caster is not slept; ally in radius is (spec L619, L1715 item 10)", () => {
    const sedge = "blue:jungle" as UnitId;
    const ally = "blue:adc" as UnitId;
    expect(KITS.sedge!.R.hits_allies).toBe(true);
    const r = simulate(
      shortCfg({
        unit_overrides: {
          [sedge]: { x: 12, y: 8, level: 7, champ: "sedge", spawn_shield_until: 0, auto_next_start_t: 999 },
          [ally]: { x: 12.5, y: 8, level: 1, champ: "huntress", spawn_shield_until: 0, auto_next_start_t: 999 },
        },
        scripted_casts: [{ tick: 2, source_id: sedge, skill: "R", aim_x: 12.5, aim_y: 8, force_hit: true }],
      }),
    );
    expect(r.events.some((e) => e.type === "status_apply" && e.kind === "sleep" && e.target_id === ally)).toBe(true);
    expect(r.events.some((e) => e.type === "status_apply" && e.kind === "sleep" && e.target_id === sedge)).toBe(false);
  });
});
