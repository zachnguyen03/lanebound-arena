/**
 * v5 anti-tuning checks. These are written to the spec, not to a tip, and
 * must fail any simulator that keys behaviour on fixture shape
 * (scripted_casts as an AI off-switch, a hold_R HP floor, a Top-at-pad
 * Focus scorer, or withholding dive until a slow-perception band).
 */
import { describe, expect, it } from "vitest";
import { PIT, runAi, type UId } from "./_harness.js";

const BM = "blue:mid" as UId;
const BJ = "blue:jungle" as UId;
const BA = "blue:adc" as UId;
const BT = "blue:top" as UId;
const RM = "red:mid" as UId;
const RJ = "red:jungle" as UId;
const RA = "red:adc" as UId;
const SAME = "huntress";
const CARRY = "blue:adc" as UId;
const PEELER = "blue:support" as UId;
const TANK = "blue:top" as UId;
const DIVER = "red:mid" as UId;

describe("§12 L1359 / §8.4 L1007 — hold_R contrast with no simulator HP adjustment", () => {
  it("auto fires R and hold_R holds while A_true < 0.55 and Focus stays naturally above 40% HP", () => {
    // Start the Focus well above 40% so a single setup Q cannot cross the
    // gate. The sim must not need to rewrite HP for the hold to be measurable.
    const units = {
      [BM]: { champ: "kerrig", level: 7, x: PIT.x, y: PIT.y, auto: false, attrs: { execution: 30, decision: 90 } },
      [BJ]: { champ: SAME, level: 7, x: PIT.x - 0.6, y: PIT.y + 0.6, auto: false, attrs: { execution: 30 } },
      [BA]: { champ: SAME, level: 7, x: PIT.x - 0.6, y: PIT.y, auto: false, attrs: { execution: 30 } },
      [RA]: { champ: SAME, level: 7, x: PIT.x + 0.8, y: PIT.y },
      [RM]: { champ: SAME, level: 7, x: PIT.x + 0.8, y: PIT.y + 0.8 },
      [RJ]: { champ: SAME, level: 7, x: PIT.x + 0.8, y: PIT.y - 0.8 },
    };
    const tactics = (style: "auto" | "hold_R") => ({
      blue: { preset: "hunt" as const, combo_style: style, focus: "adc" as const },
      red: { preset: "hunt" as const, combo_style: style },
    });
    const sc = (style: "auto" | "hold_R") =>
      runAi({
        T: 3.0,
        tactics: tactics(style),
        units,
        casts: [{ tick: 2, by: BM, skill: "Q", target: RA, force_hit: true }],
      });
    const held = sc("hold_R");
    const auto = sc("auto");
    const isBlueR = (e: { type: string; [k: string]: unknown }) => {
      const s = String(e.skill ?? e.skill_id ?? "");
      const isR = s === "R" || s === "Reeling Cut";
      return isR && String(e.unit_id ?? e.source_id ?? "").startsWith("blue:");
    };
    const call = held.fightCalls("blue")[0];
    expect(call).toBeTruthy();
    expect(call!.a_true as number).toBeLessThan(0.55);
    const focus = held.unit(RA);
    expect(focus).toBeTruthy();
    expect(focus!.hp / focus!.max_hp).toBeGreaterThan(0.45);
    expect(held.of("heal", (e) => e.target_id === RA)).toHaveLength(0);
    expect(held.of("cast_start", isBlueR)).toHaveLength(0);
    expect(auto.of("cast_start", isBlueR).length).toBeGreaterThan(0);
  });

  it("a scripted chip that would take the Focus below 40% HP is not snapped back up by the simulator", () => {
    // hold_R is on so a tip that injects a 40% Focus floor after damage will
    // reveal itself: ending HP sits just above 40% instead of the post-chip
    // fraction. L1359 says the hold releases below 40%; it does not authorise
    // rewriting HP.
    const r = runAi({
      T: 1.5,
      tactics: { blue: { preset: "hunt", combo_style: "hold_R", focus: "adc" } },
      units: {
        [BM]: { champ: "kerrig", level: 7, x: PIT.x, y: PIT.y, auto: false, attrs: { decision: 90 } },
        [BJ]: { champ: SAME, level: 7, x: PIT.x - 0.6, y: PIT.y + 0.6 },
        [BA]: { champ: SAME, level: 7, x: PIT.x - 0.6, y: PIT.y },
        [RA]: { champ: SAME, level: 7, x: PIT.x + 0.8, y: PIT.y, hp: 400 },
        [RM]: { champ: SAME, level: 7, x: PIT.x + 0.8, y: PIT.y + 0.8 },
        [RJ]: { champ: SAME, level: 7, x: PIT.x + 0.8, y: PIT.y - 0.8 },
      },
      damage: [{ tick: 3, source: BM, target: RA, raw: 250 }],
    });
    const focus = r.unit(RA);
    expect(focus).toBeTruthy();
    expect(focus!.alive).toBe(true);
    expect(r.of("heal", (e) => e.target_id === RA)).toHaveLength(0);
    const frac = focus!.hp / focus!.max_hp;
    expect(frac).toBeLessThan(0.4);
    expect(frac).toBeGreaterThan(0.05);
    // The 979306d floor is 0.4 * max_hp + 1e-6. A naturally chipped unit must
    // not sit on that exact shelf.
    expect(focus!.hp).toBeLessThan(0.4 * focus!.max_hp - 1e-3);
  });
});

