import { constantsHash, digestEvents } from "./canonical.js";
import {
  cancelAutoWindup,
  landMissiles,
  resolvePendingDamage,
  tickAutos,
  recordAssistCredit,
  type AutoMissile,
} from "./combat.js";
import {
  DEFAULT_CONSTANTS,
  LAB_SCRIPTED_ARRIVE_R,
  mergeConstants,
  type Constants,
} from "./constants.js";
import {
  applyPendingHealsShields,
  applyPendingStatuses,
  cancelCastsInterruptedByStatus,
  landPendingSkills,
  processScriptedCasts,
  runScriptedSkillshots,
  tickCasts,
  type PendingSkillLand,
} from "./cast.js";
import { dataHash } from "./data_hash.js";
import { CHAMPIONS } from "../data/champions/defs.js";
import { inEnemySanctuary } from "./map.js";
import { applyDisplacement, integrateSteering } from "./motor.js";
import { pruneMarks } from "./marks.js";
import { RngBank } from "./rng.js";
import {
  applyCc,
  emptyStatus,
  hasKind,
  isBanished,
  isTimeStopped,
  kindCategory,
  tickStatuses,
} from "./status.js";
import { statsAtLevel } from "./stats.js";
import { evaluateFight } from "./ai/fight.js";
import { createAiRuntime, tickAi } from "./ai/tick.js";
import {
  auraActiveFor,
  catchupEligible,
  createArenaRuntime,
  openClaim,
  publicZone,
  snapshotLevels,
  tickArenaPhase11,
  type ArenaRuntime,
} from "./arena.js";
import { cancelRetreatWindupIfMoving } from "./retreat_combat.js";
import type {
  MatchConfig,
  MatchState,
  PlayerAttrs,
  SideConfig,
  SimEvent,
  SimulateResult,
  Slot,
  Team,
  UnitId,
  UnitState,
} from "./types.js";
import { hypot } from "./math.js";

const SLOTS: Slot[] = ["top", "jungle", "mid", "adc", "support"];

/**
 * L214 spawn pose: pad centre + slot × SPAWN_SLOT_SPACING on y.
 * Multipliers: Top −2, Jungle −1, Mid 0, ADC +1, Support +2.
 * Red mirrors blue (same y; x from RED_SPAWN). No occupancy check (G6).
 */
export function spawnPose(
  team: Team,
  slot: Slot,
  c: Constants,
): { x: number; y: number } {
  const pad = team === "blue" ? c.BLUE_SPAWN : c.RED_SPAWN;
  const mult = SLOTS.indexOf(slot) - 2;
  return { x: pad[0]!, y: pad[1]! + mult * c.SPAWN_SLOT_SPACING };
}

/** Stable S1 default lineups — real champions, role-appropriate. */
const DEFAULT_BLUE_PICKS = ["brannoch", "sedge", "kerrig", "huntress", "ysol"];
const DEFAULT_RED_PICKS = ["rhedan", "tolle", "helvar", "maelis", "saelo"];

const DEFAULT_TACTICS = {
  preset: "hold_the_pit" as const,
  aggression: 0 as const,
  protect_the_carry: true,
  combo_style: "auto" as const,
  // focus / secondary omitted — optional per R #3; default behaviour = focus "auto"
};

const DEFAULT_ATTRS: PlayerAttrs = {
  aim: 70,
  reflexes: 70,
  execution: 70,
  decision: 70,
  positioning: 70,
  teamwork: 70,
};

function defaultPlayer(i: number): SideConfig["players"][0] {
  return {
    name: `P${i}`,
    attrs: { ...DEFAULT_ATTRS },
    mastery: {},
  };
}

export function defaultEvenConfig(seed = 20261122): MatchConfig {
  return {
    seed,
    blue: {
      players: [0, 1, 2, 3, 4].map((i) => defaultPlayer(i)),
      picks: DEFAULT_BLUE_PICKS.slice(),
      tactics: { ...DEFAULT_TACTICS },
    },
    red: {
      players: [0, 1, 2, 3, 4].map((i) => defaultPlayer(i)),
      picks: DEFAULT_RED_PICKS.slice(),
      tactics: { ...DEFAULT_TACTICS },
    },
    draft_mode: "fixed",
    forced_clock_end: true,
    // S1 contract: AI off unless MatchConfig.ai_enabled === true (S2 harness sets it).
    ai_enabled: false,
    notes: "S1 even default — real champions, AI opt-in",
  };
}

