/**
 * Claims and any-unit deny (M3-26 L1748; §5.6 L287–292; G11 L1892;
 * S3-R5-8 L1965–L1966; sandbox §11 S3 L702; plan §8.4 S3 L366;
 * career GDD v1.1.2 C-R-5). `claim_deny.deniers` is additive; tests
 * read it without asserting the exact key set of the event.
 *
 * Production path: a net +1 fight win opens a claim. Lab path: the
 * `scripted_claim_open` hook in _contract.md, for deny / award / refresh
 * fixtures that must not depend on fight-layer AI.
 */
import { describe, expect, it } from "vitest";
import {
  CLASS_CHAMPS,
  DEFAULT_CONSTANTS,
  ZONE,
  type UId,
  claimDeniesOf,
  claimOf,
  deniersOf,
  killAt,
  placeInZone,
  runS3,
} from "./_harness.js";

const BA = "blue:adc" as UId;
const BM = "blue:mid" as UId;
const BJ = "blue:jungle" as UId;
const BT = "blue:top" as UId;
const RA = "red:adc" as UId;
const RM = "red:mid" as UId;
const RT = "red:top" as UId;
const RJ = "red:jungle" as UId;

describe("§15 claim knobs", () => {
  it("CLAIM_DELAY_S default is 8.0, CLAIM_DENY_DWELL_S is 0, DENY_ANY_UNIT is true (L1590–1591, L1655)", () => {
    expect(DEFAULT_CONSTANTS.CLAIM_DELAY_S).toBe(8.0);
    expect(DEFAULT_CONSTANTS.CLAIM_DENY_DWELL_S).toBe(0.0);
    expect(DEFAULT_CONSTANTS.DENY_ANY_UNIT).toBe(true);
  });
});

describe("§5.6 L289 / §4.4 L183 — claim_open", () => {
  it("scripted_claim_open emits claim_open with resolve_at = t + CLAIM_DELAY_S", () => {
    const r = runS3({
      T: 2.0,
      constants: { CLAIM_DELAY_S: 8.0 },
      claims: [{ tick: 5, team: "blue", fight_id: "fA" }],
    });
    const ev = r.of("claim_open");
    expect(ev).toHaveLength(1);
    expect(ev[0]!.team).toBe("blue");
    expect(ev[0]!.fight_id).toBe("fA");
    expect(ev[0]!.resolve_at).toBeCloseTo(0.5 + 8.0, 6);
    const c = claimOf(r);
    expect(c).toBeTruthy();
    expect(c!.team).toBe("blue");
    expect(c!.resolve_at).toBeCloseTo(0.5 + 8.0, 6);
  });

  it("a new qualifying win by the same team refreshes resolve_at (L289)", () => {
    const r = runS3({
      T: 3.0,
      constants: { CLAIM_DELAY_S: 8.0 },
      claims: [
        { tick: 5, team: "blue", fight_id: "f1" },
        { tick: 15, team: "blue", fight_id: "f2" },
      ],
    });
    const ev = r.of("claim_open");
    expect(ev.length).toBeGreaterThanOrEqual(2);
    expect(ev[ev.length - 1]!.resolve_at).toBeCloseTo(1.5 + 8.0, 6);
    expect(claimOf(r)!.resolve_at).toBeCloseTo(1.5 + 8.0, 6);
    expect(claimOf(r)!.team).toBe("blue");
    expect(r.of("claim_award")).toHaveLength(0);
    expect(r.of("claim_deny")).toHaveLength(0);
  });

  it("a qualifying win by the other team cancels the pending claim and opens theirs (L289, G11 L1892)", () => {
    const r = runS3({
      T: 3.0,
      constants: { CLAIM_DELAY_S: 8.0 },
      claims: [
        { tick: 5, team: "blue", fight_id: "fb" },
        { tick: 15, team: "red", fight_id: "fr" },
      ],
    });
    expect(claimOf(r)!.team).toBe("red");
    expect(claimOf(r)!.resolve_at).toBeCloseTo(1.5 + 8.0, 6);
    expect(r.of("claim_award")).toHaveLength(0);
    expect(r.of("claim_deny")).toHaveLength(0);
    expect(r.of("claim_open", (e) => e.team === "red").length).toBeGreaterThanOrEqual(1);
  });
});

describe("G11 L1892 — deaths do not clear a pending claim", () => {
  it("killing every member of the claiming team leaves the claim pending; an empty zone still awards it", () => {
    const r = runS3({
      T: 3.0,
      units: {
        [BA]: { x: 4, y: 8, hp: 40, spawn_shield_until: 0, auto: false },
        [RA]: { x: 18, y: 8, spawn_shield_until: 0, auto: false },
      },
      constants: { CLAIM_DELAY_S: 1.0, SCORE_TO_WIN: 10 },
      claims: [{ tick: 5, team: "blue", fight_id: "g11" }],
      damage: [killAt(8, RA, BA)],
    });
    expect(r.of("death", (e) => e.unit_id === BA)).toHaveLength(1);
    expect(r.of("claim_award", (e) => e.team === "blue")).toHaveLength(1);
    expect(r.of("claim_deny")).toHaveLength(0);
    expect(r.state.score_blue).toBe(1);
  });
});

