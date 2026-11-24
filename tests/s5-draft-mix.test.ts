/**
 * Lab quick-draft mix: consecutive seeds must not correlate.
 * Catches the bare-xorshift + role-fill defect (isra 0/100, six champs 100/100).
 */
import { describe, expect, it } from "vitest";
import {
  QUICK_DRAFT_POOL,
  quickDraftPicks,
} from "../apps/lab/lib/batch-runner.js";

describe("S5 quickDraftPicks mix", () => {
  it("is deterministic per seed", () => {
    const a = quickDraftPicks(20261122);
    const b = quickDraftPicks(20261122);
    expect(a).toEqual(b);
    expect([...a.blue, ...a.red]).toHaveLength(10);
    expect(new Set([...a.blue, ...a.red]).size).toBe(10);
  });

  it("over 100 consecutive seeds, every champ appearance is in [55, 90]", () => {
    // Each seed deals 10 of 14 champs → P(appear) = 10/14 ≈ 0.714.
    // E[count] = 100 × 10/14 ≈ 71.4; σ ≈ √(100 × p × (1−p)) ≈ 4.5.
    // Band [55, 90] ≈ mean ± 3.5σ: fails the old defect (0 or 100) while
    // staying loose enough for CI noise. Uniform ~143/champ needs N≈200
    // games (200 × 10/14); this 100-seed check is the mix smoke test.
    const start = 20261122;
    const counts = Object.fromEntries(
      QUICK_DRAFT_POOL.map((c) => [c, 0]),
    ) as Record<string, number>;

    for (let i = 0; i < 100; i++) {
      const { blue, red } = quickDraftPicks(start + i);
      for (const c of new Set([...blue, ...red])) {
        counts[c]! += 1;
      }
    }

    for (const c of QUICK_DRAFT_POOL) {
      const n = counts[c]!;
      expect(
        n,
        `${c} appearances=${n} outside [55, 90] (counts=${JSON.stringify(counts)})`,
      ).toBeGreaterThanOrEqual(55);
      expect(n).toBeLessThanOrEqual(90);
    }
  });
});
