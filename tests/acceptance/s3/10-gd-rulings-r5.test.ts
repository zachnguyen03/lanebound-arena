/**
 * Appendix R #5 — S3 rulings S3-R5-1..10 (L1932–L1972).
 * Each case cites its ruling line. Zone counters are integer ticks internally
 * (L1934); public fields are seconds (ticks/10). Helpers in `_harness.ts`
 * accept either representation.
 */
import { describe, expect, it } from "vitest";
import {
  ORB_PADS,
  type UId,
  allPlayerStats,
  barTicks,
  claimDeniesOf,
  controlTime,
  deniersOf,
  killAt,
  pathOf,
  placeInZone,
  runS3,
  streamCounter,
  timerTicks,
  zoneOf,
  zoneSecondsOf,
} from "./_harness.js";

const BA = "blue:adc" as UId;
const BM = "blue:mid" as UId;
const BJ = "blue:jungle" as UId;
const RA = "red:adc" as UId;
const RM = "red:mid" as UId;
const RJ = "red:jungle" as UId;
const RT = "red:top" as UId;
const PAD0 = { x: ORB_PADS[0]![0], y: ORB_PADS[0]![1] };

function close() {
  return {
    [BA]: { x: 12, y: 7, spawn_shield_until: 0, auto: false as const },
    [BM]: { x: 12.4, y: 7, spawn_shield_until: 0, auto: false as const },
    [RA]: { x: 13, y: 7, spawn_shield_until: 0, auto: false as const },
    [RM]: { x: 13.4, y: 7, spawn_shield_until: 0, auto: false as const },
  };
}

