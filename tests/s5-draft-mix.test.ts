/**
 * R7-11 role-random draft (M6 Scope): one champ per Position per team,
 * uniform within Position pools from champion data; cross-team dupes OK.
 */
import { describe, expect, it } from "vitest";
import { CHAMPIONS, type Slot } from "../data/champions/defs.js";
import {
  DRAFT_SLOTS,
  labDraftUnit,
  mirroredPositionCount,
  positionPoolsFromData,
  quickDraftPicks,
} from "../apps/lab/lib/batch-runner.js";

/** Per-game appearance: 1 − ((n−1)/n)². Mirror-at-Position: 1/n. */
const EXPECTED_APPEAR: Record<Slot, number> = {
  top: 0.75,
  support: 0.75,
  jungle: 5 / 9, // ≈ 0.555…
  adc: 5 / 9,
  mid: 7 / 16, // 0.4375
};
const EXPECTED_MIRROR: Record<Slot, number> = {
  top: 0.5,
  support: 0.5,
  jungle: 1 / 3,
  adc: 1 / 3,
  mid: 0.25,
};

describe("S5 quickDraftPicks R7-11", () => {
  it("builds Position pools from champion data with R7-11 sizes", () => {
    const pools = positionPoolsFromData();
    expect(pools.top).toHaveLength(2);
    expect(pools.jungle).toHaveLength(3);
    expect(pools.mid).toHaveLength(4);
    expect(pools.adc).toHaveLength(3);
    expect(pools.support).toHaveLength(2);
    for (const slot of DRAFT_SLOTS) {
      for (const id of pools[slot]) {
        expect(CHAMPIONS[id]!.default_slot).toBe(slot);
      }
    }
  });

  it("is deterministic per seed", () => {
    const a = quickDraftPicks(20261122);
    const b = quickDraftPicks(20261122);
    expect(a).toEqual(b);
    expect(a.blue).toHaveLength(5);
    expect(a.red).toHaveLength(5);
  });

  it("seeded large-N: appearance ≈ Top/Support 75%, Jungle/ADC 55.6%, Mid 43.75%; mirror ≈ 50/33.3/25%; invariants hold", () => {
    // N=8000 seeds → σ_appear ≤ √(0.75·0.25/8000) ≈ 0.0048; ±2.5 pp band.
    const N = 8000;
    const start = 20261122;
    const pools = positionPoolsFromData();
    const appear = Object.fromEntries(
      Object.keys(CHAMPIONS).map((id) => [id, 0]),
    ) as Record<string, number>;
    const mirrorHits: Record<Slot, number> = {
      top: 0,
      jungle: 0,
      mid: 0,
      adc: 0,
      support: 0,
    };

    for (let i = 0; i < N; i++) {
      const { blue, red } = quickDraftPicks(start + i);

      // Structural invariants every game.
      expect(blue).toHaveLength(5);
      expect(red).toHaveLength(5);
      for (let s = 0; s < DRAFT_SLOTS.length; s++) {
        const slot = DRAFT_SLOTS[s]!;
        expect(pools[slot]).toContain(blue[s]!);
        expect(pools[slot]).toContain(red[s]!);
        expect(CHAMPIONS[blue[s]!]!.default_slot).toBe(slot);
        expect(CHAMPIONS[red[s]!]!.default_slot).toBe(slot);
      }
      // No two of one Position on a team (slot uniqueness by construction).
      expect(new Set(blue.map((_, i) => DRAFT_SLOTS[i])).size).toBe(5);
      expect(new Set(red.map((_, i) => DRAFT_SLOTS[i])).size).toBe(5);

      const seen = new Set([...blue, ...red]);
      for (const id of seen) appear[id]! += 1;

      for (let s = 0; s < DRAFT_SLOTS.length; s++) {
        if (blue[s] === red[s]) mirrorHits[DRAFT_SLOTS[s]!]! += 1;
      }

      const m = mirroredPositionCount(blue, red);
      expect(m).toBeGreaterThanOrEqual(0);
      expect(m).toBeLessThanOrEqual(5);
    }

    const tol = 0.025;
    for (const slot of DRAFT_SLOTS) {
      const pool = pools[slot];
      const expA = EXPECTED_APPEAR[slot];
      const expM = EXPECTED_MIRROR[slot];
      for (const id of pool) {
        const rate = appear[id]! / N;
        expect(
          Math.abs(rate - expA),
          `${id} (${slot}) appear=${rate.toFixed(4)} expected≈${expA}`,
        ).toBeLessThanOrEqual(tol);
      }
      const mRate = mirrorHits[slot]! / N;
      expect(
        Math.abs(mRate - expM),
        `${slot} mirror=${mRate.toFixed(4)} expected≈${expM}`,
      ).toBeLessThanOrEqual(tol);
    }

    // Sanity: labDraftUnit is consumed (not a no-op).
    expect(labDraftUnit(1)()).not.toBe(labDraftUnit(2)());
  });
});
