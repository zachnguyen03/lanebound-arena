/**
 * exp milestones (sim/milestones.ts) and the personal card effects (sim/cards.ts); not build-spec acceptance.
 */
import { describe, expect, it } from "vitest";
import { simulate } from "../sim/index.js";
import { evenOvrConfig } from "../sim/match_config.js";
import { SANDBOX_KIT_PATCH } from "../sim/balance.js";
import { SANDBOX_CONSTANTS, TEAMFIGHT_R3 } from "../sim/cadence.js";
import type { MatchConfig, SimEvent } from "../sim/types.js";

const arena = (seed: number): MatchConfig => ({
  ...evenOvrConfig(seed), objectives: { mode: "points" }, teamfight: { ...TEAMFIGHT_R3 }, attr_scaling: true,
  constants: { ...SANDBOX_CONSTANTS }, kit_patch: SANDBOX_KIT_PATCH,
});
const TYPES = ["spree", "shutdown", "anchor_start", "anchor_end", "sweep"];
const SEEDS = [11, 12, 13, 14, 15, 16];

describe("exp milestones", () => {
  it("is off by default: no milestone events, digest unchanged by an explicit undefined", () => {
    const r = simulate(arena(11));
    expect(r.events.some((e) => TYPES.includes(e.type))).toBe(false);
    expect(simulate({ ...arena(11), milestones: undefined }).digest).toBe(r.digest);
  });

  it("on: every milestone fires in seeded games; shutdowns and sweeps add to the score", () => {
    const seen = new Set<string>();
    for (const seed of SEEDS) {
      const r = simulate({ ...arena(seed), milestones: true }), evs = r.events;
      for (const e of evs) if (TYPES.includes(e.type)) seen.add(e.type);
      // Every point is accounted for: takedowns, majority ticks, claims, shutdown bounties and sweeps.
      const score: Record<string, number> = { blue: 0, red: 0 };
      const team = (e: SimEvent) => (e.type === "shutdown" ? String(e.killer_id).split(":")[0]! : String(e.team));
      for (const e of evs) {
        if (!["takedown_score", "zone_tick", "claim_award", "shutdown", "sweep"].includes(e.type)) continue;
        score[team(e)] = (score[team(e)] ?? 0) + 1;
        expect(e.score_after).toBe(score[team(e)]);
      }
      expect([r.state.score_blue, r.state.score_red]).toEqual([score.blue, score.red]);
      for (const e of evs.filter((x) => x.type === "shutdown")) expect(Number(e.streak)).toBeGreaterThanOrEqual(3);
    }
    expect([...seen].sort()).toEqual([...TYPES].sort());
  });

  it("execute card: hits under the threshold kill and the death credits the holder", () => {
    const cfg: MatchConfig = { ...arena(11), cards: { blue: [{ id: "x", owner: "adc", trigger: { on: "time", t: 1 }, effects: [{ stat: "execute", v: 0.5, target: "owner" }] }], red: [] } };
    const evs = simulate(cfg).events, ex = evs.filter((e) => e.type === "execute");
    expect(ex.length).toBeGreaterThan(0);
    for (const e of ex) {
      expect(e.source_id).toBe("blue:adc");
      expect(evs.find((d) => d.type === "death" && d.unit_id === e.target_id && d.t >= e.t)?.killer_id).toBe("blue:adc");
    }
  });
});
