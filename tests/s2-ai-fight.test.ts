/**
 * S2 fight-layer AI — engineer-owned unit checks (official gate is tests/acceptance/s2).
 */
import { describe, expect, it } from "vitest";
import {
  chaseShouldStop,
  detectDives,
  evaluateFight,
  fightIssuesCall,
  holdDist,
  skillshotHitChance,
  defaultEvenConfig,
  simulate,
  DEFAULT_CONSTANTS,
} from "../sim/index.js";
import { emptyStatus } from "../sim/status.js";
import type { UnitState } from "../sim/types.js";

const c = DEFAULT_CONSTANTS;

function bare(partial: Partial<UnitState> & Pick<UnitState, "id" | "team" | "slot" | "champ">): UnitState {
  const u: UnitState = {
    id: partial.id,
    team: partial.team,
    slot: partial.slot,
    index: 0,
    champ: partial.champ,
    x: 12,
    y: 8,
    vx: 0,
    vy: 0,
    hp: 900,
    max_hp: 900,
    xp: 0,
    level: 7,
    alive: true,
    respawn_at: Infinity,
    spawn_shield_until: 0,
    auto_cd: 0,
    auto_windup_left: 0,
    auto_windup_target: null,
    auto_next_start_t: 0,
    stats: {
      hp: 900,
      regen: 4,
      atk: 72,
      pow: 8,
      pres: 26,
      mres: 24,
      as: 0.84,
      crit: 0.08,
      range: partial.champ === "kerrig" || partial.champ === "brannoch" || partial.champ === "rhedan" ? 1.5 : 6.25,
      ms: 3.3,
    },
    attrs: { aim: 70, reflexes: 70, execution: 70, decision: 70, positioning: 70, teamwork: 70 },
    mastery: 50,
    intent: "Idle",
    waypoint: null,
    scripted_wp_i: 0,
    damage_log: [],
    assist_log: [],
    last_hit_by: null,
    status: emptyStatus(),
    attack_reset_pending: false,
    last_damage_t: -Infinity,
    last_dealt_t: -Infinity,
    marks: [],
    cd_q: 0,
    cd_w: 0,
    cd_r: 0,
    cast_left: 0,
    cast_skill: null,
    cast_target: null,
    cast_aim_x: 12,
    cast_aim_y: 8,
    cast_force_hit: false,
    cast_seq: 0,
    cast_snapshot_ids: null,
    break_until: 0,
    commit_until: 0,
    rewind_used: false,
    abandon_scripted_motor: false,
    ai_target_id: null,
  };
  Object.assign(u, partial);
  return u;
}

describe("S2 G9 fight detection", () => {
  it("2v2 within 6 of centroid + swing escalates; issues fight_call", () => {
    const units = [
      bare({ id: "blue:adc", team: "blue", slot: "adc", champ: "huntress", x: 11, y: 8, index: 3, hp: 900 }),
      bare({ id: "blue:support", team: "blue", slot: "support", champ: "ysol", x: 11.5, y: 8.5, index: 4, hp: 900 }),
      bare({ id: "red:adc", team: "red", slot: "adc", champ: "maelis", x: 13, y: 8, index: 8, hp: 80 }),
      bare({ id: "red:support", team: "red", slot: "support", champ: "saelo", x: 13.5, y: 8.5, index: 9, hp: 80 }),
    ];
    const snap = evaluateFight(units, c, "f1");
    expect(snap.exists).toBe(true);
    expect(snap.blue.length).toBe(2);
    expect(snap.red.length).toBe(2);
    expect(Math.abs(snap.a_true_blue - 0.5)).toBeGreaterThan(0.2);
    expect(snap.escalate_2v2).toBe(true);
    expect(fightIssuesCall(snap)).toBe(true);
  });

  it("1v1 does not issue a Fight Call", () => {
    const units = [
      bare({ id: "blue:adc", team: "blue", slot: "adc", champ: "huntress", x: 12, y: 8 }),
      bare({ id: "red:adc", team: "red", slot: "adc", champ: "maelis", x: 13, y: 8 }),
    ];
    const snap = evaluateFight(units, c, null);
    expect(snap.exists).toBe(false);
    expect(fightIssuesCall(snap)).toBe(false);
  });

  it("3v2 always issues the call without needing 2v2 swing", () => {
    const units = [
      bare({ id: "blue:top", team: "blue", slot: "top", champ: "brannoch", x: 11, y: 7, index: 0 }),
      bare({ id: "blue:adc", team: "blue", slot: "adc", champ: "huntress", x: 11, y: 8, index: 3 }),
      bare({ id: "blue:support", team: "blue", slot: "support", champ: "ysol", x: 11, y: 9, index: 4 }),
      bare({ id: "red:adc", team: "red", slot: "adc", champ: "maelis", x: 13, y: 8, index: 8 }),
      bare({ id: "red:support", team: "red", slot: "support", champ: "saelo", x: 13, y: 9, index: 9 }),
    ];
    const snap = evaluateFight(units, c, "f1");
    expect(snap.exists).toBe(true);
    expect(snap.escalate_2v2).toBe(false);
    expect(fightIssuesCall(snap)).toBe(true);
  });
});