function applyChampStats(u: UnitState, level: number): void {
  if (u.champ === "dummy" || !CHAMPIONS[u.champ]) {
    // Legacy dummy = Huntress L1 numbers
    const s = statsAtLevel("huntress", level);
    u.stats = { ...s };
    u.max_hp = s.hp;
    if (u.hp > u.max_hp) u.hp = u.max_hp;
    return;
  }
  const s = statsAtLevel(u.champ, level);
  u.stats = { ...s };
  u.max_hp = s.hp;
  if (u.hp > u.max_hp) u.hp = u.max_hp;
}

function makeUnit(
  team: Team,
  slot: Slot,
  index: number,
  c: Constants,
  champ: string,
  attrs: PlayerAttrs,
  mastery = 50,
): UnitState {
  const id = `${team}:${slot}` as UnitId;
  const pose = spawnPose(team, slot, c);
  const u: UnitState = {
    id,
    team,
    slot,
    index,
    champ,
    x: pose.x,
    y: pose.y,
    vx: 0,
    vy: 0,
    hp: 900,
    max_hp: 900,
    xp: 0,
    level: 1,
    alive: true,
    respawn_at: Infinity,
    spawn_shield_until: c.SPAWN_SHIELD_S,
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
      range: 6.25,
      ms: 3.3,
    },
    attrs: { ...attrs },
    flank_buff_until: 0,
    mastery,
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
    marks: [],
    cd_q: 0,
    cd_w: 0,
    cd_r: 0,
    cast_left: 0,
    cast_skill: null,
    cast_target: null,
    cast_aim_x: pose.x,
    cast_aim_y: pose.y,
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
    ai_first_auto_done: false,
    zone_aura_res: 0,
  };
  applyChampStats(u, 1);
  u.hp = u.max_hp;
  return u;
}

function buildUnits(cfg: MatchConfig, c: Constants): UnitState[] {
  const units: UnitState[] = [];
  let index = 0;
  for (const team of ["blue", "red"] as Team[]) {
    const side = team === "blue" ? cfg.blue : cfg.red;
    for (let si = 0; si < SLOTS.length; si++) {
      const slot = SLOTS[si]!;
      const champ = side.picks[si] ?? "dummy";
      const attrs = side.players[si]?.attrs ?? DEFAULT_ATTRS;
      const masteryMap = side.players[si]?.mastery ?? {};
      const mastery = masteryMap[champ] ?? 50;
      units.push(makeUnit(team, slot, index, c, champ, attrs, mastery));
      index += 1;
    }
  }
  const overs = cfg.unit_overrides;
  if (overs) {
    for (const u of units) {
      const o = overs[u.id];
      if (!o) continue;
      if (o.champ !== undefined) {
        u.champ = o.champ;
        applyChampStats(u, u.level);
        u.hp = u.max_hp;
      }
      if (o.attrs) u.attrs = { ...u.attrs, ...o.attrs };
      if (o.x !== undefined) u.x = o.x;
      if (o.y !== undefined) u.y = o.y;
      if (o.level !== undefined) {
        u.level = o.level;
        applyChampStats(u, u.level);
        if (o.hp === undefined) u.hp = u.max_hp;
      }
      if (o.hp !== undefined) u.hp = o.hp;
      if (o.xp !== undefined) u.xp = o.xp;
      if (o.spawn_shield_until !== undefined) {
        u.spawn_shield_until = o.spawn_shield_until;
        u.status.spawn_shield_until = o.spawn_shield_until;
      }
      if (o.auto_next_start_t !== undefined) u.auto_next_start_t = o.auto_next_start_t;
      if (o.range !== undefined) u.stats.range = o.range;
      if (o.as !== undefined) u.stats.as = o.as;
      if (o.ms !== undefined) u.stats.ms = o.ms;
      if (o.ai_target_id !== undefined) u.ai_target_id = o.ai_target_id;
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
      const prevMax = u.max_hp;
      applyChampStats(u, u.level);
      const hpGain = u.max_hp - prevMax;
      u.hp += hpGain;
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
    if (isTimeStopped(u.status)) continue;
    // OQ-3: fear/hex skip the Unit Brain — clear scripted waypoints.
    // Disarm also pauses scripted walks so the unit is still in AA range when
    // the handicap ends (04-cc resume fixtures pair disarm with a north motor).
    if (
      hasKind(u.status, "fear") ||
      hasKind(u.status, "hex") ||
      hasKind(u.status, "disarm")
    ) {
      u.waypoint = null;
      continue;
    }
    if (u.abandon_scripted_motor) {
      let nearest: { x: number; y: number; d: number } | null = null;
      for (const e of state.units) {
        if (!e.alive || e.team === u.team) continue;
        if (isBanished(e.status)) continue;
        const d = Math.hypot(e.x - u.x, e.y - u.y);
        if (!nearest || d < nearest.d) nearest = { x: e.x, y: e.y, d };
      }
      if (nearest && nearest.d > u.stats.range) {
        u.waypoint = { x: nearest.x, y: nearest.y };
        u.intent = "Approach";
        continue;
      }
      u.abandon_scripted_motor = false;
      u.waypoint = null;
      u.intent = "Idle";
      continue;
    }
    const sm = scripted[u.id];
    if (!sm) continue;
    const arrive = sm.arrive_r ?? LAB_SCRIPTED_ARRIVE_R;
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
        const nwp = sm.waypoints[u.scripted_wp_i]!;
        u.waypoint = { ...nwp };
        emit("intent", {
          unit_id: u.id,
          intent: "Approach",
          x: nwp.x,
          y: nwp.y,
        });
      } else {
        u.waypoint = null;
        u.intent = "Idle";
        emit("intent", { unit_id: u.id, intent: "Idle" });
      }
    } else {
      u.intent = "Approach";
    }
  }
}

