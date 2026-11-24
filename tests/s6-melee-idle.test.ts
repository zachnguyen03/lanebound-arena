/**
 * S6 — melee idling under Hold commit (engage gate).
 *
 * Repro: under hold_the_pit with a living foe inside sense range but outside
 * AA range, melee used to Idle for the whole window and never close.
 * Fix: hold + melee + nearEnemy promotes to engage so they Approach/Chase.
 */
import { describe, expect, it } from "vitest";
import { brainDecide } from "../sim/ai/brain.js";
import { DEFAULT_CONSTANTS } from "../sim/constants.js";
import { evenOvrConfig } from "../sim/match_config.js";
import { emptyStatus } from "../sim/status.js";
import { defaultEvenConfig, simulate } from "../sim/simulate.js";
import type { MatchState, UnitState } from "../sim/types.js";

const c = DEFAULT_CONSTANTS;
const N_S = 8;

function bare(
  partial: Partial<UnitState> & Pick<UnitState, "id" | "team" | "slot" | "champ">,
): UnitState {
  const range =
    partial.champ === "brannoch" ||
    partial.champ === "kerrig" ||
    partial.champ === "rhedan" ||
    partial.champ === "tolle"
      ? 1.5
      : 6.25;
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
      as: 0.84,
      crit: 0.08,
      range,
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

describe("S6 melee idle under Hold — engage gate", () => {
  it(`brainDecide: Hold + melee in a team fight (≥2 allies) with foe at ~4 tiles Approaches (not Idle)`, () => {
    const me = bare({
      id: "blue:top",
      team: "blue",
      slot: "top",
      champ: "brannoch",
      x: 10,
      y: 8,
      stats: {
        hp: 900,
        regen: 4,
        atk: 72,
        pow: 8,
        pres: 26,
        mres: 24,
        as: 0.84,
        crit: 0.08,
        range: 1.5,
        ms: 3.3,
      },
    });
    const ally = bare({
      id: "blue:jungle",
      team: "blue",
      slot: "jungle",
      champ: "sedge",
      x: 10.5,
      y: 8.5,
    });
    const foe = bare({
      id: "red:adc",
      team: "red",
      slot: "adc",
      champ: "maelis",
      x: 14,
      y: 8,
      stats: {
        hp: 900,
        regen: 4,
        atk: 72,
        pow: 8,
        pres: 26,
        mres: 24,
        as: 1.2,
        crit: 0.08,
        range: 6.5,
        ms: 3.3,
      },
    });
    const state = {
      t: 5,
      tick: 50,
      units: [me, ally, foe],
    } as MatchState;

    const d = brainDecide(state, me, {
      c,
      commit: "hold",
      focusId: foe.id,
      peelDiverId: null,
      peeling: false,
      chase: null,
      tactic: "hold_the_pit",
      fightIds: [me.id, ally.id, foe.id],
      intentTarget: {},
      comboStyle: "auto",
      aTrue: 0.5,
    });

    expect(d.intent).toBe("Approach");
    expect(d.target_id).toBe(foe.id);
    const dist = Math.hypot(me.x - foe.x, me.y - foe.y);
    expect(dist).toBeGreaterThan(me.stats.range + 0.3);
    expect(d.waypoint).not.toBeNull();
  });

  it("brainDecide: Hold + melee 1v1 still Idles out of range (preserves Positioning)", () => {
    const me = bare({
      id: "blue:mid",
      team: "blue",
      slot: "mid",
      champ: "kerrig",
      x: 12,
      y: 4,
    });
    const foe = bare({
      id: "blue:adc",
      team: "red",
      slot: "adc",
      champ: "huntress",
      x: 10,
      y: 4,
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
      },
    });
    // Fix foe team after bare defaults
    foe.team = "red";
    const state = { t: 5, tick: 50, units: [me, foe] } as MatchState;
    const d = brainDecide(state, me, {
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
    expect(d.intent).toBe("Idle");
  });

  it(`even-OVR Hold: melee champions land auto hits within ${N_S}s (seeds 20261122 / 20261123)`, () => {
    const meleeChamps = new Set(["brannoch", "rhedan", "tolle", "kerrig"]);
    for (const seed of [20261122, 20261123] as const) {
      const cfg = evenOvrConfig(seed, "hold_the_pit");
      const r = simulate({
        ...cfg,
        constants: { ...(cfg.constants ?? {}), MATCH_T: N_S },
      });
      const meleeIds = new Set(
        r.state.units.filter((u) => meleeChamps.has(u.champ)).map((u) => u.id as string),
      );
      expect(meleeIds.size).toBeGreaterThan(0);
      const autoHits = r.events.filter(
        (e) =>
          e.type === "hit" &&
          e.skill_id === "auto" &&
          meleeIds.has(e.source_id as string),
      );
      expect(
        autoHits.length,
        `seed ${seed}: expected melee auto hits within ${N_S}s (idle repro would be 0)`,
      ).toBeGreaterThan(0);
    }
  });

  it("defaultEvenConfig AI-on Hold: Brannoch is not Idle-stuck out of range for 8s", () => {
    const r = simulate({
      ...defaultEvenConfig(20261122),
      ai_enabled: true,
      forced_clock_end: false,
      constants: { MATCH_T: N_S },
    });
    const brannoch = r.state.units.find((u) => u.champ === "brannoch");
    expect(brannoch).toBeTruthy();
    const intents = r.events.filter(
      (e) => e.type === "intent" && e.unit_id === brannoch!.id,
    );
    const closing = intents.filter(
      (e) => e.intent === "Approach" || e.intent === "Chase" || e.intent === "Engage",
    );
    expect(closing.length).toBeGreaterThan(0);
  });
});
