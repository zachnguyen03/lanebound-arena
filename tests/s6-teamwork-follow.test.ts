/**
 * S6 Teamwork follow — Appendix R6-7(d):
 *   local < call × clamp(1 + 0.01·(T − 50), 0.70, 1.40)
 */
import { describe, expect, it } from "vitest";
import { callFollowSlack } from "../sim/ai/attributes.js";
import { shouldFollowFocus } from "../sim/ai/target.js";

describe("R6-7(d) callFollowSlack", () => {
  it("T=50 equals the plain call (multiplier 1.0)", () => {
    expect(callFollowSlack(50)).toBeCloseTo(1.0, 10);
    expect(shouldFollowFocus(10, 9.9, 50)).toBe(true);
    expect(shouldFollowFocus(10, 10, 50)).toBe(false);
    expect(shouldFollowFocus(10, 10.1, 50)).toBe(false);
  });

  it("clamps hit at T=20 (0.70) and T=90 (1.40)", () => {
    expect(callFollowSlack(20)).toBeCloseTo(0.7, 10);
    expect(callFollowSlack(19)).toBeCloseTo(0.7, 10);
    expect(callFollowSlack(1)).toBeCloseTo(0.7, 10);
    expect(callFollowSlack(90)).toBeCloseTo(1.4, 10);
    expect(callFollowSlack(91)).toBeCloseTo(1.4, 10);
    expect(callFollowSlack(99)).toBeCloseTo(1.4, 10);
  });

  it("is monotone non-decreasing in T across 1..99", () => {
    let prev = callFollowSlack(1);
    for (let T = 2; T <= 99; T++) {
      const s = callFollowSlack(T);
      expect(s, `T=${T}`).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = s;
    }
  });

  it("higher T follows more readily (same call/local pair)", () => {
    // local 12 vs call 10: needs slack > 1.2 → T > 70
    expect(shouldFollowFocus(10, 12, 50)).toBe(false);
    expect(shouldFollowFocus(10, 12, 70)).toBe(false); // slack 1.20 → 12 < 12? false
    expect(shouldFollowFocus(10, 12, 71)).toBe(true); // slack 1.21
    expect(shouldFollowFocus(10, 12, 90)).toBe(true);
  });
});