describe("S3-R5-1 L1936–L1945 — independent bars, 1.0/s drain, integer ticks", () => {
  it("a bar rises 1.0 s/s only when exclusive: 20 exclusive ticks → 20 on the bar, no capture yet", () => {
    const r = runS3({ T: 2.0, units: { [BA]: placeInZone(BA) } });
    expect(barTicks(zoneOf(r), "blue")).toBe(20);
    expect(barTicks(zoneOf(r), "red")).toBe(0);
    expect(r.of("zone_capture")).toHaveLength(0);
  });

  it("30 exclusive ticks give zone_capture on the 30th tick (t=3.0); both bars then 0 (L1941, L1945)", () => {
    const r = runS3({ T: 3.0, units: { [BA]: placeInZone(BA) } });
    const cap = r.of("zone_capture");
    expect(cap).toHaveLength(1);
    expect(cap[0]!.tick).toBe(30);
    expect(cap[0]!.t).toBeCloseTo(3.0, 6);
    expect(zoneOf(r).owner).toBe("blue");
    expect(barTicks(zoneOf(r), "blue")).toBe(0);
    expect(barTicks(zoneOf(r), "red")).toBe(0);
    // Capture tick counts as the new owner's first timer tick (L1943).
    expect(timerTicks(zoneOf(r))).toBe(1);
    expect(controlTime(zoneOf(r), "blue")).toBeCloseTo(0.1, 6);
  });

  it("the bar falls 1.0 s/s when empty: 20 exclusive ticks then 10 empty ticks → 10 remaining (L1938, L1945)", () => {
    const r = runS3({
      T: 3.0,
      units: { [BA]: placeInZone(BA) },
      // G8 / S3-R5-1: a banish is visible to this tick's phase-11 occupancy.
      // Ticks 1–20 exclusive, then banish from tick 21 through 30 (10 empty ticks).
      cc: [{ tick: 21, target: BA, kind: "banish", duration: 5 }],
    });
    expect(barTicks(zoneOf(r), "blue")).toBe(10);
    expect(zoneOf(r).owner).toBeNull();
  });


  it("flip tick, no partial credit: Blue holds 20 ticks alone, then one Red-exclusive tick leaves Blue 19 and Red 1 (L1942)", () => {
    const r = runS3({
      T: 2.1,
      units: {
        [BA]: placeInZone(BA, {}, { x: -0.6 }),
        [RA]: placeInZone(RA, {}, { x: 0.6 }),
      },
      cc: [
        { tick: 1, target: RA, kind: "banish", duration: 2.0 },
        { tick: 21, target: BA, kind: "banish", duration: 5 },
      ],
    });
    expect(barTicks(zoneOf(r), "blue")).toBe(19);
    expect(barTicks(zoneOf(r), "red")).toBe(1);
    expect(zoneOf(r).owner).toBeNull();
  });

  it("both bars freeze when contested (L1938, L1945)", () => {
    const r = runS3({
      T: 3.0,
      units: {
        [BA]: placeInZone(BA, {}, { x: -0.6 }),
        [RA]: placeInZone(RA, {}, { x: 0.6 }),
      },
      cc: [{ tick: 1, target: RA, kind: "banish", duration: 1.5 }],
    });
    // 15 exclusive ticks then contest freezes at 15.
    expect(barTicks(zoneOf(r), "blue")).toBe(15);
    expect(barTicks(zoneOf(r), "red")).toBe(0);
    expect(r.of("zone_capture")).toHaveLength(0);
  });

  it("owner's bar is held at 0; only the non-owner accumulates after capture (L1940)", () => {
    const r = runS3({
      T: 5.0,
      units: { [BA]: placeInZone(BA) },
    });
    expect(zoneOf(r).owner).toBe("blue");
    expect(barTicks(zoneOf(r), "blue")).toBe(0);
    expect(barTicks(zoneOf(r), "red")).toBe(0);
  });

  it("120 owned-exclusive ticks give exactly one zone_tick; the capture tick is the first of those 120 (L1943, L1945)", () => {
    const r = runS3({ T: 16, units: { [BA]: placeInZone(BA) } });
    const ticks = r.of("zone_tick");
    expect(ticks).toHaveLength(1);
    expect(ticks[0]!.team).toBe("blue");
    // Tick 30 = capture (timer=1); timer hits 120 on tick 149, t=14.9.
    expect(ticks[0]!.tick).toBe(149);
    expect(ticks[0]!.t).toBeCloseTo(14.9, 6);
  });

  it("119 owned-exclusive ticks, a contest of any length, then 1 more exclusive tick give exactly one zone_tick (L1945)", () => {
    // Exclusive 30..148 (119 ticks), contest 149–154, exclusive again from 155 → tick on 155.
    const r = runS3({
      T: 16,
      units: {
        [BA]: placeInZone(BA, {}, { x: -0.6 }),
        [RA]: placeInZone(RA, {}, { x: 0.6 }),
      },
      cc: [
        // 14.75 s covers ticks 1–148 and is expired by 149 when a newly applied
        // CC is not ticked down on its apply tick (L144 "Tick existing durations").
        { tick: 1, target: RA, kind: "banish", duration: 14.75 },
        { tick: 155, target: RA, kind: "banish", duration: 20 },
      ],
    });
    const ticks = r.of("zone_tick");
    expect(ticks).toHaveLength(1);
    expect(ticks[0]!.team).toBe("blue");
    expect((ticks[0]!.tick as number) >= 150).toBe(true);
    expect((ticks[0]!.t as number) + 1e-9).toBeGreaterThanOrEqual(15.0);
    expect((ticks[0]!.t as number)).toBeLessThan(16.0);
  });

  it("an ownership flip resets tick_timer (L1943, L1945)", () => {
    // Blue captures at 30; holds exclusive until timer is well above 1; then Red
    // takes 30 exclusive ticks and captures. After Red's capture, timer is 1 (reset, then first tick).
    const r = runS3({
      // End on Red's capture tick. Running past it would leave timer > 1.
      // duration 4.95 (not 5.0): a newly applied CC is not ticked on the apply
      // tick (L144), so ticks 1–50 are Blue-exclusive and tick 51 is unambiguously
      // Red-exclusive (5.0 is a 50-tick boundary and can leave a leftover 1e-16).
      T: 8.0,
      units: {
        [BA]: placeInZone(BA, {}, { x: -0.6 }),
        [RA]: placeInZone(RA, {}, { x: 0.6 }),
      },
      cc: [
        { tick: 1, target: RA, kind: "banish", duration: 4.95 },
        { tick: 51, target: BA, kind: "banish", duration: 20 }, // red exclusive ticks 51–80
      ],
    });
    expect(zoneOf(r).owner).toBe("red");
    const cap = r.of("zone_capture", (e) => e.team === "red");
    expect(cap.length).toBeGreaterThanOrEqual(1);
    expect(timerTicks(zoneOf(r))).toBe(1);
    expect(timerTicks(zoneOf(r))).not.toBeGreaterThan(1);
  });
});

