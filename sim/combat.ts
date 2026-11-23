import type { Constants } from "./constants.js";
import { dist } from "./math.js";
import type { RngBank } from "./rng.js";
import { unitKeyFromId } from "./rng.js";
import {
  isBanished,
  isBlind,
  isDisarmed,
  isLocked,
  isTimeStopped,
  type StatusState,
} from "./status.js";
import type { MatchState, UnitId, UnitState } from "./types.js";

/** Marksman-like dummy L1 stats (Huntress numbers from build-spec §7.1). */
export const DUMMY_MARKSMAN = {
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
};

/** Melee threshold: Range ≤ 2.0 applies at windup end with no missile (§9.5 dive uses same cut). */
export const MELEE_RANGE_MAX = 2.0;

function mit(resist: number): number {
  return 100 / (100 + Math.max(0, resist));
}

export interface AutoMissile {
  proj_id: string;
  source_id: UnitId;
  target_id: UnitId;
  skill_id: string;
  raw: number;
  crit: boolean;
  land_t: number;
  spawn_seq: number;
}

/** §6.9: starting a skill cancels a windup that has not yet applied. */
export function cancelAutoWindup(u: UnitState): boolean {
  if (u.auto_windup_left <= 0) return false;
  u.auto_windup_left = 0;
  u.auto_windup_target = null;
  return true;
}

/** §6.8 gates: cannot start auto while disarmed / locked / time-stopped / attack-reset pending. */
export function canStartAuto(u: UnitState, st: StatusState): boolean {
  if (u.attack_reset_pending) return false;
  if (isDisarmed(st)) return false;
  if (isLocked(st)) return false;
  if (isTimeStopped(st)) return false;
  if (isBanished(st)) return false;
  return true;
}

/**
 * §6.8 / §6.9 auto cadence:
 * - Start windup when t >= auto_next_start_t, alive, target in range, gates clear.
 * - Windup = AUTO_WINDUP / AS.
 * - On start: auto_next_start_t = t + 1/AS (next start from windup begin).
 * - Blind: windup completes but auto misses (raw 0).
 * - Melee (range ≤ 2): pending damage at windup end.
 * - Ranged: missile at MISSILE_SPEED; lands when t >= land_t; crit rolled at windup end.
 */
export function tickAutos(
  state: MatchState,
  c: Constants,
  rng: RngBank,
  missiles: AutoMissile[],
  emit: (type: string, payload: Record<string, unknown>) => void,
): void {
  void emit;
  for (const atk of state.units) {
    if (!atk.alive) continue;
    // Time-stop pauses windup countdown (§6.5).
    if (isTimeStopped(atk.status)) continue;

    // Advance an in-progress windup.
    if (atk.auto_windup_left > 0) {
      atk.auto_windup_left -= c.DT;
      if (atk.auto_windup_left > 1e-12) continue;
      atk.auto_windup_left = 0;
      const tid = atk.auto_windup_target;
      atk.auto_windup_target = null;
      if (!tid) continue;
      const target = state.units.find((u) => u.id === tid);
      if (!target || !target.alive) continue;
      if (isBanished(target.status)) continue;

      // Blind: autos miss (§6.5 / §6.8).
      if (isBlind(atk.status)) {
        emit("hit", {
          source_id: atk.id,
          target_id: target.id,
          skill_id: "auto",
          raw: 0,
          mitigated: 0,
          amp: 1,
          crit: false,
          shield_absorbed: 0,
          hp_after: target.hp,
          miss: true,
        });
        continue;
      }

      const critChance = Math.min(c.CRIT_CAP, atk.stats.crit);
      const isCrit = rng.chance("combat", critChance, unitKeyFromId(atk.id));
      const mult = isCrit ? c.CRIT_MULT : 1.0;
      const raw = atk.stats.atk * mult;

      if (atk.stats.range <= MELEE_RANGE_MAX) {
        state.pending_damage.push({
          seq: state.event_seq,
          source_id: atk.id,
          target_id: target.id,
          skill_id: "auto",
          raw,
          physical: true,
          crit: isCrit,
        });
      } else {
        const d = dist(atk.x, atk.y, target.x, target.y);
        const travel = d / c.MISSILE_SPEED;
        const land_t = state.t + travel;
        const proj_id = `auto:${atk.id}:${state.tick}:${state.event_seq}`;
        missiles.push({
          proj_id,
          source_id: atk.id,
          target_id: target.id,
          skill_id: "auto",
          raw,
          crit: isCrit,
          land_t,
          spawn_seq: state.event_seq,
        });
        emit("projectile_spawn", {
          proj_id,
          unit_id: atk.id,
          skill_id: "auto",
          x: atk.x,
          y: atk.y,
          land_t,
        });
      }
      continue;
    }

    // Ready to start a new windup?
    if (state.t < atk.auto_next_start_t) continue;
    if (!canStartAuto(atk, atk.status)) continue;

    const target = pickAutoTarget(state, atk);
    if (!target) continue;

    const windup = c.AUTO_WINDUP / atk.stats.as;
    atk.auto_windup_left = windup;
    atk.auto_windup_target = target.id;
    // Next start is 1/AS from this windup's start (§6.9).
    atk.auto_next_start_t = state.t + 1 / atk.stats.as;
  }
}

