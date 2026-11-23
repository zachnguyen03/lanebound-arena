/**
 * L1 Fight Call and fight declaration (M2 test 20; plan §8.4; sandbox §11 S2).
 * Geometry follows Appendix R G9 / R #3 L1919 (G9 wins over the old §5.6 wording).
 * dps_est is the dummy 5 s / 5 recipe (R #3 S2-5 L1915); the cheap fallback is gone.
 * Escalation tests still use identical kits plus even HP or a large HP swing, and
 * never assert an exact A_true.
 * R #4 S2-R4-3 L1927: nearOwnPad is removed; a G9 2v2 near a pad still escalates.
 */
import { describe, expect, it } from "vitest";
import { COMMITS, PIT, Run, cluster, runAi, type UId } from "./_harness.js";

const BM = "blue:mid" as UId;
const BJ = "blue:jungle" as UId;
const BA = "blue:adc" as UId;
const BT = "blue:top" as UId;
const BS = "blue:support" as UId;
const RM = "red:mid" as UId;
const RJ = "red:jungle" as UId;
const RA = "red:adc" as UId;
const RT = "red:top" as UId;
const RS = "red:support" as UId;

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
  // R #3 S2-4 L1914: a_commit and shotcaller_id are on the event.
  expect(typeof e.a_commit).toBe("number");
  expect(Number.isFinite(e.a_commit as number)).toBe(true);
  expect(typeof e.shotcaller_id).toBe("string");
}

describe("Fight declaration and L1 Fight Call (G9 L1890, §5.6 L281, §9.1 L1065–1101)", () => {
  it("G3 L1884: tick 0 is setup only — no fight_call even when a 3v3 is already stacked", () => {
    const r = runAi({ T: 1.0, units: tight3v3() });
    expect(r.of("fight_call", (e) => e.tick === 0)).toHaveLength(0);
  });

  it("M2-20 / R #3 S2-3 L1913: 3+ per side always issues a fight_call on the tick after start is detected (tick 0 is setup, tick 1 detects, tick 2 / t=0.2 emits)", () => {
    const r = runAi({ T: 1.5, units: tight3v3() });
    const calls = r.fightCalls();
    expect(calls.length).toBeGreaterThan(0);
    const first = calls[0]!;
    expect(first.tick).toBe(2);
    expect(first.t as number).toBeCloseTo(0.2, 6);
    expect(r.of("fight_call", (e) => e.tick === 1)).toHaveLength(0);
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

  it("G9 L1890 / §9.1 L1107: an even 2v2 (identical kits, full HP) inside 6 tiles does not escalate — |A_true−0.5| is not >0.20 when both sides share the same dummy dps_est (R #3 S2-5 L1915)", () => {
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
    expect(r.fightCalls().some((e) => e.tick === 2)).toBe(true);
    const late = r.fightCalls().filter((e) => (e.t as number) >= 2.2);
    expect(late).toHaveLength(0);
  });

  it("R #4 S2-R4-3 L1927: a G9-qualifying lopsided 2v2 just outside blue sanctuary (near the pad, inside the old 4-tile nearOwnPad radius) still escalates", () => {
    // Pad centre is (1.5, 7.5). Sanctuary is x < 2. Cluster around (3.2, 7.5):
    // every body has x ≥ 2.4 (out of sanctuary) and is within ~2 tiles of the
    // pad (the removed nearOwnPad exclusion was dist ≤ 4).
    // Unused defaultEvenConfig slots would WalkFromPad into this cluster and
    // can emit a stray 2v2; park them far away. T=1.0 so they cannot arrive.
    const at = { x: 3.2, y: 7.5 };
    const units = {
      ...cluster(at, [
        { id: BM, champ: SAME },
        { id: BA, champ: SAME },
        { id: RM, champ: SAME, hp: 50 },
        { id: RA, champ: SAME, hp: 50 },
      ]),
      [BT]: { champ: SAME, level: 7, x: 12, y: 1, auto: false },
      [BJ]: { champ: SAME, level: 7, x: 13, y: 1, auto: false },
      [BS]: { champ: SAME, level: 7, x: 11, y: 1, auto: false },
      [RT]: { champ: SAME, level: 7, x: 12, y: 14, auto: false },
      [RJ]: { champ: SAME, level: 7, x: 13, y: 14, auto: false },
      [RS]: { champ: SAME, level: 7, x: 11, y: 14, auto: false },
    };
    for (const id of [BM, BA, RM, RA]) {
      const u = units[id]!;
      expect(u.x).toBeGreaterThanOrEqual(2);
      expect(Math.hypot(u.x - 1.5, u.y - 7.5)).toBeLessThan(4);
    }
    const r = runAi({ T: 1.0, units });
    const calls = r.fightCalls();
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]!.tick).toBe(2);
    payloadOk(calls[0]!);
  });
});
