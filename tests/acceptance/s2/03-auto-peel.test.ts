/**
 * Auto-peel (M2 test 22; §9.5 L1147–1160; Teamwork hook L1046 / §8.4; Protect the carry §12 L1356).
 * R #3 S2-4 L1914: a `dive` event fires once per diver-target pair per fight when
 * §9.5 condition (2) first holds. M2 = peel_start / dive events where
 * peeler_perceived is true. The lab no longer reconstructs dives from `pos`.
 *
 * A 400-game preview is the M2 bar (L1735); the 2,000-game even lab is M6, listed in DEFERRED.md.
 */
import { describe, expect, it } from "vitest";
import { configOf, runAi, type UId } from "./_harness.js";
import { simulate } from "../../../sim/index.js";

const CARRY = "blue:adc" as UId; // Huntress — Marksman
const PEELER = "blue:support" as UId; // Ysol — Enchanter (always peels, L1046 / L1156)
const TANK = "blue:top" as UId; // Brannoch — Tank (always peels)
const DIVER = "red:mid" as UId; // set range ≤ 2 so the unit is a melee dive (L1149)
const RJ = "red:jungle" as UId;
const RA = "red:adc" as UId;

/** Two extra reds sit outside PEEL_DIVE_R so the scene is a 3v3 fight, not a 3v1. */
const EXTRA_REDS: Parameters<typeof runAi>[0]["units"] = {
  [RJ]: { champ: "kerrig", level: 7, x: 11, y: 7.2, range: 2, auto: false },
  [RA]: { champ: "huntress", level: 7, x: 13, y: 7.2, auto: false },
};

function diveScene(seed: number, extra?: Parameters<typeof runAi>[0]) {
  return runAi({
    seed,
    T: 6.0,
    pos: true,
    units: {
      [CARRY]: { champ: "huntress", level: 7, x: 12, y: 4, auto: false },
      [PEELER]: { champ: "ysol", level: 7, x: 11.2, y: 4.2, auto: false },
      [TANK]: { champ: "brannoch", level: 7, x: 11.2, y: 3.6, auto: false },
      // Melee in the 3.0 dive radius of the carry (L1149, PEEL_DIVE_R), peeler can reach in ≤1.5 s (L1154).
      [DIVER]: { champ: "kerrig", level: 7, x: 13.5, y: 4, range: 2, auto: true },
      ...EXTRA_REDS,
    },
    ...extra,
  });
}

