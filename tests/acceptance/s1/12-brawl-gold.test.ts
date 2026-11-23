/**
 * Gold-pinned scripted 10-champion combat match per seed, through the real loop (spec M1 'headless mid-fight tests can pin two teams in a box' L1706).
 * Assertions that do NOT depend on the implementation's numbers: there IS combat (hits, casts, status, deaths > 0), it replays bit-identically,
 * and the digest equals the pinned value in gold/s1-brawl-digests.json. The pinned digest is the ONLY value the implementing agent may edit
 * (it is an output of the sim, not an expectation derived from the spec). null = not pinned yet → test fails with the observed digest.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { lazy, run, type Scenario, type UId } from "./_harness.js";

const gold: Record<string, string | null> = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "gold", "s1-brawl-digests.json"), "utf8"));

const BLUE: [UId, string][] = [["blue:top", "rhedan"], ["blue:jungle", "torun"], ["blue:mid", "mirren"], ["blue:adc", "huntress"], ["blue:support", "ysol"]];
const RED: [UId, string][] = [["red:top", "brannoch"], ["red:jungle", "tolle"], ["red:mid", "kerrig"], ["red:adc", "isra"], ["red:support", "saelo"]];
export function brawl(seed: number): Scenario {
  const units: Scenario["units"] = {}; const casts: NonNullable<Scenario["casts"]> = [];
  const place = (list: [UId, string][], x: number) => list.forEach(([id, champ], i) => { units[id] = { champ, level: 7, x, y: 6 + i * 1.0, auto: true, hp: { frac: 0.35 } }; });
  place(BLUE, 8.5); place(RED, 11.5);
  const foe = (id: UId) => (id.startsWith("blue") ? RED : BLUE)[Number(["top", "jungle", "mid", "adc", "support"].indexOf(id.split(":")[1]!))]![0];
  const pos = (id: UId) => [units[id]!.x, units[id]!.y] as [number, number];
  for (const [id] of [...BLUE, ...RED]) {
    const f = foe(id); const alliesFoeAim = pos(f);
    casts.push({ tick: 5, by: id, key: "Q", target: f, aim: alliesFoeAim }, { tick: 30, by: id, key: "W", target: f, aim: alliesFoeAim }, { tick: 60, by: id, key: "R", target: f, aim: alliesFoeAim });
  }
  return { seed, T: 25, units, casts, abs: true };
}
describe("Scripted 10-champion brawl (all kits live, autos on, hp 35%) — one per seed", () => {
  for (const seed of [20261122, 20261123]) {
    const RR = lazy(() => run(brawl(seed)));
    it(`seed ${seed}: there is real combat — cast_start, hit, status_apply and death events all exist`, () => {
      const r = RR();
      expect(r.of("cast_start").length).toBeGreaterThan(10);
      expect(r.of("hit").length).toBeGreaterThan(10);
      expect(r.of("status_apply").length).toBeGreaterThan(0);
      expect(r.of("death").length).toBeGreaterThan(0);
      expect(r.autoHits("blue:adc").length + r.autoHits("red:adc").length).toBeGreaterThan(0);
    });
    it(`seed ${seed}: replays identically in-process (same digest)`, () => { expect(run(brawl(seed)).digest).toBe(RR().digest); });
    it(`seed ${seed}: digest equals the pinned gold (gold/s1-brawl-digests.json)`, () => {
      const r = RR();
      expect(gold[String(seed)], `PIN ME: seed ${seed} digest is ${r.digest}`).not.toBeNull();
      expect(r.digest).toBe(gold[String(seed)]);
    });
  }
  it("the two seeds produce different digests", () => { expect(run(brawl(20261122)).digest).not.toBe(run(brawl(20261123)).digest); });
});