describe("M3-26 L1748 / §5.6 L291–292 — resolve at resolve_at", () => {
  it("an empty zone at resolve_at always awards the claim, even if the claiming team does not own or occupy it", () => {
    const r = runS3({
      T: 2.5,
      constants: { CLAIM_DELAY_S: 1.0 },
      claims: [{ tick: 5, team: "red", fight_id: "empty" }],
    });
    expect(r.of("claim_award")).toHaveLength(1);
    expect(r.of("claim_award")[0]!.team).toBe("red");
    expect(r.of("claim_deny")).toHaveLength(0);
    expect(r.state.score_red).toBe(1);
  });

  it.each(Object.entries(CLASS_CHAMPS)) (
    "a leftover %s (%s) in the zone at resolve_at denies (any-unit, class does not matter)",
    (cls, champ) => {
      const r = runS3({
        T: 2.5,
        units: { [RA]: placeInZone(RA, { champ }) },
        constants: { CLAIM_DELAY_S: 1.0 },
        claims: [{ tick: 5, team: "blue", fight_id: `deny-${cls}` }],
      });
      const den = r.of("claim_deny");
      expect(den).toHaveLength(1);
      expect(den[0]!.team).toBe("blue");
      expect(den[0]!.denier_id).toBe(RA);
      expect(deniersOf(den[0]!)).toEqual([RA]);
      expect(r.of("claim_award")).toHaveLength(0);
      expect(r.state.score_blue).toBe(0);
    },
  );

  it("a banished unit in the zone at resolve_at does not deny; the claim is awarded (L291, L270)", () => {
    const r = runS3({
      T: 2.5,
      units: { [RA]: placeInZone(RA) },
      constants: { CLAIM_DELAY_S: 1.0 },
      claims: [{ tick: 5, team: "blue", fight_id: "banish" }],
      cc: [{ tick: 10, target: RA, kind: "banish", duration: 5 }],
    });
    expect(r.of("claim_award", (e) => e.team === "blue")).toHaveLength(1);
    expect(r.of("claim_deny")).toHaveLength(0);
  });

  it("a leftover at dist = ZONE_RADIUS (rim, inclusive) denies; a body just outside does not (L270, L291)", () => {
    const onRim = runS3({
      T: 2.5,
      units: { [RA]: placeInZone(RA, {}, { x: 3.0 }) },
      constants: { CLAIM_DELAY_S: 1.0 },
      claims: [{ tick: 5, team: "blue", fight_id: "rim" }],
    });
    expect(onRim.of("claim_deny")).toHaveLength(1);
    expect(onRim.of("claim_deny")[0]!.denier_id).toBe(RA);
    expect(deniersOf(onRim.of("claim_deny")[0]!)).toEqual([RA]);

    const out = runS3({
      T: 2.5,
      units: { [RA]: { x: ZONE.x + 3.2, y: ZONE.y, spawn_shield_until: 0, auto: false } },
      constants: { CLAIM_DELAY_S: 1.0 },
      claims: [{ tick: 5, team: "blue", fight_id: "out" }],
    });
    expect(out.of("claim_award", (e) => e.team === "blue")).toHaveLength(1);
    expect(out.of("claim_deny")).toHaveLength(0);
  });

  it("CLAIM_DENY_DWELL_S default 0 means any presence at resolve_at denies (L1591, M3-26)", () => {
    // Instant occupation at resolve is enough — the leftover is standing there the whole time.
    const r = runS3({
      T: 2.5,
      units: { [RA]: placeInZone(RA) },
      constants: { CLAIM_DELAY_S: 1.0, CLAIM_DENY_DWELL_S: 0.0 },
      claims: [{ tick: 5, team: "blue", fight_id: "dwell0" }],
    });
    expect(r.of("claim_deny")).toHaveLength(1);
  });
});

