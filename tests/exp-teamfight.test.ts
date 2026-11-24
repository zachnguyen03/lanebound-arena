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
