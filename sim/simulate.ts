import { constantsHash, digestEvents } from "./canonical.js";
import {
  DUMMY_MARKSMAN,
  landMissiles,
  resolvePendingDamage,
  tickAutos,
  type AutoMissile,
} from "./combat.js";
import { mergeConstants, type Constants } from "./constants.js";
import { inEnemySanctuary } from "./map.js";
import { applyDisplacement, integrateSteering } from "./motor.js";
import { RngBank } from "./rng.js";
import { emptyStatus } from "./status.js";
import type {
  MatchConfig,
  MatchState,
  SideConfig,
  SimEvent,
  SimulateResult,
  Slot,
  Team,
  UnitId,
  UnitState,
} from "./types.js";

const SLOTS: Slot[] = ["top", "jungle", "mid", "adc", "support"];

const DEFAULT_TACTICS = {
  preset: "hold_the_pit" as const,
  aggression: 0 as const,
  protect_the_carry: true,
  combo_style: "auto" as const,
};

function defaultPlayer(i: number): SideConfig["players"][0] {
  return {
    name: `P${i}`,
    attrs: {
      aim: 70,
      reflexes: 70,
      execution: 70,
      decision: 70,
      positioning: 70,
      teamwork: 70,
    },
    mastery: {},
  };
}

export function defaultEvenConfig(seed = 20261122): MatchConfig {
  return {
    seed,
    blue: {
      players: [0, 1, 2, 3, 4].map((i) => defaultPlayer(i)),
      picks: ["dummy", "dummy", "dummy", "dummy", "dummy"],
      tactics: { ...DEFAULT_TACTICS },
    },
    red: {
      players: [0, 1, 2, 3, 4].map((i) => defaultPlayer(i)),
      picks: ["dummy", "dummy", "dummy", "dummy", "dummy"],
      tactics: { ...DEFAULT_TACTICS },
    },
    draft_mode: "fixed",
    forced_clock_end: true,
    notes: "S0 even default",
  };
}

function makeUnit(
  team: Team,
  slot: Slot,
  index: number,
  spawn: [number, number],
  jitterY: number,
  c: Constants,
): UnitState {
  const id = `${team}:${slot}` as UnitId;
  const slotOrd = SLOTS.indexOf(slot);
  const yOff = (slotOrd - 2) * jitterY;
  return {
    id,
    team,
    slot,
    index,
    champ: "dummy",
    x: spawn[0],
    y: spawn[1] + yOff,
    vx: 0,
    vy: 0,
    hp: DUMMY_MARKSMAN.hp,
    max_hp: DUMMY_MARKSMAN.hp,
    xp: 0,
    level: 1,
    alive: true,
    spawn_shield_until: c.SPAWN_SHIELD_S,
    auto_cd: 0,
    auto_windup_left: 0,
    auto_windup_target: null,
    auto_next_start_t: 0,
    stats: { ...DUMMY_MARKSMAN },
    intent: "Idle",
    waypoint: null,
    scripted_wp_i: 0,
    damage_log: [],
    assist_log: [],
    last_hit_by: null,
    status: emptyStatus(c.SPAWN_SHIELD_S),
    attack_reset_pending: false,
    last_damage_t: -Infinity,
    last_dealt_t: -Infinity,
  };
}

function buildUnits(cfg: MatchConfig, c: Constants): UnitState[] {
  const units: UnitState[] = [];
  let index = 0;
  for (const team of ["blue", "red"] as Team[]) {
    const spawn = team === "blue" ? c.BLUE_SPAWN : c.RED_SPAWN;
    for (const slot of SLOTS) {
      units.push(makeUnit(team, slot, index, spawn, c.SPAWN_JITTER_Y, c));
      index += 1;
    }
  }
  const overs = cfg.unit_overrides;
  if (overs) {
    for (const u of units) {
      const o = overs[u.id];
      if (!o) continue;
      if (o.x !== undefined) u.x = o.x;
      if (o.y !== undefined) u.y = o.y;
      if (o.hp !== undefined) u.hp = o.hp;
      if (o.xp !== undefined) u.xp = o.xp;
      if (o.level !== undefined) u.level = o.level;
      if (o.spawn_shield_until !== undefined) u.spawn_shield_until = o.spawn_shield_until;
      if (o.auto_next_start_t !== undefined) u.auto_next_start_t = o.auto_next_start_t;
      if (o.range !== undefined) u.stats.range = o.range;
      if (o.as !== undefined) u.stats.as = o.as;
    }
  }
  return units;
}

function applyLevelUps(
  state: MatchState,
  c: Constants,
  emit: (type: string, payload: Record<string, unknown>) => void,
): void {
  for (const u of state.units) {
    if (!u.alive) continue;
    while (u.level < 10) {
      const need = c.XP_TO_LEVEL[u.level + 1];
      if (need === undefined || u.xp < need) break;
      u.level += 1;
      const hpGain = 200 / 6;
      u.max_hp += hpGain;
      u.hp += hpGain;
      u.stats.hp = u.max_hp;
      u.stats.atk += 28 / 6;
      u.stats.as += 0.12 / 6;
      u.stats.crit += 0.06 / 6;
      emit("level_up", {
        unit_id: u.id,
        new_level: u.level,
      });
    }
  }
}

