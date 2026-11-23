/**
 * Orbs and flank buffs (M3-28 L1750, M3-29 L1751; §5.2 L226; §5.7 L303–305;
 * §5.3 catch-up L231–233; G4 L1885; G7 L1888; Appendix R #2 tile-centre L1906;
 * sandbox §11 S3 L704).
 */
import { describe, expect, it } from "vitest";
import {
  BUFF_PADS,
  DEFAULT_CONSTANTS,
  ORB_PADS,
  type UId,
  dist,
  pathOf,
  runS3,
} from "./_harness.js";

const BA = "blue:adc" as UId;
const BJ = "blue:jungle" as UId;
const BT = "blue:top" as UId;
const RA = "red:adc" as UId;

const PAD0 = { x: ORB_PADS[0]![0], y: ORB_PADS[0]![1] }; // (2.5, 4.5)

describe("§15 / §5.7 defaults and pad placement", () => {
  it("orb first spawn 8.0, respawn 18, pickup r 0.9, XP 120; buff first spawn 90, respawn 90, duration 45, +12% dmg, +10% MS (L303–305, §15)", () => {
    expect(DEFAULT_CONSTANTS.ORB_FIRST_SPAWN_S).toBe(8.0);
    expect(DEFAULT_CONSTANTS.ORB_RESPAWN_S).toBe(18.0);
    expect(DEFAULT_CONSTANTS.ORB_PICKUP_R).toBe(0.9);
    expect(DEFAULT_CONSTANTS.ORB_XP).toBe(120);
    expect(DEFAULT_CONSTANTS.BUFF_FIRST_SPAWN_S).toBe(90.0);
    expect(DEFAULT_CONSTANTS.BUFF_RESPAWN_S).toBe(90.0);
    expect(DEFAULT_CONSTANTS.BUFF_DURATION_S).toBe(45.0);
    expect(DEFAULT_CONSTANTS.BUFF_DMG).toBe(0.12);
    expect(DEFAULT_CONSTANTS.BUFF_MS).toBe(0.1);
    expect(DEFAULT_CONSTANTS.BUFF_PADS).toEqual([
      [7.5, 7.5],
      [16.5, 7.5],
    ]);
  });
});

describe("M3-28 L1750 / G4 L1885 — first orb wave at t=8.0, eight pads, tile centres", () => {
  it("all eight orbs spawn on tick 80 (t=8.0) at the §5.7 pads placed at tile centres, and not earlier", () => {
    const r = runS3({ T: 8.2 });
    const spawns = r.of("orb_spawn");
    expect(spawns).toHaveLength(8);
    expect(spawns.every((e) => e.tick === 80 && Math.abs((e.t as number) - 8.0) < 1e-9)).toBe(true);
    const early = r.of("orb_spawn", (e) => (e.t as number) < 8.0 - 1e-9);
    expect(early).toHaveLength(0);
    const seen: Array<readonly [number, number]> = spawns.map((e) => [e.x as number, e.y as number]);
    for (const [x, y] of ORB_PADS) {
      const hit = seen.some((p) => Math.hypot(p[0] - x, p[1] - y) < 1e-6);
      expect(hit, `missing orb at tile centre (${x}, ${y})`).toBe(true);
    }
  });

  it("a unit already on a pad at spawn picks up on the next tick, not the spawn tick (G4 L1885)", () => {
    const r = runS3({
      T: 8.3,
      units: { [BA]: { x: PAD0.x, y: PAD0.y, spawn_shield_until: 0, auto: false } },
    });
    const pick = r.of("orb_pickup", (e) => e.unit_id === BA);
    expect(pick).toHaveLength(1);
    expect(pick[0]!.tick).toBe(81);
    expect(pick[0]!.t).toBeCloseTo(8.1, 6);
    expect(r.of("orb_pickup", (e) => e.tick === 80)).toHaveLength(0);
  });

  it("pickup grants 120 personal XP with source orb (L231, L303, M3-28)", () => {
    const r = runS3({
      T: 8.3,
      units: { [BA]: { x: PAD0.x, y: PAD0.y, spawn_shield_until: 0, auto: false } },
    });
    expect(r.of("xp_gain", (e) => e.source === "catchup")).toHaveLength(0);
    const orbOnly = r.of("xp_gain", (e) => e.unit_id === BA && e.source === "orb" && e.tick === 81);
    expect(orbOnly).toHaveLength(1);
    expect(orbOnly[0]!.amount).toBe(120);
    expect(r.of("orb_pickup")[0]!.xp).toBe(120);
  });

  it("pickup grants 138 XP when the enemy level gap is ≥ 2 (120 × 1.15) (L232–233, M3-28)", () => {
    const r = runS3({
      T: 8.3,
      units: {
        [BA]: { x: PAD0.x, y: PAD0.y, level: 1, xp: 0, spawn_shield_until: 0, auto: false },
        [RA]: { x: 22.5, y: 7.5, level: 5, xp: 820, spawn_shield_until: 0, auto: false },
      },
    });
    expect(r.of("xp_gain", (e) => e.source === "catchup")).toHaveLength(0);
    const orbXp = r.of("xp_gain", (e) => e.unit_id === BA && e.source === "orb" && e.tick === 81);
    expect(orbXp).toHaveLength(1);
    expect(orbXp[0]!.amount).toBe(138);
    const pick = r.of("orb_pickup", (e) => e.unit_id === BA)[0]!;
    expect(pick.xp).toBe(138);
  });

  it("the orb respawns on the same pad 18 s after pickup (L303, M3-28)", () => {
    const r = runS3({
      T: 26.3,
      units: { [BA]: { x: PAD0.x, y: PAD0.y, spawn_shield_until: 0, auto: false } },
    });
    const pick = r.of("orb_pickup", (e) => e.unit_id === BA)[0]!;
    expect(pick).toBeDefined();
    const later = r.of("orb_spawn").filter((e) => (e.t as number) > (pick.t as number) + 1e-9);
    const same = later.filter((e) => Math.hypot((e.x as number) - PAD0.x, (e.y as number) - PAD0.y) < 1e-6);
    expect(same.length).toBeGreaterThanOrEqual(1);
    expect(same[0]!.t).toBeCloseTo((pick.t as number) + 18.0, 6);
  });
});

