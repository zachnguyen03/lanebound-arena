/**
 * Chase stops (M2 test 21; §9.4 L1143; §9.6 L1164; sandbox §11 S2).
 * Each case first requires that a chase actually started (intent Chase, or Approach
 * toward the fleeing target). A sim that never chases must not pass the stop clause.
 *
 * est_ttk > 2.0 s is not tested here — the est_ttk / dps_est formula is an open question.
 */
import { describe, expect, it } from "vitest";
import { dist, inRedSanctuary, pathOf, runAi, type UId } from "./_harness.js";

const CHASER = "blue:mid" as UId; // Kerrig in the default blue mid pick, melee assassin
const FLEE = "red:adc" as UId;

describe("Chase stops (§9.4 L1143, §9.6 L1164, Hunt §9.2 L1109 / §12 L1349)", () => {
  it("chase begins under Hunt, then stops when the target enters their sanctuary; the chaser never enters the enemy pad", () => {
    const r = runAi({
      T: 8.0,
      pos: true,
      tactics: { blue: { preset: "hunt" }, red: { preset: "hunt" } },
      units: {
        [CHASER]: { champ: "kerrig", level: 7, x: 16, y: 8, auto: true },
        [FLEE]: { champ: "maelis", level: 7, x: 18, y: 8, hp: 200, auto: false },
      },
      motor: { [FLEE]: { to: [[22.6, 8]], arrive_r: 0.2, hold_at_end: true } },
    });
    const chaseIntents = r.of("intent", (e) => e.unit_id === CHASER && (e.intent === "Chase" || e.intent === "Approach"));
    expect(chaseIntents.length).toBeGreaterThan(0);
    const path = pathOf(r.events, CHASER);
    expect(path.length).toBeGreaterThan(0);
    expect(path.every((p) => !inRedSanctuary(p.x))).toBe(true);
    const targetPath = pathOf(r.events, FLEE);
    const entered = targetPath.find((p) => inRedSanctuary(p.x));
    expect(entered).toBeTruthy();
    const after = r.of(
      "intent",
      (e) => e.unit_id === CHASER && (e.t as number) >= (entered!.t + 0.3) && e.intent === "Chase",
    );
    expect(after).toHaveLength(0);
  });

  it("chase begins, then stops after the chaser has travelled 10 tiles from the point chase began (§9.4 L1143)", () => {
    const start = { x: 6, y: 4 };
    const r = runAi({
      T: 10.0,
      pos: true,
      tactics: { blue: { preset: "hunt" } },
      units: {
        [CHASER]: { champ: "kerrig", level: 7, x: start.x, y: start.y, auto: true },
        [FLEE]: { champ: "maelis", level: 7, x: 8, y: 4, hp: 200, auto: false },
      },
      motor: { [FLEE]: { to: [[20, 4]], arrive_r: 0.2, hold_at_end: true } },
    });
    const chase = r.of("intent", (e) => e.unit_id === CHASER && (e.intent === "Chase" || e.intent === "Approach"));
    expect(chase.length).toBeGreaterThan(0);
    const firstChaseT = chase[0]!.t as number;
    const path = pathOf(r.events, CHASER);
    const origin = path.find((p) => p.t >= firstChaseT - 1e-9) ?? { x: start.x, y: start.y, t: firstChaseT, tick: 0 };
    const travelled = path.filter((p) => p.t >= origin.t).map((p) => dist(p, origin));
    expect(Math.max(...travelled, 0)).toBeGreaterThan(2); // actually chased some distance
    // 10-tile leash, plus a small body-radius slack so a 0.4 body overshoot is not a fail.
    expect(Math.max(...travelled, 0)).toBeLessThanOrEqual(10.5);
    const lateChase = r.of(
      "intent",
      (e) => e.unit_id === CHASER && (e.t as number) >= firstChaseT + 10 / 3.0 + 0.5 && e.intent === "Chase",
    );
    // 10 tiles at ~3.3 MS is ~3 s; after that the intent must not stay Chase.
    expect(lateChase).toHaveLength(0);
  });
});