describe("S3-R5-2 L1947–L1951 — phase-14 single decision, trades cancel, precedence", () => {
  it("mutual kill on a sudden-death tick: no match_end, both scores +1, play continues (L1951)", () => {
    const r = runS3({
      T: 8,
      units: close(),
      constants: { MATCH_T: 5.0, SUDDEN_DEATH_T: 12.0, SCORE_TO_WIN: 10 },
      damage: [killAt(60, BA, RA), killAt(60, RM, BM)],
    });
    expect(r.of("takedown_score")).toHaveLength(2);
    expect(r.state.score_blue).toBe(1);
    expect(r.state.score_red).toBe(1);
    expect(r.of("match_end")).toHaveLength(0);
    expect(r.state.ended).toBe(false);
    expect(r.tick_count).toBe(80);
  });

  it("a takedown plus a zone_tick for the same team on one SD tick: one match_end, reason sudden_death, both events logged first, score +2 (L1951)", () => {
    const r = runS3({
      T: 8,
      units: {
        [BA]: placeInZone(BA),
        [RA]: { x: 18, y: 8, spawn_shield_until: 0, auto: false },
        [RM]: { x: 18.5, y: 8, spawn_shield_until: 0, auto: false },
      },
      constants: {
        MATCH_T: 14.0,
        SUDDEN_DEATH_T: 20.0,
        SCORE_TO_WIN: 10,
        ZONE_CAPTURE_S: 3.0,
        ZONE_TICK_S: 12.0,
      },
      damage: [killAt(149, BA, RA)], // same tick as the first zone_tick (S3-R5-1: tick 149)
    });
    const end = r.matchEnd();
    expect(end).toBeDefined();
    expect(end!.reason).toBe("sudden_death");
    expect(end!.winner).toBe("blue");
    expect(end!.score_blue).toBe(2);
    expect(end!.tick).toBe(149);
    const onTick = r.events.filter((e) => e.tick === 149);
    const types = onTick.map((e) => e.type);
    expect(types.filter((ty) => ty === "takedown_score" || ty === "zone_tick")).toEqual([
      "takedown_score",
      "zone_tick",
    ]);
    expect(types.indexOf("takedown_score")).toBeLessThan(types.indexOf("match_end"));
    expect(types.indexOf("zone_tick")).toBeLessThan(types.indexOf("match_end"));
  });


  it("Blue takedown and Red zone_tick on the same SD tick cancel (L1951) — red owns the pit, blue kills a red body outside it", () => {
    const r = runS3({
      T: 16,
      units: {
        [RA]: placeInZone(RA),
        [RM]: { x: 18, y: 8, spawn_shield_until: 0, auto: false },
        [BA]: { x: 18.5, y: 8, spawn_shield_until: 0, auto: false },
      },
      constants: {
        MATCH_T: 14.0,
        SUDDEN_DEATH_T: 20.0,
        SCORE_TO_WIN: 10,
        ZONE_TICK_S: 12.0,
      },
      damage: [killAt(149, BA, RM)],
    });
    expect(r.of("takedown_score", (e) => e.team === "blue" && e.tick === 149)).toHaveLength(1);
    expect(r.of("zone_tick", (e) => e.team === "red" && e.tick === 149)).toHaveLength(1);
    expect(r.state.score_blue).toBe(r.state.score_red);
    expect(r.of("match_end")).toHaveLength(0);
    expect(r.state.ended).toBe(false);
  });

  it("log order on one tick: takedown_score (Blue victims then Red) before zone_capture / zone_tick / claim_award (L1947)", () => {
    // Two deaths same tick, one each side, plus a claim award resolved the same tick,
    // is enough to pin takedown-before-claim_award. zone_tick order is pinned above.
    const r = runS3({
      T: 3,
      // close() sits in the pit and would deny the blue claim (§5.6). The pin
      // is log order, so the bodies stand outside and the claim is awarded.
      units: {
        [BA]: { x: 4, y: 2, spawn_shield_until: 0, auto: false },
        [BM]: { x: 4.5, y: 2, spawn_shield_until: 0, auto: false },
        [RA]: { x: 20, y: 2, spawn_shield_until: 0, auto: false },
        [RM]: { x: 20.5, y: 2, spawn_shield_until: 0, auto: false },
      },
      constants: { CLAIM_DELAY_S: 0.5, SCORE_TO_WIN: 10, MATCH_T: 3.0 },
      claims: [{ tick: 5, team: "blue", fight_id: "ord" }], // resolve_at = 0.5+0.5=1.0, tick 10
      damage: [killAt(10, BA, RA), killAt(10, RM, BM)],
    });
    const on10 = r.events.filter((e) => e.tick === 10);
    const tds = on10.filter((e) => e.type === "takedown_score");
    const award = on10.find((e) => e.type === "claim_award");
    expect(tds).toHaveLength(2);
    expect(tds[0]!.victim_id).toBe(BM); // Blue mid before Red adc in unit order of *victims*?
    // "death order (phase 10, Blue 0..4 then Red 0..4 victims)" — BM (blue mid) before RA (red adc).
    expect(tds[0]!.victim_id).toBe(BM);
    expect(tds[1]!.victim_id).toBe(RA);
    expect(award).toBeDefined();
    expect((tds[1]!.seq as number) < (award!.seq as number)).toBe(true);
  });

  it("precedence: at MATCH_T, a score that leaves a team ≥ SCORE_TO_WIN and strictly ahead is first_to_10, not clock (L1949, L1970)", () => {
    const r = runS3({
      T: 5,
      units: close(),
      constants: { MATCH_T: 5.0, SUDDEN_DEATH_T: 8.0, SCORE_TO_WIN: 2 },
      damage: [killAt(3, BA, RA), killAt(50, BM, RM)],
    });
    expect(r.matchEnd()!.reason).toBe("first_to_10");
    expect(r.matchEnd()!.winner).toBe("blue");
  });
});

