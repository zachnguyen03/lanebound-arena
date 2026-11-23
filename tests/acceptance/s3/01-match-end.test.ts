/**
 * Full-match end condition (M3-30 L1752; §5.8 L311–320; S3-R5-10 L1970;
 * G3 L1884; G4 L1885; sandbox §11 S3 L701; plan §8.4 S3 L366). Sandbox
 * matches are Bo1 (sandbox §2.1 L66): no draw, no series replay. A win
 * requires score ≥ SCORE_TO_WIN and strictly ahead (S3-R5-10).
 *
 * Fixtures set forced_clock_end: false (defaultEvenConfig keeps true — _contract.md).
 * SCORE_TO_WIN / MATCH_T / SUDDEN_DEATH_T / BO1_EXTRA_S are the §15 knobs; short
 * clocks are lab fixtures in the same way S0 used MATCH_T: 2.0, not a new rule.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONSTANTS,
  type UId,
  killAt,
  phaseOf,
  placeInZone,
  runS3,
  tickOf,
} from "./_harness.js";

const BA = "blue:adc" as UId;
const BM = "blue:mid" as UId;
const RA = "red:adc" as UId;
const RM = "red:mid" as UId;
const RJ = "red:jungle" as UId;

const WIN_REASONS = ["first_to_10", "clock", "sudden_death", "zone_time", "takedowns", "coin_flip"] as const;

/** Two blue killers, two red victims, close enough for packets, autos off, shields off. */
function twoKillSetup() {
  return {
    [BA]: { x: 12, y: 7, spawn_shield_until: 0, auto: false as const },
    [BM]: { x: 12.5, y: 7, spawn_shield_until: 0, auto: false as const },
    [RA]: { x: 13, y: 7, spawn_shield_until: 0, auto: false as const },
    [RM]: { x: 13.5, y: 7, spawn_shield_until: 0, auto: false as const },
  };
}

describe("§15 defaults used by §5.8 (L1630–1636)", () => {
  it("SCORE_TO_WIN default is 10, MATCH_T 240, SUDDEN_DEATH_T 270, BO1_EXTRA_S 15", () => {
    expect(DEFAULT_CONSTANTS.SCORE_TO_WIN).toBe(10);
    expect(DEFAULT_CONSTANTS.MATCH_T).toBe(240);
    expect(DEFAULT_CONSTANTS.SUDDEN_DEATH_T).toBe(270);
    expect(DEFAULT_CONSTANTS.BO1_EXTRA_S).toBe(15);
  });
});

describe("M3-30 L1752 / §5.8 L311 / S3-R5-10 L1970 — first to SCORE_TO_WIN, strictly ahead, wins immediately", () => {
  it("two scripted takedowns with SCORE_TO_WIN=2 emit match_end.reason first_to_10, winner blue, score 2–0", () => {
    const r = runS3({
      T: 8,
      units: twoKillSetup(),
      constants: { SCORE_TO_WIN: 2 },
      damage: [killAt(5, BA, RA), killAt(6, BM, RM)],
    });
    const end = r.matchEnd();
    expect(end, "match_end must fire when the score reaches SCORE_TO_WIN and the team is strictly ahead (§5.8 L311, S3-R5-10 L1970)").toBeDefined();
    expect(end!.reason).toBe("first_to_10");
    expect(end!.winner).toBe("blue");
    expect(end!.score_blue).toBe(2);
    expect(end!.score_red).toBe(0);
    expect(end!.tick).toBe(6);
    expect(r.state.ended).toBe(true);
    expect(r.state.end_reason).toBe("first_to_10");
    expect(r.tick_count).toBe(6);
  });

  it("a single takedown with SCORE_TO_WIN=2 does not end the match (score 1 < 2)", () => {
    const r = runS3({
      T: 8,
      units: twoKillSetup(),
      constants: { SCORE_TO_WIN: 2 },
      damage: [killAt(5, BA, RA)],
    });
    expect(r.of("match_end")).toHaveLength(0);
    expect(r.state.ended).toBe(false);
    expect(r.state.score_blue).toBe(1);
    expect(r.tick_count).toBe(tickOf(8));
  });
});

