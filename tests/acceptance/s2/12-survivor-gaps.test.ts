/**
 * v5 coverage for held-out mutations that official v4 did not kill.
 * Each case cites the spec and asserts an observable event or position.
 * No fixture is tuned to a tip.
 */
import { describe, expect, it } from "vitest";
import { inBlueSanctuary, inRedSanctuary, pathOf, PIT, runAi, type UId } from "./_harness.js";

const BM = "blue:mid" as UId;
const BJ = "blue:jungle" as UId;
const BA = "blue:adc" as UId;
const BT = "blue:top" as UId;
const BS = "blue:support" as UId;
const MID = "blue:mid" as UId;
const FOE = "red:mid" as UId;
const RM = "red:mid" as UId;
const RJ = "red:jungle" as UId;
const RA = "red:adc" as UId;
const SAME = "huntress";
const CHASER = "blue:mid" as UId;
const FLEE = "red:adc" as UId;

describe("G3 L1884 / R #3 S2-3 L1915 — no fight_call before the next-tick emit (S2A05)", () => {
  it("a stacked 3v3 emits its first fight_call on tick 2 / t=0.2, never on tick 0 or tick 1", () => {
    const r = runAi({
      T: 1.5,
      units: {
        [BM]: { champ: SAME, level: 7, x: PIT.x, y: PIT.y },
        [BJ]: { champ: SAME, level: 7, x: PIT.x - 0.6, y: PIT.y + 0.6 },
        [BA]: { champ: SAME, level: 7, x: PIT.x - 0.6, y: PIT.y },
        [RM]: { champ: SAME, level: 7, x: PIT.x + 0.6, y: PIT.y },
        [RJ]: { champ: SAME, level: 7, x: PIT.x + 0.6, y: PIT.y + 0.6 },
        [RA]: { champ: SAME, level: 7, x: PIT.x + 0.6, y: PIT.y - 0.6 },
      },
    });
    expect(r.of("fight_call", (e) => (e.tick as number) <= 1)).toHaveLength(0);
    const first = r.fightCalls()[0];
    expect(first).toBeTruthy();
    expect(first!.tick).toBe(2);
  });
});

describe("§9.4 L1143 / §9.6 L1166 — chase stops at the target's sanctuary (S2A06)", () => {
  it("after the chased target has entered their sanctuary, the chaser has no Chase / Approach / Kite toward them", () => {
    const r = runAi({
      T: 8.0,
      pos: true,
      tactics: { blue: { preset: "hunt" }, red: { preset: "hunt" } },
      units: {
        [CHASER]: { champ: "kerrig", level: 7, x: 16, y: 8, auto: true },
        [FLEE]: { champ: "maelis", level: 7, x: 18, y: 8, hp: 200, auto: false },
      },
      motor: { [FLEE]: { to: [[22.6, 8]], arrive_r: 0.2, hold_at_end: true } },
    });
    const chaseIntents = r.of("intent", (e) => e.unit_id === CHASER && (e.intent === "Chase" || e.intent === "Approach"));
    expect(chaseIntents.length).toBeGreaterThan(0);
    const targetPath = pathOf(r.events, FLEE);
    const entered = targetPath.find((p) => inRedSanctuary(p.x));
    expect(entered).toBeTruthy();
    const toward = r.of(
      "intent",
      (e) =>
        e.unit_id === CHASER &&
        (e.t as number) >= entered!.t + 0.2 &&
        (e.intent === "Chase" || e.intent === "Approach" || e.intent === "Kite") &&
        (e.target_id == null || e.target_id === FLEE),
    );
    expect(toward).toHaveLength(0);
  });
});

