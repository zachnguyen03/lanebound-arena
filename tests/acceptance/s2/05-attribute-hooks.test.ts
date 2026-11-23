/**
 * The six in-match attribute hooks (§8.4 L922–1048), minus anything that needs
 * zone or orbs (those are in DEFERRED.md).
 *
 * Aim vs Reflexes itself is already an S1 official test (11-aim-skillshots, L929).
 * This file adds the mastery scale on that hook, plus Execution / Positioning / Teamwork
 * behaviours that become observable once the Unit Brain exists. The greener-local
 * freelance and disengage-always-followed cases live in 10-gd-rulings-r4.test.ts.
 */
import { describe, expect, it } from "vitest";
import { PIT, cluster, runAi, type UId } from "./_harness.js";

const HUNTER = "blue:adc" as UId;
const TARGET = "red:adc" as UId;
const KERRIG = "blue:mid" as UId;
const FOE = "red:mid" as UId;

function skillshotHits(mastery: number, n = 400, seed = 20261122): number {
  const r = runAi({
    seed,
    T: 2.0,
    units: {
      [HUNTER]: { champ: "huntress", level: 7, x: 10, y: 4, attrs: { aim: 60 }, mastery },
      [TARGET]: { champ: "maelis", level: 7, x: 13, y: 4, attrs: { reflexes: 60 } },
    },
    skillshots: [{ tick: 5, source: HUNTER, target: TARGET, count: n }],
  });
  return r.of("hit", (e) => e.source_id === HUNTER && e.target_id === TARGET && e.miss !== true).length;
}

describe("Mastery scales eff_Aim (§8.3 L899–908, used by the Aim hook L924–929)", () => {
  it("mastery 100 vs 50 on the same Aim 60 / Reflexes 60 skillshot batch raises the hit count toward the authored 62.5% (from 55%)", () => {
    // mastery 50 → mod 0 → 55% of 400 ≈ 220. mastery 100 → mod +7.5 → hit% = 62.5% ≈ 250.
    // A ±7-point band (S1 11-aim-skillshots style) still separates 55 from 62.5.
    const at50 = skillshotHits(50);
    const at100 = skillshotHits(100);
    expect(at50).toBeGreaterThan(0);
    expect(at100).toBeGreaterThan(at50);
    expect(at100 / 400).toBeGreaterThan(0.55);
  });
});

describe("Execution — authored setup before the finisher (§8.4 L998, Kerrig notes L730, L1713 item 7)", () => {
  it("eff_Execution ≥ 45: after Kerrig Q is on cooldown, he does not fire R without a live mark", () => {
    const r = runAi({
      T: 4.0,
      units: {
        [KERRIG]: { champ: "kerrig", level: 7, x: 11, y: 4, auto: false, attrs: { execution: 80 }, mastery: 50 },
        [FOE]: { champ: "maelis", level: 7, x: 13, y: 4, auto: false },
      },
      casts: [{ tick: 2, by: KERRIG, skill: "Q", target: FOE, force_hit: false }],
    });
    // Scripted Q with force_hit false may miss and not apply a mark; regardless, low wait:
    // high Execution must not start R while Q is down and no mark is live (L998).
    const isR = (e: { type: string; [k: string]: unknown }) => e.skill === "R" || e.skill_id === "R";
    const rAfterQ = r.of("cast_start", (e) => e.unit_id === KERRIG && e.tick > 2 && isR(e));
    const fizzles = r.of("skill_fizzle", (e) => e.unit_id === KERRIG);
    expect(rAfterQ).toHaveLength(0);
    expect(fizzles).toHaveLength(0);
  });

  it("eff_Execution < 45: after Kerrig Q is on cooldown and will not be ready within 0.5 s, he fires R anyway and it fizzles without a mark (L998)", () => {
    const r = runAi({
      T: 4.0,
      units: {
        [KERRIG]: { champ: "kerrig", level: 7, x: 11, y: 4, auto: false, attrs: { execution: 30 }, mastery: 50 },
        [FOE]: { champ: "maelis", level: 7, x: 13, y: 4, auto: false },
      },
      casts: [{ tick: 2, by: KERRIG, skill: "Q", target: FOE, force_hit: false }],
    });
    const rAfterQ = r.of(
      "cast_start",
      (e) => e.unit_id === KERRIG && e.tick > 2 && (e.skill === "R" || e.skill_id === "R"),
    );
    const fizzles = r.of("skill_fizzle", (e) => e.unit_id === KERRIG);
    expect(rAfterQ.length + fizzles.length).toBeGreaterThan(0);
  });
});