describe("M3-30 L1752 / §5.8 L312 — higher score at MATCH_T wins (clock)", () => {
  it("blue 1–0 at MATCH_T=5.0 emits match_end.reason clock, winner blue, and does not enter sudden death", () => {
    const r = runS3({
      T: 5,
      units: twoKillSetup(),
      constants: { MATCH_T: 5.0, SUDDEN_DEATH_T: 8.0, BO1_EXTRA_S: 2.0, SCORE_TO_WIN: 10 },
      damage: [killAt(3, BA, RA)],
    });
    const end = r.matchEnd();
    expect(end).toBeDefined();
    expect(end!.reason).toBe("clock");
    expect(end!.winner).toBe("blue");
    expect(end!.score_blue).toBe(1);
    expect(end!.score_red).toBe(0);
    expect(end!.t).toBeCloseTo(5.0, 6);
    expect(end!.tick).toBe(50);
    expect(r.of("match_end")).toHaveLength(1);
  });
});

describe("M3-30 L1752 / §5.8 L313 / G4 L1885 — sudden death", () => {
  it("a 0–0 tie at MATCH_T does not emit match_end; phase is sudden_death (L313, §14.7 L1540)", () => {
    const r = runS3({
      T: 5.0,
      constants: { MATCH_T: 5.0, SUDDEN_DEATH_T: 8.0, BO1_EXTRA_S: 2.0 },
    });
    expect(r.of("match_end")).toHaveLength(0);
    expect(r.state.ended).toBe(false);
    expect(phaseOf(r)).toBe("sudden_death");
    expect(r.tick_count).toBe(50);
  });

  it("the next score event in (MATCH_T, SUDDEN_DEATH_T] wins with reason sudden_death (L313)", () => {
    const r = runS3({
      T: 8,
      units: twoKillSetup(),
      constants: { MATCH_T: 5.0, SUDDEN_DEATH_T: 8.0, BO1_EXTRA_S: 2.0, SCORE_TO_WIN: 10 },
      damage: [killAt(60, BA, RA)], // t=6.0, inside sudden death
    });
    const end = r.matchEnd();
    expect(end).toBeDefined();
    expect(end!.reason).toBe("sudden_death");
    expect(end!.winner).toBe("blue");
    expect(end!.score_blue).toBe(1);
    expect(end!.score_red).toBe(0);
    expect(end!.tick).toBe(60);
    expect(r.tick_count).toBe(60);
  });
});

describe("M3-30 L1752 / §5.8 L315–318 / G4 L1885 — tiebreaks at SUDDEN_DEATH_T and Bo1 coin", () => {
  it("tied scores, blue has more zone-control time: reason zone_time, winner blue (L315)", () => {
    const r = runS3({
      T: 8,
      units: {
        [BA]: placeInZone(BA),
      },
      motor: { [BA]: { to: [[12, 8]], arrive_r: 0.15, hold_at_end: true } },
      constants: { MATCH_T: 8.0, SUDDEN_DEATH_T: 8.0, BO1_EXTRA_S: 2.0, ZONE_CAPTURE_S: 3.0 },
    });
    const end = r.matchEnd();
    expect(end).toBeDefined();
    expect(end!.reason).toBe("zone_time");
    expect(end!.winner).toBe("blue");
    expect(end!.score_blue).toBe(end!.score_red);
    expect(end!.t).toBeCloseTo(8.0, 6);
  });

  it("tied scores and tied zone-control time (both 0), blue has more takedowns: reason takedowns (L316)", () => {
    const r = runS3({
      T: 8,
      units: twoKillSetup(),
      constants: { MATCH_T: 8.0, SUDDEN_DEATH_T: 8.0, BO1_EXTRA_S: 2.0, SCORE_TO_WIN: 10, CLAIM_DELAY_S: 1.0 },
      // Kill at t=0.5, well before the clock. Scores stay 1–0 until we… wait,
      // a 1–0 score would already win on clock, not reach the takedown tiebreak.
      // The takedown comparison only runs when *scores* are still tied (L314–316).
      // Assist does not increment the team score (L320), so this path cannot be
      // a 1–0 vs 0–0. Leave scores 0–0 and also takedowns 0–0? Then we would
      // fall through to the coin. To isolate takedowns, scores must be tied
      // AND takedowns must differ — which is impossible if every takedown
      // awards +1 score (§5.8 L320) unless some other score event equalises.
      // Use a red zone_tick or claim to equalise? Simpler: blue kill + red
      // claim_award (hook) so scores 1–1, takedowns 1–0, zone times 0–0.
      damage: [killAt(3, BA, RA)],
      claims: [{ tick: 4, team: "red", fight_id: "eq" }],
    });
    const end = r.matchEnd();
    expect(end).toBeDefined();
    expect(end!.reason).toBe("takedowns");
    expect(end!.winner).toBe("blue");
    expect(end!.score_blue).toBe(end!.score_red);
  });

  it("Bo1 full deadlock (0–0, no zone time, no takedowns) ends at SUDDEN_DEATH_T+BO1_EXTRA_S with coin_flip, winner blue or red, never draw (L319, sandbox L66)", () => {
    const r = runS3({
      seed: 20261122,
      T: 10,
      constants: { MATCH_T: 5.0, SUDDEN_DEATH_T: 8.0, BO1_EXTRA_S: 2.0 },
    });
    const end = r.matchEnd();
    expect(end).toBeDefined();
    expect(end!.reason).toBe("coin_flip");
    expect(end!.winner === "blue" || end!.winner === "red").toBe(true);
    expect(end!.winner).not.toBe("draw");
    expect(end!.score_blue).toBe(0);
    expect(end!.score_red).toBe(0);
    expect(end!.t).toBeCloseTo(10.0, 6);
    expect(end!.tick).toBe(100);
    const again = runS3({
      seed: 20261122,
      T: 10,
      constants: { MATCH_T: 5.0, SUDDEN_DEATH_T: 8.0, BO1_EXTRA_S: 2.0 },
    });
    expect(again.matchEnd()!.winner).toBe(end!.winner);
  });

  it("the Bo1 coin uses stream tiebreak and is seed-stable; seed+1 may differ (L319, §4.1 L119)", () => {
    const a = runS3({
      seed: 20261122,
      T: 10,
      constants: { MATCH_T: 5.0, SUDDEN_DEATH_T: 8.0, BO1_EXTRA_S: 2.0 },
    }).matchEnd()!;
    const b = runS3({
      seed: 20261123,
      T: 10,
      constants: { MATCH_T: 5.0, SUDDEN_DEATH_T: 8.0, BO1_EXTRA_S: 2.0 },
    }).matchEnd()!;
    expect(a.reason).toBe("coin_flip");
    expect(b.reason).toBe("coin_flip");
    expect(WIN_REASONS.includes(a.reason as (typeof WIN_REASONS)[number])).toBe(true);
    // Not required that 22 and 23 flip opposite sides; only that each is legal and self-stable.
    expect(a.winner === "blue" || a.winner === "red").toBe(true);
    expect(b.winner === "blue" || b.winner === "red").toBe(true);
  });
});

