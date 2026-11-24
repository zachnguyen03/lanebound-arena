/**
 * R7-10: Tolle W winning-commit / last-denier guards; Helvar R zone-break
 * with clipped knockback; Torun W still issued (taunt applied in cast.ts).
 */
import { describe, expect, it } from "vitest";
import { evaluateCastPolicy } from "../sim/ai/cast_policy.js";
import { beginCast, tickCasts } from "../sim/cast.js";
import { DEFAULT_CONSTANTS } from "../sim/constants.js";
import { evenOvrConfig } from "../sim/match_config.js";
import { emptyStatus } from "../sim/status.js";
import type { MatchState, UnitState } from "../sim/types.js";
import type { RngBank } from "../sim/rng.js";

const c = DEFAULT_CONSTANTS;

function bare(
  partial: Partial<UnitState> & Pick<UnitState, "id" | "team" | "slot" | "champ">,
): UnitState {
  const u: UnitState = {
    id: partial.id,
    team: partial.team,
    slot: partial.slot,
    index: partial.index ?? 0,
    champ: partial.champ,
    x: 12,
    y: 8,
    vx: 0,
    vy: 0,
    hp: 1200,
    max_hp: 1200,
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
      hp: 1200,
      regen: 4,
      atk: 80,
      pow: 40,
      pres: 30,
      mres: 28,
      as: 0.9,
      crit: 0.05,
      range: 1.5,
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

describe("R7-10 Tolle W guards", () => {
  it("blocks enemy banish on winning commit when the diver is the only hit-able enemy", () => {
    const me = bare({ id: "blue:jgl", team: "blue", slot: "jgl", champ: "tolle", x: 11, y: 8, cd_q: 5 });
    const carry = bare({
      id: "blue:adc",
      team: "blue",
      slot: "adc",
      champ: "huntress",
      x: 12,
      y: 8,
      index: 1,
      stats: {
        hp: 1200,
        regen: 4,
        atk: 80,
        pow: 40,
        pres: 30,
        mres: 28,
        as: 0.9,
        crit: 0.05,
        range: 6.5,
        ms: 3.3,
      },
    });
    const diver = bare({
      id: "red:mid",
      team: "red",
      slot: "mid",
      champ: "kerrig",
      x: 12.5,
      y: 8,
      index: 2,
    });
    // aTrue ≥ 0.62 would block via P1b gate too; use aTrue just under for the
    // backstop path by forcing commit engage at 0.62 with only one enemy.
    const got = evaluateCastPolicy({ t: 10, tick: 100, units: [me, carry, diver] } as MatchState, me, {
      c,
      focusId: diver.id,
      peelDiverId: diver.id,
      peeling: true,
      commit: "engage",
      aTrue: 0.62,
      fightIds: [me.id, carry.id, diver.id],
    });
    // P1b requires aTrue < 0.62, so at 0.62 P1b is off; winning-commit backstop
    // also blocks if somehow reached. Expect no W.
    expect(got?.skill === "W").toBe(false);
  });

  it("blocks last-denier banish when banish would end before resolve_at", () => {
    const me = bare({ id: "blue:jgl", team: "blue", slot: "jgl", champ: "tolle", x: 11, y: 8, cd_q: 5 });
    const carry = bare({
      id: "blue:adc",
      team: "blue",
      slot: "adc",
      champ: "huntress",
      x: 10,
      y: 8,
      index: 1,
      stats: {
        hp: 1200,
        regen: 4,
        atk: 80,
        pow: 40,
        pres: 30,
        mres: 28,
        as: 0.9,
        crit: 0.05,
        range: 6.5,
        ms: 3.3,
      },
    });
    const denier = bare({
      id: "red:mid",
      team: "red",
      slot: "mid",
      champ: "kerrig",
      x: 12,
      y: 8,
      index: 2,
    });
    // resolve_at far in the future → apply+18 < resolve → block.
    const state = {
      t: 10,
      tick: 100,
      units: [me, carry, denier],
      claim: { team: "blue", resolve_at: 20.0 },
    } as MatchState;
    const got = evaluateCastPolicy(state, me, {
      c,
      focusId: denier.id,
      peelDiverId: denier.id,
      peeling: true,
      commit: "hold",
      aTrue: 0.4,
    });
    expect(got?.skill === "W" && got.target_id === denier.id).toBe(false);
  });

  it("allows last-denier banish when banish covers resolve_at", () => {
    const me = bare({ id: "blue:jgl", team: "blue", slot: "jgl", champ: "tolle", x: 11, y: 8, cd_q: 5 });
    const carry = bare({
      id: "blue:adc",
      team: "blue",
      slot: "adc",
      champ: "huntress",
      x: 10,
      y: 8,
      index: 1,
      stats: {
        hp: 1200,
        regen: 4,
        atk: 80,
        pow: 40,
        pres: 30,
        mres: 28,
        as: 0.9,
        crit: 0.05,
        range: 6.5,
        ms: 3.3,
      },
    });
    const denier = bare({
      id: "red:mid",
      team: "red",
      slot: "mid",
      champ: "kerrig",
      x: 12,
      y: 8,
      index: 2,
    });
    // resolve_at soon: apply(~102) + 18 = 120 → resolve tick 105 covered → allow.
    const state = {
      t: 10,
      tick: 100,
      units: [me, carry, denier],
      claim: { team: "blue", resolve_at: 10.5 },
    } as MatchState;
    const got = evaluateCastPolicy(state, me, {
      c,
      focusId: denier.id,
      peelDiverId: denier.id,
      peeling: true,
      commit: "hold",
      aTrue: 0.4,
    });
    expect(got).toMatchObject({ skill: "W", tier: "P1b", target_id: denier.id });
  });
});

describe("R7-10 Helvar R zone-break", () => {
  it("fires P4 zone-break when occupants are on-line and knockback clears the pit", () => {
    const me = bare({
      id: "blue:mid",
      team: "blue",
      slot: "mid",
      champ: "helvar",
      x: 8,
      y: 8,
      level: 7,
      cd_q: 5,
      cd_w: 5,
    });
    // Occupant near zone rim so 2.2 knockback away from Helvar ends > 3 from (12,8).
    const occ = bare({
      id: "red:adc",
      team: "red",
      slot: "adc",
      champ: "huntress",
      x: 13.5,
      y: 8,
      index: 1,
      stats: {
        hp: 1200,
        regen: 4,
        atk: 80,
        pow: 40,
        pres: 30,
        mres: 28,
        as: 0.9,
        crit: 0.05,
        range: 6.5,
        ms: 3.3,
      },
    });
    const state = {
      t: 10,
      tick: 100,
      units: [me, occ],
      zone: {
        owner: "red",
        progress_blue: 0,
        progress_red: 5,
        tick_timer: 0,
        occupied: [occ.id],
        control_time: { blue: 0, red: 5 },
      },
    } as MatchState;
    const got = evaluateCastPolicy(state, me, {
      c,
      focusId: occ.id,
      commit: "hold",
      aTrue: 0.9,
      comboStyle: "auto",
    });
    expect(got).toMatchObject({ skill: "R", tier: "P4", target_id: occ.id });
  });
});

describe("R7-10 Torun W policy + kit taunt", () => {
  it("policy still issues Torun W P1b when diver is inside r 1.2 of the carry", () => {
    const me = bare({ id: "blue:jgl", team: "blue", slot: "jgl", champ: "torun", x: 10, y: 8, cd_q: 5, cd_r: 5 });
    const carry = bare({
      id: "blue:adc",
      team: "blue",
      slot: "adc",
      champ: "huntress",
      x: 12,
      y: 8,
      index: 1,
      stats: {
        hp: 1200,
        regen: 4,
        atk: 80,
        pow: 40,
        pres: 30,
        mres: 28,
        as: 0.9,
        crit: 0.05,
        range: 6.5,
        ms: 3.3,
      },
    });
    const diver = bare({
      id: "red:mid",
      team: "red",
      slot: "mid",
      champ: "kerrig",
      x: 12.5,
      y: 8,
      index: 2,
    });
    const got = evaluateCastPolicy({ t: 10, tick: 100, units: [me, carry, diver] } as MatchState, me, {
      c,
      focusId: diver.id,
      peelDiverId: diver.id,
      peeling: true,
      commit: "hold",
      aTrue: 0.4,
    });
    expect(got).toMatchObject({ skill: "W", tier: "P1b", target_id: carry.id });
  });

  it("resolve applies the kit 2.0 s taunt on a diver inside r 1.2", () => {
    const me = bare({ id: "blue:jgl", team: "blue", slot: "jgl", champ: "torun", x: 10, y: 8 });
    const carry = bare({
      id: "blue:adc",
      team: "blue",
      slot: "adc",
      champ: "huntress",
      x: 12,
      y: 8,
      index: 1,
    });
    const diver = bare({
      id: "red:mid",
      team: "red",
      slot: "mid",
      champ: "kerrig",
      x: 12.4,
      y: 8,
      index: 2,
    });
    const state = {
      t: 1,
      tick: 10,
      units: [me, carry, diver],
      displacements: [],
      pending_damage: [],
      pending_status: [],
      pending_heals: [],
      pending_shields: [],
      event_seq: 1,
      config: evenOvrConfig(),
      forced_clock_end: false,
      ended: false,
      winner: null,
    } as MatchState;
    const events: Array<{ type: string; [k: string]: unknown }> = [];
    const emit = (type: string, payload: Record<string, unknown>) => {
      events.push({ type, ...payload });
    };
    const rng = { next: () => 0.01 } as unknown as RngBank;
    beginCast(
      state,
      { source_id: me.id, skill: "W", target_id: carry.id, aim_x: carry.x, aim_y: carry.y, force_hit: true },
      c,
      emit,
    );
    // Drain windup and resolve.
    const pendingLands: never[] = [];
    while (me.cast_left > 1e-12) {
      tickCasts(state, pendingLands, c, rng, emit);
    }
    tickCasts(state, pendingLands, c, rng, emit);
    const taunt = state.pending_status.find((p) => p.kind === "taunt" && p.target_id === diver.id);
    expect(taunt).toBeTruthy();
    expect(taunt?.raw_duration).toBe(2.0);
  });
});
