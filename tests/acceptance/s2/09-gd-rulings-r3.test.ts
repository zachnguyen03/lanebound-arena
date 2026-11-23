/**
 * Appendix R #3 (23 Nov 2026) — S2 fight-AI rulings. Each case cites the
 * ruling line and asserts observable events or positions through the public API.
 * New S2 API names (`a_commit`, `shotcaller_id`, `dive`, `combo_style: "hold_R"`,
 * `focus`, `secondary`) are written against the ruling; see README.
 */
import { describe, expect, it } from "vitest";
import { COMMITS, PIT, cluster, dist, pathOf, runAi, type UId } from "./_harness.js";

const BT = "blue:top" as UId;
const BJ = "blue:jungle" as UId;
const BM = "blue:mid" as UId;
const BA = "blue:adc" as UId;
const BS = "blue:support" as UId;
const RM = "red:mid" as UId;
const RJ = "red:jungle" as UId;
const RA = "red:adc" as UId;

const SAME = "huntress";
const PAD_BLUE = { x: 1.5, y: 7.5 };

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

/** §8.4 L953 / L939. R #3 S2-1 L1911 locks these coefficients as S2 defaults. */
function perceptionDelay(decision: number): number {
  const raw = 0.4 - 0.004 * (decision - 50);
  return Math.min(0.6, Math.max(0.15, raw));
}
function reactionDelay(reflexes: number): number {
  const raw = 0.7 - 0.008 * (reflexes - 50);
  return Math.min(0.9, Math.max(0.2, raw));
}
/** L1097 / R #3 S2-2 L1912. */
function hystS(decision: number): number {
  const raw = 0.8 + 0.01 * (decision - 50);
  return Math.min(1.3, Math.max(0.4, raw));
}

function lopsidedSwing(decision: number) {
  // 3v3, red very low — blue should commit engage. Then banish two blues so the
  // live set is 1v3 and the desired commit is disengage. Banish is not a death
  // (the death exception must not apply).
  const units = tight3v3(undefined, 50);
  for (const id of [BJ, BM, BA]) {
    units[id] = { ...units[id]!, attrs: { decision } };
  }
  // Top and Support stay at their spawn slots (not in the fight) so the living
  // set in the pit stays 3v3, but every living starter shares `decision` and
  // the shotcaller (Top, by tie-break) has the value under test.
  units[BT] = { champ: "brannoch", x: 1.5, y: 5.5, auto: false, attrs: { decision } };
  units[BS] = { champ: "ysol", x: 1.5, y: 9.5, auto: false, attrs: { decision } };
  return runAi({
    T: 3.0,
    units,
    cc: [
      { tick: 3, target: BJ, kind: "banish", duration: 8 },
      { tick: 3, target: BA, kind: "banish", duration: 8 },
    ],
  });
}

describe("R #3 S2-4 L1914 — fight_call fields and shotcaller", () => {
  it("fight_call carries a_commit and shotcaller_id; with nobody dead, a_commit equals a_true", () => {
    const r = runAi({ T: 1.5, units: tight3v3() });
    const calls = r.fightCalls("blue");
    expect(calls.length).toBeGreaterThan(0);
    const e = calls[0]!;
    expect(typeof e.a_commit).toBe("number");
    expect(Number.isFinite(e.a_commit as number)).toBe(true);
    expect(e.a_commit).toBe(e.a_true);
    expect(typeof e.shotcaller_id).toBe("string");
    expect(COMMITS.includes(e.commit as (typeof COMMITS)[number])).toBe(true);
  });

  it("the shotcaller is the living starter with the highest Decision (§8.4 L947)", () => {
    const units = tight3v3();
    units[BM] = { ...units[BM]!, attrs: { decision: 90 } };
    const r = runAi({ T: 1.5, units });
    const e = r.fightCalls("blue")[0];
    expect(e).toBeTruthy();
    expect(e!.shotcaller_id).toBe(BM);
  });

  it("a Decision tie breaks in slot order Top, Jungle, Mid, ADC, Support (§8.4 L947)", () => {
    // Default attrs are 70 on every starter; Top is alive at spawn, even though
    // the pit cluster is mid/jungle/adc.
    const r = runAi({ T: 1.5, units: tight3v3() });
    const e = r.fightCalls("blue")[0];
    expect(e).toBeTruthy();
    expect(e!.shotcaller_id).toBe(BT);
  });
});

