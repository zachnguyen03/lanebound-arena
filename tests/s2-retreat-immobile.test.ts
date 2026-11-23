/**
 * S2-R4-5 immobile exception (engineer-owned): a rooted/leashed/at-pad Retreat
 * may still auto a target in range. Official suite is verifier-owned — do not
 * edit tests/acceptance/s2.
 */
import { describe, expect, it } from "vitest";
import { defaultEvenConfig, simulate } from "../sim/index.js";
import { retreatImmobile, retreatSuppressesCombat } from "../sim/retreat_combat.js";
import { applyCc, emptyStatus, isRooted } from "../sim/status.js";
import { DEFAULT_CONSTANTS } from "../sim/constants.js";
import type { MatchConfig, UnitState } from "../sim/types.js";

const PIT = { x: 12, y: 7.5 };
const c = DEFAULT_CONSTANTS;

describe("S2-R4-5 immobile Retreat still autos in-range (L1974)", () => {
  it("retreatImmobile lifts retreatSuppressesCombat for a rooted unit", () => {
    const st = emptyStatus();
    applyCc(st, {
      kind: "root",
      raw_duration: 2,
      school: "magic",
      source_id: "red:mid",
      now: 0,
      dr_window: c.DR_WINDOW_S,
      dr_factor: c.DR_FACTOR,
      dr_floor: c.DR_FLOOR,
      lock_budget: c.LOCK_BUDGET_S,
      lock_taper: c.LOCK_TAPER,
    });
    expect(isRooted(st)).toBe(true);
    const u = {
      team: "blue",
      x: PIT.x,
      y: PIT.y,
      status: st,
      waypoint: null,
      ai_retreat_suppress_until: 10,
    } as UnitState;
    expect(retreatImmobile(u, c)).toBe(true);
    const stubState = { t: 1, units: [] } as unknown as import("../sim/types.js").MatchState;
    expect(retreatSuppressesCombat(u, stubState, c)).toBe(false);
  });

  it("a rooted retreating blue:adc with red:mid in melee range emits auto damage", () => {
    const base = defaultEvenConfig(20261122);
    const cfg: MatchConfig = {
      ...base,
      ai_enabled: true,
      blue: {
        ...base.blue,
        tactics: { ...base.blue.tactics, preset: "hunt", focus: "adc", aggression: 0 },
      },
      constants: { MATCH_T: 3.0 },
      unit_overrides: {
        "blue:mid": {
          champ: "kerrig",
          level: 7,
          x: PIT.x,
          y: PIT.y,
          hp: 40,
          spawn_shield_until: 0,
          auto_next_start_t: 999,
          attrs: { teamwork: 90, decision: 90 },
        },
        "blue:jungle": {
          champ: "kerrig",
          level: 7,
          x: PIT.x - 0.6,
          y: PIT.y + 0.6,
          hp: 40,
          spawn_shield_until: 0,
          auto_next_start_t: 999,
          attrs: { teamwork: 90 },
        },
        "blue:adc": {
          champ: "kerrig",
          level: 7,
          x: PIT.x - 0.6,
          y: PIT.y,
          hp: 40,
          range: 1.5,
          spawn_shield_until: 0,
          auto_next_start_t: 0,
          attrs: { teamwork: 90 },
        },
        "red:mid": {
          champ: "maelis",
          level: 7,
          // d from BA (11.4, 7.5) ≈ 1.1 — inside melee 1.5
          x: PIT.x + 0.5,
          y: PIT.y,
          hp: 200,
          spawn_shield_until: 0,
          auto_next_start_t: 999,
        },
        "red:jungle": {
          champ: "kerrig",
          level: 7,
          x: PIT.x + 0.8,
          y: PIT.y + 0.8,
          spawn_shield_until: 0,
          auto_next_start_t: 999,
        },
        "red:adc": {
          champ: "kerrig",
          level: 7,
          x: PIT.x + 6.0,
          y: PIT.y,
          spawn_shield_until: 0,
          auto_next_start_t: 999,
        },
        "blue:top": { x: 2, y: 4, spawn_shield_until: 0, auto_next_start_t: 999 },
        "blue:support": { x: 2, y: 10, spawn_shield_until: 0, auto_next_start_t: 999 },
        "red:top": { x: 22, y: 4, spawn_shield_until: 0, auto_next_start_t: 999 },
        "red:support": { x: 22, y: 10, spawn_shield_until: 0, auto_next_start_t: 999 },
      },
      scripted_cc: [{ tick: 1, target_id: "blue:adc", kind: "root", duration: 5.0 }],
    };

    const r = simulate(cfg);
    const call = r.events.find(
      (e) => e.type === "fight_call" && e.team === "blue" && e.commit === "disengage",
    );
    expect(call, "expected a blue disengage fight_call").toBeTruthy();
    const t0 = call!.t as number;

    const rootApply = r.events.find(
      (e) => e.type === "status_apply" && e.target_id === "blue:adc" && e.kind === "root",
    );
    expect(rootApply).toBeTruthy();
    expect((rootApply!.t as number)).toBeLessThanOrEqual(t0 + 1e-9);

    const retreats = r.events.filter(
      (e) =>
        e.type === "intent" &&
        e.unit_id === "blue:adc" &&
        (e.t as number) >= t0 &&
        e.intent === "Retreat",
    );
    expect(retreats.length).toBeGreaterThan(0);

    const autos = r.events.filter(
      (e) =>
        e.source_id === "blue:adc" &&
        e.target_id === "red:mid" &&
        (e.t as number) >= t0 &&
        (e.type === "hit" || e.type === "projectile_spawn") &&
        (e.skill_id === "auto" || e.type === "projectile_spawn"),
    );
    expect(
      autos.length,
      "rooted Retreat must still auto an in-range foe (S2-R4-5 immobile exception)",
    ).toBeGreaterThan(0);
  });
});
