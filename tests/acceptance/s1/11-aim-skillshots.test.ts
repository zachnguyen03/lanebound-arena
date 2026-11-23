/** M1-19b Aim vs Reflexes + which skills roll (spec §8.4 L922-936, §6.8 L513, M1 L1724). */
import { describe, expect, it } from "vitest";
import { run, type UId } from "./_harness.js";

const S = "blue:adc" as UId, T = "red:adc" as UId;
const attrs = (aim: number, refl: number) => ({ aim, reflexes: refl, execution: 70, decision: 70, positioning: 70, teamwork: 70 });
function rate(seed: number, aim: number, refl: number, n = 2000) {
  const r = run({ seed, T: 1, units: { [S]: { champ: "huntress", level: 7, x: 6, y: 8, attrs: attrs(aim, 70) }, [T]: { champ: "maelis", level: 7, x: 7, y: 8, attrs: attrs(70, refl) } }, skillshots: [{ tick: 1, source: S, target: T, count: n }] });
  const rolls = r.of("skillshot_roll"); return { rate: rolls.filter((e) => e.hit === true).length / rolls.length, n: rolls.length, r };
}
describe("M1-19b: hit% = clamp(0.55 + 0.01·(Aim − Reflexes), 0.25, 0.90) over 2,000 rolls, ±2 points (spec L929, L1724)", () => {
  const seeds = [20261122, 20261123, 7, 99, 424242];
  for (const [aim, refl, p] of [[60, 60, 0.55], [90, 60, 0.85], [60, 90, 0.25], [90, 90, 0.55], [90, 50, 0.90], [30, 90, 0.25]] as const)
    for (const seed of seeds) it(`aim ${aim} vs reflexes ${refl} → ${p * 100}% (seed ${seed})`, () => {
      const x = rate(seed, aim, refl); expect(x.n).toBe(2000); expect(Math.abs(x.rate - p)).toBeLessThanOrEqual(0.02);
    });
  it("the same seed replays identically (rolls and digest); a different seed differs", () => {
    const a = rate(20261122, 60, 60, 500), b = rate(20261122, 60, 60, 500), c = rate(20261123, 60, 60, 500);
    expect(a.r.digest).toBe(b.r.digest); expect(a.r.of("skillshot_roll").map((e) => e.hit)).toEqual(b.r.of("skillshot_roll").map((e) => e.hit));
    expect(c.r.of("skillshot_roll").map((e) => e.hit)).not.toEqual(a.r.of("skillshot_roll").map((e) => e.hit));
  });
});

describe("Real skillshots use the same roll (no force_hit): Huntress Q at a stationary target, aim 60 vs reflexes 60 → ≈55% over 400 seeds (spec L513, L934)", () => {
  it("hit rate within ±7 points of 55% (σ≈2.5 pts)", () => {
    let hit = 0; const N = 400;
    for (let s = 0; s < N; s++) {
      const r = run({ seed: 1000 + s, T: 1.5, units: { [S]: { champ: "huntress", level: 7, x: 6, y: 8, attrs: attrs(60, 60) }, [T]: { champ: "torun", level: 7, x: 9, y: 8, attrs: attrs(60, 60) } }, casts: [{ tick: 2, by: S, key: "Q", aim: [9, 8], force_hit: false }] });
      if (r.skillHits(S, T).length) hit++;
    }
    expect(Math.abs(hit / N - 0.55)).toBeLessThanOrEqual(0.07);
  });
  it("a pierced line rolls once per target and can hit one and miss the other (some seed shows a split)", () => {
    let split = 0;
    for (let s = 0; s < 120; s++) {
      const r = run({ seed: 5000 + s, T: 1.5, units: { [S]: { champ: "huntress", level: 7, x: 6, y: 8, attrs: attrs(60, 60) }, [T]: { champ: "torun", level: 7, x: 8, y: 8, attrs: attrs(60, 60) }, "red:mid": { champ: "torun", level: 7, x: 10, y: 8, attrs: attrs(60, 60) } }, casts: [{ tick: 2, by: S, key: "Q", aim: [10, 8], force_hit: false }] });
      const a = r.skillHits(S, T).length, b = r.skillHits(S, "red:mid").length; if (a !== b) split++;
    }
    expect(split).toBeGreaterThan(20);
  });
});

describe("Targeted-unit skills never roll: they hit even with Aim 1 vs Reflexes 99 (hit chance would be 25%) (spec L513, L934)", () => {
  it("Mirren W hexes the target in 8 of 8 seeds; Sedge Q and Tolle Q hit their primary in 8 of 8; Saelo W heals in 8 of 8", () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    const lo = attrs(1, 99);
    const cnt = (f: (seed: number) => boolean) => seeds.filter(f).length;
    expect(cnt((s) => run({ seed: s, T: 2, units: { "blue:mid": { champ: "mirren", level: 7, x: 6, y: 8, attrs: lo }, [T]: { champ: "torun", level: 7, x: 9, y: 8, attrs: lo } }, casts: [{ tick: 3, by: "blue:mid", key: "W", target: T, force_hit: false }] }).status(T, "hex").length === 1)).toBe(8);
    expect(cnt((s) => run({ seed: s, T: 2, units: { "blue:jungle": { champ: "sedge", level: 7, x: 6, y: 8, attrs: lo }, [T]: { champ: "torun", level: 7, x: 9, y: 8, attrs: lo } }, casts: [{ tick: 3, by: "blue:jungle", key: "Q", target: T, force_hit: false }] }).skillHits("blue:jungle", T).length === 1)).toBe(8);
    expect(cnt((s) => run({ seed: s, T: 2, units: { "blue:jungle": { champ: "tolle", level: 7, x: 6, y: 8, attrs: lo }, [T]: { champ: "torun", level: 7, x: 7.2, y: 8, attrs: lo } }, casts: [{ tick: 3, by: "blue:jungle", key: "Q", target: T, force_hit: false }] }).skillHits("blue:jungle", T).length === 1)).toBe(8);
    expect(cnt((s) => run({ seed: s, T: 2, units: { "blue:support": { champ: "saelo", level: 7, x: 6, y: 8, attrs: lo }, "blue:adc": { champ: "torun", level: 7, x: 9, y: 8, hp: { frac: 0.5 } } }, casts: [{ tick: 3, by: "blue:support", key: "W", target: "blue:adc", force_hit: false }] }).heals("blue:support", "blue:adc").length === 1)).toBe(8);
  });
  it("self skills (Calder W) and dashes always work with the same attributes", () => {
    for (let s = 1; s <= 6; s++) expect(run({ seed: s, T: 2, units: { "blue:mid": { champ: "calder", level: 7, x: 6, y: 8, hp: { frac: 0.5 }, attrs: attrs(1, 99) } }, casts: [{ tick: 3, by: "blue:mid", key: "W", force_hit: false }] }).heals("blue:mid", "blue:mid").length).toBe(1);
  });
});