describe("R #3 S2-3 L1913 — next-tick fight_call on deaths", () => {
  it("a death on tick N emits its fight_call on tick N+1, not on tick N", () => {
    const r = runAi({
      T: 1.5,
      units: tight3v3(),
      damage: [{ tick: 5, source: BM, target: RJ, raw: 50_000 }],
    });
    expect(r.of("death", (e) => e.tick === 5 || (e.unit_id === RJ && (e.t as number) <= 0.6)).length).toBeGreaterThan(0);
    const death = r.of("death", (e) => e.unit_id === RJ)[0]!;
    const n = death.tick as number;
    expect(r.of("fight_call", (e) => e.tick === n)).toHaveLength(0);
    expect(r.of("fight_call", (e) => e.tick === n + 1).length).toBeGreaterThan(0);
  });
});

describe("R #3 S2-2 L1912 — hysteresis from the shotcaller's Decision", () => {
  it.each([
    // Decision 10 is exactly the 0.4 floor; Decision 99 is 1.29 (the 1.3 cap is
    // the formula bound — attrs are 1–99, so 1.29 is the reachable high end).
    { decision: 10, hyst: 0.4, label: "low clamp 0.4" },
    { decision: 50, hyst: 0.8, label: "Decision 50 → 0.8 s" },
    { decision: 99, hyst: 1.29, label: "high end 1.29 (1.3 cap)" },
  ])("no engage↔disengage flip before hyst_s ($label)", ({ decision, hyst }) => {
    expect(hystS(decision)).toBeCloseTo(hyst, 6);
    const r = lopsidedSwing(decision);
    const first = r.fightCalls("blue")[0];
    expect(first).toBeTruthy();
    expect(first!.commit).toBe("engage");
    const t0 = first!.t as number;
    const earlyFlip = r.fightCalls("blue").filter(
      (e) => (e.t as number) < t0 + hyst - 1e-9 && e.commit === "disengage",
    );
    expect(earlyFlip).toHaveLength(0);
    const later = r.fightCalls("blue").filter(
      (e) => (e.t as number) >= t0 + hyst - 1e-9 && e.commit === "disengage",
    );
    expect(later.length).toBeGreaterThan(0);
  });

  it("R #3 S2-2 L1912: at Decision 50 (hyst_s = 0.8) a flip at 0.75 s is blocked and a flip by 0.85 s is allowed — a stale 1.0 s window fails", () => {
    // t0 is the first engage call. Banish (not a death) makes disengage the
    // desired commit immediately after. A 1.0 s leftover from the retired
    // wording would not flip until t0+1.0.
    expect(hystS(50)).toBeCloseTo(0.8, 6);
    const r = lopsidedSwing(50);
    const first = r.fightCalls("blue")[0];
    expect(first).toBeTruthy();
    expect(first!.commit).toBe("engage");
    const t0 = first!.t as number;
    const flips = r.fightCalls("blue").filter((e) => e.commit === "disengage");
    // 0.75 s is still inside hyst_s = 0.8; 0.85 s is past it. One 10 Hz tick of
    // alignment slop on the allowed side; the bound is still below a stale 1.0 s.
    expect(flips.some((e) => (e.t as number) <= t0 + 0.75 + 1e-9)).toBe(false);
    expect(flips.some((e) => (e.t as number) <= t0 + 0.85 + 0.1)).toBe(true);
  });

  it("the death exception allows a commit flip inside the hyst_s window (L1097)", () => {
    const units = tight3v3(undefined, 50);
    for (const id of [BJ, BM, BA]) {
      units[id] = { ...units[id]!, attrs: { decision: 50 } };
    }
    units[BT] = { champ: "brannoch", x: 1.5, y: 5.5, auto: false, attrs: { decision: 50 } };
    units[BS] = { champ: "ysol", x: 1.5, y: 9.5, auto: false, attrs: { decision: 50 } };
    const r = runAi({
      T: 2.0,
      units,
      damage: [
        { tick: 4, source: RM, target: BJ, raw: 50_000 },
        { tick: 4, source: RM, target: BA, raw: 50_000 },
      ],
    });
    const first = r.fightCalls("blue")[0];
    expect(first).toBeTruthy();
    const t0 = first!.t as number;
    expect(hystS(50)).toBe(0.8);
    const flip = r.fightCalls("blue").find(
      (e) => e.commit !== first!.commit && (e.t as number) < t0 + 0.8,
    );
    expect(flip).toBeTruthy();
  });
});