describe("§5.6 L291 — denier_id is the closest occupant; tie is unit order", () => {
  it("among two living enemies in the zone, denier_id is the one closer to the centre", () => {
    const r = runS3({
      T: 2.5,
      units: {
        [RA]: placeInZone(RA, {}, { x: 2.0 }),
        [RM]: placeInZone(RM, {}, { x: 0.5 }),
      },
      constants: { CLAIM_DELAY_S: 1.0 },
      claims: [{ tick: 5, team: "blue", fight_id: "closest" }],
    });
    expect(r.of("claim_deny")[0]!.denier_id).toBe(RM);
    expect(deniersOf(r.of("claim_deny")[0]!)).toEqual(expect.arrayContaining([RA, RM]));
  });

  it("equal distance: denier_id is earlier in unit order (Blue 0..4, then Red 0..4) (L291, §4.3 L134)", () => {
    // Both red units stacked on the centre (G6: living units may overlap).
    const r = runS3({
      T: 2.5,
      units: {
        [RJ]: placeInZone(RJ), // red jungle, index 1
        [RT]: placeInZone(RT), // red top, index 0 — earlier in unit order
      },
      constants: { CLAIM_DELAY_S: 1.0 },
      claims: [{ tick: 5, team: "blue", fight_id: "tie" }],
    });
    expect(r.of("claim_deny")[0]!.denier_id).toBe(RT);
    expect(deniersOf(r.of("claim_deny")[0]!)).toEqual([RT, RJ]);
  });
});

describe("career GDD v1.1.2 C-R-5 — PlayerMatchStats.claim_denies (career-match/1.x)", () => {
  it("every allied unit occupying the zone at resolve_at is credited, not only denier_id", () => {
    const r = runS3({
      T: 2.5,
      units: {
        [RA]: placeInZone(RA, {}, { x: 0.4 }),
        [RM]: placeInZone(RM, {}, { x: -0.4 }),
        [RT]: { x: 18, y: 8, spawn_shield_until: 0, auto: false }, // red, not in zone
      },
      constants: { CLAIM_DELAY_S: 1.0 },
      claims: [{ tick: 5, team: "blue", fight_id: "cr5" }],
    });
    expect(r.of("claim_deny")).toHaveLength(1);
    const denier = r.of("claim_deny")[0]!.denier_id as UId;
    expect(denier === RA || denier === RM).toBe(true);
    expect(deniersOf(r.of("claim_deny")[0]!)).toEqual(expect.arrayContaining([RA, RM]));
    expect(claimDeniesOf(r, RA)).toBe(1);
    expect(claimDeniesOf(r, RM)).toBe(1);
    expect(claimDeniesOf(r, RT)).toBe(0);
    expect(claimDeniesOf(r, BA)).toBe(0);
  });

  it("a solo denier is credited exactly once; a paid claim credits no one", () => {
    const denied = runS3({
      T: 2.5,
      units: { [RA]: placeInZone(RA) },
      constants: { CLAIM_DELAY_S: 1.0 },
      claims: [{ tick: 5, team: "blue", fight_id: "solo" }],
    });
    expect(claimDeniesOf(denied, RA)).toBe(1);

    const paid = runS3({
      T: 2.5,
      constants: { CLAIM_DELAY_S: 1.0 },
      claims: [{ tick: 5, team: "blue", fight_id: "paid" }],
    });
    expect(paid.of("claim_award")).toHaveLength(1);
    expect(claimDeniesOf(paid, RA)).toBe(0);
  });
});

describe("§5.6 L281–289 — production path: a net +1 fight win opens a claim (no hook)", () => {
  it("a 2v2 in which blue records strictly more fight takedowns emits claim_open for blue after fight end, resolve_at = fight_end + CLAIM_DELAY_S", () => {
    const pit = { x: 12, y: 4 };
    const r = runS3({
      T: 6.0,
      units: {
        [BM]: { x: pit.x - 0.6, y: pit.y, champ: "huntress", spawn_shield_until: 0, auto: false },
        [BJ]: { x: pit.x - 0.6, y: pit.y + 0.6, champ: "huntress", spawn_shield_until: 0, auto: false },
        [RM]: { x: pit.x + 0.6, y: pit.y, champ: "huntress", hp: 40, spawn_shield_until: 0, auto: false },
        [RA]: { x: pit.x + 0.6, y: pit.y + 0.6, champ: "huntress", spawn_shield_until: 0, auto: false },
      },
      constants: { CLAIM_DELAY_S: 8.0, FIGHT_END_GRACE_S: 1.0, SCORE_TO_WIN: 10 },
      damage: [killAt(10, BM, RM)],
    });
    const opens = r.of("claim_open", (e) => e.team === "blue");
    expect(opens.length).toBeGreaterThanOrEqual(1);
    const death = r.of("death", (e) => e.unit_id === RM)[0]!;
    // Fight end is when 2-per-side has failed for 1.0 s, or the other side has 0 in radius (L287).
    // resolve_at is fight_end + 8.0, so at least death.t + 8.0 (if end is immediate) and
    // at most death.t + 1.0 + 8.0 (if the grace timer runs).
    const resolve = opens[0]!.resolve_at as number;
    expect(resolve).toBeGreaterThanOrEqual((death.t as number) + 8.0 - 1e-9);
    expect(resolve).toBeLessThanOrEqual((death.t as number) + 1.0 + 8.0 + 1e-9);
  });
});
