/**
 * exp/teamfight-dynamics — experiment rules (not build-spec acceptance).
 */
import { describe, expect, it } from "vitest";
import { simulate } from "../sim/index.js";
import { evenOvrConfig } from "../sim/match_config.js";
import { DEFAULT_CONSTANTS } from "../sim/constants.js";
import { chaseRelax, chaseShouldStop } from "../sim/ai/brain.js";
import type { MatchState, UnitState } from "../sim/types.js";

const unit = (over: Partial<UnitState>): UnitState =>
  ({ alive: true, team: "blue", id: "blue:top", x: 0, y: 0, hp: 100, max_hp: 100, ...over }) as UnitState;

describe("exp teamfight", () => {
  it("chase relax is 1 when the flag is off and grows on low-HP / supported targets", () => {
    const me = unit({ id: "blue:jungle" });
    const low = unit({ id: "red:adc", team: "red", x: 5, hp: 20 });
    const mate = unit({ id: "blue:mid", x: 6 });
    const off = { config: {}, units: [me, low, mate] } as unknown as MatchState;
    const on = { config: { teamfight: { chase: true } }, units: [me, low, mate] } as unknown as MatchState;
    expect(chaseRelax(off, me, low)).toBe(1);
    expect(chaseRelax(on, me, low)).toBeCloseTo(3, 9);
  });

  it("relax raises the TTK stop", () => {
    const me = unit({ id: "blue:jungle" });
    const tgt = unit({ id: "red:adc", team: "red", x: 3 });
    const chase = { target_id: tgt.id, start_x: 0, start_y: 0, start_t: 0 };
    const ttk = DEFAULT_CONSTANTS.CHASE_TTK_STOP * 1.5;
    expect(chaseShouldStop(me, tgt, chase, DEFAULT_CONSTANTS, ttk, false).stop).toBe(true);
    expect(chaseShouldStop(me, tgt, chase, DEFAULT_CONSTANTS, ttk, false, 2).stop).toBe(false);
  });

  it("flags change the match but stay deterministic", () => {
    const base = simulate(evenOvrConfig(20261122)).digest;
    const cfg = { ...evenOvrConfig(20261122), teamfight: { combo: true, roles: true, chase: true } };
    const a = simulate(cfg).digest;
    expect(a).not.toBe(base);
    expect(simulate(cfg).digest).toBe(a);
  });
});

import { shapeFormation } from "../sim/ai/formation.js";

describe("exp teamfight round 2", () => {
  it("r_min_level lets ults fire before level 5", () => {
    const cfg = { ...evenOvrConfig(20261122), teamfight: { r_min_level: 3 } };
    const ev = simulate(cfg).events as Array<Record<string, any>>;
    const level: Record<string, number> = {};
    let early = 0;
    for (const e of ev) {
      if (e.type === "level_up") level[e.unit_id] = e.new_level;
      if (e.type === "cast_end" && e.skill === "R" && (level[e.unit_id] ?? 1) < 5) early++;
    }
    expect(early).toBeGreaterThan(0);
  });

  it("formation keeps the backline behind its front line and flanks divers", () => {
    const tank = unit({ id: "blue:top", champ: "brannoch", slot: "top", x: 10, y: 8 });
    const adc = unit({ id: "blue:adc", champ: "huntress", slot: "adc", x: 6, y: 8 });
    const jg = unit({ id: "blue:jungle", champ: "kerrig", slot: "jungle", x: 4, y: 9 });
    const state = { config: { teamfight: { formation: true } }, units: [tank, adc, jg] } as unknown as MatchState;
    expect(shapeFormation(state, adc, "Chase", { x: 14, y: 8 })).toEqual({ x: 8.5, y: 8 });
    expect(shapeFormation(state, jg, "Approach", { x: 16, y: 8 })).toEqual({ x: 16, y: 11 });
    const off = { config: {}, units: [tank, adc] } as unknown as MatchState;
    expect(shapeFormation(off, adc, "Chase", { x: 14, y: 8 })).toEqual({ x: 14, y: 8 });
  });
});