describe("R #3 S2-1 L1911 — perception vs reaction delay", () => {
  // Newly appeared: diver already in both perception radius and PEEL_DIVE_R at
  // t=0, so the first action (peel_start) is gated from tick 1 (t=0.1) by
  // max(perception_delay, reaction_delay). Already-perceived: stun the diver
  // just outside dive range but inside the radius, then let them walk in after
  // both delays have elapsed — only reaction_delay applies to the new threat.

  it("a newly appeared enemy is acted on after max(perception, reaction), not after reaction alone (perception > reaction)", () => {
    const decision = 10;
    const reflexes = 99;
    const perc = perceptionDelay(decision);
    const reac = reactionDelay(reflexes);
    expect(perc).toBeGreaterThan(reac);
    const t0 = 0.1; // tick 1, first AI tick, enemy already in radius
    const maxD = Math.max(perc, reac);
    const r = runAi({
      T: 2.5,
      pos: true,
      units: {
        [BA]: { champ: "huntress", level: 7, x: 12, y: 4, auto: false, attrs: { decision, reflexes } },
        [BS]: { champ: "ysol", level: 7, x: 11.2, y: 4.2, auto: false, attrs: { decision, reflexes } },
        [RM]: { champ: "kerrig", level: 7, x: 13.5, y: 4, range: 2, auto: true, attrs: { decision, reflexes } },
      },
    });
    const peels = r.of("peel_start");
    expect(peels.length).toBeGreaterThan(0);
    const t = peels[0]!.t as number;
    expect(t).toBeGreaterThanOrEqual(t0 + maxD - 0.05);
    expect(t).toBeLessThan(t0 + perc + reac - 0.1); // delays do not add
    expect(t).toBeGreaterThan(t0 + reac + 0.05); // not reaction-only
  });

  it("a newly appeared enemy is acted on after max(perception, reaction), not after perception alone (reaction > perception)", () => {
    const decision = 99;
    const reflexes = 10;
    const perc = perceptionDelay(decision);
    const reac = reactionDelay(reflexes);
    expect(reac).toBeGreaterThan(perc);
    const t0 = 0.1;
    const maxD = Math.max(perc, reac);
    const r = runAi({
      T: 2.5,
      pos: true,
      units: {
        [BA]: { champ: "huntress", level: 7, x: 12, y: 4, auto: false, attrs: { decision, reflexes } },
        [BS]: { champ: "ysol", level: 7, x: 11.2, y: 4.2, auto: false, attrs: { decision, reflexes } },
        [RM]: { champ: "kerrig", level: 7, x: 13.5, y: 4, range: 2, auto: true, attrs: { decision, reflexes } },
      },
    });
    const peels = r.of("peel_start");
    expect(peels.length).toBeGreaterThan(0);
    const t = peels[0]!.t as number;
    expect(t).toBeGreaterThanOrEqual(t0 + maxD - 0.05);
    expect(t).toBeGreaterThan(t0 + perc + 0.05); // not perception-only
  });

  it("an already-perceived enemy is acted on after reaction_delay only (fight_call / peel threat)", () => {
    const decision = 10;
    const reflexes = 99;
    const perc = perceptionDelay(decision);
    const reac = reactionDelay(reflexes);
    expect(perc).toBeGreaterThan(reac);
    // Diver walks a path that stays inside the Decision-10 perception radius
    // (5.4) and outside PEEL_DIVE_R=3 for ~2 s (longer than both delays), then
    // steps in. Scripted motor is used rather than a stun-hold: stun sets
    // abandon_scripted_motor, so a post-CC walk would never start.
    const r = runAi({
      T: 5.0,
      pos: true,
      units: {
        [BA]: { champ: "huntress", level: 7, x: 12, y: 4, auto: false, attrs: { decision, reflexes } },
        [BS]: { champ: "ysol", level: 7, x: 11.2, y: 4.2, auto: false, attrs: { decision, reflexes } },
        [RM]: { champ: "kerrig", level: 7, x: 16, y: 4, range: 2, auto: true, attrs: { decision, reflexes } },
      },
      motor: { [RM]: { to: [[15.2, 6.8], [13.5, 6.8], [12, 7.2], [13.5, 4]], arrive_r: 0.2, hold_at_end: true } },
    });
    const carryPath = pathOf(r.events, BA);
    const diverPath = pathOf(r.events, RM);
    const enter = diverPath.find((p) => {
      const c = carryPath.find((q) => q.tick === p.tick);
      return c != null && dist(p, c) <= 3.0;
    });
    expect(enter).toBeTruthy();
    expect(enter!.t).toBeGreaterThan(perceptionDelay(decision) + 0.5); // already perceived when the dive starts
    const peels = r.of("peel_start", (e) => (e.t as number) >= enter!.t);
    expect(peels.length).toBeGreaterThan(0);
    const t = peels[0]!.t as number;
    expect(t).toBeGreaterThanOrEqual(enter!.t + reac - 0.1);
    expect(t).toBeLessThan(enter!.t + perc - 0.05); // a second perception delay must not apply
  });
});

