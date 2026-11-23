import { describe, expect, it } from "vitest";
import { DEFAULT_CONSTANTS, defaultEvenConfig, simulate } from "../sim/index.js";
import type { MatchConfig, UnitId } from "../sim/types.js";

describe("AUTO_WINDUP cadence (§6.8 / §6.9)", () => {
  it("melee auto applies only after windup; next start is 1/AS from windup begin", () => {
    const blue = "blue:adc" as UnitId;
    const red = "red:adc" as UnitId;
    const as = 1.0; // windup = 0.25/1 = 0.25s → 3 ticks of DT after start tick
    const cfg: MatchConfig = {
      ...defaultEvenConfig(20261122),
      notes: "auto windup fixture",
      constants: { MATCH_T: 3.0, SPAWN_SHIELD_S: 0 },
      unit_overrides: {
        [blue]: {
          x: 12.0,
          y: 8.0,
          spawn_shield_until: 0,
          range: 1.5, // melee: apply at windup end
          as,
        },
        [red]: {
          x: 12.8,
          y: 8.0,
          spawn_shield_until: 0,
          range: 1.5,
          as,
          auto_next_start_t: 999, // red does not auto back
        },
      },
    };

    const r = simulate(cfg);
    const hits = r.events.filter(
      (e) => e.type === "hit" && e.source_id === blue && e.skill_id === "auto",
    );
    expect(hits.length).toBeGreaterThanOrEqual(2);

    const first = hits[0]!;
    const second = hits[1]!;

    // Windup = 0.25s. Start on tick 1 (t=0.1), complete on tick where elapsed ≥ 0.25.
    // Decrements on ticks 2,3,4 → first apply at tick 4 (t=0.4).
    expect(first.tick).toBe(4);
    expect(first.t).toBe(0.4);

    // Next windup may start at t_start + 1/AS = 0.1 + 1.0 = 1.1 → tick 11.
    // Then same 3-tick windup → apply at tick 14 (t=1.4).
    expect(second.tick).toBe(14);
    expect(second.t).toBe(1.4);

    // Period between applies = 1.0s (= 1/AS), not windup alone.
    expect(second.t - first.t).toBeCloseTo(1.0, 10);

    // Constant present and default
    expect(DEFAULT_CONSTANTS.AUTO_WINDUP).toBe(0.25);
  });
});
