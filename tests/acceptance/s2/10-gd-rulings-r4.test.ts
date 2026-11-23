/**
 * Appendix R #4 (23 Nov 2026, L1924–1930). Observables only — the reach
 * formula is not re-implemented here, and no fixture is tuned to a tip.
 * S2-R4-4 (L1930): fight_call.focus_id is the targeting-score winner after
 * the ×1.25 Focus bump, never a hard assignment of the coach slot.
 */
import { describe, expect, it } from "vitest";
import { PIT, pathOf, runAi, type UId } from "./_harness.js";

const BM = "blue:mid" as UId;
const BJ = "blue:jungle" as UId;
const BA = "blue:adc" as UId;
const RM = "red:mid" as UId;
const RJ = "red:jungle" as UId;
const RA = "red:adc" as UId;

const SAME = "huntress";

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
      (e.intent === "Engage" || e.intent === "Chase" || e.intent === "Kite" || e.intent === "Cast" || e.intent === "Approach"),
  );
  return [...hits, ...intents];
}

function meanHold(r: ReturnType<typeof runAi>, self: UId, threat: UId): number {
  const a = pathOf(r.events, self);
  const b = pathOf(r.events, threat);
  const ds: number[] = [];
  for (const p of a) {
    const t = b.find((q) => q.tick === p.tick);
    if (t) ds.push(Math.hypot(p.x - t.x, p.y - t.y));
  }
  return ds.length ? ds.reduce((s, x) => s + x, 0) / ds.length : NaN;
}

describe("R #4 S2-R4-1 L1925 — reach is monotone and never 0", () => {
  it("two identical-kit legal bodies: the closer one is fight_call.focus_id (reach is monotone in eta)", () => {
    // Lopsided 2v2 so G9 escalates. Shotcaller Decision 99. Both reds at 50 HP;
    // RM is 4 tiles from mid, RJ is 7 (still inside the fight radius and the
    // 6-tile centroid cap). Same kit and HP, so the contrast is distance.
    const units = {
      [BM]: { champ: SAME, level: 7, x: PIT.x, y: PIT.y, attrs: { decision: 99 } },
      [BA]: { champ: SAME, level: 7, x: PIT.x - 0.6, y: PIT.y },
      [RM]: { champ: SAME, level: 7, x: PIT.x + 4.0, y: PIT.y, hp: 50 },
      [RJ]: { champ: SAME, level: 7, x: PIT.x + 7.0, y: PIT.y, hp: 50 },
    };
    const r = runAi({ T: 2.0, units });
    const call = r.fightCalls("blue").find((e) => typeof e.focus_id === "string");
    expect(call).toBeTruthy();
    expect(call!.focus_id).toBe(RM);
    expect(call!.focus_id).not.toBe(RJ);
  });

  it("Hunt still acquires a far legal body (reach is never 0 — a linear floor of 0 would wipe it)", () => {
    // The only legal enemy is across the map (out of the 8-tile fight radius,
    // eta well past 1.5 s). A reach of 0 wipes that body out of priority, so
    // Hunt would neither name it nor walk in. Within one fight, eta cannot
    // get large enough for the rejected linear form to hit 0.
    const r = runAi({
      T: 4.0,
      pos: true,
      tactics: { blue: { preset: "hunt" } },
      units: {
        [BM]: { champ: "kerrig", level: 7, x: 3.0, y: 7.5, auto: true },
        [BJ]: { champ: "kerrig", level: 7, x: 3.0, y: 6.7 },
        [BA]: { champ: "kerrig", level: 7, x: 3.0, y: 8.3 },
        [RM]: { champ: "maelis", level: 7, x: 21.0, y: 7.5 },
      },
    });
    const aimed = aimedAt(r, BM, 0);
    const path = pathOf(r.events, BM);
    const start = path[0] ?? { x: 3.0, y: 7.5 };
    const last = path.at(-1) ?? { x: r.unit(BM)!.x, y: r.unit(BM)!.y };
    const closer = Math.hypot(last.x - 21.0, last.y - 7.5) < Math.hypot(start.x - 21.0, start.y - 7.5) - 0.5;
    expect(aimed.some((e) => e.target_id === RM) || closer).toBe(true);
  });
});