describe("G4 L1885 — a point scored on the MATCH_T tick counts", () => {
  it("1–1 going into MATCH_T, a blue takedown on that tick, ends clock 2–1 for blue (point is not dropped)", () => {
    const r = runS3({
      T: 5,
      units: {
        ...twoKillSetup(),
        [RJ]: { x: 14, y: 7, spawn_shield_until: 0, auto: false },
      },
      constants: { MATCH_T: 5.0, SUDDEN_DEATH_T: 8.0, BO1_EXTRA_S: 2.0, SCORE_TO_WIN: 10 },
      damage: [killAt(3, BA, RA), killAt(4, RM, BM), killAt(50, BA, RJ)],
    });
    const end = r.matchEnd();
    expect(end).toBeDefined();
    expect(end!.reason).toBe("clock");
    expect(end!.winner).toBe("blue");
    expect(end!.score_blue).toBe(2);
    expect(end!.score_red).toBe(1);
    expect(end!.tick).toBe(50);
  });

  it("score reaching SCORE_TO_WIN on the MATCH_T tick is first_to_10, not clock (L311 immediate, G4 L1885)", () => {
    const r = runS3({
      T: 5,
      units: twoKillSetup(),
      constants: { MATCH_T: 5.0, SUDDEN_DEATH_T: 8.0, SCORE_TO_WIN: 2 },
      damage: [killAt(3, BA, RA), killAt(50, BM, RM)],
    });
    const end = r.matchEnd();
    expect(end).toBeDefined();
    expect(end!.reason).toBe("first_to_10");
    expect(end!.winner).toBe("blue");
    expect(end!.score_blue).toBe(2);
    expect(end!.tick).toBe(50);
  });
});

describe("§4.3 L146 / §4.4 L156 — logging and stop", () => {
  it("after match_end the sim stops: no events on a later tick, tick_count equals the end tick", () => {
    const r = runS3({
      T: 20,
      units: twoKillSetup(),
      constants: { SCORE_TO_WIN: 2 },
      damage: [killAt(5, BA, RA), killAt(6, BM, RM)],
    });
    const end = r.matchEnd()!;
    expect(r.events.some((e) => e.tick > (end.tick as number))).toBe(false);
    expect(r.tick_count).toBe(end.tick);
  });
});