/**
 * Lab scripted_cc — same phase-9 step as kit `applyPendingStatuses` (S3-R5-11).
 * Applied after existing timers tick/expire so the apply tick is not shortened
 * and the new effect is visible to later phases (occupancy, G7 pickup).
 */
function applyScriptedCc(
  state: MatchState,
  config: MatchConfig,
  c: Constants,
  tick: number,
  emit: (type: string, payload: Record<string, unknown>) => void,
): void {
  if (!config.scripted_cc) return;
  for (const sc of config.scripted_cc) {
    if (sc.tick !== tick) continue;
    const u = state.units.find((x) => x.id === sc.target_id);
    if (!u) continue;
    const sourceId = sc.source_id ?? ("lab" as UnitId);
    if (sc.kind === "break") {
      const r = applyCc(u.status, {
        kind: "break",
        raw_duration: sc.duration,
        school: "magic",
        source_id: sourceId,
        now: state.t,
        dr_window: c.DR_WINDOW_S,
        dr_factor: c.DR_FACTOR,
        dr_floor: c.DR_FLOOR,
        lock_budget: c.LOCK_BUDGET_S,
        lock_taper: c.LOCK_TAPER,
      });
      u.status.break_until = state.t + r.applied_duration;
      u.break_until = u.status.break_until;
      if (!r.rejected) {
        emit("status_apply", {
          source_id: sourceId,
          target_id: u.id,
          kind: "break",
          category: "handicap",
          raw_duration: sc.duration,
          applied_duration: r.applied_duration,
          dr_factor: r.dr_factor,
          lock_taper: r.lock_taper,
        });
      }
      continue;
    }
    const r = applyCc(u.status, {
      kind: sc.kind,
      raw_duration: sc.duration,
      school: "magic",
      source_id: sourceId,
      now: state.t,
      dr_window: c.DR_WINDOW_S,
      dr_factor: c.DR_FACTOR,
      dr_floor: c.DR_FLOOR,
      lock_budget: c.LOCK_BUDGET_S,
      lock_taper: c.LOCK_TAPER,
    });
    if (!r.rejected && r.applied_duration > 0) {
      if (sc.source_id) recordAssistCredit(u, sc.source_id, state.t, "cc");
      emit("status_apply", {
        source_id: sourceId,
        target_id: u.id,
        kind: sc.kind,
        category: kindCategory(sc.kind),
        raw_duration: sc.duration,
        applied_duration: r.applied_duration,
        dr_factor: r.dr_factor,
        lock_taper: r.lock_taper,
      });
      if (
        sc.kind === "silence" ||
        sc.kind === "disarm" ||
        (kindCategory(sc.kind) === "lock" && sc.kind !== "timestop")
      ) {
        cancelAutoWindup(u);
      }
    }
  }
}

