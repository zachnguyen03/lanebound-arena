/**
 * exp attr_scaling — attribute damage scaling (not build-spec acceptance).
 */
import { describe, expect, it } from "vitest";
import { simulate } from "../sim/index.js";
import { evenOvrConfig } from "../sim/match_config.js";
import { attrDamageMult } from "../sim/combat.js";
import type { MatchState, PlayerAttrs, UnitState } from "../sim/types.js";

const attrs = (v: number): PlayerAttrs =>
  ({ aim: v, reflexes: v, execution: v, decision: v, positioning: v, teamwork: v });
const unit = (id: string, v: number, x = 0) =>
  ({ id, team: id.split(":")[0], alive: true, x, y: 0, attrs: attrs(v), damage_log: [] }) as unknown as UnitState;

describe("exp attr_scaling", () => {
  it("is off by default: absent = identical digest, on = different and deterministic", () => {
    const base = evenOvrConfig(20261122);
    expect(simulate({ ...base, attr_scaling: undefined }).digest).toBe(simulate(base).digest);
    // Even-OVR players sit at 70 (multiplier 1), so give Blue +15 everywhere.
    const blue = { ...base.blue, players: base.blue.players.map((p) => ({ ...p, attrs: attrs(85) })) };
    const on = { ...base, blue, attr_scaling: true as const };
    expect(simulate({ ...base, blue }).digest).not.toBe(simulate(on).digest);
    const d = simulate(on).digest;
    expect(simulate(on).digest).toBe(d);
  });

  it("higher attributes raise damage dealt and lower damage taken", () => {
    const st = (units: UnitState[], cfg?: true) => ({ t: 10, units, config: { attr_scaling: cfg } }) as unknown as MatchState;
    const src = unit("blue:mid", 70), tgt = unit("red:mid", 70, 3);
    expect(attrDamageMult(st([src, tgt]), src, tgt)).toBe(1);
    expect(attrDamageMult(st([src, tgt], true), src, tgt)).toBe(1);
    const strong = unit("blue:mid", 85), weak = unit("red:mid", 55, 3);
    expect(attrDamageMult(st([strong, tgt], true), strong, tgt)).toBeGreaterThan(1);
    expect(attrDamageMult(st([src, weak], true), src, weak)).toBeGreaterThan(1);
    expect(attrDamageMult(st([strong, tgt]), strong, tgt)).toBe(1);
  });
});