describe("S2 chase-stop", () => {
  it("stops when chase leash exceeded", () => {
    const chaser = bare({ id: "blue:adc", team: "blue", slot: "adc", champ: "huntress", x: 12, y: 8 });
    const target = bare({ id: "red:adc", team: "red", slot: "adc", champ: "maelis", x: 14, y: 8 });
    const chase = { target_id: target.id, start_x: 0, start_y: 8 };
    expect(chaseShouldStop(chaser, target, chase, c, 1.0, false).stop).toBe(true);
    expect(chaseShouldStop(chaser, target, chase, c, 1.0, false).reason).toBe("leash");
  });

  it("stops when target is in own sanctuary", () => {
    const chaser = bare({ id: "blue:adc", team: "blue", slot: "adc", champ: "huntress", x: 10, y: 8 });
    const target = bare({
      id: "red:adc",
      team: "red",
      slot: "adc",
      champ: "maelis",
      x: c.RED_SPAWN[0]!,
      y: c.RED_SPAWN[1]!,
    });
    const chase = { target_id: target.id, start_x: 10, start_y: 8 };
    expect(chaseShouldStop(chaser, target, chase, c, 0.5, false).stop).toBe(true);
    expect(chaseShouldStop(chaser, target, chase, c, 0.5, false).reason).toBe("sanctuary");
  });
});

describe("S2 attribute hooks", () => {
  it("Aim vs Reflexes hit% uses locked formula", () => {
    const p = skillshotHitChance(55, 85, c);
    expect(p).toBeCloseTo(0.25, 5);
  });

  it("Positioning hold_dist rises with Positioning (clamped to [range-1.5, range])", () => {
    const floor = 6.25 - 1.5;
    const mid = holdDist(6.25, 50);
    const high = holdDist(6.25, 90);
    const low = holdDist(6.25, 20);
    expect(low).toBeCloseTo(floor, 5);
    expect(mid).toBeCloseTo(floor, 5);
    expect(high).toBeGreaterThan(mid);
    expect(high).toBeLessThanOrEqual(6.25 + 1e-9);
  });
});

describe("S2 peel geometry", () => {
  it("detects melee dive on carry and selects a peeler", () => {
    const units = [
      bare({ id: "blue:adc", team: "blue", slot: "adc", champ: "huntress", x: 12, y: 8, index: 3 }),
      bare({ id: "blue:support", team: "blue", slot: "support", champ: "ysol", x: 11, y: 8, index: 4 }),
      bare({
        id: "red:mid",
        team: "red",
        slot: "mid",
        champ: "kerrig",
        x: 12.5,
        y: 8,
        index: 7,
        stats: {
          hp: 900,
          regen: 4,
          atk: 80,
          pow: 20,
          pres: 30,
          mres: 30,
          as: 0.9,
          crit: 0.1,
          range: 1.5,
          ms: 3.5,
        },
      }),
    ];
    const dives = detectDives(units, c, {
      a_true: 0.5,
      tactic: "hold_the_pit",
      ignore_perception: true,
      now: 1,
      seenAt: {},
    });
    expect(dives.length).toBeGreaterThanOrEqual(1);
    const d = dives[0]!;
    expect(d.geometric_ok).toBe(true);
    expect(d.peeler_id && d.peeler_id.id).toBe("blue:support");
    expect(d.carry_id).toBe("blue:adc");
  });
});

describe("S2 simulate with AI", () => {
  it("defaultEvenConfig digests match published S2 gold (AI on; intent in digest)", () => {
    const r = simulate(defaultEvenConfig(20261122));
    expect(r.digest).toBe("0f7456370f500188fa4fddde922d9c55213e792819bb9b8614b370a1c5df2e26");
  });

  it("AI-on same seed is deterministic across two runs", () => {
    const cfg = { ...defaultEvenConfig(20261122), ai_enabled: true, constants: { MATCH_T: 8.0 } };
    const a = simulate(cfg);
    const b = simulate(cfg);
    expect(a.digest).toBe(b.digest);
  });

  it("AI-off quiet match recovers S1 digest for seed 20261122", () => {
    const r = simulate({ ...defaultEvenConfig(20261122), ai_enabled: false });
    expect(r.digest).toBe("7e6516f4fad170ab9893de7d8a225271c42b19d837a5dfedefeda6bdd97aee1f");
  });
});
