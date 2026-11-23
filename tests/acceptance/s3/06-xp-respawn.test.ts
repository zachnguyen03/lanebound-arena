/**
 * XP curve, catch-up, no XP while dead, and respawn
 * (M3-31 L1753; §5.3 L229–257; §5.4 L261–264; G2 L1883; G3 L1884).
 *
 * XP_TO_LEVEL is the build-spec table as written (L242–253), L5 = 820.
 * Confirmed by Anh. Do not substitute 966 or any other curve.
 * Catch-up event shape is S3-R5-3 L1955 (folded into source time / orb).
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONSTANTS,
  XP_TO_LEVEL,
  type UId,
  killAt,
  runS3,
} from "./_harness.js";

const BA = "blue:adc" as UId;
const BM = "blue:mid" as UId;
const RA = "red:adc" as UId;

/** First tick at which cumulative time XP (no other income, tick 0 grants none) reaches the threshold. */
function predictedTick(level: number): number {
  const need = XP_TO_LEVEL[level]!;
  return Math.ceil(need / (DEFAULT_CONSTANTS.TIME_XP_PER_S * DEFAULT_CONSTANTS.DT));
}

describe("§5.3 L242–253 — XP_TO_LEVEL table as written (confirmed by Anh, L5=820)", () => {
  it("the exported table is exactly {1:0, 2:140, 3:320, 4:540, 5:820, 6:1160, 7:1560, 8:2040, 9:2600, 10:3240}", () => {
    expect(XP_TO_LEVEL).toEqual({
      1: 0,
      2: 140,
      3: 320,
      4: 540,
      5: 820,
      6: 1160,
      7: 1560,
      8: 2040,
      9: 2600,
      10: 3240,
    });
    expect(DEFAULT_CONSTANTS.XP_TO_LEVEL).toEqual(XP_TO_LEVEL);
    expect(DEFAULT_CONSTANTS.TIME_XP_PER_S).toBe(11.5);
  });

  it("time-only, no orbs/kills: L2 on tick 122 (M0-4 L1703, L242)", () => {
    expect(predictedTick(2)).toBe(122);
    const r = runS3({ T: 13, forced_clock_end: true, constants: { MATCH_T: 13 } });
    const up = r.of("level_up", (e) => e.unit_id === "blue:top" && e.new_level === 2);
    expect(up).toHaveLength(1);
    expect(up[0]!.tick).toBe(122);
  });

  it("time-only, no orbs/kills: L5 (R unlock) on tick 714 — 820 / 1.15 (L246, L256)", () => {
    expect(predictedTick(5)).toBe(714);
    // 713 × 1.15 = 819.95 < 820; 714 × 1.15 = 821.1.
    const r = runS3({ T: 72, forced_clock_end: true, constants: { MATCH_T: 72 } });
    const up = r.of("level_up", (e) => e.unit_id === "blue:top" && e.new_level === 5);
    expect(up).toHaveLength(1);
    expect(up[0]!.tick).toBe(714);
  });

  it("time-only, no orbs/kills: L7 on tick 1357 — 1560 / 1.15 (L248, L256)", () => {
    expect(predictedTick(7)).toBe(1357);
    const r = runS3({ T: 136, forced_clock_end: true, constants: { MATCH_T: 136 } });
    const up = r.of("level_up", (e) => e.unit_id === "blue:top" && e.new_level === 7);
    expect(up).toHaveLength(1);
    expect(up[0]!.tick).toBe(1357);
  });
});

