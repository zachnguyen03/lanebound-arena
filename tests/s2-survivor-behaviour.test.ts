/**
 * S2 AI behaviour pins via the real sim path (runAi).
 * Do not edit tests/acceptance/**.
 */
import { describe, expect, it } from "vitest";
import { PIT, runAi, type UId } from "./acceptance/s2/_harness.js";

const BA = "blue:adc" as UId;
const BM = "blue:mid" as UId;
const BJ = "blue:jungle" as UId;
const RA = "red:adc" as UId;
const RM = "red:mid" as UId;
const RJ = "red:jungle" as UId;
const SAME = "huntress";
const CHASER = "blue:mid" as UId;
const FLEE = "red:adc" as UId;

/** Offensive aim events after t0 (hits + Chase/Engage/Kite/Cast/Approach intents). */
function aimedAt(r: ReturnType<typeof runAi>, who: UId, afterT: number) {
  const hits = r.of(
    "hit",
    (e) => e.source_id === who && (e.t as number) >= afterT && e.skill_id === "auto",
  );
  const intents = r.of(
    "intent",
    (e) =>
      e.unit_id === who &&
      (e.t as number) >= afterT &&
      e.target_id != null &&
      (e.intent === "Engage" ||
        e.intent === "Chase" ||
        e.intent === "Kite" ||
        e.intent === "Cast" ||
        e.intent === "Approach"),
  );
  return [...hits, ...intents];
}