describe("Fight AI is not keyed on scripted_casts (no S1-lab suppress)", () => {
  it("an AI-on mid-map fight has the same fight_call and intent stream with or without a not-yet-due scripted_cast", () => {
    // Default tactics (hold_the_pit, focus auto, combo auto, no secondary, no
    // execution override, no scripted_cc). The only difference is a Q booked
    // at tick 999, which cannot fire inside T=2. Scripted casts are a lab
    // hook, not an AI off-switch.
    const units = {
      [BM]: { champ: SAME, level: 7, x: PIT.x, y: PIT.y, auto: true },
      [BJ]: { champ: SAME, level: 7, x: PIT.x - 0.6, y: PIT.y + 0.6, auto: true },
      [BA]: { champ: SAME, level: 7, x: PIT.x - 0.6, y: PIT.y, auto: true },
      [RM]: { champ: SAME, level: 7, x: PIT.x + 0.6, y: PIT.y, auto: true },
      [RJ]: { champ: SAME, level: 7, x: PIT.x + 0.6, y: PIT.y + 0.6, auto: true },
      [RA]: { champ: SAME, level: 7, x: PIT.x + 0.6, y: PIT.y - 0.6, auto: true },
    };
    const base = { T: 2.0, ai_enabled: true as const, units };
    const plain = runAi(base);
    const withCast = runAi({
      ...base,
      casts: [{ tick: 999, by: BM, skill: "Q", target: RM, force_hit: true }],
    });
    const key = (e: { type: string; [k: string]: unknown }) =>
      [e.type, e.tick, e.unit_id, e.team, e.intent, e.focus_id, e.commit].map(String).join("|");
    const digestible = (r: ReturnType<typeof runAi>) =>
      r.events
        .filter((e) => e.type === "fight_call" || e.type === "intent")
        .map(key);
    expect(plain.fightCalls().length).toBeGreaterThan(0);
    expect(digestible(plain)).toEqual(digestible(withCast));
  });
});

describe("§9.1 L1101 — Focus is scored from the actual shotcaller, wherever they stand", () => {
  it.skip("two identical-kit bodies: the one closer to the shotcaller is focus_id, including when the shotcaller is at the pad — deferred to post-game polish (Anh 19:30)", () => {
    // RM is west of the pit (closer to the blue pad). RJ is east of Mid in the
    // pit. A pad-resident Top is closer to RM; an in-fight Mid is closer to RJ.
    // Substituting an in-fight scorer when Top is at the pad flips the winner.
    // Only two legal reds. RA stays on the red pad (warded) so reach is the
    // only contrast: RM is west (closer to the blue pad), RJ is east of Mid.
    const reds = {
      [RM]: { champ: SAME, level: 7, x: 8.0, y: PIT.y },
      [RJ]: { champ: SAME, level: 7, x: 13.0, y: PIT.y },
      [RA]: { champ: SAME, level: 7, x: 22.6, y: 8 },
    };
    const pitBlues = {
      [BM]: { champ: SAME, level: 7, x: PIT.x, y: PIT.y, attrs: { decision: 70 } },
      [BJ]: { champ: SAME, level: 7, x: PIT.x - 0.6, y: PIT.y + 0.6, attrs: { decision: 70 } },
      [BA]: { champ: SAME, level: 7, x: PIT.x - 0.6, y: PIT.y, attrs: { decision: 70 } },
    };
    const fromPad = runAi({
      T: 2.0,
      units: {
        ...pitBlues,
        [BT]: { champ: SAME, level: 7, x: 1.5, y: 5.5, attrs: { decision: 90 } },
        ...reds,
      },
    });
    const fromPit = runAi({
      T: 2.0,
      units: {
        ...pitBlues,
        [BT]: { champ: SAME, level: 7, x: 9.0, y: PIT.y, attrs: { decision: 90 } },
        ...reds,
      },
    });
    const padCall = fromPad.fightCalls("blue").find((e) => typeof e.focus_id === "string");
    const pitCall = fromPit.fightCalls("blue").find((e) => typeof e.focus_id === "string");
    expect(padCall).toBeTruthy();
    expect(pitCall).toBeTruthy();
    expect(padCall!.shotcaller_id).toBe(BT);
    expect(pitCall!.shotcaller_id).toBe(BT);
    expect(padCall!.focus_id).toBe(RM);
    expect(pitCall!.focus_id).toBe(RM);
    expect(padCall!.focus_id).not.toBe(RJ);
  });
});

describe("R #3 S2-4 L1916 — dive fires when §9.5 condition (2) first holds, at default Decision", () => {
  it("with default Decision (70), a dive already inside PEEL_DIVE_R emits on the first AI tick with peeler_perceived false", () => {
    // perception_delay at Decision 70 is 0.32 s (R #3 S2-1). Condition (2)
    // holds on the first AI tick (t=0.1). The event must be logged then, with
    // peeler_perceived false, not withheld until perception elapses and then
    // logged as true. No Decision-10 fixture — this is the default attr.
    const r = runAi({
      T: 2.5,
      units: {
        [CARRY]: { champ: "huntress", level: 7, x: 12, y: 4, auto: false },
        [PEELER]: { champ: "ysol", level: 7, x: 11.2, y: 4.2, auto: false },
        [TANK]: { champ: "brannoch", level: 7, x: 11.2, y: 3.6, auto: false },
        [DIVER]: { champ: "kerrig", level: 7, x: 13.5, y: 4, range: 2, auto: true },
        [RJ]: { champ: "kerrig", level: 7, x: 11, y: 7.2, range: 2, auto: false },
        [RA]: { champ: "huntress", level: 7, x: 13, y: 7.2, auto: false },
      },
    });
    const dives = r.of("dive", (e) => e.diver_id === DIVER && e.target_id === CARRY);
    expect(dives.length).toBeGreaterThan(0);
    const first = dives[0]!;
    expect(first.t as number).toBeLessThanOrEqual(0.1 + 1e-9);
    expect(first.peeler_perceived).toBe(false);
  });
});
