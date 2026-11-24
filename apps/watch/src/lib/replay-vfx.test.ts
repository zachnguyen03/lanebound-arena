import { describe, expect, it } from "vitest";
import { activeEffectsAt, ReplayEngine } from "./replay";
import type { SimEvent } from "./types";

function ev(
  partial: Partial<SimEvent> & { type: string; tick: number; seq: number },
): SimEvent {
  return {
    t: partial.tick / 10,
    ...partial,
  };
}

const lineup: SimEvent = ev({
  type: "match_start",
  tick: 0,
  seq: 0,
  seed: 20261122,
  blue_lineup: ["brannoch", "sedge", "kerrig", "huntress", "ysol"],
  red_lineup: ["rhedan", "tolle", "helvar", "maelis", "saelo"],
});

describe("ReplayEngine skill VFX intervals", () => {
  it("telegraph appears for cast_time and expires", () => {
    const events = [
      lineup,
      ev({
        type: "cast_start",
        tick: 27,
        seq: 1,
        unit_id: "blue:mid",
        skill_id: "Latch Line",
        cast_time: 0.3,
        target_id: "red:mid",
        x: 18,
        y: 8,
      }),
      // Extends maxTick so we can scrub past the cast window.
      ev({ type: "xp_gain", tick: 40, seq: 2, unit_id: "blue:mid", amount: 1 }),
    ];
    const eng = new ReplayEngine(events);
    const during = eng.stateAt(27);
    const active = activeEffectsAt(during.effects, during.t);
    expect(active.telegraphs).toHaveLength(1);
    expect(active.telegraphs[0]!.skillId).toBe("Latch Line");
    expect(active.telegraphs[0]!.skillKey).toBe("Q");
    expect(active.skillTags[0]!.skillName).toBe("Latch Line");
    expect(active.telegraphs[0]!.endsAt).toBeCloseTo(2.7 + 0.3, 5);

    const after = eng.stateAt(31); // t=3.1 > 3.0
    expect(activeEffectsAt(after.effects, after.t).telegraphs).toHaveLength(0);
  });

  it("cast_cancel removes the telegraph immediately", () => {
    const events = [
      lineup,
      ev({
        type: "cast_start",
        tick: 10,
        seq: 1,
        unit_id: "blue:mid",
        skill_id: "Latch Line",
        cast_time: 0.5,
        x: 12,
        y: 8,
      }),
      ev({
        type: "cast_cancel",
        tick: 12,
        seq: 2,
        unit_id: "blue:mid",
        skill_id: "Latch Line",
        reason: "silence",
      }),
    ];
    const eng = new ReplayEngine(events);
    expect(
      activeEffectsAt(eng.stateAt(11).effects, 1.1).telegraphs,
    ).toHaveLength(1);
    const atCancel = eng.stateAt(12);
    expect(
      activeEffectsAt(atCancel.effects, atCancel.t).telegraphs,
    ).toHaveLength(0);
  });

  it("scrubbing backward and forward yields the same active set", () => {
    const events = [
      lineup,
      ev({
        type: "cast_start",
        tick: 50,
        seq: 1,
        unit_id: "red:support",
        skill_id: "Still Hour",
        cast_time: 0.7,
        x: 10,
        y: 8,
      }),
      ev({
        type: "status_apply",
        tick: 60,
        seq: 2,
        source_id: "red:support",
        target_id: "blue:mid",
        kind: "slow",
        applied_duration: 1.2,
        raw_duration: 1.2,
      }),
      ev({
        type: "status_expire",
        tick: 72,
        seq: 3,
        target_id: "blue:mid",
        kind: "slow",
      }),
      ev({ type: "xp_gain", tick: 90, seq: 4, unit_id: "blue:mid", amount: 1 }),
    ];
    const eng = new ReplayEngine(events);
    // Mid-cast + mid-ult-pulse: pulse lasts 0.28s from t=5.0; tick 52 = 5.2.
    const forward = activeEffectsAt(eng.stateAt(52).effects, 5.2);
    expect(forward.ultPulses).toHaveLength(1);
    expect(forward.telegraphs).toHaveLength(1);
    eng.stateAt(80);
    const scrubbed = activeEffectsAt(eng.stateAt(52).effects, 5.2);
    expect(scrubbed.telegraphs.map((t) => t.id)).toEqual(
      forward.telegraphs.map((t) => t.id),
    );
    expect(scrubbed.ultPulses).toHaveLength(1);

    const midStatus = activeEffectsAt(eng.stateAt(65).effects, 6.5);
    expect(midStatus.statuses.some((s) => s.kind === "slow")).toBe(true);
    const afterExpire = activeEffectsAt(eng.stateAt(72).effects, 7.2);
    expect(afterExpire.statuses.some((s) => s.kind === "slow")).toBe(false);
  });

  it("projectile_spawn tracks flight until land_t", () => {
    const events = [
      lineup,
      ev({
        type: "pos",
        tick: 828,
        seq: 1,
        unit_id: "red:jungle",
        x: 14,
        y: 8,
      }),
      ev({
        type: "projectile_spawn",
        tick: 828,
        seq: 2,
        proj_id: "tolleR:red:jungle:828",
        unit_id: "red:jungle",
        skill_id: "Upwelling",
        x: 15.8,
        y: 8.0,
        land_t: 83.6,
      }),
      ev({ type: "xp_gain", tick: 850, seq: 3, unit_id: "red:jungle", amount: 1 }),
    ];
    const eng = new ReplayEngine(events);
    const mid = activeEffectsAt(eng.stateAt(832).effects, 83.2);
    expect(mid.projectiles).toHaveLength(1);
    const p = mid.projectiles[0]!;
    expect(p.projId).toBe("tolleR:red:jungle:828");
    expect(p.toX).toBeCloseTo(15.8, 5);
    expect(p.endedAt).toBeCloseTo(83.6, 5);
    const done = activeEffectsAt(eng.stateAt(837).effects, 83.7);
    expect(done.projectiles).toHaveLength(0);
  });

  it("skill hit creates a flash distinct from autos", () => {
    const events = [
      lineup,
      ev({
        type: "hit",
        tick: 30,
        seq: 1,
        source_id: "blue:mid",
        target_id: "red:mid",
        skill_id: "Latch Line",
        hp_after: 900,
      }),
      ev({
        type: "hit",
        tick: 31,
        seq: 2,
        source_id: "blue:adc",
        target_id: "red:mid",
        skill_id: "auto",
        hp_after: 880,
      }),
    ];
    const eng = new ReplayEngine(events);
    const skill = activeEffectsAt(eng.stateAt(30).effects, 3.0);
    expect(skill.hitFlashes).toHaveLength(1);
    expect(skill.hitFlashes[0]!.skillId).toBe("Latch Line");
    const auto = activeEffectsAt(eng.stateAt(31).effects, 3.1);
    expect(auto.hitFlashes.every((h) => h.skillId !== "auto")).toBe(true);
  });
});