describe("S3-R5-3 L1953–L1955 — catch-up snapshot over all five enemies, folded xp_gain", () => {
  it("after the enemy L5 dies, the next time XP and the next orb on a L3 unit are still bumped (L1954)", () => {
    const r = runS3({
      T: 8.3,
      units: {
        [BA]: { x: PAD0.x, y: PAD0.y, level: 3, xp: 320, spawn_shield_until: 0, auto: false },
        [RA]: { x: 18, y: 8, level: 5, xp: 820, hp: 40, spawn_shield_until: 0, auto: false },
        [BM]: { x: 6, y: 8, spawn_shield_until: 0, auto: false },
      },
      damage: [killAt(20, BM, RA)], // t=2.0, well before the orb pickup at 8.1
    });
    expect(r.of("death", (e) => e.unit_id === RA)).toHaveLength(1);
    const timeAfter = r.of("xp_gain", (e) => e.unit_id === BA && e.source === "time" && (e.tick as number) > 20);
    expect(timeAfter.length).toBeGreaterThan(0);
    expect(timeAfter[0]!.amount).toBeCloseTo(1.3225, 4);
    expect(timeAfter[0]!.source).toBe("time");
    const orb = r.of("xp_gain", (e) => e.unit_id === BA && e.source === "orb");
    expect(orb).toHaveLength(1);
    expect(orb[0]!.amount).toBe(138);
    expect(r.of("orb_pickup", (e) => e.unit_id === BA)[0]!.xp).toBe(138);
  });

  it("a unit that becomes L3 this tick is scored off the start-of-tick level; next tick uses the new level (L1954)", () => {
    // Enemy is L4. Blue starts the crossing tick as L2 (gap 2, eligible). After the
    // award they are L3; the following tick the gap is 1 and catch-up stops.
    const startXp = 320 - 1.3225; // L3 threshold is 320
    const r = runS3({
      T: 1.0,
      units: {
        [BA]: { x: 4, y: 8, level: 2, xp: startXp, spawn_shield_until: 0, auto: false },
        [RA]: { x: 20, y: 8, level: 4, xp: 540, spawn_shield_until: 0, auto: false },
      },
    });
    const t1 = r.of("xp_gain", (e) => e.unit_id === BA && e.source === "time" && e.tick === 1)[0]!;
    expect(t1.amount).toBeCloseTo(1.3225, 4);
    const up = r.of("level_up", (e) => e.unit_id === BA && e.new_level === 3);
    expect(up).toHaveLength(1);
    expect(up[0]!.tick).toBe(1);
    const t2 = r.of("xp_gain", (e) => e.unit_id === BA && e.source === "time" && e.tick === 2)[0]!;
    expect(t2.amount).toBeCloseTo(1.15, 4);
  });

  it("folded event: time catch-up is 1.3225 source time; orb is 138; no source catchup is ever emitted (L1955)", () => {
    const r = runS3({
      T: 8.3,
      units: {
        [BA]: { x: PAD0.x, y: PAD0.y, level: 1, xp: 0, spawn_shield_until: 0, auto: false },
        [RA]: { x: 20, y: 8, level: 5, xp: 820, spawn_shield_until: 0, auto: false },
      },
    });
    expect(r.of("xp_gain", (e) => e.source === "catchup")).toHaveLength(0);
    const time = r.of("xp_gain", (e) => e.unit_id === BA && e.source === "time" && e.tick === 1)[0]!;
    expect(time.amount).toBeCloseTo(1.3225, 4);
    const orb = r.of("orb_pickup", (e) => e.unit_id === BA)[0]!;
    expect(orb.xp).toBe(138);
    const orbXp = r.of("xp_gain", (e) => e.unit_id === BA && e.source === "orb");
    expect(orbXp).toHaveLength(1);
    expect(orbXp[0]!.amount).toBe(138);
    const sumOrb = orbXp.reduce((s, e) => s + (e.amount as number), 0);
    expect(sumOrb).toBe(orb.xp);
    for (const e of r.of("orb_pickup")) {
      expect(e.xp === 120 || e.xp === 138).toBe(true);
    }
  });
});

