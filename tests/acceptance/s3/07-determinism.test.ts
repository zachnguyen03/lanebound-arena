/**
 * Determinism of a full S3 match (M0-1 L1699; M3 + plan §8.4 S3 L366;
 * sandbox §11 S3 L629; G10 L1891; §4.4 L196).
 *
 * Two-process digest equality is required for seeds 20261122 and 20261123
 * with forced_clock_end: false (real §5.8 end, including the Bo1 coin if
 * the default even game stays 0–0). seed+1 must differ. The digest must
 * include S3 events (orb_spawn at t=8.0) once scoring is live.
 *
 * Not pinned to the S1 gold — new orb / zone / buff / end-reason events
 * will change the full digest. The AI-off S1 subsequence lives in
 * 08-s1-regression.test.ts.
 */
import { describe, expect, it } from "vitest";
import {
  defaultEvenConfig,
  digestEvents,
  digestFromChild,
  simulate,
  type S3MatchConfig,
} from "./_harness.js";

const SEEDS = [20261122, 20261123] as const;

function fullEven(seed: number): S3MatchConfig {
  const cfg = defaultEvenConfig(seed);
  cfg.forced_clock_end = false;
  return cfg;
}

describe("Two-process / two-call digest identity — seeds 20261122 and 20261123 (G10 L1891, §4.4 L196)", () => {
  it.each(SEEDS)(
    "two in-process simulate() calls on the full S3 even match agree for seed %i",
    (seed) => {
      const cfg = fullEven(seed);
      const a = simulate(cfg);
      const b = simulate(cfg);
      expect(a.digest).toBe(b.digest);
      expect(a.constants_hash).toBe(b.constants_hash);
      expect(a.digest).toMatch(/^[0-9a-f]{64}$/);
    },
  );

  it.each(SEEDS)(
    "two separate Node processes agree on the full S3 even-match digest for seed %i",
    (seed) => {
      const a = digestFromChild({ seed, full: true });
      const b = digestFromChild({ seed, full: true });
      expect(a.digest).toBe(b.digest);
      expect(a.constants_hash).toBe(b.constants_hash);
      const inProc = simulate(fullEven(seed));
      expect(inProc.digest).toBe(a.digest);
    },
    180_000,
  );

  it("seed 20261123 differs from seed 20261122 on the full S3 even match", () => {
    const a = simulate(fullEven(20261122));
    const b = simulate(fullEven(20261123));
    expect(b.digest).not.toBe(a.digest);
  });
});

describe("plan §8.4 S3 L366 / sandbox L629 — a full match ends with a digest and S3 events", () => {
  it("the default even match with forced_clock_end false reaches match_end with a legal reason and a 64-hex digest", () => {
    const r = simulate(fullEven(20261122));
    const end = r.events.find((e) => e.type === "match_end");
    expect(end).toBeDefined();
    expect(["first_to_10", "clock", "sudden_death", "zone_time", "takedowns", "coin_flip"]).toContain(
      end!.reason,
    );
    expect(end!.winner === "blue" || end!.winner === "red").toBe(true);
    expect(r.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(r.state.ended).toBe(true);
  });

  it("a full even match emits the first orb wave at t=8.0 (S3 is live; M3-28 L1750)", () => {
    const r = simulate(fullEven(20261122));
    const orbs = r.events.filter((e) => e.type === "orb_spawn" && Math.abs((e.t as number) - 8.0) < 1e-9);
    expect(orbs).toHaveLength(8);
  });

  it("one additional random-seed full match (4242) ends with match_end and a digest (plan L366)", () => {
    const r = simulate(fullEven(4242));
    expect(r.events.some((e) => e.type === "match_end")).toBe(true);
    expect(r.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(r.digest).not.toBe(simulate(fullEven(20261122)).digest);
  });

  it("digestEvents(events) equals result.digest; move and pos stay out (G10 L1891, §4.4 L196)", () => {
    const r = simulate(fullEven(20261122));
    expect(digestEvents(r.events)).toBe(r.digest);
    const stripped = r.events.filter((e) => e.type !== "move" && e.type !== "pos");
    expect(digestEvents(stripped)).toBe(r.digest);
  });
});
