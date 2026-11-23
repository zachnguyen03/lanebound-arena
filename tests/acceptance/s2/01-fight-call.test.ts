/**
 * L1 Fight Call and fight declaration (M2 test 20; plan §8.4; sandbox §11 S2).
 * Geometry follows Appendix R G9 (L1890), which tightens §5.6 L281.
 * A_true is never asserted to an exact value (spec L1125–1126 allows two dps_est
 * formulas). Escalation tests use identical kits, then either even HP or a large
 * HP swing, which is enough under both formulas.
 */
import { describe, expect, it } from "vitest";
import { COMMITS, PIT, Run, cluster, runAi, type UId } from "./_harness.js";

const BM = "blue:mid" as UId;
const BJ = "blue:jungle" as UId;
const BA = "blue:adc" as UId;
const RM = "red:mid" as UId;
const RJ = "red:jungle" as UId;
const RA = "red:adc" as UId;

const SAME = "huntress";

function tight2v2(hpBlue?: number, hpRed?: number) {
  return cluster(PIT, [
    { id: BM, champ: SAME, hp: hpBlue },
    { id: BA, champ: SAME, hp: hpBlue },
    { id: RM, champ: SAME, hp: hpRed },
    { id: RA, champ: SAME, hp: hpRed },
  ]);
}

function tight3v3(hpBlue?: number, hpRed?: number) {
  return cluster(PIT, [
    { id: BM, champ: SAME, hp: hpBlue },
    { id: BJ, champ: SAME, hp: hpBlue },
    { id: BA, champ: SAME, hp: hpBlue },
    { id: RM, champ: SAME, hp: hpRed },
    { id: RJ, champ: SAME, hp: hpRed },
    { id: RA, champ: SAME, hp: hpRed },
  ]);
}

/** Participants sit ~7 tiles from the centroid (still inside the 8-tile fight radius, outside the 6-tile 2v2 escalate). */
function ringAround(at: { x: number; y: number }, ids: UId[], radius: number) {
  const units: ReturnType<typeof tight2v2> = {};
  ids.forEach((id, i) => {
    const ang = (2 * Math.PI * i) / ids.length;
    units[id] = { champ: SAME, level: 7, x: at.x + radius * Math.cos(ang), y: at.y + radius * Math.sin(ang) };
  });
  return units;
}

function payloadOk(e: ReturnType<Run["fightCalls"]>[number]) {
  expect(e.team === "blue" || e.team === "red").toBe(true);
  expect(typeof e.a_true).toBe("number");
  expect(e.a_true as number).toBeGreaterThan(0);
  expect(e.a_true as number).toBeLessThan(1);
  expect(COMMITS.includes(e.commit as (typeof COMMITS)[number])).toBe(true);
}

describe("Fight declaration and L1 Fight Call (G9 L1890, §5.6 L281, §9.1 L1065–1101)", () => {
  it("G3 L1884: tick 0 is setup only — no fight_call even when a 3v3 is already stacked", () => {
    const r = runAi({ T: 1.0, units: tight3v3() });
    expect(r.of("fight_call", (e) => e.tick === 0)).toHaveLength(0);
  });

  it("M2-20 / §9.1 L1101: 3+ per side always issues a fight_call; first call is after tick 0 and by t=0.6 (see OPEN-QUESTIONS.md on same-tick vs next-tick start)", () => {
    const r = runAi({ T: 1.5, units: tight3v3() });
    const calls = r.fightCalls();
    expect(calls.length).toBeGreaterThan(0);
    const first = calls[0]!;
    expect(first.tick).toBeGreaterThan(0);
    expect(first.t as number).toBeLessThanOrEqual(0.6);
    payloadOk(first);
  });

  it("§9.1 L1101: a 1v1 does not issue a team fight_call (units may still use the Unit Brain)", () => {
    const r = runAi({
      T: 2.0,
      units: cluster(PIT, [
        { id: BM, champ: SAME },
        { id: RM, champ: SAME },
      ]),
    });
    expect(r.fightCalls()).toHaveLength(0);
  });

  it("G9 L1890: a 2v1 is not a fight (≥2 per side) — no fight_call", () => {
    const r = runAi({
      T: 2.0,
      units: cluster(PIT, [
        { id: BM, champ: SAME },
        { id: BA, champ: SAME },
        { id: RM, champ: SAME },
      ]),
    });
    expect(r.fightCalls()).toHaveLength(0);
  });

  it("G9 L1890 / §9.1 L1107: an even 2v2 (identical kits, full HP) inside 6 tiles does not escalate — |A_true−0.5| is not >0.20 under either dps_est formula", () => {
    const r = runAi({ T: 2.0, units: tight2v2() });
    expect(r.fightCalls()).toHaveLength(0);
  });

  it("M2-20 / G9 L1890: a lopsided 2v2 (identical kits, red at 5% HP) inside 6 tiles does emit fight_call", () => {
    // Huntress L7 max HP is ~ the unit max after level apply; 50 raw HP is << 5% of a 2k pool but
    // is unambiguously a large sqrt(hp) swing vs full, under either dps_est.
    const r = runAi({ T: 2.0, units: tight2v2(undefined, 50) });
    const calls = r.fightCalls();
    expect(calls.length).toBeGreaterThan(0);
    payloadOk(calls[0]!);
    // The healthier side is blue; A_true for blue should be the large side if the event is for blue,
    // or the complement if for red. We only check consistency, not an exact value (L1125).
    const blue = calls.find((e) => e.team === "blue");
    const red = calls.find((e) => e.team === "red");
    if (blue) expect(blue.a_true as number).toBeGreaterThan(0.7);
    if (red) expect(red.a_true as number).toBeLessThan(0.3);
  });

  it("G9 L1890: a lopsided 2v2 whose four sit ~7 tiles from the centroid (inside r=8, outside the 6-tile escalate) does not emit fight_call", () => {
    const r = runAi({
      T: 2.0,
      units: (() => {
        const u = ringAround(PIT, [BM, BA, RM, RA], 7.0);
        u[RM]!.hp = 50;
        u[RA]!.hp = 50;
        return u;
      })(),
    });
    expect(r.fightCalls()).toHaveLength(0);
  });

  it("G9 L1890 / §9.1 L1101: a 3v3 with participants ~7 tiles from the centroid still emits fight_call (≥3 always calls)", () => {
    const r = runAi({
      T: 1.5,
      units: ringAround(PIT, [BM, BJ, BA, RM, RJ, RA], 7.0),
    });
    expect(r.fightCalls().length).toBeGreaterThan(0);
    payloadOk(r.fightCalls()[0]!);
  });

  it("§9.1 L1077 / L444: after two of three blues are banished, the living set is 1v3 and fight_call stops once the 1.0 s grace (L282) has elapsed", () => {
    const r = runAi({
      T: 3.0,
      units: tight3v3(),
      cc: [
        { tick: 1, target: BJ, kind: "banish", duration: 8 },
        { tick: 1, target: BA, kind: "banish", duration: 8 },
      ],
    });
    // Paired: a 3v3 must have called before the banish takes the set to 1v3; then, after the
    // 1.0 s grace (L282) from the inject tick, calls must stop. A sim that never calls fails the first expect.
    expect(r.fightCalls().some((e) => (e.t as number) < 0.6)).toBe(true);
    const late = r.fightCalls().filter((e) => (e.t as number) >= 2.2);
    expect(late).toHaveLength(0);
  });
});