describe("S3-R5-4 L1957 — CC'd units occupy; banished and dead do not", () => {
  it.each(["stun", "root", "sleep", "knockup", "fear", "hex", "timestop"] as const)(
    "a %s unit in the radius is an occupant",
    (kind) => {
      const r = runS3({
        T: 1.0,
        units: { [BA]: placeInZone(BA) },
        cc: [{ tick: 1, target: BA, kind, duration: 5 }],
      });
      expect(zoneOf(r).occupied).toContain(BA);
    },
  );

  it("a time-stopped defender in the pit contests it and does not hand capture to the attacker (L1957)", () => {
    const r = runS3({
      T: 4.0,
      units: {
        [BA]: placeInZone(BA, {}, { x: -0.6 }),
        [RA]: placeInZone(RA, {}, { x: 0.6 }),
      },
      cc: [{ tick: 1, target: BA, kind: "timestop", duration: 10 }],
    });
    expect(zoneOf(r).occupied).toEqual(expect.arrayContaining([BA, RA]));
    expect(r.of("zone_capture")).toHaveLength(0);
    expect(barTicks(zoneOf(r), "red")).toBe(0);
    expect(barTicks(zoneOf(r), "blue")).toBe(0);
  });

  it("banished and dead units do not occupy (L1957, §5.5 L270)", () => {
    const ban = runS3({
      T: 1.0,
      units: { [BA]: placeInZone(BA) },
      cc: [{ tick: 1, target: BA, kind: "banish", duration: 5 }],
    });
    expect(zoneOf(ban).occupied).not.toContain(BA);

    const dead = runS3({
      T: 1.5,
      units: {
        [BA]: placeInZone(BA, { hp: 40 }),
        [RA]: { x: 18, y: 8, spawn_shield_until: 0, auto: false },
      },
      damage: [killAt(5, RA, BA)],
    });
    expect(zoneOf(dead).occupied).not.toContain(BA);
  });
});

describe("S3-R5-5 L1959 — G7 pickup once in phase 11, no swept path, orbs and buffs", () => {
  it.each(["fear", "hex", "leash", "silence", "disarm", "slow", "break", "blind", "mute"] as const)(
    "a %s unit still picks up an orb (G7 for every status except dead/banish/timestop)",
    (kind) => {
      const r = runS3({
        T: 8.3,
        units: { [BA]: { x: PAD0.x, y: PAD0.y, spawn_shield_until: 0, auto: false } },
        // Apply on the pickup tick (81): movement this tick is still unforced, so
        // a solo hex/fear/leash cannot walk off the pad before phase 11 (G7, L1959).
        cc: [{ tick: 81, target: BA, kind, duration: 5 }],
      });
      expect(r.of("orb_spawn").length).toBeGreaterThanOrEqual(8);
      expect(r.of("orb_pickup", (e) => e.unit_id === BA)).toHaveLength(1);
    },
  );

  it("spawn shield does not block orb pickup (L1959)", () => {
    const r = runS3({
      T: 8.3,
      units: { [BA]: { x: PAD0.x, y: PAD0.y, spawn_shield_until: 999, auto: false } },
    });
    expect(r.of("orb_pickup", (e) => e.unit_id === BA)).toHaveLength(1);
  });

  it("the same G7 rule applies to flank buffs: fear still picks up; banish does not (L1959)", () => {
    const fear = runS3({
      T: 3.0,
      units: { [BA]: { x: 7.5, y: 7.5, spawn_shield_until: 0, auto: false } },
      constants: { BUFF_FIRST_SPAWN_S: 1.0 },
      cc: [{ tick: 11, target: BA, kind: "fear", duration: 5 }],
    });
    expect(fear.of("buff_pickup", (e) => e.unit_id === BA)).toHaveLength(1);

    const ban = runS3({
      T: 3.0,
      units: { [BA]: { x: 7.5, y: 7.5, spawn_shield_until: 0, auto: false } },
      constants: { BUFF_FIRST_SPAWN_S: 1.0 },
      cc: [{ tick: 5, target: BA, kind: "banish", duration: 5 }],
    });
    expect(ban.of("buff_spawn").length).toBeGreaterThanOrEqual(2);
    expect(ban.of("buff_pickup", (e) => e.unit_id === BA)).toHaveLength(0);
  });

  it("a unit that died this tick cannot pick up, even if it was on the pad (L1959)", () => {
    const r = runS3({
      T: 8.3,
      units: {
        [BA]: { x: PAD0.x, y: PAD0.y, hp: 40, spawn_shield_until: 0, auto: false },
        [RA]: { x: 6, y: 4.5, spawn_shield_until: 0, auto: false },
      },
      damage: [{ tick: 81, source: RA, target: BA, raw: 10_000 }],
    });
    expect(r.of("orb_spawn").length).toBeGreaterThanOrEqual(8);
    expect(r.of("death", (e) => e.unit_id === BA && e.tick === 81)).toHaveLength(1);
    expect(r.of("orb_pickup", (e) => e.unit_id === BA)).toHaveLength(0);
  });

  it("pickup uses end-of-tick position only (no swept path): a unit that crosses the pad in one tick and ends outside does not pick up (L1959)", () => {
    // Start south of the pad, one tick of MS=40 covers 4 tiles, ending north of it.
    const r = runS3({
      T: 8.3,
      pos: true,
      units: {
        [BA]: { x: PAD0.x, y: PAD0.y - 2.0, champ: "huntress", ms: 40, spawn_shield_until: 0, auto: false },
      },
      motor: { [BA]: { to: [[PAD0.x, PAD0.y + 2.0]], arrive_r: 0.15, hold_at_end: true } },
      constants: { ORB_FIRST_SPAWN_S: 0.5, ORB_PICKUP_R: 0.9 },
    });
    // By t=8.3 they have long since passed; first spawn at 0.5, pickup check from the next tick.
    // If any end-of-tick pose was inside r=0.9 there would be a pickup — the path is the diameter.
    const path = pathOf(r.events, BA);
    const endedInside = path.filter((p) => p.t >= 0.5).filter((p) => Math.hypot(p.x - PAD0.x, p.y - PAD0.y) <= 0.9 + 1e-9);
    if (endedInside.length === 0) {
      expect(r.of("orb_spawn").length).toBeGreaterThanOrEqual(1);
      expect(r.of("orb_pickup", (e) => e.unit_id === BA)).toHaveLength(0);
    } else {
      // If a tick landed inside, the fixture did not isolate sweep; do not invent a pass.
      expect.fail(`fixture landed inside the pad at t=${endedInside[0]!.t}; sweep cannot be isolated`);
    }
  });
});