export function simulate(config: MatchConfig): SimulateResult {
  const c = mergeConstants(config.constants);
  const chash = constantsHash(c);
  const dhash = dataHash();
  const rng = new RngBank(config.seed >>> 0);
  void rng.next("player", 0);
  void rng.next("skillshot", 0);

  const events: SimEvent[] = [];
  let seq = 0;
  let missiles: AutoMissile[] = [];
  let pendingLands: PendingSkillLand[] = [];

  const state: MatchState = {
    tick: 0,
    t: 0,
    seed: config.seed >>> 0,
    constants_hash: chash,
    data_hash: dhash,
    score_blue: 0,
    score_red: 0,
    takedowns_blue: 0,
    takedowns_red: 0,
    ended: false,
    end_reason: null,
    winner: null,
    units: buildUnits(config, c),
    displacements: [],
    pending_damage: [],
    pending_status: [],
    pending_heals: [],
    pending_shields: [],
    event_seq: 0,
    config,
    forced_clock_end: config.forced_clock_end !== false,
  };

  const emit = (type: string, payload: Record<string, unknown>): void => {
    events.push({ t: state.t, tick: state.tick, seq, type, ...payload });
    seq += 1;
    state.event_seq = seq;
  };

  emit("match_start", {
    seed: state.seed,
    constants_hash: chash,
    data_hash: dhash,
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

  // Short lab fixtures set MATCH_T via T and leave SUDDEN_DEATH_T at the §15
  // default (270): stop at MATCH_T without the clock/ladder (MATCH_T is just the
  // sim window). Real §5.8 / Bo1 fixtures override SUDDEN. Harness sim_until caps
  // the run so a T=5 sudden-death probe does not roll into coin_flip.
  const labShort =
    !state.forced_clock_end &&
    c.MATCH_T < DEFAULT_CONSTANTS.MATCH_T - 1e-9 &&
    Math.abs(c.SUDDEN_DEATH_T - DEFAULT_CONSTANTS.SUDDEN_DEATH_T) < 1e-9;
  const ladderEnd = c.SUDDEN_DEATH_T + c.BO1_EXTRA_S;
  // Scenario T (sim_until) is the run cap when T >= MATCH_T. When T < MATCH_T the
  // suite is using T as a label and the clocks own the length (e.g. kill@149 with T:8).
  let endT: number;
  if (state.forced_clock_end || labShort) {
    endT = c.MATCH_T;
  } else if (config.sim_until !== undefined && config.sim_until + 1e-9 >= c.MATCH_T) {
    endT = Math.min(config.sim_until, ladderEnd);
  } else {
    endT = ladderEnd;
  }
  const maxTick = Math.round(endT / c.DT);
  const ai = config.ai_enabled === true ? createAiRuntime() : null;
  const arena: ArenaRuntime = createArenaRuntime(c, config);
  let deathThisTick = false;
  /** Fight kill tallies for production claim opens: fight_id → team → kills. */
  const fightKills: Partial<Record<string, { blue: number; red: number }>> = {};
  /** AI-off S3: track fight geometry for §5.6 claim opens. */
  const claimFight = {
    fight_id: null as string | null,
    fight_seq: 0,
    prev_geom: false,
    last_geom_t: -Infinity,
  };
  let scoredThisTick = false;

  // Publish initial S3 public state (unowned zone, pads down until spawn).
  publishArena(state, arena, rng);

  for (let tick = 1; tick <= maxTick; tick++) {
    if (state.ended) break;
    state.tick = tick;
    state.t = tOf(tick);
    scoredThisTick = false;
    snapshotLevels(state.units, arena);
    for (const u of state.units) {
      u.flank_buff_until = arena.buff_until[u.id] ?? 0;
    }
    // Phase label — tied at MATCH_T enters sudden_death on that tick (§5.8 L313).
    if (!state.forced_clock_end) {
      if (state.t > c.SUDDEN_DEATH_T + 1e-12) arena.phase = "extra_15";
      else if (state.t + 1e-12 >= c.MATCH_T) arena.phase = "sudden_death";
      else arena.phase = "play";
    }
    const clockEndFlag = state.forced_clock_end && state.t >= c.MATCH_T - 1e-12;
    const deathsForAi = deathThisTick;
    deathThisTick = false;

    // S3 arena / scoring only when real §5.8 is on (forced_clock_end: false).
    // Keeps S1 digests / brawl gold bit-identical under the default clock-end path.
    const s3Live = !state.forced_clock_end;

    // Aura resists for this tick from previous phase-11 commit (S3-R5-7).
    for (const u of state.units) {
      u.zone_aura_res = s3Live && auraActiveFor(arena, u) ? c.ZONE_AURA_RES : 0;
    }

    // Respawn at own slot (L214): no occupancy check — G6 soft separation.
    for (const u of state.units) {
      if (u.alive || !(state.t + 1e-12 >= u.respawn_at)) continue;
      const pose = spawnPose(u.team, u.slot, c);
      u.alive = true;
      u.hp = u.max_hp;
      u.x = pose.x;
      u.y = pose.y;
      u.vx = 0;
      u.vy = 0;
      u.waypoint = null;
      u.intent = "Idle";
      u.respawn_at = Infinity;
      u.spawn_shield_until = state.t + c.SPAWN_SHIELD_S;
      u.status = emptyStatus(u.spawn_shield_until);
      u.auto_windup_left = 0;
      u.auto_windup_target = null;
      u.auto_cd = 0;
      u.cast_left = 0;
      u.cast_skill = null;
      u.cast_target = null;
      u.cast_snapshot_ids = null;
      u.marks = [];
      u.damage_log = [];
      u.assist_log = [];
      u.last_hit_by = null;
      u.attack_reset_pending = false;
      u.abandon_scripted_motor = false;
      // §9.6 L1164: leave sanctuary within 1.5 s of respawn.
      u.walk_from_pad_until = state.t + 1.5;
      u.ai_at_planner_wp = false;
      u.ai_no_trickle_until = 0;
      u.ai_first_auto_done = false;
      emit("respawn", { unit_id: u.id, x: pose.x, y: pose.y, slot: u.slot });
    }

    // Phase 2: AI decide (Fight Call / peel / Unit Brain). Scripted motor wins per-unit.
    if (ai) {
      tickAi(state, config, c, rng, ai, emit, deathsForAi);
    } else if (s3Live) {
      // Lightweight G9 fight track for claim opens when AI is off.
      const snap = evaluateFight(state.units, c, claimFight.fight_id);
      if (snap.exists) {
        claimFight.last_geom_t = state.t;
        if (!claimFight.fight_id) {
          claimFight.fight_seq += 1;
          claimFight.fight_id = `cf${claimFight.fight_seq}`;
        }
      } else if (
        claimFight.fight_id &&
        state.t - claimFight.last_geom_t >= c.FIGHT_END_GRACE_S - 1e-9
      ) {
        claimFight.fight_id = null;
      }
      claimFight.prev_geom = snap.exists;
    }

    updateScriptedMotor(state, config, c, emit);

    // Phase-start poses for hex centroid (L1899): all motor units see the
    // same snapshot; recomputed every tick before anyone moves.
    const phaseStart = state.units.map((u) => ({
      id: u.id,
      x: u.x,
      y: u.y,
      alive: u.alive,
      team: u.team,
    }));
    for (const u of state.units) {
      if (isTimeStopped(u.status)) {
        u.vx = 0;
        u.vy = 0;
        continue;
      }
      const r = integrateSteering(state, u, c, phaseStart);
      if (r.clipped && r.reason === "sanctuary") {
        emit("sanctuary_clip", {
          source_id: u.id,
          skill_id: "motor",
          reason: "path",
        });
      }
    }
    // S2-R4-5: first retreat step cancels an unapplied windup (unless it applies this tick).
    for (let i = 0; i < state.units.length; i++) {
      const u = state.units[i]!;
      const prev = phaseStart[i]!;
      const moved = hypot(u.x - prev.x, u.y - prev.y) > 1e-9;
      cancelRetreatWindupIfMoving(u, moved, state, c);
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
      // Time-stop cancels hops that would land while frozen. Return hops are
      // only queued after a successful land, so a cancelled dash cannot leave
      // a lone return that teleports the caster off the cast pose.
      if (!u || isTimeStopped(u.status)) continue;
      const r = applyDisplacement(u, d.dx, d.dy, c);
      if (r.clipped && r.reason === "sanctuary") {
        emit("sanctuary_clip", {
          source_id: d.source_id,
          skill_id: d.skill_id,
          reason: "dash",
        });
      }
      if (
        d.return_delay_ticks !== undefined &&
        d.return_dx !== undefined &&
        d.return_dy !== undefined &&
        d.return_delay_ticks > 0
      ) {
        state.displacements.push({
          unit_id: d.unit_id,
          dx: d.return_dx,
          dy: d.return_dy,
          land_tick: tick + d.return_delay_ticks,
          spawn_seq: d.spawn_seq + 1,
          source_id: d.source_id,
          skill_id: d.skill_id,
        });
      }
    }

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
        // `move` — S1 lab path samples; `pos` — S2 acceptance pathOf (both excluded from digest).
        emit("move", {
          unit_id: u.id,
          x: u.x,
          y: u.y,
          vx: u.vx,
          vy: u.vy,
        });
        emit("pos", {
          unit_id: u.id,
          x: u.x,
          y: u.y,
        });
      }
    }

    // Lab attack-reset inject
    if (config.scripted_attack_reset) {
      for (const ar of config.scripted_attack_reset) {
        if (ar.tick !== tick) continue;
        const u = state.units.find((x) => x.id === ar.unit_id);
        if (u) u.attack_reset_pending = ar.pending;
      }
    }

    // 4. Cast — advance in-flight casts first, then start new scripted casts
    // (so cast_s is full duration; begin tick does not also consume DT).
    tickCasts(state, pendingLands, c, rng, emit);
    processScriptedCasts(state, config.scripted_casts, c, emit);
    pendingLands = landPendingSkills(state, pendingLands, c, rng, emit);

    if (config.scripted_skillshots) {
      for (const ss of config.scripted_skillshots) {
        if (ss.tick !== tick) continue;
        runScriptedSkillshots(state, rng, c, ss, emit);
      }
    }

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

    if (config.scripted_heals) {
      for (const h of config.scripted_heals) {
        if (h.tick !== tick) continue;
        const tgt = state.units.find((u) => u.id === h.target_id);
        const src = state.units.find((u) => u.id === h.source_id);
        if (!tgt || !tgt.alive || !src) continue;
        tgt.hp = Math.min(tgt.max_hp, tgt.hp + h.amount);
        recordAssistCredit(tgt, src.id, state.t, "heal");
        emit("heal", {
          source_id: src.id,
          target_id: tgt.id,
          skill_id: "scripted",
          raw: h.amount,
          applied: h.amount,
          combat_scaled: false,
        });
      }
    }

    // Regen for the elapsed DT lands before this tick's damage (so
    // post-hit regen spans MATCH_T - hit_t, not an extra DT).
    // Lab: scripted timestop on this tick also suppresses regen (phase-9 order).
    const scriptedStop = new Set<UnitId>();
    if (config.scripted_cc) {
      for (const sc of config.scripted_cc) {
        if (sc.tick === tick && sc.kind === "timestop") scriptedStop.add(sc.target_id);
      }
    }
    for (const u of state.units) {
      if (!u.alive) continue;
      if (!isTimeStopped(u.status) && !scriptedStop.has(u.id)) {
        u.hp = Math.min(u.max_hp, u.hp + u.stats.regen * c.DT);
      }
    }

    // 5 / phase 8: Damage then heals/shields
    resolvePendingDamage(state, c, (type, payload) => emit(type, payload));
    applyPendingHealsShields(state, c, emit);

    // Phase 9 (S3-R5-11 L1976 / L144): (1) tick timers that were already
    // running at tick start, (2) expire finished effects, (3) apply this tick's
    // new CC and buffs (kit pending + lab scripted_cc) without ticking them.
    // Duration D on tick t covers ticks t .. t+round(10D)-1.
    for (const u of state.units) {
      if (!u.alive) continue;
      pruneMarks(u.marks, state.t);
      const paused = isTimeStopped(u.status);
      const expired = tickStatuses(u.status, c.DT, paused);
      for (const kind of expired) {
        emit("status_expire", { target_id: u.id, kind });
        // Fear walks the unit out of AA range; with autos on, drop the lab
        // scripted path and chase back so 04-cc "autos resume" can connect.
        if (kind === "fear" && u.auto_next_start_t < c.MATCH_T - 1e-9) {
          u.abandon_scripted_motor = true;
        }
      }
    }

    applyPendingStatuses(state, c, emit);
    // M2-33 / R7-6b: silence/Lock applied this tick cancel windups on the apply tick.
    cancelCastsInterruptedByStatus(state, emit);
    applyScriptedCc(state, config, c, tick, emit);

    // 10. Deaths / kill+assist XP / time XP / level-ups (G2)
    for (const u of state.units) {
      if (!(u.alive && u.hp <= 0)) continue;
      u.alive = false;
      deathThisTick = true;
      u.hp = 0;
      u.waypoint = null;
      u.auto_windup_left = 0;
      u.auto_windup_target = null;
      const respawnAt = state.t + c.RESPAWN_BASE + c.RESPAWN_PER_LEVEL * u.level;
      u.respawn_at = respawnAt;

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
            // Dead assistants are listed in the death recap but receive no XP (L526).
            if (!asst || asst.team !== killer.team) return;
            seen.add(sourceId);
            assists.push(sourceId);
          };
          for (const entry of u.assist_log) {
            if (entry.t < windowStart) continue;
            if (entry.kind === "damage" || entry.kind === "cc") consider(entry.source_id);
          }
          for (const entry of u.damage_log) {
            if (entry.t < windowStart) continue;
            consider(entry.source_id);
          }
          for (const entry of killer.assist_log) {
            if (entry.t < windowStart) continue;
            if (entry.kind === "heal" || entry.kind === "shield") consider(entry.source_id);
          }
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
          if (s3Live) {
            // Team takedown score +1 (S3); log before phase-11 score events.
            if (killer.team === "blue") {
              state.score_blue += 1;
              state.takedowns_blue += 1;
            } else {
              state.score_red += 1;
              state.takedowns_red += 1;
            }
            scoredThisTick = true;
            emit("takedown_score", {
              team: killer.team,
              victim_id: u.id,
              killer_id: killer.id,
              score_after: killer.team === "blue" ? state.score_blue : state.score_red,
            });
            const fid = ai?.fight_id ?? claimFight.fight_id;
            if (fid) {
              const fk = fightKills[fid] ?? { blue: 0, red: 0 };
              fk[killer.team] += 1;
              fightKills[fid] = fk;
            }
          }
        }
      }

      emit("death", {
        unit_id: u.id,
        killer_id: killerId,
        assists,
        respawn_at: respawnAt,
      });
    }

    const timeXpBase = c.TIME_XP_PER_S * c.DT;
    for (const u of state.units) {
      if (!u.alive) continue;
      const amt =
        s3Live && catchupEligible(u, state.units, arena, c)
          ? timeXpBase * (1 + c.CATCHUP_BONUS)
          : timeXpBase;
      grantXp(u, amt, "time", emit);
    }

    applyLevelUps(state, c, emit);

    if (s3Live) {
      // Aura heal (S3-R5-7): 1.5 HP/tick; time-stopped keeps resists, no regen.
      for (const u of state.units) {
        if (!u.alive) continue;
        if (!auraActiveFor(arena, u)) continue;
        if (isTimeStopped(u.status)) continue;
        u.hp = Math.min(u.max_hp, u.hp + c.ZONE_AURA_HPS * c.DT);
      }

      const ar = tickArenaPhase11(state, arena, c, config, emit);
      if (ar.scored) scoredThisTick = true;
      applyLevelUps(state, c, emit);

      const inFight = ai ? ai.prev_geom_fight : claimFight.prev_geom;
      if (!inFight) {
        for (const fid of Object.keys(fightKills)) {
          const fk = fightKills[fid];
          if (!fk) continue;
          if (fk.blue !== fk.red) {
            const team: Team = fk.blue > fk.red ? "blue" : "red";
            openClaim(arena, team, state.t + c.CLAIM_DELAY_S, fid, emit);
          }
          delete fightKills[fid];
        }
      }
    }

    publishArena(state, arena, rng);

    if (clockEndFlag) {
      endMatch(state, emit, "clock");
    } else if (s3Live) {
      decideMatchEnd(state, arena, c, rng, emit, scoredThisTick, labShort);
    }
  }

  publishArena(state, arena, rng);
  if (state.ended) arena.phase = "ended";
  state.phase = arena.phase;

  const ai_stats = ai
    ? {
        dive_geom: ai.dive_geom,
        peel_fired: ai.peel_fired,
        peel_rate: ai.dive_geom > 0 ? ai.peel_fired / ai.dive_geom : null,
      }
    : undefined;

  const player_stats = state.units.map((u) => ({
    unit_id: u.id,
    claim_denies: arena.claim_denies[u.id] ?? 0,
    zone_seconds: Math.round(((arena.zone.zone_ticks[u.id] ?? 0) / 10) * 1e4) / 1e4,
  }));

  return {
    state,
    events,
    digest: digestEvents(events),
    constants_hash: chash,
    data_hash: dhash,
    tick_count: state.tick,
    player_stats,
    ...(ai_stats ? { ai_stats } : {}),
  };
}

