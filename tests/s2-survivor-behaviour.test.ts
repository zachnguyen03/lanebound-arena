/**
 * S2 AI behaviour pins via one brainDecide step on a hand-built world.
 * Do not edit tests/acceptance/**.
 */
import { describe, expect, it } from "vitest";
import { brainDecide, type ChaseState } from "../sim/ai/brain.js";
import { DEFAULT_CONSTANTS } from "../sim/constants.js";
import { emptyStatus } from "../sim/status.js";
import type { MatchState, UnitState } from "../sim/types.js";

const c = DEFAULT_CONSTANTS;

const BA = "blue:adc";
const BM = "blue:mid";
const RA = "red:adc";
const RM = "red:mid";

function bare(
  partial: Omit<Partial<UnitState>, "attrs" | "stats"> &
    Pick<UnitState, "id" | "team" | "slot"> & {
      attrs?: Partial<UnitState["attrs"]>;
      stats?: Partial<UnitState["stats"]>;
    },
): UnitState {
  const { stats: statsPatch, attrs: attrsPatch, ...rest } = partial;
  return {
    index: 0,
    champ: "huntress",
    x: 12,
    y: 4,
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
      as: 1.2,
      crit: 0.08,
      range: 6.25,
      ms: 3.3,
      ...(statsPatch ?? {}),
    },
    attrs: {
      aim: 70,
      reflexes: 70,
      execution: 70,
      decision: 70,
      positioning: 70,
      teamwork: 70,
      ...(attrsPatch ?? {}),
    },
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
    cd_r: 99,
    cast_left: 0,
    cast_skill: null,
    cast_target: null,
    cast_aim_x: 0,
    cast_aim_y: 0,
    cast_force_hit: false,
    cast_seq: 0,
    cast_snapshot_ids: null,
    break_until: 0,
    commit_until: 0,
    rewind_used: false,
    abandon_scripted_motor: false,
    ai_target_id: null,
    ai_retreat_suppress_until: 0,
    walk_from_pad_until: 0,
    ai_at_planner_wp: false,
    ai_no_trickle_until: 0,
    ai_first_auto_done: true,
    zone_aura_res: 0,
    flank_buff_until: 0,
    ...rest,
  };
}

function stubState(units: UnitState[], t = 1.0): MatchState {
  return { t, units } as unknown as MatchState;
}

describe("S2 one-step decide behaviour", () => {
  it("follows a much greener local shot, not the far called target", () => {
    // Blue ADC TW90, free (no windup, unlocked). Engage call still names live
    // far full-HP Red ADC. Live Red Mid sits next to her at ~200/900.
    const blueAdc = bare({
      id: BA,
      team: "blue",
      slot: "adc",
      x: 8.5,
      y: 4,
      attrs: { teamwork: 90, decision: 70 },
      stats: { range: 6.25, ms: 3.3, atk: 72, as: 1.2 },
    });
    const redAdc = bare({
      id: RA,
      team: "red",
      slot: "adc",
      x: 15.8,
      y: 4,
      hp: 900,
      max_hp: 900,
    });
    const redMid = bare({
      id: RM,
      team: "red",
      slot: "mid",
      x: 9.3,
      y: 4,
      hp: 200,
      max_hp: 900,
      champ: "kerrig",
    });
    const state = stubState([blueAdc, redAdc, redMid]);

    const got = brainDecide(state, blueAdc, {
      c,
      commit: "engage",
      focusId: RA,
      peelDiverId: null,
      peeling: false,
      chase: null,
      tactic: "hunt",
      fightIds: [BA, RA, RM],
      intentTarget: {},
    });

    expect(got.target_id).toBe(RM);
    expect(got.target_id).not.toBe(RA);
  });

  it("a dead called target does not stay the attack target", () => {
    // Call still carries Red ADC as focus even though she is dead. Live Red Mid
    // is next to Blue ADC (TW90, free). One decide step must pick the live body.
    const blueAdc = bare({
      id: BA,
      team: "blue",
      slot: "adc",
      x: 8.5,
      y: 4,
      attrs: { teamwork: 90, decision: 70 },
      stats: { range: 6.25, ms: 3.3, atk: 72, as: 1.2 },
    });
    const redAdc = bare({
      id: RA,
      team: "red",
      slot: "adc",
      x: 15.8,
      y: 4,
      hp: 0,
      max_hp: 900,
      alive: false,
    });
    const redMid = bare({
      id: RM,
      team: "red",
      slot: "mid",
      x: 9.3,
      y: 4,
      hp: 500,
      max_hp: 900,
      champ: "kerrig",
    });
    const state = stubState([blueAdc, redAdc, redMid]);

    const got = brainDecide(state, blueAdc, {
      c,
      commit: "engage",
      focusId: RA,
      peelDiverId: null,
      peeling: false,
      chase: null,
      tactic: "hunt",
      fightIds: [BA, RA, RM],
      intentTarget: {},
    });

    expect(redAdc.alive).toBe(false);
    expect(got.target_id).toBe(RM);
    expect(got.target_id).not.toBe(RA);
  });

  it("a no-damage chaser still treats a 1-HP target as killable", () => {
    // Already-open chase: Blue Mid mid-chase on Red ADC, under leash, not in
    // sanctuary. Level 1, zero attack damage and speed, no damaging ally nearby.
    // Red ADC has 1 HP. Decide must keep the chase (not Idle / not stopped).
    const chaser = bare({
      id: BM,
      team: "blue",
      slot: "mid",
      champ: "kerrig",
      x: 10,
      y: 4,
      level: 1,
      attrs: { decision: 90, execution: 90, teamwork: 70 },
      stats: {
        atk: 0,
        as: 0,
        range: 2.5,
        ms: 3.3,
        pow: 0,
        crit: 0,
        hp: 900,
        regen: 0,
        pres: 26,
        mres: 24,
      },
    });
    const target = bare({
      id: RA,
      team: "red",
      slot: "adc",
      x: 14,
      y: 4,
      hp: 1,
      max_hp: 900,
      champ: "maelis",
      stats: { range: 6.25, ms: 3.3, atk: 72, as: 1.2 },
    });
    const openChase: ChaseState = {
      target_id: RA,
      start_x: 10,
      start_y: 4,
      start_t: 0.5,
    };
    const travelled = Math.hypot(chaser.x - openChase.start_x, chaser.y - openChase.start_y);
    expect(travelled).toBeLessThan(c.CHASE_LEASH);
    expect(target.hp).toBe(1);

    const state = stubState([chaser, target], 1.2);
    const got = brainDecide(state, chaser, {
      c,
      commit: "engage",
      focusId: null,
      peelDiverId: null,
      peeling: false,
      chase: openChase,
      tactic: "hunt",
      fightIds: [BM, RA],
      intentTarget: { [BM]: RA },
    });

    expect(got.intent).not.toBe("Idle");
    expect(got.target_id).toBe(RA);
    expect(got.chase).not.toBeNull();
    expect(got.chase!.leashed).not.toBe(true);
    expect(got.chase!.target_id).toBe(RA);
  });
});
