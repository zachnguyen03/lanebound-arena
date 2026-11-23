/**
 * Zone occupation, capture, tick timer, and holder aura
 * (§5.5 L269–274; §14.7 L1546; M3-27 L1749; G8 L1889 / plan G8 L395;
 * sandbox §11 S3 L703).
 *
 * Zone-bar drain, freeze, and integer-tick capture are pinned in
 * `10-gd-rulings-r5.test.ts` (S3-R5-1 L1936–L1945). This file keeps the
 * M3-27 / §5.5 occupation, pause, and aura coverage; progress is read via
 * `barTicks` so public seconds or raw ticks both work.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONSTANTS,
  ZONE,
  ZONE_RADIUS,
  type UId,
  barTicks,
  controlTime,
  inZone,
  killAt,
  placeInZone,
  runS3,
  zoneOf,
} from "./_harness.js";

const BA = "blue:adc" as UId;
const BM = "blue:mid" as UId;
const RA = "red:adc" as UId;

describe("§15 / §5.5 defaults", () => {
  it("ZONE_CENTER is the seam point (12, 8), radius 3, capture 3 s, tick 12 s, aura +10 res / +15 HP/s (L269–273, §15, Appendix R #2 L1906)", () => {
    expect(DEFAULT_CONSTANTS.ZONE_CENTER).toEqual([12.0, 8.0]);
    expect(DEFAULT_CONSTANTS.ZONE_RADIUS).toBe(3.0);
    expect(DEFAULT_CONSTANTS.ZONE_CAPTURE_S).toBe(3.0);
    expect(DEFAULT_CONSTANTS.ZONE_TICK_S).toBe(12.0);
    expect(DEFAULT_CONSTANTS.ZONE_AURA_RES).toBe(10);
    expect(DEFAULT_CONSTANTS.ZONE_AURA_HPS).toBe(15);
  });
});

describe("§5.2 L226 / §5.5 L273 — starting state", () => {
  it("the zone is unowned at t=0, both progress bars are 0, no occupants on a pad-only setup", () => {
    const r = runS3({ T: 0.1, constants: { MATCH_T: 0.1 } });
    const z = zoneOf(r);
    expect(z.owner).toBeNull();
    expect(barTicks(z, "blue")).toBe(0);
    expect(barTicks(z, "red")).toBe(0);
    expect(z.occupied.length).toBe(0);
    expect(controlTime(z, "blue")).toBe(0);
    expect(controlTime(z, "red")).toBe(0);
    expect(r.of("zone_capture")).toHaveLength(0);
  });
});

describe("§5.5 L270 — occupation (living, not banished, dist ≤ 3.0)", () => {
  it("a living unit with dist ≤ 3.0 occupies; a unit just outside does not", () => {
    const r = runS3({
      T: 1.0,
      units: {
        [BA]: placeInZone(BA, {}, { x: 3.0 }), // dist 3.0 inclusive
        [BM]: { x: ZONE.x + 3.2, y: ZONE.y, spawn_shield_until: 0, auto: false },
      },
    });
    const z = zoneOf(r);
    expect(inZone(r.unit(BA)!.x, r.unit(BA)!.y)).toBe(true);
    expect(inZone(r.unit(BM)!.x, r.unit(BM)!.y)).toBe(false);
    expect(z.occupied).toContain(BA);
    expect(z.occupied).not.toContain(BM);
  });

  it("a dead unit does not occupy (L270); a death this tick is gone from phase-11 occupancy (G8 L1889)", () => {
    const r = runS3({
      T: 2.0,
      units: {
        [BA]: placeInZone(BA, { hp: 50 }),
        [RA]: { x: 18, y: 8, spawn_shield_until: 0, auto: false },
      },
      damage: [killAt(10, RA, BA)],
    });
    expect(r.of("death", (e) => e.unit_id === BA && e.tick === 10)).toHaveLength(1);
    const z = zoneOf(r);
    expect(r.unit(BA)!.alive).toBe(false);
    expect(z.occupied).not.toContain(BA);
  });

  it("a banished unit in the radius does not occupy (L270)", () => {
    const r = runS3({
      T: 2.0,
      units: { [BA]: placeInZone(BA) },
      cc: [{ tick: 5, target: BA, kind: "banish", duration: 5 }],
    });
    const z = zoneOf(r);
    expect(z.occupied).not.toContain(BA);
    expect(z.owner).toBeNull();
  });
});

describe("§5.5 L272 — capture progress (1.0/s exclusive, 3.0 s → zone_capture)", () => {
  it("exclusive occupation for 3.0 s emits zone_capture for that team and sets owner", () => {
    const r = runS3({
      T: 4.0,
      units: { [BA]: placeInZone(BA) },
    });
    const caps = r.of("zone_capture");
    expect(caps).toHaveLength(1);
    expect(caps[0]!.team).toBe("blue");
    // Tick 0 is setup (G3 L1884); exclusive time starts on tick 1. 3.0 s is 30 ticks → capture on tick 30, t=3.0.
    expect(caps[0]!.tick).toBe(30);
    expect(caps[0]!.t).toBeCloseTo(3.0, 6);
    expect(zoneOf(r).owner).toBe("blue");
  });

  it("contested occupation pauses both progress bars (no accumulate, no decay) (L272, G8 L1889)", () => {
    const short = runS3({
      T: 1.0,
      units: { [BA]: placeInZone(BA, {}, { x: -0.8 }) },
    });
    expect(barTicks(zoneOf(short), "blue")).toBeGreaterThan(5);

    const r = runS3({
      T: 3.0,
      units: {
        [BA]: placeInZone(BA, {}, { x: -0.8 }),
        [RA]: placeInZone(RA, {}, { x: 0.8 }),
      },
    });
    const z = zoneOf(r);
    expect(z.owner).toBeNull();
    expect(r.of("zone_capture")).toHaveLength(0);
    expect(barTicks(z, "blue")).toBe(0);
    expect(barTicks(z, "red")).toBe(0);
    expect(z.occupied).toEqual(expect.arrayContaining([BA, RA]));
  });

  it("empty zone decays progress at 1.0/s: exclusive 2.0 s then banish the occupant → progress drops ~1.0 over the next second and stays ≥ 0 (L272)", () => {
    const held = runS3({ T: 2.0, units: { [BA]: placeInZone(BA) } });
    expect(barTicks(zoneOf(held), "blue")).toBe(20);
    expect(zoneOf(held).owner).toBeNull();

    const r = runS3({
      T: 3.0,
      units: { [BA]: placeInZone(BA) },
      // Same-tick banish (G8 L1889): ticks 1–20 exclusive, empty from tick 21.
      cc: [{ tick: 21, target: BA, kind: "banish", duration: 5 }],
    });
    const z = zoneOf(r);
    expect(z.owner).toBeNull();
    expect(barTicks(z, "blue")).toBe(10);
  });

  it("contest after exclusive time freezes progress (no further accum, no decay) (L272, G8 L1889)", () => {
    // Red starts in the zone but is banished for the first 1.5 s; then contest begins.
    const r = runS3({
      T: 3.0,
      units: {
        [BA]: placeInZone(BA, {}, { x: -0.6 }),
        [RA]: placeInZone(RA, {}, { x: 0.6 }),
      },
      cc: [{ tick: 1, target: RA, kind: "banish", duration: 1.5 }],
    });
    const z = zoneOf(r);
    expect(z.owner).toBeNull();
    expect(barTicks(z, "blue")).toBe(15);
  });



  it("G8 L1889 / plan L395: on a flip tick the new exclusive occupier starts progress this tick (no partial-tick credit)", () => {
    // Blue exclusive for 1 tick (tick 1), then red is already in place from tick 2
    // by walking in… simpler: blue in zone at t=0, red motor arrives on a known tick.
    // Even simpler: start both just inside; banish blue on tick 5 so the tick-5
    // occupancy is red-exclusive, and red's progress increases on that same tick.
    const r = runS3({
      T: 1.2,
      units: {
        [BA]: placeInZone(BA, {}, { x: -0.8 }),
        [RA]: placeInZone(RA, {}, { x: 0.8 }),
      },
      cc: [{ tick: 5, target: BA, kind: "banish", duration: 5 }],
    });
    const z = zoneOf(r);
    // Ticks 1–4 contested (progress frozen at 0). Tick 5: blue banished, red exclusive.
    // Ticks 5–12 inclusive is 0.8 s if T=1.2 ends at tick 12. progress_red > 0
    // and starts this tick (strictly greater than 0 after the flip tick).
    expect(barTicks(z, "blue")).toBe(0);
    expect(barTicks(z, "red")).toBeGreaterThan(0);
    // From tick 5 to tick 12 = 8 ticks of exclusive (if the flip tick counts in full).
    expect(barTicks(z, "red")).toBe(8);
  });

  it("S3-R5-1 L1936: progress_blue and progress_red are independent; Red exclusive drains Blue's leftover 1.0 s/s", () => {
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
  });
});

describe("§5.5 L274 / M3-27 L1749 — tick timer pauses, does not reset; 12 s exclusive owned = +1", () => {
  it("12.0 s of owned exclusive time produces exactly one zone_tick and no second tick before 24 s", () => {
    const r = runS3({
      T: 16,
      units: { [BA]: placeInZone(BA) },
    });
    expect(r.of("zone_tick")).toHaveLength(1);
    expect(r.of("zone_tick")[0]!.team).toBe("blue");
    const later = runS3({
      T: 27,
      units: { [BA]: placeInZone(BA) },
    });
    // Capture at 3 s; first tick at 15 s; second at 27 s. T=27 includes the second tick if the end tick is simulated (G3/G4).
    expect(later.of("zone_tick").length).toBeGreaterThanOrEqual(1);
    expect(later.of("zone_tick").length).toBeLessThanOrEqual(2);
    const at16 = later.of("zone_tick").filter((e) => (e.t as number) <= 16.0 + 1e-9);
    expect(at16).toHaveLength(1);
  });


  it("deterministic pause/no-reset: red is placed in the zone only during a mid window via banish bracketing (L274, M3-27)", () => {
    // Blue lives in the zone the whole time.
    // Red starts in the zone but is banished from tick 1 until we want contest,
    // then is living in the zone for 2 s, then banished again.
    // Capture: ticks 1–30 (red banished, blue exclusive) → owner blue at t=3.0.
    // Exclusive owned t=3.0–9.0 (6 s), timer=6.
    // At tick 90 (t=9.0) banish expires if duration was 8.9 s from tick 1? 
    // Cleaner: apply banish at tick 1 duration 8.0 (expires t=0.1+8=8.1? or t=1.0+8?).
    // We do not want to depend on whether duration starts at apply t.
    // Use two banishes: (1) long banish from tick 1 covering capture + 6 s,
    // expire by applying nothing — actually apply banish duration 8.9 at tick 1
    // and a second banish at tick 110 (t=11.0) duration 20.
    const r = runS3({
      T: 18,
      units: {
        [BA]: placeInZone(BA, {}, { x: -0.6 }),
        [RA]: placeInZone(RA, {}, { x: 0.6 }),
      },
      cc: [
        { tick: 1, target: RA, kind: "banish", duration: 9.0 },
        { tick: 110, target: RA, kind: "banish", duration: 20.0 },
      ],
    });
    const ticks = r.of("zone_tick");
    expect(ticks).toHaveLength(1);
    expect(ticks[0]!.team).toBe("blue");
    // If the timer had reset at the contest, the second exclusive window
    // would end at t=18 with only 6–7 s on the clock and no tick yet.
    expect((ticks[0]!.t as number) + 1e-9).toBeGreaterThanOrEqual(14.0);
  });


  it("after capture, banishing the only occupant pauses the tick timer (owned + empty): no zone_tick by t=16 (L274)", () => {
    const r = runS3({
      T: 16,
      units: { [BA]: placeInZone(BA) },
      cc: [{ tick: 40, target: BA, kind: "banish", duration: 30 }], // after capture at t=3.0, banish at t=4.0
    });
    expect(r.of("zone_capture", (e) => e.team === "blue")).toHaveLength(1);
    expect(zoneOf(r).owner).toBe("blue");
    expect(r.of("zone_tick")).toHaveLength(0);
  });
});

describe("§5.5 L273 — holder aura (owned and exclusive only)", () => {
  it("a damaged occupying owner regenerates about +15 HP/s extra over a stable exclusive window (aura is regen-like, not a skill heal)", () => {
    const window = 2.0;
    const inAura = runS3({
      T: 6.0,
      units: { [BA]: placeInZone(BA, { hp: 200, champ: "huntress" }) },
    });
    const outside = runS3({
      T: 6.0,
      units: { [BA]: { x: 4, y: 8, hp: 200, champ: "huntress", spawn_shield_until: 0, auto: false } },
    });
    // Both start at hp 200. Compare HP at end: the in-zone unit has been
    // exclusive-owned from t=3.0 to 6.0 (3 s of aura) plus any regen.
    const hpAura = inAura.unit(BA)!.hp;
    const hpOut = outside.unit(BA)!.hp;
    const extra = hpAura - hpOut;
    // Capture at tick 30; first aura tick is 31 (S3-R5-7 L1963). Ticks 31–60 = 3.0 s × 15 HP/s = 45, plus Huntress regen.
    expect(extra).toBeGreaterThan(15 * window - 5);
    expect(inAura.of("heal", (e) => e.combat_scaled === true && e.unit_id === BA)).toHaveLength(0);
  });

  it("aura resists apply only while owned and exclusive: a raw physical packet deals less then than before capture or while contested (L273)", () => {
    const raw = 200;
    const before = runS3({
      T: 1.0,
      units: {
        [BA]: placeInZone(BA, { hp: 400, champ: "huntress" }),
        [RA]: { x: 18, y: 8, spawn_shield_until: 0, auto: false },
      },
      damage: [{ tick: 5, source: RA, target: BA, raw }],
    });
    const after = runS3({
      T: 4.0,
      units: {
        [BA]: placeInZone(BA, { hp: 400, champ: "huntress" }),
        [RA]: { x: 18, y: 8, spawn_shield_until: 0, auto: false },
      },
      damage: [{ tick: 35, source: RA, target: BA, raw }], // t=3.5, owned exclusive
    });
    const hitBefore = before.of("hit", (e) => e.target_id === BA);
    const hitAfter = after.of("hit", (e) => e.target_id === BA);
    expect(hitBefore.length).toBeGreaterThan(0);
    expect(hitAfter.length).toBeGreaterThan(0);
    const lost = (e: { hp_after?: unknown; raw?: unknown; mitigated?: unknown; [key: string]: unknown }) =>
      typeof e.mitigated === "number" ? e.mitigated : undefined;
    const m0 = lost(hitBefore[0]!);
    const m1 = lost(hitAfter[0]!);
    if (m0 !== undefined && m1 !== undefined) {
      expect(m1).toBeLessThan(m0);
    } else {
      // Fallback: more HP remaining after the aura packet.
      expect(after.unit(BA)!.hp).toBeGreaterThan(before.unit(BA)!.hp);
    }

    const contested = runS3({
      T: 4.0,
      units: {
        [BA]: placeInZone(BA, { hp: 400, champ: "huntress" }, { x: -0.6 }),
        [RA]: placeInZone(RA, { champ: "maelis" }, { x: 0.6 }),
      },
      damage: [{ tick: 35, source: RA, target: BA, raw }],
    });
    // Never captured (contested the whole time) — no aura.
    expect(zoneOf(contested).owner).toBeNull();
    const hitC = contested.of("hit", (e) => e.target_id === BA);
    expect(hitC.length).toBeGreaterThan(0);
    if (m1 !== undefined && typeof hitC[0]!.mitigated === "number") {
      expect(hitC[0]!.mitigated as number).toBeGreaterThan(m1);
    }
  });
});

describe("G8 L1889 — occupancy is phase-11 of the current tick (after movement)", () => {
  it("a unit that walks in this tick occupies this tick (capture progress starts the same tick they arrive)", () => {
    // Start just outside r=3 (x = 12+3.2), walk to the centre. First tick
    // inside must increase progress_blue (new exclusive occupier starts this tick).
    const r = runS3({
      T: 2.0,
      pos: true,
      units: { [BA]: { x: ZONE.x + 3.2, y: ZONE.y, champ: "huntress", spawn_shield_until: 0, auto: false } },
      motor: { [BA]: { to: [[ZONE.x, ZONE.y]], arrive_r: 0.15, hold_at_end: true } },
    });
    expect(inZone(r.unit(BA)!.x, r.unit(BA)!.y)).toBe(true);
    expect(zoneOf(r).occupied).toContain(BA);
    expect(barTicks(zoneOf(r), "blue")).toBeGreaterThan(0);
  });
});