describe("G7 L1888 / §5.7 L303 — who may pick up", () => {
  it.each(["stun", "root", "sleep", "knockup"] as const)(
    "a %s unit whose centre is within 0.9 still picks up (G7)",
    (kind) => {
      const r = runS3({
        T: 8.3,
        units: { [BA]: { x: PAD0.x, y: PAD0.y, spawn_shield_until: 0, auto: false } },
        cc: [{ tick: 70, target: BA, kind, duration: 5 }],
      });
      expect(r.of("orb_pickup", (e) => e.unit_id === BA)).toHaveLength(1);
    },
  );

  it("a slowed unit still picks up (§5.7 L303)", () => {
    const r = runS3({
      T: 8.3,
      units: { [BA]: { x: PAD0.x, y: PAD0.y, spawn_shield_until: 0, auto: false } },
      cc: [{ tick: 70, target: BA, kind: "slow", duration: 5 }],
    });
    expect(r.of("orb_pickup", (e) => e.unit_id === BA)).toHaveLength(1);
  });

  it.each(["banish", "timestop"] as const)("a %s unit cannot pick up (G7, L303)", (kind) => {
    const r = runS3({
      T: 8.3,
      units: { [BA]: { x: PAD0.x, y: PAD0.y, spawn_shield_until: 0, auto: false } },
      cc: [{ tick: 70, target: BA, kind, duration: 5 }],
    });
    // Require the wave to have spawned, so this is not vacuously true on a stub that never emits orbs.
    expect(r.of("orb_spawn").length).toBeGreaterThanOrEqual(8);
    expect(r.of("orb_pickup", (e) => e.unit_id === BA)).toHaveLength(0);
  });

  it("a dead unit cannot pick up (G7, L303, xp_while_dead = 0)", () => {
    const r = runS3({
      T: 8.3,
      units: {
        [BA]: { x: PAD0.x, y: PAD0.y, hp: 40, spawn_shield_until: 0, auto: false },
        [RA]: { x: 6, y: 4.5, spawn_shield_until: 0, auto: false },
      },
      damage: [{ tick: 70, source: RA, target: BA, raw: 10_000 }],
    });
    expect(r.of("death", (e) => e.unit_id === BA)).toHaveLength(1);
    expect(r.of("orb_spawn").length).toBeGreaterThanOrEqual(8);
    expect(r.of("orb_pickup", (e) => e.unit_id === BA)).toHaveLength(0);
  });

  it("two units arriving the same tick: earlier in unit order wins (L303, §4.3 L134)", () => {
    // blue:top (index 0) vs blue:jungle (index 1) stacked on the same pad.
    const r = runS3({
      T: 8.3,
      units: {
        [BT]: { x: PAD0.x, y: PAD0.y, spawn_shield_until: 0, auto: false },
        [BJ]: { x: PAD0.x, y: PAD0.y, spawn_shield_until: 0, auto: false },
      },
    });
    const picks = r.of("orb_pickup", (e) => e.tick === 81);
    expect(picks).toHaveLength(1);
    expect(picks[0]!.unit_id).toBe(BT);
  });
});