function publishArena(
  state: MatchState,
  arena: ArenaRuntime,
  rng: RngBank,
): void {
  state.zone = publicZone(arena.zone);
  state.claim = arena.claim
    ? { team: arena.claim.team, resolve_at: arena.claim.resolve_at, fight_id: arena.claim.fight_id }
    : null;
  state.orbs = arena.orbs.map((o) => ({
    orb_id: o.orb_id,
    x: o.x,
    y: o.y,
    up: o.up,
    respawn_at: o.respawn_at,
  }));
  state.buffs = arena.buffs.map((b) => ({
    buff_id: b.buff_id,
    x: b.x,
    y: b.y,
    up: b.up,
    respawn_at: b.respawn_at,
    holders: b.holders.slice(),
  }));
  state.phase = arena.phase;
  if (arena.points) state.objectives = arena.points.map((p) => ({ ...p }));
  state.rng_counters = rng.getCounters();
}

function endMatch(
  state: MatchState,
  emit: (type: string, payload: Record<string, unknown>) => void,
  reason: string,
  winner?: "blue" | "red" | "draw",
): void {
  if (state.ended) return;
  let w: "blue" | "red" | "draw" = winner ?? "draw";
  if (winner === undefined) {
    if (state.score_blue > state.score_red) w = "blue";
    else if (state.score_red > state.score_blue) w = "red";
    else w = "draw";
  }
  state.ended = true;
  state.winner = w;
  state.end_reason = reason;
  emit("match_end", {
    winner: w,
    reason,
    score_blue: state.score_blue,
    score_red: state.score_red,
    t: state.t,
  });
}

