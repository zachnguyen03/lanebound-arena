import { describe, expect, it } from "vitest";
import { rollAimHits } from "../sim/fixture.js";
import { hitChance } from "../sim/stats.js";

const N = 2000;
const SEED = 20261122;
const TOL = 0.02; // ±2 percentage points

describe("M1-19b Aim vs Reflexes", () => {
  it("formula pins 55/85/25%", () => {
    expect(hitChance(60, 60)).toBeCloseTo(0.55, 12);
    expect(hitChance(90, 60)).toBeCloseTo(0.85, 12);
    expect(hitChance(60, 90)).toBeCloseTo(0.25, 12);
  });

  it("60 vs 60 → ~55% ±2 over 2000 rolls; identical replay digest", () => {
    const a = rollAimHits(SEED, 60, 60, N);
    const b = rollAimHits(SEED, 60, 60, N);
    expect(a.hitChance).toBeCloseTo(0.55, 12);
    expect(Math.abs(a.rate - 0.55)).toBeLessThanOrEqual(TOL);
    expect(a.replayDigest).toBe(b.replayDigest);
    expect(a.hits).toBe(b.hits);
  });

  it("90 vs 60 → ~85% ±2 over 2000 rolls; identical replay digest", () => {
    const a = rollAimHits(SEED, 90, 60, N);
    const b = rollAimHits(SEED, 90, 60, N);
    expect(a.hitChance).toBeCloseTo(0.85, 12);
    expect(Math.abs(a.rate - 0.85)).toBeLessThanOrEqual(TOL);
    expect(a.replayDigest).toBe(b.replayDigest);
  });

  it("60 vs 90 → ~25% ±2 over 2000 rolls; identical replay digest", () => {
    const a = rollAimHits(SEED, 60, 90, N);
    const b = rollAimHits(SEED, 60, 90, N);
    expect(a.hitChance).toBeCloseTo(0.25, 12);
    expect(Math.abs(a.rate - 0.25)).toBeLessThanOrEqual(TOL);
    expect(a.replayDigest).toBe(b.replayDigest);
  });

  it("seed+1 differs from base seed replay digest", () => {
    const a = rollAimHits(SEED, 60, 60, N);
    const b = rollAimHits(SEED + 1, 60, 60, N);
    expect(a.replayDigest).not.toBe(b.replayDigest);
  });
});