describe("S2 survivor behaviour — real AI path", () => {
  it("follows a much greener local shot, not the far called target (engage, Teamwork 90)", () => {
    // Blue ADC TW90 in an active fight. First engage call names Red ADC (far, full HP)
    // via the Focus-slot geometry. Red Mid is then chipped to ~200/1100 beside her so
    // the local body is much greener while that call still names RA. She is free to
    // choose (autos on, not mid-windup). Expected: she attacks Red Mid, not RA.
    const r = runAi({
      T: 1.0,
      tactics: { blue: { preset: "hunt", focus: "adc" } },
      units: {
        [BM]: { champ: SAME, level: 7, x: 15.0, y: PIT.y, attrs: { teamwork: 90, decision: 90 } },
        [BJ]: { champ: SAME, level: 7, x: 14.4, y: PIT.y + 0.6, attrs: { teamwork: 90 } },
        [BA]: { champ: SAME, level: 7, x: 8.5, y: PIT.y, auto: true, attrs: { teamwork: 90 } },
        [RA]: { champ: SAME, level: 7, x: 15.8, y: PIT.y },
        [RM]: { champ: SAME, level: 7, x: 9.3, y: PIT.y },
        [RJ]: { champ: SAME, level: 7, x: 14.6, y: PIT.y + 0.8 },
      },
      // After the t=0.2 call, bring RM down near 200/max before BA's first auto.
      damage: [{ tick: 3, source: BA, target: RM, raw: 1100 }],
    });
    const call = r.fightCalls("blue").find(
      (e) => typeof e.focus_id === "string" && e.commit === "engage",
    );
    expect(call).toBeTruthy();
    expect(call!.focus_id).toBe(RA);
    expect(call!.commit).toBe("engage");

    // Until the next L1 at t=1.0, focus_id stays RA while RM sits ~200 HP.
    const nextFocus = r.fightCalls("blue").find((e) => (e.t as number) > (call!.t as number));
    const until = nextFocus ? (nextFocus.t as number) : 1.0;
    expect(until).toBeGreaterThan(call!.t as number);

    const rmHp = r.unit(RM)!.hp;
    const rmMax = r.unit(RM)!.max_hp;
    expect(r.unit(RM)!.alive).toBe(true);
    expect(rmMax).toBeGreaterThanOrEqual(900);
    // Statement's 200/900; tip Huntress L7 max ~1100 after mitigation.
    expect(rmHp).toBeGreaterThan(150);
    expect(rmHp).toBeLessThan(280);

    const aimed = aimedAt(r, BA, call!.t as number).filter((e) => (e.t as number) < until);
    expect(aimed.length).toBeGreaterThan(0);
    expect(aimed.every((e) => e.target_id === RM)).toBe(true);
    expect(aimed.some((e) => e.target_id === RA)).toBe(false);

    const hits = r.of(
      "hit",
      (e) =>
        e.source_id === BA &&
        (e.t as number) >= (call!.t as number) &&
        (e.t as number) < until &&
        e.skill_id === "auto",
    );
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((e) => e.target_id === RM)).toBe(true);
  });

  it("a dead called target does not stay the attack target", () => {
    // Call names Red ADC while she is alive; then Red ADC dies. Live Red Mid is
    // next to Blue ADC (TW90). Expected: she switches to live Red Mid and never
    // keeps dead Red ADC as her target.
    const r = runAi({
      T: 2.5,
      tactics: { blue: { preset: "hunt", focus: "adc" } },
      units: {
        [BM]: { champ: SAME, level: 7, x: 15.0, y: PIT.y, attrs: { teamwork: 90, decision: 90 } },
        [BJ]: { champ: SAME, level: 7, x: 14.4, y: PIT.y + 0.6, attrs: { teamwork: 90 } },
        [BA]: { champ: SAME, level: 7, x: 8.5, y: PIT.y, auto: true, attrs: { teamwork: 90 } },
        [RA]: { champ: SAME, level: 7, x: 15.8, y: PIT.y, hp: 80 },
        [RM]: { champ: SAME, level: 7, x: 9.3, y: PIT.y },
        [RJ]: { champ: SAME, level: 7, x: 14.6, y: PIT.y + 0.8 },
      },
      damage: [{ tick: 8, source: BM, target: RA, raw: 10_000 }],
    });
    const call = r.fightCalls("blue").find((e) => e.focus_id === RA);
    expect(call).toBeTruthy();
    const death = r.of("death", (e) => e.unit_id === RA)[0];
    expect(death).toBeTruthy();
    const afterDeath = death!.t as number;

    const aimedAfter = aimedAt(r, BA, afterDeath);
    expect(aimedAfter.some((e) => e.target_id === RA)).toBe(false);
    expect(aimedAfter.some((e) => e.target_id === RM)).toBe(true);
    expect(r.unit(RA)!.alive).toBe(false);
    expect(r.unit(RM)!.alive).toBe(true);
  });

  it("a no-damage chaser still treats a 1-HP target as killable (chase continues)", () => {
    // Blue Mid mid-chase on Red ADC. Level 1, as=0 (auto DPS 0; R locked at L<5),
    // no ally feeding damage into the target. Red ADC starts at 1 HP, not in
    // sanctuary, under the 10-tile leash. Chase stops only when est_ttk > 2 s —
    // with the denominator floor, 1 HP stays finite and ≤ 2 s, so chase continues.
    const r = runAi({
      T: 3.0,
      pos: true,
      tactics: { blue: { preset: "hunt" } },
      units: {
        [CHASER]: {
          champ: "kerrig",
          level: 1,
          x: 10,
          y: 4,
          auto: true,
          as: 0,
          attrs: { decision: 90, execution: 90 },
        },
        [FLEE]: {
          champ: "maelis",
          level: 7,
          x: 12,
          y: 4,
          hp: 1,
          auto: false,
        },
      },
      motor: { [FLEE]: { to: [[12, 4]], arrive_r: 0.2, hold_at_end: true } },
    });

    const chase = r.of(
      "intent",
      (e) =>
        e.unit_id === CHASER &&
        (e.intent === "Chase" || e.intent === "Engage" || e.intent === "Approach") &&
        e.target_id === FLEE,
    );
    expect(chase.length).toBeGreaterThan(0);
    const firstT = chase[0]!.t as number;

    // Through the next planner second the chaser must stay on the 1-HP body.
    const stillOn = r.of(
      "intent",
      (e) =>
        e.unit_id === CHASER &&
        (e.t as number) >= firstT &&
        (e.t as number) <= firstT + 1.0 &&
        (e.intent === "Chase" ||
          e.intent === "Engage" ||
          e.intent === "Approach" ||
          e.intent === "Kite") &&
        e.target_id === FLEE,
    );
    expect(stillOn.length).toBeGreaterThan(0);

    // Sanctuary / leash are not the stop: target stays mid-map; chaser travel < 8.
    expect(r.unit(FLEE)!.alive).toBe(true);
    expect((r.unit(FLEE)!.x as number) < 22).toBe(true);
  });
});