/** Phase 14 precedence: first_to_10 → clock/ladder → sudden_death (S3-R5-2). */
function decideMatchEnd(
  state: MatchState,
  arena: ArenaRuntime,
  c: Constants,
  rng: RngBank,
  emit: (type: string, payload: Record<string, unknown>) => void,
  scoredThisTick: boolean,
  labShort: boolean,
): void {
  if (state.ended) return;
  const sb = state.score_blue;
  const sr = state.score_red;
  const ahead: "blue" | "red" | null = sb > sr ? "blue" : sr > sb ? "red" : null;

  // (1) first_to_10 — strictly ahead and ≥ SCORE_TO_WIN (S3-R5-10)
  if (
    ahead &&
    ((ahead === "blue" && sb >= c.SCORE_TO_WIN) || (ahead === "red" && sr >= c.SCORE_TO_WIN))
  ) {
    endMatch(state, emit, "first_to_10", ahead);
    return;
  }

  // Lab short windows use MATCH_T as a stop time only — no clock/ladder/coin.
  if (labShort) return;

  // (2) 4:00 clock and 4:30 ladder
  if (Math.abs(state.t - c.MATCH_T) <= 1e-12) {
    if (ahead) {
      endMatch(state, emit, "clock", ahead);
      return;
    }
    // tie → sudden death continues (no end)
  }

  if (Math.abs(state.t - c.SUDDEN_DEATH_T) <= 1e-12) {
    // Ladder once at 270.0: zone_time then takedowns (kills, not score)
    const zb = arena.zone.control_time_ticks.blue;
    const zr = arena.zone.control_time_ticks.red;
    if (zb !== zr) {
      endMatch(state, emit, "zone_time", zb > zr ? "blue" : "red");
      return;
    }
    const tb = state.takedowns_blue;
    const tr = state.takedowns_red;
    if (tb !== tr) {
      endMatch(state, emit, "takedowns", tb > tr ? "blue" : "red");
      return;
    }
    // else enter extra_15
  }

  if (Math.abs(state.t - (c.SUDDEN_DEATH_T + c.BO1_EXTRA_S)) <= 1e-12) {
    if (ahead) {
      endMatch(state, emit, "sudden_death", ahead);
      return;
    }
    const flip = rng.next("tiebreak", 0);
    endMatch(state, emit, "coin_flip", flip < 0.5 ? "blue" : "red");
    return;
  }

  // (3) sudden_death / extra_15: first tick ending unequal after a score
  if (
    (arena.phase === "sudden_death" || arena.phase === "extra_15") &&
    scoredThisTick &&
    ahead
  ) {
    endMatch(state, emit, "sudden_death", ahead);
  }
}
