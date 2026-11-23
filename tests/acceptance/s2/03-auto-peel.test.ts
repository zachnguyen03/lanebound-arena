/**
 * Auto-peel (M2 test 22; §9.5 L1147–1160; Teamwork hook L1046; Protect the carry §12 L1356).
 * The denominator is dives where geometric check (2) was true on the dive tick and
 * the peeler had had time to perceive the diver. There is no `dive` event in §4.4
 * (see OPEN-QUESTIONS.md); the lab reconstructs dives from the spec definition
 * and `pos` / `cast_start` / unit range, and counts `peel_start`.
 *
 * A 400-game preview is the M2 bar (L1735); the 2,000-game even lab is M6, listed in DEFERRED.md.
 */
import { describe, expect, it } from "vitest";
import { configOf, dist, pathOf, runAi, type Ev, type UId } from "./_harness.js";
import { simulate } from "../../../sim/index.js";

const CARRY = "blue:adc" as UId; // Huntress — Marksman
const PEELER = "blue:support" as UId; // Ysol — Enchanter (always peels, L1046 / L1156)
const TANK = "blue:top" as UId; // Brannoch — Tank (always peels)
const DIVER = "red:mid" as UId; // set range ≤ 2 so the unit is a melee dive (L1149)

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
    },
    ...extra,
  });
}

/** Geometric check (2) at a tick: a peeler is living, not obvious from end-state; we use peel_start + reconstructed dives. */
function reconstructedDives(events: Ev[]): number {
  const posCarry = pathOf(events, CARRY);
  const posDiver = pathOf(events, DIVER);
  if (posDiver.length === 0 || posCarry.length === 0) {
    // No pos stream: fall back to "a melee was placed in r=3 of a carry for the whole short lab"
    // only counting a dive if the placement itself satisfies (2) at t>perception. The caller
    // still requires peel_start for a pass on the single-game tests.
    return 0;
  }
  const ticks = new Set(posDiver.map((p) => p.tick));
  let dives = 0;
  let active = false;
  for (const tick of [...ticks].sort((a, b) => a - b)) {
    const d = posDiver.find((p) => p.tick === tick);
    const c = posCarry.find((p) => p.tick === tick);
    if (!d || !c) continue;
    const inRange = dist(d, c) <= 3.0;
    // Perception: Decision 70 → delay 0.32 s (L952–956, proposal). Count from tick ≥ 5 (t=0.5).
    if (inRange && tick >= 5 && !active) {
      dives += 1;
      active = true;
    }
    if (!inRange) active = false;
  }
  return dives;
}

describe("Auto-peel (§9.5 L1147–1160, M2-22 L1735)", () => {
  it("a constructed melee dive within 3 tiles of an allied Marksman emits peel_start naming the peeler, carry, and diver", () => {
    const r = diveScene(20261122);
    const peels = r.of("peel_start");
    expect(peels.length).toBeGreaterThan(0);
    const e = peels[0]!;
    expect(e.carry_id === CARRY || e.carry_id === PEELER).toBe(true);
    expect(e.diver_id).toBe(DIVER);
    expect(e.peeler_id === PEELER || e.peeler_id === TANK).toBe(true);
  });

  it("no peel_start when nobody is diving (all sides far apart)", () => {
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

  it("M2 preview lab: peel_start fires in ≥ 70% of reconstructed dives over 400 seeds; denominator is recorded and must be > 0 (L1160, L1735; fail if unmeasured)", () => {
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
        },
      });
      const r = simulate(cfg);
      const dives = reconstructedDives(r.events);
      const peels = r.events.filter((e) => e.type === "peel_start").length;
      eligible += dives;
      // A peel in a game with a reconstructed dive counts as a fire on that dive.
      if (dives > 0 && peels > 0) fired += Math.min(peels, dives);
    }
    // Bound for the report / QA: denominator recorded.
    // eslint-disable-next-line no-console
    console.log(`S2 peel preview lab: peel_start=${fired} denominator=${eligible} rate=${eligible ? fired / eligible : "unmeasured"} N=${N}`);
    expect(eligible, "denominator must be recorded and > 0 — an unmeasured peel rate is a fail (sandbox §11 S2)").toBeGreaterThan(0);
    expect(fired / eligible).toBeGreaterThanOrEqual(0.7);
  }, 120_000);
});
