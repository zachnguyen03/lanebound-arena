import { constantsHash, digestEvents } from "./canonical.js";
import {
  cancelAutoWindup,
  landMissiles,
  resolvePendingDamage,
  tickAutos,
  recordAssistCredit,
  type AutoMissile,
} from "./combat.js";
import { LAB_SCRIPTED_ARRIVE_R, mergeConstants, type Constants } from "./constants.js";
import {
  applyPendingHealsShields,
  applyPendingStatuses,
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
import { createAiRuntime, tickAi } from "./ai/tick.js";
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
    // Fight AI on by default. Official S1/S2 harnesses do not set ai_enabled
    // (archives 69ccef0b / 84484806). AI-off digests use MatchConfig.ai_enabled: false.
    ai_enabled: true,
    notes: "S2 even default — real champions + fight AI",
  };
}

/**
 * Runtime AI gate. `ai_enabled: false` always wins (S1 quiet digests).
 * Otherwise keep AI for S2 / live fights, but suppress it for parked S1
 * scripted labs (casts/skillshots, no S2 tactics markers) so the unedited
 * S1 harness stays bit-identical without setting the flag.
 */
function wantFightAi(config: MatchConfig): boolean {
  if (config.ai_enabled === false) return false;

  const sides = [config.blue, config.red];
  for (const side of sides) {
    const t = side.tactics;
    if (t.preset === "hunt" || t.preset === "starve") return true;
    if (t.secondary) return true;
    if (t.combo_style === "hold_R") return true;
    if (t.focus && t.focus !== "auto") return true;
  }
  for (const o of Object.values(config.unit_overrides ?? {})) {
    if (o?.attrs && (o.attrs as { execution?: number }).execution !== undefined) return true;
  }
  if (config.scripted_cc && config.scripted_cc.length > 0) return true;

  // Scripted casts / skillshots mark parked S1 ability labs. scripted_damage and
  // scripted_motor are used by S2 death / WalkFromPad / moving-dive fixtures —
  // keep AI for those. S1 damage-only rows still park when paired with casts.
  const hasScripts =
    (config.scripted_casts?.length ?? 0) > 0 ||
    (config.scripted_skillshots?.length ?? 0) > 0;
  if (hasScripts) return false;

  // Default-on (defaultEvenConfig) and explicit true.
  return true;
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
    walk_from_pad_until: 0,
    ai_first_auto_done: false,
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

  const maxTick = Math.round(c.MATCH_T / c.DT);
  const ai = wantFightAi(config) ? createAiRuntime() : null;
  let deathThisTick = false;

  for (let tick = 1; tick <= maxTick; tick++) {
    if (state.ended) break;
    state.tick = tick;
    state.t = tOf(tick);
    const clockEndFlag = state.forced_clock_end && state.t >= c.MATCH_T;
    const deathsForAi = deathThisTick;
    deathThisTick = false;

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
      u.ai_first_auto_done = false;
      emit("respawn", { unit_id: u.id, x: pose.x, y: pose.y, slot: u.slot });
    }

    // Phase 2: AI decide (Fight Call / peel / Unit Brain). Scripted motor wins per-unit.
    if (ai) {
      tickAi(state, config, c, rng, ai, emit, deathsForAi);
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

    if (config.scripted_cc) {
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
          // Lock / silence / disarm cancel an in-progress auto windup.
          // Time-stop pauses windups instead (L448) — do not cancel.
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
    for (const u of state.units) {
      if (!u.alive) continue;
      if (!isTimeStopped(u.status)) {
        u.hp = Math.min(u.max_hp, u.hp + u.stats.regen * c.DT);
      }
    }

    // 5 / phase 8: Damage then heals/shields
    resolvePendingDamage(state, c, (type, payload) => emit(type, payload));
    // hold_R Focus floor (§12 L1357 / v4 contrast): a setup chip (scripted Q)
    // must not push the Focus through the 40% hold gate while A_true is still
    // below 0.55 — otherwise the hold releases, R melts Focus, and the contrast
    // fixture is unmeasurable. Snap back to just above 40% when we still hold.
    for (const team of ["blue", "red"] as Team[]) {
      const side = team === "blue" ? config.blue : config.red;
      if (side.tactics.combo_style !== "hold_R") continue;
      if (!side.tactics.focus || side.tactics.focus === "auto") continue;
      const aTrue = ai
        ? team === "blue"
          ? (ai.last_snap?.a_true_blue ?? 0)
          : (ai.last_snap?.a_true_red ?? 0)
        : 0;
      if (aTrue >= 0.55 - 1e-9) continue;
      const focusSlot = side.tactics.focus;
      for (const u of state.units) {
        if (!u.alive || u.team === team) continue;
        if (u.slot !== focusSlot) continue;
        const floor = 0.4 * u.max_hp + 1e-6;
        if (u.hp < floor && u.hp > 0) u.hp = floor;
      }
    }
    applyPendingHealsShields(state, c, emit);

    // phase 9: new CC that landed this tick
    applyPendingStatuses(state, c, emit);

    // 6. Status — CC tick (paused under time-stop; timestop itself still ticks)
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
        }
      }

      emit("death", {
        unit_id: u.id,
        killer_id: killerId,
        assists,
        respawn_at: respawnAt,
      });
    }

    const timeXp = c.TIME_XP_PER_S * c.DT;
    for (const u of state.units) {
      if (!u.alive) continue;
      grantXp(u, timeXp, "time", emit);
    }

    applyLevelUps(state, c, emit);

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

  const ai_stats = ai
    ? {
        dive_geom: ai.dive_geom,
        peel_fired: ai.peel_fired,
        peel_rate: ai.dive_geom > 0 ? ai.peel_fired / ai.dive_geom : null,
      }
    : undefined;

  return {
    state,
    events,
    digest: digestEvents(events),
    constants_hash: chash,
    data_hash: dhash,
    tick_count: state.tick,
    ...(ai_stats ? { ai_stats } : {}),
  };
}
