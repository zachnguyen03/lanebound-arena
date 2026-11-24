/**
 * M1-19c — Skillshot vs a disabled target (ruling K-2).
 * Spec §8.4 L935–944, test definition L1927.
 *
 * Behind LB_M2: bb4cb63 lacks K-2, so default npm test stays green.
 * Leave M1-19b (11-aim-skillshots.test.ts) unchanged.
 *
 *   LB_M2=1 npx vitest run tests/acceptance/m1-19c-disabled-skillshot.test.ts
 */
import { describe, expect, it } from "vitest";
import { LB_M2 } from "./_m2_gate.js";
import { run, type UId } from "./s1/_harness.js";

const S = "blue:adc" as UId;
const T = "red:adc" as UId;

const attrs = (aim: number, refl: number) => ({
  aim,
  reflexes: refl,
  execution: 70,
  decision: 70,
  positioning: 70,
  teamwork: 70,
});

/**
 * Target is stunned from tick 1; skillshot rolls fire on tick 2 so the stun
 * is already applied (scripted_cc is phase 9; scripted_skillshots run earlier
 * on the same tick).
 */
function rate(seed: number, aim: number, refl: number, n = 2000) {
  const r = run({
    seed,
    T: 0.4,
    units: {
      [S]: { champ: "huntress", level: 7, x: 6, y: 8, attrs: attrs(aim, 70) },
      [T]: { champ: "maelis", level: 7, x: 7, y: 8, attrs: attrs(70, refl) },
    },
    cc: [{ tick: 1, target: T, kind: "stun", duration: 5.0, source: S }],
    skillshots: [{ tick: 2, source: S, target: T, count: n }],
  });
  const rolls = r.of("skillshot_roll");
  const stuns = r.status(T, "stun");
  return {
    rate: rolls.length ? rolls.filter((e) => e.hit === true).length / rolls.length : NaN,
    n: rolls.length,
    stunned: stuns.length > 0,
    r,
  };
}

describe.skipIf(!LB_M2)(
  "M1-19c: skillshot vs stunned target — Aim-only disabled curve over 2,000 rolls, ±2 points (spec L935–944, L1927)",
  () => {
    // Worked values L941 / L1927: Aim 30→70%, 60→80%, 70→90%, 90→95%.
    const cases: Array<[number, number]> = [
      [30, 0.7],
      [60, 0.8],
      [70, 0.9],
      [90, 0.95],
    ];
    const seeds = [20261122, 20261123, 7, 99, 424242];

    for (const [aim, p] of cases) {
      for (const refl of [30, 90] as const) {
        for (const seed of seeds) {
          it(`aim ${aim} vs stunned reflexes ${refl} → ${p * 100}% (seed ${seed})`, () => {
            const x = rate(seed, aim, refl);
            expect(x.stunned, "target must be stunned before the rolls").toBe(true);
            expect(x.n).toBe(2000);
            expect(Math.abs(x.rate - p)).toBeLessThanOrEqual(0.02);
          });
        }
      }
    }

    it("identical at target Reflexes 30 and 90 for the same Aim and seed", () => {
      for (const aim of [30, 60, 70, 90]) {
        const a = rate(20261122, aim, 30, 2000);
        const b = rate(20261122, aim, 90, 2000);
        expect(a.n).toBe(2000);
        expect(b.n).toBe(2000);
        expect(a.r.of("skillshot_roll").map((e) => e.hit)).toEqual(
          b.r.of("skillshot_roll").map((e) => e.hit),
        );
        expect(Math.abs(a.rate - b.rate)).toBeLessThanOrEqual(1e-12);
      }
    });

    it("the same seed replays identically (rolls and digest); a different seed differs", () => {
      const a = rate(20261122, 60, 30, 500);
      const b = rate(20261122, 60, 30, 500);
      const c = rate(20261123, 60, 30, 500);
      expect(a.r.digest).toBe(b.r.digest);
      expect(a.r.of("skillshot_roll").map((e) => e.hit)).toEqual(
        b.r.of("skillshot_roll").map((e) => e.hit),
      );
      expect(c.r.of("skillshot_roll").map((e) => e.hit)).not.toEqual(
        a.r.of("skillshot_roll").map((e) => e.hit),
      );
    });
  },
);