describe("Positioning — backliner hold distance (§8.4 L1025)", () => {
  it("a Marksman with Positioning 90 holds farther from a close threat than one with Positioning 20 (same seed, same threat)", () => {
    const scene = (positioning: number) =>
      runAi({
        seed: 20261122,
        T: 5.0,
        pos: true,
        units: {
          [HUNTER]: { champ: "huntress", level: 7, x: 10, y: 4, auto: true, attrs: { positioning } },
          [TARGET]: { champ: "kerrig", level: 7, x: 12, y: 4, auto: true, range: 2 },
        },
      });
    const low = scene(20);
    const high = scene(90);
    // Must have actually moved or kited — a parked sim must not pass.
    expect(high.of("intent", (e) => e.unit_id === HUNTER).length + high.of("pos", (e) => e.unit_id === HUNTER).length).toBeGreaterThan(0);
    const meanDist = (r: ReturnType<typeof runAi>) => {
      const pts = r.of("pos", (e) => e.unit_id === HUNTER);
      const threat = r.of("pos", (e) => e.unit_id === TARGET);
      const ds: number[] = [];
      for (const p of pts) {
        const t = threat.find((q) => q.tick === p.tick);
        if (t) ds.push(Math.hypot((p.x as number) - (t.x as number), (p.y as number) - (t.y as number)));
      }
      return ds.length ? ds.reduce((s, x) => s + x, 0) / ds.length : 0;
    };
    expect(meanDist(high)).toBeGreaterThan(meanDist(low));
  });
});

describe("Teamwork — follow the L1 focus (R #4 S2-R4-2 L1926, §8.4 L1039–1046)", () => {
  it("Teamwork 90, otherwise equal targets: once a fight_call names a focus_id, this unit follows that focus (call 1.30 beats local 1.00 when the rest of priority is equal)", () => {
    const r = runAi({
      T: 4.0,
      units: cluster(PIT, [
        { id: "blue:mid" as UId, champ: "huntress", attrs: { teamwork: 90, decision: 90 } },
        { id: "blue:adc" as UId, champ: "huntress", auto: true, attrs: { teamwork: 90 } },
        { id: "blue:jungle" as UId, champ: "huntress", attrs: { teamwork: 90 } },
        { id: "red:mid" as UId, champ: "maelis" },
        { id: "red:jungle" as UId, champ: "maelis" },
        { id: "red:adc" as UId, champ: "maelis" },
      ]),
    });
    const call = r.fightCalls("blue").find((e) => typeof e.focus_id === "string");
    expect(call).toBeTruthy();
    const focus = call!.focus_id as UId;
    const laterHits = r.of(
      "hit",
      (e) => e.source_id === ("blue:adc" as UId) && (e.t as number) >= (call!.t as number) && e.skill_id === "auto",
    );
    const laterIntent = r.of(
      "intent",
      (e) => e.unit_id === ("blue:adc" as UId) && (e.t as number) >= (call!.t as number) && e.target_id != null,
    );
    expect(laterHits.length + laterIntent.length).toBeGreaterThan(0);
    const aimed = [...laterHits, ...laterIntent];
    expect(aimed.every((e) => e.target_id === focus)).toBe(true);
  });
});
