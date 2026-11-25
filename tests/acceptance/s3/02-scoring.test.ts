/**
 * Hybrid scoring formula (M3-30; §5.8 L320; §4.4 L174–184; sandbox §8.2 L548).
 * Team score is takedowns + zone ticks + claims. Assists are personal only
 * (XP / rating) and do not increment the team score.
 */
import { describe, expect, it } from "vitest";
import {
  type UId,
  killAt,
  placeInZone,
  runS3,
  scorePartsFromEvents,
} from "./_harness.js";

const BA = "blue:adc" as UId;
const BM = "blue:mid" as UId;
const BS = "blue:support" as UId;
const RA = "red:adc" as UId;
const RM = "red:mid" as UId;

function closeCluster() {
  return {
    [BA]: { x: 12, y: 7, spawn_shield_until: 0, auto: false as const },
    [BM]: { x: 12.4, y: 7, spawn_shield_until: 0, auto: false as const },
    [BS]: { x: 12.2, y: 7.4, spawn_shield_until: 0, auto: false as const },
    [RA]: { x: 13, y: 7, hp: 80, spawn_shield_until: 0, auto: false as const },
    [RM]: { x: 13.4, y: 7, hp: 80, spawn_shield_until: 0, auto: false as const },
  };
}

describe("§5.8 L320 / §4.4 L174 — takedown team points", () => {
  it("a kill emits takedown_score for the killer's team, score_after is +1, and the team score is 1", () => {
    const r = runS3({
      T: 3,
      units: closeCluster(),
      constants: { SCORE_TO_WIN: 10 },
      damage: [killAt(5, BA, RA)],
    });
    const ev = r.of("takedown_score");
    expect(ev).toHaveLength(1);
    expect(ev[0]!.team).toBe("blue");
    expect(ev[0]!.victim_id).toBe(RA);
    expect(ev[0]!.killer_id).toBe(BA);
    expect(ev[0]!.score_after).toBe(1);
    expect(ev[0]!.tick).toBe(5);
    expect(r.state.score_blue).toBe(1);
    expect(r.state.score_red).toBe(0);
  });

  it("an assist does not increment the team score (L320); only the killer's team gains +1 once", () => {
    const r = runS3({
      T: 3,
      units: closeCluster(),
      constants: { SCORE_TO_WIN: 10 },
      // Tick 4: assist credit from mid; tick 5: adc lands the kill.
      damage: [
        { tick: 4, source: BM, target: RA, raw: 30 },
        { tick: 5, source: BA, target: RA, raw: 10_000 },
      ],
    });
    expect(r.of("takedown_score")).toHaveLength(1);
    expect(r.state.score_blue).toBe(1);
    const assistXp = r.of("xp_gain", (e) => e.source === "assist");
    expect(assistXp.length).toBeGreaterThanOrEqual(1);
    expect(assistXp.some((e) => e.unit_id === BM)).toBe(true);
    expect(r.of("takedown_score").some((e) => e.team === "red")).toBe(false);
  });

  it("two takedowns award +2 (score is the count of takedown_score events for that team)", () => {
    const r = runS3({
      T: 3,
      units: closeCluster(),
      constants: { SCORE_TO_WIN: 10 },
      damage: [killAt(5, BA, RA), killAt(6, BM, RM)],
    });
    expect(r.of("takedown_score", (e) => e.team === "blue")).toHaveLength(2);
    expect(r.state.score_blue).toBe(2);
    expect(r.of("takedown_score")[1]!.score_after).toBe(2);
  });
});

describe("§5.5 L274 / §4.4 L176 — zone_tick is +1", () => {
  it("12 s of owned exclusive occupation produces exactly one zone_tick and team score +1 (M3-27 L1749)", () => {
    const r = runS3({
      T: 16,
      units: { [BA]: placeInZone(BA) },
      constants: { ZONE_CAPTURE_S: 3.0, ZONE_TICK_S: 12.0, SCORE_TO_WIN: 10 },
    });
    const ticks = r.of("zone_tick");
    expect(ticks).toHaveLength(1);
    expect(ticks[0]!.team).toBe("blue");
    expect(ticks[0]!.score_after).toBe(1);
    expect(r.state.score_blue).toBe(1);
    expect(r.state.score_red).toBe(0);
  });
});

describe("§5.6 L292 / §4.4 L184 — claim_award is +1", () => {
  it("an uncontested claim awards +1 to the claiming team even if they do not occupy or own the zone (M3-26 L1748)", () => {
    const r = runS3({
      T: 4,
      // Everyone stays on pads — zone empty.
      constants: { CLAIM_DELAY_S: 1.0, SCORE_TO_WIN: 10 },
      claims: [{ tick: 5, team: "blue", fight_id: "f1" }],
    });
    const open = r.of("claim_open");
    expect(open).toHaveLength(1);
    expect(open[0]!.team).toBe("blue");
    expect(open[0]!.resolve_at).toBeCloseTo(0.5 + 1.0, 6);
    const awards = r.of("claim_award");
    expect(awards).toHaveLength(1);
    expect(awards[0]!.team).toBe("blue");
    expect(awards[0]!.score_after).toBe(1);
    expect(r.state.score_blue).toBe(1);
    expect(r.of("claim_deny")).toHaveLength(0);
  });
});

describe("sandbox §8.2 L548 / career-match/1 — score is kills + ticks + claims", () => {
  it("final score_blue equals the event-derived score_parts sum (takedown + tick + claim)", () => {
    const r = runS3({
      T: 16,
      units: {
        [BA]: placeInZone(BA, { champ: "huntress" }),
        [RA]: { x: 18, y: 8, spawn_shield_until: 0, auto: false },
      },
      constants: {
        ZONE_CAPTURE_S: 3.0,
        ZONE_TICK_S: 12.0,
        CLAIM_DELAY_S: 1.0,
        SCORE_TO_WIN: 10,
      },
      damage: [killAt(5, BA, RA)],
      claims: [{ tick: 8, team: "blue", fight_id: "f2" }],
    });
    const parts = scorePartsFromEvents(r.events, "blue");
    expect(parts.kills).toBe(1);
    expect(parts.ticks).toBe(1);
    expect(parts.claims).toBe(1);
    expect(r.state.score_blue).toBe(parts.kills + parts.ticks + parts.claims);
    expect(r.state.score_blue).toBe(3);
    const red = scorePartsFromEvents(r.events, "red");
    expect(red.kills + red.ticks + red.claims).toBe(r.state.score_red);
  });
});
