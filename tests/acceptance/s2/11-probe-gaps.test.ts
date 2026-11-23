/**
 * v4 probe-gap tests (spec §9 / §12 and Appendix R #3). Observables only,
 * through the public API. These pin defects the v1–v3 suite left open.
 */
import { describe, expect, it } from "vitest";
import { PIT, cluster, runAi, type UId } from "./_harness.js";

const BM = "blue:mid" as UId;
const BJ = "blue:jungle" as UId;
const BA = "blue:adc" as UId;
const RM = "red:mid" as UId;
const RJ = "red:jungle" as UId;
const RA = "red:adc" as UId;

const SAME = "huntress";

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

describe("R #3 S2-6 L1916 / §12 L1357 — Focus is ×1.25, not a hard override", () => {
  it("a non-Focus target whose score beats the flagged slot ×1.25 is the fight_call focus_id", () => {
    // Flag Mid. red:adc is the same kit, much lower HP and closer — missing-HP
    // value and killability more than cover a 1.25× Focus bump (L1127, L1357).
    // A hard override onto the flagged slot must fail this.
    const units = {
      [BM]: { champ: SAME, level: 7, x: PIT.x, y: PIT.y, attrs: { decision: 99 } },
      [BJ]: { champ: SAME, level: 7, x: PIT.x - 0.6, y: PIT.y + 0.6, attrs: { decision: 99 } },
      [BA]: { champ: SAME, level: 7, x: PIT.x - 0.6, y: PIT.y, attrs: { decision: 99 } },
      [RM]: { champ: SAME, level: 7, x: PIT.x + 5.5, y: PIT.y },
      [RJ]: { champ: SAME, level: 7, x: PIT.x + 5.5, y: PIT.y + 0.8 },
      [RA]: { champ: SAME, level: 7, x: PIT.x + 1.6, y: PIT.y, hp: 50 },
    };
    const r = runAi({
      T: 1.5,
      tactics: { blue: { preset: "hunt", combo_style: "auto", focus: "mid" } },
      units,
    });
    const call = r.fightCalls("blue").find((e) => typeof e.focus_id === "string");
    expect(call).toBeTruthy();
    expect(call!.focus_id).toBe(RA);
    expect(call!.focus_id).not.toBe(RM);
  });
});

describe("§9.3 L1128 — killability Lock ×1.25", () => {
  it("a hard Lock already on one of two otherwise equal bodies makes that body the focus_id", () => {
    // Same kit, same HP, same distance from the Decision-99 shotcaller. Without
    // the Lock multiplier the earlier slot (mid) would win a tie. Stun is a
    // Lock (§6.5 L436). Applied at tick 1 so it is already on the target when
    // the first fight_call is emitted (tick 2).
    const units = {
      [BM]: { champ: SAME, level: 7, x: PIT.x, y: PIT.y, attrs: { decision: 99 } },
      [BJ]: { champ: SAME, level: 7, x: PIT.x - 0.6, y: PIT.y + 0.6 },
      [BA]: { champ: SAME, level: 7, x: PIT.x - 0.6, y: PIT.y },
      [RM]: { champ: SAME, level: 7, x: PIT.x + 2.0, y: PIT.y },
      [RJ]: { champ: SAME, level: 7, x: PIT.x + 2.0, y: PIT.y + 0.8 },
      [RA]: { champ: SAME, level: 7, x: PIT.x + 2.0, y: PIT.y - 0.8 },
    };
    const r = runAi({
      T: 1.5,
      units,
      cc: [{ tick: 1, target: RA, kind: "stun", duration: 4 }],
    });
    const call = r.fightCalls("blue").find((e) => typeof e.focus_id === "string");
    expect(call).toBeTruthy();
    expect(call!.focus_id).toBe(RA);
  });
});

describe("R #3 S2-6 L1916 / §12 L1359 — hold_R vs auto contrast", () => {
  it("same fixture: auto casts R at the first legal moment, hold_R holds it while A_true < 0.55 and the Focus is above 40% HP (§12 L1359, §8.4 L1007)", () => {
    // Execution 30: auto may fire R without a live mark (L998). Focus at ~half
    // HP is at or below auto r_hold_hp at Execution 50 (L1003) but still above
    // the hold_R 40% gate (L1359). Even fight keeps a_true < 0.55.
    const units = {
      ...tight3v3(),
      [BM]: { champ: "kerrig", level: 7, x: PIT.x, y: PIT.y, auto: false, attrs: { execution: 30, decision: 90 } },
      [BA]: { champ: SAME, level: 7, x: PIT.x - 0.6, y: PIT.y, auto: false, attrs: { execution: 30 } },
      [RA]: { champ: SAME, level: 7, x: PIT.x + 0.8, y: PIT.y, hp: 550 },
    };
    const tactics = (style: "auto" | "hold_R") => ({
      blue: { preset: "hunt" as const, combo_style: style, focus: "adc" as const },
      red: { preset: "hunt" as const, combo_style: style },
    });
    // Autos off so the Focus is not melted below 40%. Script Q so auto's
    // first legal R moment is after the setup skill is on cooldown (L998).
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
      // Some tips emit the key "R"; some emit the authored name (Kerrig R is Reeling Cut, §7 L728).
      const isR = s === "R" || s === "Reeling Cut";
      return isR && String(e.unit_id ?? e.source_id ?? "").startsWith("blue:");
    };

    const call = held.fightCalls("blue")[0];
    expect(call).toBeTruthy();
    expect(call!.a_true as number).toBeLessThan(0.55);
    const focus = held.unit(RA);
    expect(focus).toBeTruthy();
    expect(focus!.hp / focus!.max_hp).toBeGreaterThan(0.4);
    // Auto r_hold_hp at Execution 50 is 0.55 (L1003); stay at or below that so auto may legally fire.
    expect(focus!.hp / focus!.max_hp).toBeLessThanOrEqual(0.55);

    expect(held.of("cast_start", isBlueR)).toHaveLength(0);
    expect(auto.of("cast_start", isBlueR).length).toBeGreaterThan(0);
  });
});