describe("R #4 S2-R4-4 L1930 — fight_call.focus_id is the score winner after the ×1.25 Focus bump", () => {
  it("when the Focus slot's pre-bump score is at least best-other / 1.25, focus_id is the slot", () => {
    // Same kit, same HP. Coach Focus is adc. RA sits next to the Decision-99
    // shotcaller; RM is several tiles further. Reach is the only contrast, so
    // pre-bump(RA) already beats pre-bump(RM) and certainly beats RM/1.25.
    const r = runAi({
      T: 2.0,
      tactics: { blue: { preset: "hunt", focus: "adc" } },
      units: {
        [BM]: { champ: SAME, level: 7, x: PIT.x, y: PIT.y, attrs: { decision: 99 } },
        [BJ]: { champ: SAME, level: 7, x: PIT.x - 0.6, y: PIT.y + 0.6 },
        [BA]: { champ: SAME, level: 7, x: PIT.x - 0.6, y: PIT.y },
        [RA]: { champ: SAME, level: 7, x: PIT.x + 1.6, y: PIT.y },
        [RM]: { champ: SAME, level: 7, x: PIT.x + 5.5, y: PIT.y },
        [RJ]: { champ: SAME, level: 7, x: PIT.x + 5.5, y: PIT.y + 0.8 },
      },
    });
    const call = r.fightCalls("blue").find((e) => typeof e.focus_id === "string");
    expect(call).toBeTruthy();
    expect(call!.focus_id).toBe(RA);
    expect(call!.focus_id).not.toBe(RM);
  });

  it("when another target's score is greater than 1.25 × the Focus slot's score, focus_id is that target", () => {
    // Coach Focus is mid. RM is full HP and far; RA is the same kit, much lower
    // HP and closer — missing-HP value and killability more than cover the
    // ×1.25 bump (L1127, L1357, L1930). A hard override onto Mid must fail this.
    const r = runAi({
      T: 1.5,
      tactics: { blue: { preset: "hunt", combo_style: "auto", focus: "mid" } },
      units: {
        [BM]: { champ: SAME, level: 7, x: PIT.x, y: PIT.y, attrs: { decision: 99 } },
        [BJ]: { champ: SAME, level: 7, x: PIT.x - 0.6, y: PIT.y + 0.6, attrs: { decision: 99 } },
        [BA]: { champ: SAME, level: 7, x: PIT.x - 0.6, y: PIT.y, attrs: { decision: 99 } },
        [RM]: { champ: SAME, level: 7, x: PIT.x + 5.5, y: PIT.y },
        [RJ]: { champ: SAME, level: 7, x: PIT.x + 5.5, y: PIT.y + 0.8 },
        [RA]: { champ: SAME, level: 7, x: PIT.x + 1.6, y: PIT.y, hp: 50 },
      },
    });
    const call = r.fightCalls("blue").find((e) => typeof e.focus_id === "string");
    expect(call).toBeTruthy();
    expect(call!.focus_id).toBe(RA);
    expect(call!.focus_id).not.toBe(RM);
  });
});