/** Resolve missiles whose land_t <= state.t into pending damage. */
export function landMissiles(
  state: MatchState,
  missiles: AutoMissile[],
): AutoMissile[] {
  const keep: AutoMissile[] = [];
  // Stable order: land_t, spawn_seq, proj_id
  const due = missiles
    .filter((m) => m.land_t <= state.t)
    .sort((a, b) => {
      if (a.land_t !== b.land_t) return a.land_t - b.land_t;
      if (a.spawn_seq !== b.spawn_seq) return a.spawn_seq - b.spawn_seq;
      return a.proj_id < b.proj_id ? -1 : a.proj_id > b.proj_id ? 1 : 0;
    });
  for (const m of missiles) {
    if (m.land_t > state.t) keep.push(m);
  }
  for (const m of due) {
    const target = state.units.find((u) => u.id === m.target_id);
    if (!target || !target.alive) continue;
    if (isBanished(target.status)) continue;
    state.pending_damage.push({
      seq: m.spawn_seq,
      source_id: m.source_id,
      target_id: m.target_id,
      skill_id: m.skill_id,
      raw: m.raw,
      physical: true,
      crit: m.crit,
    });
  }
  return keep;
}

function pickAutoTarget(state: MatchState, atk: UnitState): UnitState | null {
  let best: UnitState | null = null;
  let bestD = Infinity;
  let bestIndex = Infinity;
  for (const u of state.units) {
    if (!u.alive || u.team === atk.team) continue;
    if (isBanished(u.status)) continue;
    const d = dist(atk.x, atk.y, u.x, u.y);
    if (d > atk.stats.range) continue;
    if (d < bestD || (d === bestD && u.index < bestIndex)) {
      best = u;
      bestD = d;
      bestIndex = u.index;
    }
  }
  return best;
}

export function resolvePendingDamage(
  state: MatchState,
  c: Constants,
  emit: (type: string, payload: Record<string, unknown>) => void,
): void {
  void c;
  const pkts = state.pending_damage.slice();
  state.pending_damage = [];
  pkts.sort((a, b) => {
    const ai = state.units.find((u) => u.id === a.source_id)?.index ?? 0;
    const bi = state.units.find((u) => u.id === b.source_id)?.index ?? 0;
    if (ai !== bi) return ai - bi;
    return a.seq - b.seq;
  });

  for (const p of pkts) {
    const target = state.units.find((u) => u.id === p.target_id);
    const source = state.units.find((u) => u.id === p.source_id);
    if (!target || !target.alive || !source) continue;
    if (isBanished(target.status)) continue;

    if (state.t < target.spawn_shield_until) {
      emit("hit", {
        source_id: p.source_id,
        target_id: p.target_id,
        skill_id: p.skill_id,
        raw: p.raw,
        mitigated: 0,
        amp: 1,
        crit: p.crit,
        shield_absorbed: p.raw,
        hp_after: target.hp,
      });
      continue;
    }

    const resist = p.physical ? target.stats.pres : target.stats.mres;
    const mitigated = p.raw * mit(resist);
    target.hp = Math.floor(target.hp - mitigated);
    if (mitigated > 0) {
      target.last_hit_by = p.source_id;
      target.damage_log.push({ source_id: p.source_id, t: state.t });
      target.assist_log.push({ source_id: p.source_id, t: state.t, kind: "damage" });
      target.last_damage_t = state.t;
      source.last_dealt_t = state.t;
    }
    emit("hit", {
      source_id: p.source_id,
      target_id: p.target_id,
      skill_id: p.skill_id,
      raw: p.raw,
      mitigated,
      amp: 1,
      crit: p.crit,
      shield_absorbed: 0,
      hp_after: target.hp,
    });
  }
}

/** Record a CC/heal/shield assist contribution (§6.10). */
export function recordAssistCredit(
  targetOrKiller: UnitState,
  sourceId: UnitId,
  t: number,
  kind: "cc" | "heal" | "shield",
): void {
  targetOrKiller.assist_log.push({ source_id: sourceId, t, kind });
}