describe("M3-29 L1751 / §5.7 L305 — flank buffs", () => {
  const BUFF0 = { x: BUFF_PADS[0]![0], y: BUFF_PADS[0]![1] };

  it("both buff pads spawn at t=90.0 (tick 900) and not earlier, at tile centres", () => {
    const r = runS3({ T: 90.2 });
    const spawns = r.of("buff_spawn");
    expect(spawns).toHaveLength(2);
    expect(spawns.every((e) => e.tick === 900 && Math.abs((e.t as number) - 90.0) < 1e-9)).toBe(true);
    expect(r.of("buff_spawn", (e) => (e.t as number) < 90.0 - 1e-9)).toHaveLength(0);
    for (const [x, y] of BUFF_PADS) {
      const hit = spawns.some((e) => Math.hypot((e.x as number) - x, (e.y as number) - y) < 1e-6);
      expect(hit, `missing buff at (${x}, ${y})`).toBe(true);
    }
  });

  it("a unit already on the pad picks up the next tick (G4, by the same phase-11 rule as orbs)", () => {
    // Official first spawn is 90 s; keep it so this also pins the default clock.
    const r = runS3({
      T: 90.3,
      units: { [BA]: { x: BUFF0.x, y: BUFF0.y, spawn_shield_until: 0, auto: false } },
    });
    const pick = r.of("buff_pickup", (e) => e.unit_id === BA);
    expect(pick).toHaveLength(1);
    expect(pick[0]!.tick).toBe(901);
    expect(pick[0]!.expires_at).toBeCloseTo(90.1 + 45.0, 6);
  });

  it("+10% move speed for 45 s: a buffed Huntress covers more ground than an unbuffed one on the same path (L305)", () => {
    // Short-circuit first spawn (lab, same pattern as S0 MATCH_T: 2) so the
    // walk is measured under the buff; duration stays 45 s.
    // Huntress MS is 3.3; (7.5, 7.5) → (18, 7.5) is only 10.5 tiles and both
    // arrive in well under 6 s, so path length would match. Walk a long
    // diagonal and stop mid-path (T=3.0). Spawn at 0.1 so pickup is tick 2,
    // while the unit is still inside r=0.9 (~0.66 tiles of motion).
    const walkTo: [number, number] = [22, 0.5];
    const from = { x: BUFF0.x, y: BUFF0.y };
    const common = {
      T: 3.0,
      pos: true,
      motor: { [BA]: { to: [walkTo], arrive_r: 0.15, hold_at_end: true } },
      constants: { BUFF_FIRST_SPAWN_S: 0.1, BUFF_DURATION_S: 45.0, BUFF_MS: 0.1 },
    };
    const buffed = runS3({
      ...common,
      units: { [BA]: { ...from, champ: "huntress", spawn_shield_until: 0, auto: false } },
    });
    const plain = runS3({
      T: 3.0,
      pos: true,
      units: { [BA]: { ...from, champ: "huntress", spawn_shield_until: 0, auto: false } },
      motor: { [BA]: { to: [walkTo], arrive_r: 0.15, hold_at_end: true } },
      constants: { BUFF_FIRST_SPAWN_S: 99.0, BUFF_MS: 0.1 },
    });
    expect(buffed.of("buff_pickup", (e) => e.unit_id === BA).length).toBeGreaterThanOrEqual(1);
    const pathB = pathOf(buffed.events, BA);
    const pathP = pathOf(plain.events, BA);
    expect(pathB.length).toBeGreaterThan(5);
    expect(pathP.length).toBeGreaterThan(5);
    const travelled = (path: typeof pathB) => {
      let s = 0;
      for (let i = 1; i < path.length; i++) s += dist(path[i - 1]!, path[i]!);
      return s;
    };
    expect(travelled(pathB)).toBeGreaterThan(travelled(pathP) * 1.04);
  });

  it("+12% damage dealt: a scripted physical packet from a buffed source is amplified ~12% vs an unbuffed one (L305, §6.3 L401)", () => {
    const raw = 200;
    const commonUnits = {
      [BA]: { x: BUFF0.x, y: BUFF0.y, champ: "huntress", spawn_shield_until: 0, auto: false },
      [RA]: { x: 18, y: 7.5, hp: 800, champ: "maelis", spawn_shield_until: 0, auto: false },
    };
    const buffed = runS3({
      T: 3.0,
      units: commonUnits,
      constants: { BUFF_FIRST_SPAWN_S: 1.0, BUFF_DMG: 0.12, BUFF_DURATION_S: 45.0 },
      damage: [{ tick: 20, source: BA, target: RA, raw }],
    });
    const plain = runS3({
      T: 3.0,
      units: {
        [BA]: { x: 4, y: 7.5, champ: "huntress", spawn_shield_until: 0, auto: false },
        [RA]: { x: 18, y: 7.5, hp: 800, champ: "maelis", spawn_shield_until: 0, auto: false },
      },
      constants: { BUFF_FIRST_SPAWN_S: 99.0, BUFF_DMG: 0.12 },
      damage: [{ tick: 20, source: BA, target: RA, raw }],
    });
    expect(buffed.of("buff_pickup", (e) => e.unit_id === BA).length).toBeGreaterThanOrEqual(1);
    const hb = buffed.of("hit", (e) => e.target_id === RA && e.source_id === BA)[0]!;
    const hp = plain.of("hit", (e) => e.target_id === RA && e.source_id === BA)[0]!;
    expect(hb).toBeDefined();
    expect(hp).toBeDefined();
    if (typeof hb.raw === "number" && typeof hp.raw === "number") {
      expect(hb.raw as number).toBeCloseTo((hp.raw as number) * 1.12, 1);
    } else if (typeof hb.amp === "number") {
      expect(hb.amp as number).toBeCloseTo(1.12, 2);
    } else {
      expect(buffed.unit(RA)!.hp).toBeLessThan(plain.unit(RA)!.hp);
    }
  });

  it("re-pickup refreshes duration and does not stack the +12% (L305)", () => {
    const raw = 200;
    const r = runS3({
      T: 4.0,
      units: {
        [BA]: { x: BUFF0.x, y: BUFF0.y, champ: "huntress", spawn_shield_until: 0, auto: false },
        [RA]: { x: 18, y: 7.5, hp: 800, champ: "maelis", spawn_shield_until: 0, auto: false },
      },
      constants: {
        BUFF_FIRST_SPAWN_S: 1.0,
        BUFF_RESPAWN_S: 1.0,
        BUFF_DURATION_S: 45.0,
        BUFF_DMG: 0.12,
      },
      damage: [{ tick: 35, source: BA, target: RA, raw }],
    });
    const picks = r.of("buff_pickup", (e) => e.unit_id === BA);
    expect(picks.length).toBeGreaterThanOrEqual(2);
    const last = picks[picks.length - 1]!;
    expect(last.expires_at).toBeCloseTo((last.t as number) + 45.0, 6);
    const hit = r.of("hit", (e) => e.target_id === RA && e.source_id === BA)[0];
    if (hit && typeof hit.raw === "number") {
      expect(hit.raw as number).toBeCloseTo(200 * 1.12, 0);
      expect(hit.raw as number).toBeLessThan(200 * 1.24 - 1);
    } else if (hit && typeof hit.amp === "number") {
      expect(hit.amp as number).toBeCloseTo(1.12, 2);
      expect(hit.amp as number).toBeLessThan(1.2);
    }
  });

  it("the two buff pads are independent: picking one does not despawn the other (L305)", () => {
    const r = runS3({
      T: 90.3,
      units: { [BA]: { x: BUFF0.x, y: BUFF0.y, spawn_shield_until: 0, auto: false } },
    });
    expect(r.of("buff_pickup", (e) => e.unit_id === BA)).toHaveLength(1);
    const other = BUFF_PADS[1]!;
    const stillUp = r.of("buff_spawn").some((e) => Math.hypot((e.x as number) - other[0], (e.y as number) - other[1]) < 1e-6);
    expect(stillUp).toBe(true);
    // And no pickup of the far pad by this unit.
    expect(r.of("buff_pickup").length).toBe(1);
  });
});
