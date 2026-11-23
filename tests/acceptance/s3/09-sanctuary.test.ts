/**
 * 0 illegal enemy-sanctuary entries (M3-25 L1747; sandbox §11 S3 L705;
 * plan §8.4 S3 L366; §9.6). The 400-game AI preview and the 2,000-game lab
 * are deferred (DEFERRED.md). This pack pins the constructed shove already
 * used in S0 and a 20-seed AI-off defaultEvenConfig preview.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_CONSTANTS, defaultEvenConfig, simulate } from "./_harness.js";
import type { MatchConfig, UnitId } from "../../../sim/index.js";

describe("M3-25 constructed sanctuary clip (G5 L1886, §5.1 L215)", () => {
  it("a unit scripted into the enemy pad records 0 sanctuary_violation events and ends outside that pad", () => {
    const cfg: MatchConfig = {
      ...defaultEvenConfig(20261122),
      assert_sanctuary: true,
      forced_clock_end: true,
      constants: { MATCH_T: 12 },
      scripted_motor: {
        "blue:adc": {
          waypoints: [{ x: DEFAULT_CONSTANTS.RED_SPAWN[0], y: DEFAULT_CONSTANTS.RED_SPAWN[1] }],
          arrive_r: 0.05,
          hold_at_end: true,
        },
      },
    };
    const r = simulate(cfg);
    expect(r.events.filter((e) => e.type === "sanctuary_violation")).toHaveLength(0);
    const adc = r.state.units.find((u) => u.id === ("blue:adc" as UnitId))!;
    expect(adc.x).toBeLessThan(22);
  });
});

describe("M3-25 20-seed AI-off preview (sandbox L705 preview; 400 / 2,000 deferred)", () => {
  it("20 defaultEvenConfig seeds with assert_sanctuary emit 0 sanctuary_violation events", () => {
    let violations = 0;
    for (let i = 0; i < 20; i++) {
      const cfg = defaultEvenConfig(20261122 + i);
      cfg.assert_sanctuary = true;
      cfg.forced_clock_end = true;
      cfg.constants = { MATCH_T: 16 };
      const r = simulate(cfg);
      violations += r.events.filter((e) => e.type === "sanctuary_violation").length;
    }
    expect(violations).toBe(0);
  }, 180_000);
});