describe("§9.3 L1131 — sanctuary and banish wards (S2A10)", () => {
  it("a low-HP marksman in their own sanctuary is not focus_id when a legal tank is in the pit", () => {
    const r = runAi({
      T: 2.0,
      units: {
        [BM]: { champ: "huntress", level: 7, x: PIT.x, y: PIT.y, attrs: { decision: 99 } },
        [BJ]: { champ: "huntress", level: 7, x: PIT.x - 0.6, y: PIT.y },
        [BA]: { champ: "huntress", level: 7, x: PIT.x + 0.6, y: PIT.y },
        [RM]: { champ: "brannoch", level: 7, x: PIT.x, y: PIT.y + 0.8 },
        [RJ]: { champ: "brannoch", level: 7, x: PIT.x - 0.6, y: PIT.y + 0.8 },
        [RA]: { champ: "huntress", level: 7, x: 22.6, y: 8, hp: 50 },
      },
    });
    const calls = r.fightCalls("blue").filter((e) => typeof e.focus_id === "string");
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((e) => e.focus_id !== RA)).toBe(true);
    expect(calls.some((e) => e.focus_id === RM || e.focus_id === RJ)).toBe(true);
  });
});

describe("§8.3 L899–908 — mastery scales eff_Aim (S2A11)", () => {
  it("mastery 100 vs 50 on Aim 60 / Reflexes 60 raises the scripted-skillshot hit count", () => {
    const hits = (mastery: number) => {
      const r = runAi({
        seed: 20261122,
        T: 2.0,
        units: {
          [BA]: { champ: "huntress", level: 7, x: 10, y: 4, attrs: { aim: 60 }, mastery },
          [RA]: { champ: "maelis", level: 7, x: 13, y: 4, attrs: { reflexes: 60 } },
        },
        skillshots: [{ tick: 5, source: BA, target: RA, count: 400 }],
      });
      return r.of("hit", (e) => e.source_id === BA && e.target_id === RA && e.miss !== true).length;
    };
    const at50 = hits(50);
    const at100 = hits(100);
    expect(at100).toBeGreaterThan(at50);
    expect(at100 / 400).toBeGreaterThan(0.55);
  });
});

describe("§9.6 L1166 — WalkFromPad after respawn (S2A15)", () => {
  it("the respawned unit emits WalkFromPad and leaves its own sanctuary within 1.5 s", () => {
    const r = runAi({
      T: 20.0,
      pos: true,
      units: {
        [MID]: { champ: "kerrig", level: 7, x: 12, y: 4, hp: 1, auto: false },
        [FOE]: { champ: "maelis", level: 7, x: 13, y: 4, auto: false },
      },
      damage: [{ tick: 2, source: FOE, target: MID, raw: 50_000 }],
    });
    const respawn = r.of("respawn", (e) => e.unit_id === MID);
    expect(respawn.length).toBeGreaterThan(0);
    const tR = respawn[0]!.t as number;
    const walk = r.of("intent", (e) => e.unit_id === MID && (e.t as number) >= tR && e.intent === "WalkFromPad");
    const path = pathOf(r.events, MID).filter((p) => p.t >= tR && p.t <= tR + 1.5 + 1e-9);
    expect(walk.length).toBeGreaterThan(0);
    expect(path.some((p) => !inBlueSanctuary(p.x))).toBe(true);
  });
});

describe("L140 / R #2 OQ-3 L1901 — Lock skips the Unit Brain (S2A16)", () => {
  it("a stunned unit that starts Idle does not emit Approach / Engage / Chase / Cast / Peel when a foe walks into range", () => {
    const r = runAi({
      T: 3.5,
      units: {
        [MID]: { champ: "kerrig", level: 7, x: 8, y: 4, auto: true },
        [FOE]: { champ: "maelis", level: 7, x: 16, y: 4, auto: false },
      },
      cc: [{ tick: 1, target: MID, kind: "stun", duration: 3.0 }],
      motor: { [FOE]: { to: [[8.8, 4]], arrive_r: 0.2, hold_at_end: true } },
    });
    const stun = r.of("status_apply", (e) => e.target_id === MID && e.kind === "stun")[0];
    expect(stun).toBeTruthy();
    const t0 = stun!.t as number;
    const during = r.of(
      "intent",
      (e) =>
        e.unit_id === MID &&
        (e.t as number) >= t0 - 1e-9 &&
        (e.t as number) < t0 + 3.0 - 1e-9 &&
        (e.intent === "Cast" || e.intent === "Peel" || e.intent === "Engage" || e.intent === "Chase" || e.intent === "Approach"),
    );
    expect(during).toHaveLength(0);
  });
});

