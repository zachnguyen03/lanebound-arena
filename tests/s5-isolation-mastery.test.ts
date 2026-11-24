/**
 * §8.5 mastery isolation pins ONE player (blue ADC pick), not all ten.
 */
import { describe, expect, it } from "vitest";
import { evenOvrConfig } from "../sim/match_config.js";
import { applyPins } from "../apps/lab/lib/batch-runner.js";
import { runIsolation } from "../apps/lab/lib/isolation.js";

describe("S5 isolation mastery_one (§8.5)", () => {
  it("applyPins mastery_one raises only the blue ADC pick entry", () => {
    const base = evenOvrConfig(20261122, "hold_the_pit");
    const adcChamp = base.blue.picks[3]!; // adc slot
    const cfg = applyPins(base, {
      attrs_all: 60,
      mastery_all: 50,
      mastery_one: { side: "blue", slot: "adc", value: 90 },
    });

    const blueAdc = cfg.blue.players[3]!;
    expect(blueAdc.mastery[adcChamp]).toBe(90);
    // Other champions on that player stay at the mastery_all floor.
    for (const [champ, v] of Object.entries(blueAdc.mastery)) {
      if (champ === adcChamp) continue;
      expect(v, champ).toBe(50);
    }
    // Other nine players remain entirely at 50.
    for (const side of [cfg.blue, cfg.red]) {
      for (const p of side.players) {
        if (p === blueAdc) continue;
        for (const v of Object.values(p.mastery)) expect(v).toBe(50);
      }
    }
  });

  it("runIsolation mastery arm does not set mastery_all=90", () => {
    const iso = runIsolation({
      nPerArm: 2,
      seedStart: 20261122,
      pairing: "plain",
      includeMirrorControl: false,
      teamworkFloor: 40,
    });
    expect(iso.arms.mastery90).toBeTruthy();
    expect(iso.setup_notes.some((n) => n.includes("mastery_one"))).toBe(true);
    // Control and mastery arms both finished the requested games.
    expect(iso.arms.control!.n).toBe(2);
    expect(iso.arms.mastery90!.n).toBe(2);
  }, 120_000);
});
