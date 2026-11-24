/**
 * S6 — kite_slack / Execution sign pin (§8.4 L1009–1014).
 *
 * Spec intent: "High Execution completes the auto at the rim; low Execution
 * over-steers and cancels windups."
 *   kite_slack_tiles = clamp(0.80 - 0.012*(eff_Execution - 50), 0.20, 1.20)
 *
 * Higher Execution ⇒ smaller slack ⇒ fewer windup cancels.
 * If the live brain/motor does the opposite, this test fails — report, do not fix
 * (design call).
 */
import { describe, expect, it } from "vitest";
import { kiteSlackTiles } from "../sim/ai/attributes.js";
import { brainDecide } from "../sim/ai/brain.js";
import { DEFAULT_CONSTANTS } from "../sim/constants.js";
import { emptyStatus } from "../sim/status.js";
import type { MatchState, UnitState } from "../sim/types.js";

const c = DEFAULT_CONSTANTS;

function bare(
  partial: Partial<UnitState> & Pick<UnitState, "id" | "team" | "slot" | "champ">,
): UnitState {
  const u: UnitState = {
    id: partial.id,
    team: partial.team,
    slot: partial.slot,
    index: 0,
    champ: partial.champ,
    x: 10,
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
      as: 1.0,
      crit: 0.08,
      range: 6.25,
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
    cast_aim_x: 10,
    cast_aim_y: 8,
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
    flank_buff_until: 0,
    ai_first_auto_done: true,
    zone_aura_res: 0,
  };
  Object.assign(u, partial);
  return u;
}

describe("kite_slack / Execution — formula sign (§8.4)", () => {
  it("kiteSlackTiles decreases as Execution rises (high Exec → smaller slack)", () => {
    expect(kiteSlackTiles(10)).toBeGreaterThan(kiteSlackTiles(50));
    expect(kiteSlackTiles(50)).toBeGreaterThan(kiteSlackTiles(90));
    // clamp floor 0.20 / ceil 1.20
    expect(kiteSlackTiles(1)).toBeCloseTo(1.2, 5);
    expect(kiteSlackTiles(50)).toBeCloseTo(0.8, 5);
    // 0.80 - 0.012*(99-50) = 0.212 (floor 0.20 only at Exec 100)
    expect(kiteSlackTiles(99)).toBeCloseTo(0.212, 5);
    expect(kiteSlackTiles(100)).toBeCloseTo(0.2, 5);
  });
});

describe("kite_slack / Execution — behavioural sign (spec intent)", () => {
  /**
   * Spec: high Execution completes the auto at the rim (refuses kite sidesteps
   * that would cancel windup while within slack). Proxy: count mid-windup move
   * intents (Kite/Approach/Chase) at low vs high Execution when slightly off
   * hold_dist. Spec intent: cancelsHigh < cancelsLow.
   *
   * DESIGN CALL (do not "fix" in this PR): the brain currently hard-Holds
   * Engage for any auto_windup_left > 0, ignoring kite_slack — so both arms
   * cancel 0 times and the inequality fails. it.fails documents that until
   * GD decides whether to wire slack into mid-windup kite refusal.
   */
  it.fails("higher Execution cancels fewer mid-windup kite moves than low Execution", () => {
    const foe = bare({
      id: "red:top",
      team: "red",
      slot: "top",
      champ: "brannoch",
      x: 12,
      y: 8,
      stats: {
        hp: 1200,
        regen: 4,
        atk: 70,
        pow: 8,
        pres: 40,
        mres: 40,
        as: 0.7,
        crit: 0.05,
        range: 1.5,
        ms: 3.2,
      },
    });

    const countMoveDuringWindup = (execution: number): number => {
      let moves = 0;
      // Sweep distances around hold_dist for a ranged unit (range 6.25, pos 70
      // → hold_dist ≈ 6.25*(0.75+0.06) ≈ 5.06). Place slightly inside/outside.
      for (const d of [4.2, 4.6, 5.0, 5.4, 5.8, 6.2, 6.6]) {
        const me = bare({
          id: "blue:adc",
          team: "blue",
          slot: "adc",
          champ: "huntress",
          x: foe.x - d,
          y: foe.y,
          attrs: {
            aim: 70,
            reflexes: 70,
            execution,
            decision: 70,
            positioning: 70,
            teamwork: 70,
          },
          auto_windup_left: 0.2,
          auto_windup_target: foe.id,
        });
        const state = { t: 5, tick: 50, units: [me, foe] } as MatchState;
        const d0 = brainDecide(state, me, {
          c,
          commit: "hold",
          focusId: foe.id,
          peelDiverId: null,
          peeling: false,
          chase: null,
          tactic: "hold_the_pit",
          fightIds: [me.id, foe.id],
          intentTarget: {},
        });
        // A move intent mid-windup is a windup-cancel risk (over-steer).
        if (d0.intent === "Kite" || d0.intent === "Approach" || d0.intent === "Chase") {
          moves += 1;
        }
      }
      return moves;
    };

    const cancelsLow = countMoveDuringWindup(10);
    const cancelsHigh = countMoveDuringWindup(90);

    // Spec intent: high Execution cancels fewer windups.
    expect(
      cancelsHigh,
      `expected cancelsHigh (${cancelsHigh}) < cancelsLow (${cancelsLow}) per §8.4; if inverted or equal, report — do not retune`,
    ).toBeLessThan(cancelsLow);
  });
});