describe("M3-31 L1753 / G2 L1883 / §5.3 L234 — no XP on dead ticks; respawn tick is paid", () => {
  it("a unit that dies this tick gets no time XP on the death tick (G2)", () => {
    const r = runS3({
      T: 2.0,
      units: {
        [BA]: { x: 12, y: 8, hp: 40, spawn_shield_until: 0, auto: false },
        [RA]: { x: 14, y: 8, spawn_shield_until: 0, auto: false },
      },
      damage: [killAt(8, RA, BA)],
    });
    const death = r.of("death", (e) => e.unit_id === BA)[0]!;
    expect(death.tick).toBe(8);
    const timeOnDeath = r.of("xp_gain", (e) => e.unit_id === BA && e.source === "time" && e.tick === 8);
    expect(timeOnDeath).toHaveLength(0);
  });

  it("no time / orb / catchup XP on any tick the unit is dead, between death and respawn (M3-31, L234)", () => {
    const r = runS3({
      T: 12,
      units: {
        [BA]: { x: 12, y: 8, hp: 40, level: 1, spawn_shield_until: 0, auto: false },
        [RA]: { x: 14, y: 8, spawn_shield_until: 0, auto: false },
      },
      damage: [killAt(8, RA, BA)],
    });
    const death = r.of("death", (e) => e.unit_id === BA)[0]!;
    const respawnAt = death.respawn_at as number;
    expect(respawnAt).toBeCloseTo(0.8 + 6 + 1.5 * 1, 6); // §5.4 L261, level at death = 1
    const respawnEv = r.of("respawn", (e) => e.unit_id === BA)[0];
    expect(respawnEv).toBeDefined();
    const deadTicks: number[] = [];
    for (const e of r.events) {
      if (e.tick > (death.tick as number) && (e.t as number) + 1e-12 < respawnAt) {
        if (e.type === "xp_gain" && e.unit_id === BA) deadTicks.push(e.tick as number);
      }
    }
    expect(deadTicks).toEqual([]);
  });

  it("the tick the unit respawns, they do get time XP (G2 L1883)", () => {
    const r = runS3({
      T: 12,
      units: {
        [BA]: { x: 12, y: 8, hp: 40, level: 1, spawn_shield_until: 0, auto: false },
        [RA]: { x: 14, y: 8, spawn_shield_until: 0, auto: false },
      },
      damage: [killAt(8, RA, BA)],
    });
    const respawn = r.of("respawn", (e) => e.unit_id === BA)[0]!;
    const time = r.of(
      "xp_gain",
      (e) => e.unit_id === BA && e.source === "time" && e.tick === respawn.tick,
    );
    expect(time).toHaveLength(1);
    expect(time[0]!.amount).toBeCloseTo(1.15, 6);
  });

  it("G3 L1884: tick 0 is setup only — no time XP on tick 0", () => {
    const r = runS3({ T: 0.2, forced_clock_end: true, constants: { MATCH_T: 0.2 } });
    expect(r.of("xp_gain", (e) => e.source === "time" && e.tick === 0)).toHaveLength(0);
  });
});

describe("§5.3 L232–233 — catch-up on time XP only (not kill / assist)", () => {
  it("when highest_enemy_level − this_unit_level ≥ 2, time XP is +15% (1.15 × 1.15 per tick)", () => {
    const r = runS3({
      T: 1.0,
      units: {
        [BA]: { x: 4, y: 8, level: 1, xp: 0, spawn_shield_until: 0, auto: false },
        [RA]: { x: 20, y: 8, level: 5, xp: 820, spawn_shield_until: 0, auto: false },
      },
    });
    expect(r.of("xp_gain", (e) => e.source === "catchup")).toHaveLength(0);
    const time = r.of("xp_gain", (e) => e.unit_id === BA && e.source === "time" && e.tick === 1);
    expect(time).toHaveLength(1);
    expect(time[0]!.amount).toBeCloseTo(1.3225, 4);
  });

  it("catch-up does not apply to kill or assist XP (L232)", () => {
    const r = runS3({
      T: 2.0,
      units: {
        [BA]: { x: 12, y: 8, level: 1, xp: 0, spawn_shield_until: 0, auto: false },
        [BM]: { x: 12.4, y: 8, level: 1, spawn_shield_until: 0, auto: false },
        [RA]: { x: 13, y: 8, hp: 40, level: 1, spawn_shield_until: 0, auto: false },
        // A different red, high level, keeps the gap ≥ 2 against BA.
        ["red:mid" as UId]: { x: 20, y: 8, level: 5, xp: 820, spawn_shield_until: 0, auto: false },
      },
      damage: [
        { tick: 4, source: BM, target: RA, raw: 20 },
        killAt(5, BA, RA),
      ],
    });
    const kill = r.of("xp_gain", (e) => e.unit_id === BA && e.source === "kill");
    expect(kill).toHaveLength(1);
    expect(kill[0]!.amount).toBe(45);
    const assist = r.of("xp_gain", (e) => e.unit_id === BM && e.source === "assist");
    expect(assist).toHaveLength(1);
    expect(assist[0]!.amount).toBe(20);
  });
});

describe("§5.4 L261–264 — respawn timer and spawn shield", () => {
  it("respawn_at = t_death + 6 + 1.5 × level_at_death (no per-minute term)", () => {
    const r = runS3({
      T: 3.0,
      units: {
        [BA]: { x: 12, y: 8, hp: 40, level: 7, xp: 1560, spawn_shield_until: 0, auto: false },
        [RA]: { x: 14, y: 8, spawn_shield_until: 0, auto: false },
      },
      damage: [killAt(5, RA, BA)],
    });
    const death = r.of("death", (e) => e.unit_id === BA)[0]!;
    expect(death.respawn_at).toBeCloseTo(0.5 + 6 + 1.5 * 7, 6); // 17.0 s after t=0, i.e. 16.5 s wait
  });
});