describe("S3-R5-6 L1961 — Bo1 extra 15 s: sudden_death, ladder once at 270, coin_flip at 285", () => {

  it("scaled clocks: a score in (SUDDEN_DEATH_T, SUDDEN_DEATH_T+BO1_EXTRA] is sudden_death, and rng_counters.tiebreak is unchanged (L1961)", () => {
    const endedEarly = runS3({
      T: 4,
      units: close(),
      constants: { MATCH_T: 2.0, SUDDEN_DEATH_T: 4.0, BO1_EXTRA_S: 2.0, SCORE_TO_WIN: 2 },
      damage: [killAt(3, BA, RA), killAt(4, BM, RM)],
    });
    const base = streamCounter(endedEarly, "tiebreak");

    const r = runS3({
      T: 8,
      units: close(),
      constants: { MATCH_T: 4.0, SUDDEN_DEATH_T: 6.0, BO1_EXTRA_S: 2.0, SCORE_TO_WIN: 10 },
      damage: [killAt(70, BA, RA)], // t=7.0, inside (6.0, 8.0]
    });
    const end = r.matchEnd();
    expect(end).toBeDefined();
    expect(end!.reason).toBe("sudden_death");
    expect(end!.winner).toBe("blue");
    expect(end!.t).toBeCloseTo(7.0, 6);
    expect(streamCounter(r, "tiebreak")).toBe(base);
  });



  it("a body banished until after the 4:30 ladder, then occupying the pit through 4:45, still ends coin_flip (ladder not re-run, L1961)", () => {
    const r = runS3({
      seed: 20261122,
      T: 10,
      units: { [BA]: placeInZone(BA) },
      cc: [{ tick: 1, target: BA, kind: "banish", duration: 6.1 }], // hidden through t=6.1
      constants: { MATCH_T: 6.0, SUDDEN_DEATH_T: 6.0, BO1_EXTRA_S: 4.0, SCORE_TO_WIN: 10 },
    });
    const end = r.matchEnd();
    expect(end).toBeDefined();
    expect(end!.reason).toBe("coin_flip");
    expect(end!.t).toBeCloseTo(10.0, 6);
    expect(end!.winner === "blue" || end!.winner === "red").toBe(true);
  });
});

