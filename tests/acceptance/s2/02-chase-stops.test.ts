/**
 * Chase stops (M2 test 21; §9.4 L1143; §9.6 L1164; sandbox §11 S2).
 * Each case first requires that a chase actually started (intent Chase, or Approach
 * toward the fleeing target). A sim that never chases must not pass the stop clause.
 *
 * The third stop — est_ttk > 2.0 s — is tested after the leash case (R #3 S2-5 L1915).
 * The test does not compute or assert an exact A_true or dummy-5s dps_est.
 * After a stop, Chase, Approach, and Kite toward that target are all rejected
 * (§9.4 L1143: revert to planner). Timing uses one planner tick (1.0 s, §9.2 L1105),
 * not a 0.5 s acceptance grace.
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
    const afterT = entered!.t + 0.3;
    const toward = r.of(
      "intent",
      (e) =>
        e.unit_id === CHASER &&
        (e.t as number) >= afterT &&
        (e.intent === "Chase" || e.intent === "Approach" || e.intent === "Kite") &&
        (e.target_id == null || e.target_id === FLEE),
    );
    expect(toward).toHaveLength(0);
    // Distance trend: after the target is in sanctuary, the chaser does not
    // keep closing on them (Approach/Kite toward the pad would still fail this).
    const afterPath = path.filter((p) => p.t >= afterT);
    const tgtAfter = targetPath.filter((p) => p.t >= afterT);
    if (afterPath.length >= 2 && tgtAfter.length >= 1) {
      const d0 = dist(afterPath[0]!, tgtAfter[0]!);
      const lastCh = afterPath[afterPath.length - 1]!;
      const lastT = tgtAfter.find((q) => q.tick === lastCh.tick) ?? tgtAfter[tgtAfter.length - 1]!;
      expect(dist(lastCh, lastT)).toBeGreaterThanOrEqual(d0 - 0.4);
    }
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

  it("R #3 S2-5 L1915 / §9.4 L1143: chase begins, then stops when est_ttk > 2.0 s (dummy 5 s dps_est; no exact A_true)", () => {
    // L1 assassin vs a full-HP L10 tank standing still, already within 8 tiles.
    // Dummy 5 s damage of a level-1 kit (R not included: level < 5) cannot empty
    // a L10 tank in 2 s, so est_ttk > 2. The tank never enters sanctuary and the
    // gap is well under the 10-tile leash, so those two stops do not fire first.
    const r = runAi({
      T: 6.0,
      pos: true,
      tactics: { blue: { preset: "hunt" } },
      units: {
        [CHASER]: { champ: "kerrig", level: 1, x: 12, y: 4, auto: true },
        [FLEE]: { champ: "brannoch", level: 10, x: 14, y: 4, auto: false },
      },
      motor: { [FLEE]: { to: [[14, 4]], arrive_r: 0.2, hold_at_end: true } },
    });
    const chase = r.of("intent", (e) => e.unit_id === CHASER && (e.intent === "Chase" || e.intent === "Approach"));
    expect(chase.length).toBeGreaterThan(0);
    const firstChaseT = chase[0]!.t as number;
    const path = pathOf(r.events, CHASER);
    const origin = path.find((p) => p.t >= firstChaseT - 1e-9) ?? { x: 12, y: 4, t: firstChaseT, tick: 0 };
    const travelled = path.filter((p) => p.t >= origin.t).map((p) => dist(p, origin));
    expect(Math.max(...travelled, 0)).toBeLessThan(8); // leash must not be the stop
    expect(path.every((p) => !inRedSanctuary(p.x))).toBe(true);
    // Dummy 5 s dps_est vs a L10 tank is already est_ttk > 2 when chase begins
    // (R #3 S2-5). Stop within one planner tick (1.0 s, §9.2 L1105) — no 0.5 s grace.
    const deadline = firstChaseT + 1.0;
    const towardAfter = (tMin: number) =>
      r.of(
        "intent",
        (e) =>
          e.unit_id === CHASER &&
          (e.t as number) >= tMin &&
          (e.intent === "Chase" || e.intent === "Approach" || e.intent === "Kite") &&
          (e.target_id == null || e.target_id === FLEE),
      );
    expect(towardAfter(deadline)).toHaveLength(0);
    const stoppedByDeadline = r.of(
      "intent",
      (e) =>
        e.unit_id === CHASER &&
        (e.t as number) <= deadline + 1e-9 &&
        (e.t as number) >= firstChaseT &&
        e.intent !== "Chase" &&
        e.intent !== "Approach" &&
        e.intent !== "Kite",
    );
    expect(stoppedByDeadline.length).toBeGreaterThan(0);
    const afterPath = path.filter((p) => p.t >= deadline);
    const tgtPath = pathOf(r.events, FLEE).filter((p) => p.t >= deadline);
    if (afterPath.length >= 2 && tgtPath.length >= 1) {
      const d0 = dist(afterPath[0]!, tgtPath[0]!);
      const lastCh = afterPath[afterPath.length - 1]!;
      const lastT = tgtPath.find((q) => q.tick === lastCh.tick) ?? tgtPath[tgtPath.length - 1]!;
      expect(dist(lastCh, lastT)).toBeGreaterThanOrEqual(d0 - 0.4);
    }
  });
});