describe("R #3 S2-5 L1917 — dps_est includes R iff level ≥ 5 (S2R11)", () => {
  it("a level-4 chaser whose auto-only est_ttk is already > 2 stops the chase; including R at L<5 would keep them in Chase", () => {
    // L4 Kerrig vs a mid-HP L7 tank. Dummy 5 s auto damage of a pre-R kit cannot
    // empty this body in 2 s, so the chase must stop. Adding L4 R to dps_est
    // (forbidden by S2-5) would push est_ttk under 2 and leave them in Chase.
    const r = runAi({
      T: 4.0,
      pos: true,
      tactics: { blue: { preset: "hunt" } },
      units: {
        [CHASER]: { champ: "kerrig", level: 4, x: 12, y: 4, auto: true },
        [FLEE]: { champ: "brannoch", level: 7, x: 14, y: 4, hp: 900, auto: false },
      },
      motor: { [FLEE]: { to: [[14, 4]], arrive_r: 0.2, hold_at_end: true } },
    });
    const chase = r.of("intent", (e) => e.unit_id === CHASER && (e.intent === "Chase" || e.intent === "Approach"));
    expect(chase.length).toBeGreaterThan(0);
    const firstChaseT = chase[0]!.t as number;
    const towardLate = r.of(
      "intent",
      (e) =>
        e.unit_id === CHASER &&
        (e.t as number) >= firstChaseT + 1.0 &&
        (e.intent === "Chase" || e.intent === "Approach" || e.intent === "Kite") &&
        (e.target_id == null || e.target_id === FLEE),
    );
    expect(towardLate).toHaveLength(0);
    expect(pathOf(r.events, CHASER).every((p) => !inRedSanctuary(p.x))).toBe(true);
  });
});

describe("R #3 S2-5 L1917 / §9.4 — chase stop is Idle, not Approach (S2R33, S2R34)", () => {
  it("the est_ttk stop lands within 0.4 s of the first Chase and the stopping intent is not Approach / Kite toward the target", () => {
    const r = runAi({
      T: 4.0,
      pos: true,
      tactics: { blue: { preset: "hunt" } },
      units: {
        [CHASER]: { champ: "kerrig", level: 1, x: 12, y: 4, auto: true },
        [FLEE]: { champ: "brannoch", level: 10, x: 14, y: 4, auto: false },
      },
      motor: { [FLEE]: { to: [[14, 4]], arrive_r: 0.2, hold_at_end: true } },
    });
    const chase = r.of("intent", (e) => e.unit_id === CHASER && (e.intent === "Chase" || e.intent === "Approach"));
    expect(chase.length).toBeGreaterThan(0);
    const firstChaseT = chase[0]!.t as number;
    const deadline = firstChaseT + 0.4;
    const towardAfter = r.of(
      "intent",
      (e) =>
        e.unit_id === CHASER &&
        (e.t as number) >= deadline - 1e-9 &&
        (e.intent === "Chase" || e.intent === "Approach" || e.intent === "Kite") &&
        (e.target_id == null || e.target_id === FLEE),
    );
    expect(towardAfter).toHaveLength(0);
    const stopIntent = r.of(
      "intent",
      (e) =>
        e.unit_id === CHASER &&
        (e.t as number) >= firstChaseT &&
        (e.t as number) <= deadline + 1e-9 &&
        e.intent !== "Chase",
    );
    expect(stopIntent.length).toBeGreaterThan(0);
    expect(stopIntent.every((e) => e.intent !== "Approach" && e.intent !== "Kite")).toBe(true);
  });
});

describe("R #3 L1922 — hexed with no allies walks to the pad centre (S2R21)", () => {
  it("a hexed ADC with no living allies moves toward (1.5, 7.5), not the ADC slot at y=8.5", () => {
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
    const toCentre = Math.hypot(end!.x - 1.5, end!.y - 7.5);
    const toSlot = Math.hypot(end!.x - 1.5, end!.y - 8.5);
    expect(toCentre).toBeLessThan(toSlot);
    expect(Math.abs(end!.y - 7.5)).toBeLessThan(Math.abs(end!.y - 8.5));
    expect(end!.x).toBeLessThan(6);
  });
});