describe("S3-R5-7 L1963 — aura starts one tick after zone_capture", () => {
  it("the first aura regen tick is the tick after zone_capture: +1.5 HP that tick, not on the capture tick itself", () => {
    const atCapture = runS3({
      T: 3.0,
      units: { [BA]: placeInZone(BA, { hp: 200, champ: "huntress" }) },
    });
    expect(atCapture.of("zone_capture")[0]!.tick).toBe(30);
    const hp30 = atCapture.unit(BA)!.hp;

    const after = runS3({
      T: 3.1,
      units: { [BA]: placeInZone(BA, { hp: 200, champ: "huntress" }) },
    });
    const hp31 = after.unit(BA)!.hp;
    // Tick 31 phase 9: previous tick is owned+exclusive, so +1.5 aura plus one tick of base regen.
    // Tick 30 phase 9 used the pre-capture state: base regen only.
    expect(hp31 - hp30).toBeCloseTo(1.5 + 0.4, 1); // Huntress L1 regen 4/s → 0.4/tick
  });

  it("a time-stopped occupant keeps the aura resists but gets no regen (L1963)", () => {
    const raw = 200;
    const r = runS3({
      T: 4.0,
      units: {
        [BA]: placeInZone(BA, { hp: 400, champ: "huntress" }),
        [RA]: { x: 18, y: 8, spawn_shield_until: 0, auto: false },
      },
      cc: [{ tick: 32, target: BA, kind: "timestop", duration: 5 }],
      damage: [{ tick: 35, source: RA, target: BA, raw }],
    });
    // Aura resists are live from tick 31. Mitigated damage should be less than a
    // no-capture control.
    const ctrl = runS3({
      T: 1.0,
      units: {
        [BA]: placeInZone(BA, { hp: 400, champ: "huntress" }),
        [RA]: { x: 18, y: 8, spawn_shield_until: 0, auto: false },
      },
      damage: [{ tick: 5, source: RA, target: BA, raw }],
    });
    const hAura = r.of("hit", (e) => e.target_id === BA)[0]!;
    const hCtrl = ctrl.of("hit", (e) => e.target_id === BA)[0]!;
    if (typeof hAura.mitigated === "number" && typeof hCtrl.mitigated === "number") {
      expect(hAura.mitigated).toBeLessThan(hCtrl.mitigated);
    } else {
      expect(r.unit(BA)!.hp).toBeGreaterThan(ctrl.unit(BA)!.hp);
    }

    const beforeStop = runS3({
      T: 3.2,
      units: { [BA]: placeInZone(BA, { hp: 200, champ: "huntress" }) },
    });
    const duringStop = runS3({
      T: 3.5,
      units: { [BA]: placeInZone(BA, { hp: 200, champ: "huntress" }) },
      cc: [{ tick: 33, target: BA, kind: "timestop", duration: 5 }],
    });
    // Ticks 34–35 are time-stopped: no regen (base or aura). HP stays at the tick-33 value.
    expect(duringStop.unit(BA)!.hp).toBeCloseTo(beforeStop.unit(BA)!.hp, 1);
  });
});

describe("S3-R5-8 L1965–L1966 — dwell N = max(1, round(dwell×10)), additive deniers", () => {
  it("default dwell 0 → N=1: any occupant at resolve_at denies, and deniers lists them in unit order", () => {
    const r = runS3({
      T: 2.5,
      units: {
        [RJ]: placeInZone(RJ, {}, { x: 0.5 }),
        [RT]: placeInZone(RT, {}, { x: -0.5 }),
      },
      constants: { CLAIM_DELAY_S: 1.0, CLAIM_DENY_DWELL_S: 0.0 },
      claims: [{ tick: 5, team: "blue", fight_id: "n1" }],
    });
    const ev = r.of("claim_deny")[0]!;
    expect(ev).toBeDefined();
    const deniers = deniersOf(ev);
    expect(deniers).toEqual([RT, RJ]); // unit order: red top then red jungle
    expect(ev.denier_id === RT || ev.denier_id === RJ).toBe(true);
    expect(claimDeniesOf(r, RT)).toBe(1);
    expect(claimDeniesOf(r, RJ)).toBe(1);
  });


  it("dwell 0.5 s → N=5: a unit banished until the resolve tick, then present only that tick, does not deny; a unit present for 5 continuous ticks does, and only that unit is in deniers (L1965–L1966)", () => {
    const r = runS3({
      T: 2.5,
      units: {
        [RA]: placeInZone(RA, {}, { x: 0.6 }), // continuous occupant
        [RM]: placeInZone(RM, {}, { x: -0.6 }), // will be hidden until the last tick
      },
      constants: { CLAIM_DELAY_S: 1.0, CLAIM_DENY_DWELL_S: 0.5 },
      claims: [{ tick: 5, team: "blue", fight_id: "dwell5" }], // resolve t=1.5, tick 15
      cc: [{ tick: 1, target: RM, kind: "banish", duration: 1.4 }], // expires just at resolve
    });
    const ev = r.of("claim_deny")[0]!;
    expect(ev).toBeDefined();
    const deniers = deniersOf(ev);
    expect(deniers).toContain(RA);
    expect(deniers).not.toContain(RM);
    expect(ev.denier_id).toBe(RA);
    expect(claimDeniesOf(r, RA)).toBe(1);
    expect(claimDeniesOf(r, RM)).toBe(0);
  });

  it("a paid claim emits no deniers and credits no claim_denies (L1966)", () => {
    const r = runS3({
      T: 2.5,
      constants: { CLAIM_DELAY_S: 1.0 },
      claims: [{ tick: 5, team: "blue", fight_id: "paid" }],
    });
    expect(r.of("claim_award")).toHaveLength(1);
    expect(r.of("claim_deny")).toHaveLength(0);
    expect(claimDeniesOf(r, RA)).toBe(0);
  });
});