describe("R #3 S2-6 L1916 — combo_style hold_R, Focus slot, secondary tactic", () => {
  it("under hold_R, no unit fires R while a_true < 0.55 and the Focus is above 40% HP (§12 L1357)", () => {
    const r = runAi({
      T: 3.0,
      tactics: {
        blue: { preset: "hunt", combo_style: "hold_R", focus: "adc", secondary: "starve" },
        red: { preset: "hunt", combo_style: "hold_R", focus: "adc" },
      },
      units: tight3v3(),
    });
    const calls = r.fightCalls("blue");
    expect(calls.length).toBeGreaterThan(0);
    const first = calls[0]!;
    expect(first.a_true as number).toBeLessThan(0.55);
    const focus = r.unit(RA);
    expect(focus).toBeTruthy();
    expect(focus!.hp / focus!.max_hp).toBeGreaterThan(0.4);
    const rCasts = r.of(
      "cast_start",
      (e) =>
        (e.skill === "R" || e.skill_id === "R") &&
        String(e.unit_id ?? e.source_id ?? "").startsWith("blue:"),
    );
    expect(rCasts).toHaveLength(0);
  });

  it("the Focus slot (×1.25) is the fight_call focus_id when that enemy slot is flagged (§12 L1352)", () => {
    const adc = runAi({
      T: 1.5,
      tactics: { blue: { preset: "hunt", combo_style: "auto", focus: "adc" } },
      units: tight3v3(),
    });
    const mid = runAi({
      T: 1.5,
      tactics: { blue: { preset: "hunt", combo_style: "auto", focus: "mid" } },
      units: tight3v3(),
    });
    const a = adc.fightCalls("blue")[0];
    const m = mid.fightCalls("blue")[0];
    expect(a).toBeTruthy();
    expect(m).toBeTruthy();
    expect(a!.focus_id).toBe(RA);
    expect(m!.focus_id).toBe(RM);
  });
});

describe("R #3 L1920 — hexed with no living allies walks to the pad centre", () => {
  it("a hexed ADC with no living allies walks toward pad centre (1.5, 7.5), not their spawn slot at y=8.5", () => {
    const r = runAi({
      T: 4.0,
      pos: true,
      units: {
        [BA]: { champ: "huntress", level: 7, x: 6, y: 8.5, auto: false },
        [BM]: { champ: "kerrig", level: 7, x: 8, y: 7.5, hp: 1, auto: false },
        [BJ]: { champ: "kerrig", level: 7, x: 8, y: 6.5, hp: 1, auto: false },
        [BT]: { champ: "brannoch", level: 7, x: 8, y: 5.5, hp: 1, auto: false },
        [BS]: { champ: "ysol", level: 7, x: 8, y: 9.5, hp: 1, auto: false },
      },
      damage: [
        { tick: 1, source: RA, target: BM, raw: 50_000 },
        { tick: 1, source: RA, target: BJ, raw: 50_000 },
        { tick: 1, source: RA, target: BT, raw: 50_000 },
        { tick: 1, source: RA, target: BS, raw: 50_000 },
      ],
      cc: [{ tick: 3, target: BA, kind: "hex", duration: 6, source: RM }],
    });
    const end = r.unit(BA);
    expect(end).toBeTruthy();
    expect(end!.alive).toBe(true);
    // Closer to pad centre than to the ADC slot (1.5, 8.5), and y has moved toward 7.5.
    const toCentre = dist({ x: end!.x, y: end!.y }, PAD_BLUE);
    const toSlot = dist({ x: end!.x, y: end!.y }, { x: 1.5, y: 8.5 });
    expect(toCentre).toBeLessThan(toSlot);
    expect(end!.y).toBeLessThan(8.5 - 0.15);
    expect(end!.x).toBeLessThan(6);
  });
});
