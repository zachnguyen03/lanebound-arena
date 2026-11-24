/**
 * §9.4.1.4 rule 12 / §4.4: every cast_start carries target_id or x,y.
 */
import { describe, expect, it } from "vitest";
import { beginCast } from "../sim/cast.js";
import { DEFAULT_CONSTANTS } from "../sim/constants.js";
import { evenOvrConfig, simulate } from "../sim/index.js";
import { emptyStatus } from "../sim/status.js";
import type { MatchState, SimEvent, UnitState } from "../sim/types.js";

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

describe("rule 12: cast_start carries target_id or x,y (§4.4 / L1210)", () => {
  it("targeted cast_start includes target_id and aim x,y", () => {
    const me = bare({ id: "blue:adc", team: "blue", slot: "adc", champ: "huntress", x: 11, y: 8 });
    const foe = bare({ id: "red:adc", team: "red", slot: "adc", champ: "maelis", x: 14, y: 8.5 });
    const state = {
      t: 1,
      tick: 10,
      event_seq: 1,
      units: [me, foe],
      pending_damage: [],
      pending_heals: [],
      pending_shields: [],
      pending_status: [],
      pending_lands: [],
    } as unknown as MatchState;
    const events: SimEvent[] = [];
    beginCast(
      state,
      { tick: 10, source_id: me.id, skill: "Q", target_id: foe.id, force_hit: true, tier: "P4" },
      c,
      (type, payload) => {
        events.push({ type, t: 1, tick: 10, seq: events.length + 1, ...payload } as SimEvent);
      },
    );
    const start = events.find((e) => e.type === "cast_start");
    expect(start).toBeTruthy();
    expect(start!.target_id).toBe(foe.id);
    expect(typeof start!.x).toBe("number");
    expect(typeof start!.y).toBe("number");
    expect(start!.x).toBeCloseTo(14, 4);
    expect(start!.y).toBeCloseTo(8.5, 4);
  });

  it("aim-only cast_start includes x,y when target_id is absent", () => {
    const me = bare({ id: "blue:mid", team: "blue", slot: "mid", champ: "helvar", x: 10, y: 8 });
    const state = {
      t: 1,
      tick: 10,
      event_seq: 1,
      units: [me],
      pending_damage: [],
      pending_heals: [],
      pending_shields: [],
      pending_status: [],
      pending_lands: [],
    } as unknown as MatchState;
    const events: SimEvent[] = [];
    beginCast(
      state,
      { tick: 10, source_id: me.id, skill: "Q", aim_x: 16, aim_y: 9, force_hit: true, tier: "P4" },
      c,
      (type, payload) => {
        events.push({ type, t: 1, tick: 10, seq: events.length + 1, ...payload } as SimEvent);
      },
    );
    const start = events.find((e) => e.type === "cast_start");
    expect(start).toBeTruthy();
    expect(start!.target_id).toBeUndefined();
    expect(start!.x).toBeCloseTo(16, 4);
    expect(start!.y).toBeCloseTo(9, 4);
  });

  it("AI even-Hold cast_starts all carry target_id or x,y", () => {
    const r = simulate(evenOvrConfig(20261122, "hold_the_pit"));
    const starts = r.events.filter((e) => e.type === "cast_start");
    expect(starts.length).toBeGreaterThan(0);
    for (const e of starts) {
      const hasTarget = typeof e.target_id === "string" && e.target_id.length > 0;
      const hasXY = typeof e.x === "number" && typeof e.y === "number";
      expect(hasTarget || hasXY, `${e.skill_id} @t=${e.t}`).toBe(true);
    }
  });
});