describe("S3-R5-9 L1968 — per-player zone_seconds and the team-sum invariant", () => {
  it("zone_seconds is occupant ticks / 10, including contested time, and is ≤ match seconds", () => {
    const r = runS3({
      T: 2.0,
      units: {
        [BA]: placeInZone(BA, {}, { x: -0.6 }),
        [RA]: placeInZone(RA, {}, { x: 0.6 }),
      },
    });
    // Tick 0 is setup (no occupancy credit). Ticks 1–20 both occupy → 2.0 s each.
    expect(zoneSecondsOf(r, BA)).toBeCloseTo(2.0, 4);
    expect(zoneSecondsOf(r, RA)).toBeCloseTo(2.0, 4);
    expect(zoneSecondsOf(r, BA)).toBeLessThanOrEqual(2.0 + 1e-9);
    expect(zoneSecondsOf(r, BM)).toBeCloseTo(0, 4);
  });

  it("per team, Σ zone_seconds ≥ control_time (every owned-exclusive tick has at least one occupant)", () => {
    const r = runS3({
      T: 5.0,
      units: {
        [BA]: placeInZone(BA, {}, { x: -0.4 }),
        [BM]: placeInZone(BM, {}, { x: 0.4 }),
      },
    });
    const z = zoneOf(r);
    expect(z.owner).toBe("blue");
    const sumBlue = allPlayerStats(r)
      .filter((p) => (p.unit_id ?? p.player_id ?? "").startsWith("blue"))
      .reduce((s, p) => s + (p.zone_seconds ?? 0), 0);
    expect(sumBlue + 1e-9).toBeGreaterThanOrEqual(controlTime(z, "blue"));
    expect(sumBlue).toBeGreaterThan(controlTime(z, "blue") - 1e-9);
    // Two bodies in the pit: sum should be strictly above team control time.
    expect(sumBlue).toBeGreaterThan(controlTime(z, "blue"));
  });
});

describe("S3-R5-10 L1970 — win needs score ≥ 10 and strictly ahead", () => {

  it("SCORE_TO_WIN=2: 1–1 plus a mutual kill is 2–2, no match_end; the next lone takedown is first_to_10 (L1970)", () => {
    const r = runS3({
      T: 12,
      units: {
        ...close(),
        [BJ]: { x: 12.2, y: 6.5, spawn_shield_until: 0, auto: false },
        [RJ]: { x: 13.2, y: 6.5, spawn_shield_until: 0, auto: false },
      },
      constants: { SCORE_TO_WIN: 2, MATCH_T: 20, SUDDEN_DEATH_T: 24, RESPAWN_BASE: 0.4, RESPAWN_PER_LEVEL: 0, SPAWN_SHIELD_S: 0 },
      damage: [
        killAt(5, BA, RA),
        killAt(6, RM, BM), // 1–1
        killAt(20, BA, RA), // RA has respawned (~0.4s)
        killAt(20, RM, BM), // 2–2, no end
        killAt(40, BJ, RJ), // 3–2, first_to_10 blue
      ],
    });
    expect(r.of("match_end", (e) => e.tick === 20)).toHaveLength(0);
    const end = r.matchEnd();
    expect(end).toBeDefined();
    expect(end!.reason).toBe("first_to_10");
    expect(end!.winner).toBe("blue");
    expect(end!.score_blue).toBe(3);
    expect(end!.score_red).toBe(2);
    expect(end!.tick).toBe(40);
  });

  it("a team may end a tick above SCORE_TO_WIN (e.g. 3 with cap 2); reason is still first_to_10 (L1970)", () => {
    const r = runS3({
      T: 4,
      units: {
        ...close(),
        [BJ]: { x: 12.2, y: 6.5, spawn_shield_until: 0, auto: false },
        [RJ]: { x: 13.2, y: 6.5, spawn_shield_until: 0, auto: false },
      },
      constants: { SCORE_TO_WIN: 2, MATCH_T: 8 },
      damage: [killAt(8, BA, RA), killAt(8, BM, RM), killAt(8, BJ, RJ)],
    });
    const end = r.matchEnd();
    expect(end).toBeDefined();
    expect(end!.reason).toBe("first_to_10");
    expect(end!.winner).toBe("blue");
    expect(end!.score_blue).toBe(3);
    expect(end!.score_red).toBe(0);
    expect(end!.tick).toBe(8);
  });
});