describe("Auto-peel (§9.5 L1147–1160, M2-22 L1735, R #3 S2-4 L1914)", () => {
  it("a constructed melee dive within 3 tiles of an allied Marksman emits peel_start naming the peeler, carry, and diver", () => {
    const r = diveScene(20261122);
    const peels = r.of("peel_start");
    expect(peels.length).toBeGreaterThan(0);
    const e = peels[0]!;
    expect(e.carry_id === CARRY || e.carry_id === PEELER).toBe(true);
    expect(e.diver_id).toBe(DIVER);
    expect(e.peeler_id === PEELER || e.peeler_id === TANK).toBe(true);
  });

  it("R #3 S2-4 L1914: a dive event is emitted with diver_id, target_id, fight_id, peeler_perceived, and optional peeler_id", () => {
    const r = diveScene(20261122);
    const dives = r.of("dive");
    expect(dives.length).toBeGreaterThan(0);
    const e = dives[0]!;
    expect(e.diver_id).toBe(DIVER);
    expect(e.target_id).toBe(CARRY);
    expect("fight_id" in e).toBe(true);
    expect(typeof e.peeler_perceived).toBe("boolean");
    if (e.peeler_id != null) {
      expect(e.peeler_id === PEELER || e.peeler_id === TANK).toBe(true);
    }
  });

  it("R #3 S2-4 L1914: dive fires once per diver-target pair per fight, even if the pair stays in range", () => {
    const r = diveScene(20261122, { T: 6.0 });
    const pair = r.of("dive", (e) => e.diver_id === DIVER && e.target_id === CARRY);
    expect(pair.length).toBe(1);
  });

  it("no peel_start and no dive when nobody is diving (all sides far apart)", () => {
    const r = runAi({
      T: 4.0,
      pos: true,
      units: {
        [CARRY]: { champ: "huntress", level: 7, x: 6, y: 4 },
        [PEELER]: { champ: "ysol", level: 7, x: 5, y: 4 },
        [DIVER]: { champ: "kerrig", level: 7, x: 20, y: 12, range: 2 },
      },
    });
    expect(r.of("peel_start")).toHaveLength(0);
    expect(r.of("dive")).toHaveLength(0);
  });

  it("Tanks and Enchanters always attempt peel when the geometric checks pass, regardless of Teamwork (§8.4 L1046)", () => {
    const r = diveScene(20261123, {
      T: 6.0,
      pos: true,
      units: {
        [CARRY]: { champ: "huntress", level: 7, x: 12, y: 4, auto: false, attrs: { teamwork: 10 } },
        [PEELER]: { champ: "ysol", level: 7, x: 11.2, y: 4.2, auto: false, attrs: { teamwork: 10 } },
        [TANK]: { champ: "brannoch", level: 7, x: 11.2, y: 3.6, auto: false, attrs: { teamwork: 10 } },
        [DIVER]: { champ: "kerrig", level: 7, x: 13.5, y: 4, range: 2, auto: true, attrs: { teamwork: 10 } },
        ...EXTRA_REDS,
      },
    });
    const peels = r.of("peel_start");
    expect(peels.length).toBeGreaterThan(0);
    expect(peels.some((e) => e.peeler_id === PEELER || e.peeler_id === TANK)).toBe(true);
  });

  it("a Lock-disabled peeler does not emit peel_start when they are the only peeler (L1154)", () => {
    const r = runAi({
      T: 6.0,
      pos: true,
      units: {
        [CARRY]: { champ: "huntress", level: 7, x: 12, y: 4 },
        [PEELER]: { champ: "ysol", level: 7, x: 11.2, y: 4.2 },
        [DIVER]: { champ: "kerrig", level: 7, x: 13.5, y: 4, range: 2, auto: true },
      },
      cc: [{ tick: 1, target: PEELER, kind: "stun", duration: 6 }],
    });
    expect(r.of("peel_start", (e) => e.peeler_id === PEELER)).toHaveLength(0);
  });

  it("M2 preview lab: peel_start fires in ≥ 70% of dive events with peeler_perceived, over 400 seeds; denominator is recorded and must be > 0 (L1160, L1735, R #3 S2-4; fail if unmeasured)", () => {
    const N = 400;
    let eligible = 0;
    let fired = 0;
    for (let i = 0; i < N; i++) {
      const cfg = configOf({
        seed: 20261122 + i,
        T: 6.0,
        pos: true,
        units: {
          [CARRY]: { champ: "huntress", level: 7, x: 12, y: 4 },
          [PEELER]: { champ: "ysol", level: 7, x: 11.2, y: 4.2 },
          [TANK]: { champ: "brannoch", level: 7, x: 11.2, y: 3.6 },
          [DIVER]: { champ: "kerrig", level: 7, x: 13.5, y: 4, range: 2, auto: true },
          ...EXTRA_REDS,
        },
      });
      const r = simulate(cfg);
      const dives = r.events.filter((e) => e.type === "dive" && e.peeler_perceived === true);
      const peels = r.events.filter((e) => e.type === "peel_start").length;
      eligible += dives.length;
      if (dives.length > 0 && peels > 0) fired += Math.min(peels, dives.length);
    }
    // Bound for the report / QA: denominator recorded.
    // eslint-disable-next-line no-console
    console.log(`S2 peel preview lab: peel_start=${fired} denominator=${eligible} rate=${eligible ? fired / eligible : "unmeasured"} N=${N}`);
    expect(eligible, "denominator must be recorded and > 0 — an unmeasured peel rate is a fail (sandbox §11 S2)").toBeGreaterThan(0);
    expect(fired / eligible).toBeGreaterThanOrEqual(0.7);
  }, 120_000);
});