function grantXp(
  u: UnitState,
  amount: number,
  source: string,
  emit: (type: string, payload: Record<string, unknown>) => void,
): void {
  u.xp += amount;
  emit("xp_gain", {
    unit_id: u.id,
    amount,
    source,
  });
}

function tOf(tick: number): number {
  return tick / 10;
}

function updateScriptedMotor(
  state: MatchState,
  config: MatchConfig,
  c: Constants,
  emit: (type: string, payload: Record<string, unknown>) => void,
): void {
  const scripted = config.scripted_motor;
  if (!scripted) return;
  for (const u of state.units) {
    if (!u.alive) continue;
    const sm = scripted[u.id];
    if (!sm) continue;
    const arrive = sm.arrive_r ?? c.SCRIPTED_ARRIVE_R;
    if (u.scripted_wp_i >= sm.waypoints.length) {
      if (sm.hold_at_end !== false) {
        u.waypoint = null;
        u.intent = "Idle";
      }
      continue;
    }
    const wp = sm.waypoints[u.scripted_wp_i]!;
    u.waypoint = { ...wp };
    const dx = u.x - wp.x;
    const dy = u.y - wp.y;
    if (dx * dx + dy * dy <= arrive * arrive) {
      u.scripted_wp_i += 1;
      if (u.scripted_wp_i < sm.waypoints.length) {
        const next = sm.waypoints[u.scripted_wp_i]!;
        u.waypoint = { ...next };
        emit("intent", {
          unit_id: u.id,
          intent: "Approach",
          x: next.x,
          y: next.y,
        });
      } else if (sm.hold_at_end !== false) {
        u.waypoint = null;
        u.intent = "Idle";
        emit("intent", { unit_id: u.id, intent: "Idle" });
      }
    }
  }
}