describe("R #4 S2-R4-2 L1926 — no 1.3 base threshold; disengage always followed; Teamwork is isolated", () => {
  it("Teamwork 90, a much greener in-range local vs a winning Focus slot: this unit hits the local (not always-follow at 50+)", () => {
    // S2-R4-4 case (1): both reds full HP, RA (Focus) sits on the shotcaller, so
    // focus_id is the slot. BA stands next to RM, far from RA, so this unit's
    // local score on RM (call 1.00, short eta) can beat call_score on RA
    // (call 1.30, long eta) at Teamwork 90. A 1.3 base threshold or a TW≥50
    // hard gate would still stick to RA.
    const r = runAi({
      T: 4.0,
      tactics: { blue: { preset: "hunt", focus: "adc" } },
      units: {
        // Cluster stays inside one G9 fight (all within 8 of the centroid).
        // BA→RA is ~7.3 tiles (eta > 1.5 s, reach < 1/1.30) so TW 90 can
        // freelance onto adjacent RM; BM sits on RA so the slot still wins L1.
        [BM]: { champ: SAME, level: 7, x: 15.0, y: PIT.y, attrs: { teamwork: 90, decision: 90 } },
        [BJ]: { champ: SAME, level: 7, x: 14.4, y: PIT.y + 0.6, attrs: { teamwork: 90 } },
        [BA]: { champ: SAME, level: 7, x: 8.5, y: PIT.y, auto: true, attrs: { teamwork: 90 } },
        [RA]: { champ: SAME, level: 7, x: 15.8, y: PIT.y },
        [RM]: { champ: SAME, level: 7, x: 9.3, y: PIT.y },
        [RJ]: { champ: SAME, level: 7, x: 14.6, y: PIT.y + 0.8 },
      },
    });
    const call = r.fightCalls("blue").find((e) => typeof e.focus_id === "string");
    expect(call).toBeTruthy();
    expect(call!.focus_id).toBe(RA);
    const aimed = aimedAt(r, BA, call!.t as number);
    expect(aimed.length).toBeGreaterThan(0);
    expect(aimed.every((e) => e.target_id === RM)).toBe(true);
    expect(aimed.some((e) => e.target_id === RA)).toBe(false);
  });

  it("a disengage call is always followed, even when a greener local body is in range", () => {
    // Same case-(1) geometry as the freelance test (focus_id is the Focus slot),
    // but blues start at 40 HP so the call is disengage. Following the call
    // means do not freelance onto red:mid (R #4 S2-R4-2 L1926).
    const r = runAi({
      T: 4.0,
      tactics: { blue: { preset: "hunt", focus: "adc" } },
      units: {
        [BM]: { champ: SAME, level: 7, x: 15.0, y: PIT.y, hp: 40, attrs: { teamwork: 90, decision: 90 } },
        [BJ]: { champ: SAME, level: 7, x: 14.4, y: PIT.y + 0.6, hp: 40, attrs: { teamwork: 90 } },
        [BA]: { champ: SAME, level: 7, x: 8.5, y: PIT.y, hp: 40, auto: true, attrs: { teamwork: 90 } },
        [RA]: { champ: SAME, level: 7, x: 15.8, y: PIT.y },
        [RM]: { champ: SAME, level: 7, x: 9.3, y: PIT.y },
        [RJ]: { champ: SAME, level: 7, x: 14.6, y: PIT.y + 0.8 },
      },
    });
    const call = r.fightCalls("blue").find((e) => typeof e.focus_id === "string");
    expect(call).toBeTruthy();
    expect(call!.commit).toBe("disengage");
    expect(call!.focus_id).toBe(RA);
    const aimed = aimedAt(r, BA, call!.t as number);
    const retreats = r.of(
      "intent",
      (e) => e.unit_id === BA && (e.t as number) >= (call!.t as number) && e.intent === "Retreat",
    );
    expect(aimed.length + retreats.length).toBeGreaterThan(0);
    expect(aimed.every((e) => e.target_id !== RM)).toBe(true);
    expect(aimed.some((e) => e.target_id === RA) || retreats.length > 0).toBe(true);
  });

  it("Teamwork does not change a Marksman's Positioning hold_dist (Teamwork affects focus-following and the peel skip only)", () => {
    const scene = (teamwork: number) =>
      runAi({
        seed: 20261122,
        T: 5.0,
        pos: true,
        units: {
          [BA]: { champ: "huntress", level: 7, x: 10, y: 4, auto: true, attrs: { positioning: 70, teamwork } },
          [RM]: { champ: "kerrig", level: 7, x: 12, y: 4, auto: true, range: 2 },
        },
      });
    const low = scene(10);
    const high = scene(90);
    expect(pathOf(low.events, BA).length + pathOf(high.events, BA).length).toBeGreaterThan(0);
    const d10 = meanHold(low, BA, RM);
    const d90 = meanHold(high, BA, RM);
    expect(Number.isFinite(d10) && Number.isFinite(d90)).toBe(true);
    expect(Math.abs(d90 - d10)).toBeLessThan(0.4);
  });
});