export function simulate(config: MatchConfig): SimulateResult {
  const c = mergeConstants(config.constants);
  const chash = constantsHash(c);
  const rng = new RngBank(config.seed >>> 0);
  // Reserve streams so later milestones do not reshape the hasher contract.
  void rng.next("player", 0);
  void rng.next("skillshot", 0);

  const events: SimEvent[] = [];
  let seq = 0;
  let missiles: AutoMissile[] = [];

  const state: MatchState = {
    tick: 0,
    t: 0,
    seed: config.seed >>> 0,
    constants_hash: chash,
    score_blue: 0,
    score_red: 0,
    ended: false,
    end_reason: null,
    winner: null,
    units: buildUnits(config, c),
    displacements: [],
    pending_damage: [],
    event_seq: 0,
    config,
    forced_clock_end: config.forced_clock_end !== false,
  };

  const emit = (type: string, payload: Record<string, unknown>): void => {
    events.push({ t: state.t, tick: state.tick, seq, type, ...payload });
    seq += 1;
    state.event_seq = seq;
  };

  // Tick 0 — setup only (G3)
  emit("match_start", {
    seed: state.seed,
    constants_hash: chash,
    blue_lineup: config.blue.picks.slice(),
    red_lineup: config.red.picks.slice(),
    blue_cards: [],
    red_cards: [],
    blue_tactics: { ...config.blue.tactics },
    red_tactics: { ...config.red.tactics },
  });

  if (config.scripted_motor) {
    for (const u of state.units) {
      const sm = config.scripted_motor[u.id];
      if (!sm || sm.waypoints.length === 0) continue;
      u.scripted_wp_i = 0;
      u.waypoint = { ...sm.waypoints[0]! };
      u.intent = "Approach";
      emit("intent", {
        unit_id: u.id,
        intent: "Approach",
        x: u.waypoint.x,
        y: u.waypoint.y,
      });
    }
  }

  const maxTick = Math.round(c.MATCH_T / c.DT); // 2400

  for (let tick = 1; tick <= maxTick; tick++) {
    if (state.ended) break;
    state.tick = tick;

    // 1. Clock
    state.t = tOf(tick);
    const clockEndFlag = state.forced_clock_end && state.t >= c.MATCH_T;

    // 2. Input / AI (S0: scripted motor)
    updateScriptedMotor(state, config, c, emit);

    // 3. Movement — ordinary steering, then displacements (G12)
    for (const u of state.units) {
      const r = integrateSteering(state, u, c);
      if (r.clipped && r.reason === "sanctuary") {
        emit("sanctuary_clip", {
          source_id: u.id,
          skill_id: "motor",
          reason: "path",
        });
      }
    }

    const due = state.displacements
      .filter((d) => d.land_tick === tick)
      .sort((a, b) => {
        if (a.land_tick !== b.land_tick) return a.land_tick - b.land_tick;
        if (a.spawn_seq !== b.spawn_seq) return a.spawn_seq - b.spawn_seq;
        return a.unit_id < b.unit_id ? -1 : a.unit_id > b.unit_id ? 1 : 0;
      });
    state.displacements = state.displacements.filter((d) => d.land_tick !== tick);
    for (const d of due) {
      const u = state.units.find((x) => x.id === d.unit_id);
      if (!u) continue;
      const r = applyDisplacement(u, d.dx, d.dy, c);
      if (r.clipped && r.reason === "sanctuary") {
        emit("sanctuary_clip", {
          source_id: d.source_id,
          skill_id: d.skill_id,
          reason: "dash",
        });
      }
    }

    // G5 lab assertion
    if (config.assert_sanctuary) {
      for (const u of state.units) {
        if (!u.alive) continue;
        if (inEnemySanctuary(u.team, u.x, u.y, c)) {
          emit("sanctuary_violation", {
            unit_id: u.id,
            x: u.x,
            y: u.y,
          });
        }
      }
    }

    if (config.debug_pos) {
      for (const u of state.units) {
        emit("pos", {
          unit_id: u.id,
          x: u.x,
          y: u.y,
          vx: u.vx,
          vy: u.vy,
        });
      }
    }

    // 4. Cast — dummy autos (windup + missiles) + lab scripted damage
    tickAutos(state, c, rng, missiles, (type, payload) => emit(type, payload));
    missiles = landMissiles(state, missiles);
    if (config.scripted_damage) {
      for (const sd of config.scripted_damage) {
        if (sd.tick !== tick) continue;
        state.pending_damage.push({
          seq: state.event_seq,
          source_id: sd.source_id,
          target_id: sd.target_id,
          skill_id: "scripted",
          raw: sd.raw,
          physical: true,
          crit: false,
        });
      }
    }

    // 5. Damage
    resolvePendingDamage(state, c, (type, payload) => emit(type, payload));

    // 6. Status — regen
    for (const u of state.units) {
      if (!u.alive) continue;
      u.hp = Math.min(u.max_hp, u.hp + u.stats.regen * c.DT);
    }

    // 10. Deaths / kill+assist XP / time XP / level-ups (G2)
    // Order: deaths + kill/assist XP → time XP → level-ups.
    for (const u of state.units) {
      if (!(u.alive && u.hp <= 0)) continue;
      u.alive = false;
      u.hp = 0;
      u.waypoint = null;
      u.auto_windup_left = 0;
      u.auto_windup_target = null;

      const killerId = u.last_hit_by;
      const assists: UnitId[] = [];
      if (killerId) {
        const killer = state.units.find((x) => x.id === killerId);
        if (killer && killer.alive && killer.team !== u.team) {
          const windowStart = state.t - c.ASSIST_WINDOW_S;
          const seen = new Set<UnitId>();
          const consider = (sourceId: UnitId) => {
            if (sourceId === killerId) return;
            if (seen.has(sourceId)) return;
            const asst = state.units.find((x) => x.id === sourceId);
            if (!asst || !asst.alive || asst.team !== killer.team) return;
            seen.add(sourceId);
            assists.push(sourceId);
          };
          // Damage / CC on the victim (§6.10).
          for (const entry of u.assist_log) {
            if (entry.t < windowStart) continue;
            if (entry.kind === "damage" || entry.kind === "cc") consider(entry.source_id);
          }
          // Legacy damage_log (kept in sync for S0 fixtures).
          for (const entry of u.damage_log) {
            if (entry.t < windowStart) continue;
            consider(entry.source_id);
          }
          // Heal / shield on the killer (§6.10).
          for (const entry of killer.assist_log) {
            if (entry.t < windowStart) continue;
            if (entry.kind === "heal" || entry.kind === "shield") consider(entry.source_id);
          }
          // Stable assist order by unit index
          assists.sort((a, b) => {
            const ai = state.units.find((x) => x.id === a)?.index ?? 0;
            const bi = state.units.find((x) => x.id === b)?.index ?? 0;
            return ai - bi;
          });

          grantXp(killer, c.KILL_XP, "kill", emit);
          for (const aid of assists) {
            const asst = state.units.find((x) => x.id === aid);
            if (asst && asst.alive) grantXp(asst, c.ASSIST_XP, "assist", emit);
          }
        }
      }

      emit("death", {
        unit_id: u.id,
        killer_id: killerId,
        assists,
        respawn_at: state.t + c.RESPAWN_BASE + c.RESPAWN_PER_LEVEL * u.level,
      });
    }

    const timeXp = c.TIME_XP_PER_S * c.DT;
    for (const u of state.units) {
      if (!u.alive) continue; // dies this tick: no time XP (G2)
      grantXp(u, timeXp, "time", emit);
    }

    applyLevelUps(state, c, emit);

    // 14. Match-end
    if (clockEndFlag) {
      let winner: "blue" | "red" | "draw" = "draw";
      if (state.score_blue > state.score_red) winner = "blue";
      else if (state.score_red > state.score_blue) winner = "red";
      state.ended = true;
      state.winner = winner;
      state.end_reason = "clock";
      emit("match_end", {
        winner,
        reason: "clock",
        score_blue: state.score_blue,
        score_red: state.score_red,
        t: state.t,
      });
    }
  }

  return {
    state,
    events,
    digest: digestEvents(events),
    constants_hash: chash,
    tick_count: state.tick,
  };
}
