import type { Constants } from "./constants.js";
import { dist } from "./math.js";
import { effectiveResist, kitAmps, longSightAmp, tryRewoundMoment } from "./passives.js";
import type { RngBank } from "./rng.js";
import { unitKeyFromId } from "./rng.js";
import {
  absorbDamage,
  addShield,
  breakSleepOnHpLoss,
  hasPetrify,
  isBanished,
  isBlind,
  isDisarmed,
  isLocked,
  isTaunted,
  isTimeStopped,
  tauntSourceId,
  type StatusState,
} from "./status.js";
// isLocked covers Lock category (stun/fear/hex/…) — cancel windups under Lock.
import { retreatImmobile, retreatSuppressesCombat } from "./retreat_combat.js";
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

/** §6.8 gates: cannot start auto while disarmed / locked / attack-reset pending. Time-stop is a Lock (isLocked). */
export function canStartAuto(
  u: UnitState,
  st: StatusState,
  state?: MatchState,
  c?: Constants,
): boolean {
  if (u.attack_reset_pending) return false;
  if (isDisarmed(st)) return false;
  if (isLocked(st)) return false;
  if (isBanished(st)) return false;
  // S2-R4-5 L1974: mobile Retreat/Regroup starts no new autos.
  if (state && c && retreatSuppressesCombat(u, state, c)) return false;
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
      // Lock / time-stop / disarm cancel an unapplied windup (no hit).
      if (isLocked(atk.status) || isTimeStopped(atk.status) || isDisarmed(atk.status) || isBanished(atk.status)) {
        atk.auto_windup_left = 0;
        atk.auto_windup_target = null;
        continue;
      }
      atk.auto_windup_left -= c.DT;
      if (atk.auto_windup_left > 1e-12) continue;
      atk.auto_windup_left = 0;
      const tid = atk.auto_windup_target;
      atk.auto_windup_target = null;
      if (!tid) continue;
      if (isLocked(atk.status) || isDisarmed(atk.status)) continue;
      const target = state.units.find((u) => u.id === tid);
      if (!target || !target.alive) continue;
      if (isBanished(target.status)) continue;
      atk.ai_first_auto_done = true;

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
    if (!canStartAuto(atk, atk.status, state, c)) continue;

    const target = pickAutoTarget(state, atk, c);
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
    const source = state.units.find((u) => u.id === m.source_id);
    const target = state.units.find((u) => u.id === m.target_id);
    if (!target || !target.alive) continue;
    if (isBanished(target.status)) continue;
    // If the attacker is Locked / banished / disarmed when the missile lands, the auto does not apply.
    if (
      source &&
      (isLocked(source.status) ||
        isBanished(source.status) ||
        isTimeStopped(source.status) ||
        isDisarmed(source.status))
    ) {
      continue;
    }
    // Blind at land: auto misses (raw 0), matching windup-end blind handling.
    const raw = source && isBlind(source.status) ? 0 : m.raw;
    state.pending_damage.push({
      seq: m.spawn_seq,
      source_id: m.source_id,
      target_id: m.target_id,
      skill_id: m.skill_id,
      raw,
      physical: true,
      crit: raw === 0 ? false : m.crit,
    });
  }
  return keep;
}

function pickAutoTarget(state: MatchState, atk: UnitState, c: Constants): UnitState | null {
  // S2-R4-5: mobile retreat — no freestyle (or any) new auto target.
  if (retreatSuppressesCombat(atk, state, c)) return null;
  if (isTaunted(atk.status)) {
    const tid = tauntSourceId(atk.status);
    if (tid) {
      const t = state.units.find((u) => u.id === tid);
      if (t && t.alive && !isBanished(t.status)) {
        const d = dist(atk.x, atk.y, t.x, t.y);
        if (d <= atk.stats.range) return t;
      }
    }
  }
  // Prefer Unit Brain target when in range (Teamwork follow-call).
  if (atk.ai_target_id) {
    const pref = state.units.find((u) => u.id === atk.ai_target_id);
    if (pref && pref.alive && pref.team !== atk.team && !isBanished(pref.status)) {
      const d = dist(atk.x, atk.y, pref.x, pref.y);
      if (d <= atk.stats.range) return pref;
    }
  }
  // R #4: L1044 "Teamwork 50+ always-follow" is superseded. Block freestyle
  // nearest-in-range only when the brain set ai_no_freelance (focus dead/cleared).
  // S2-R4-5: immobile Retreat still freelances via the same retreatImmobile predicate.
  if (atk.ai_target_id === null && atk.ai_no_freelance && !retreatImmobile(atk, c)) {
    return null;
  }
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

    // Lab scripted_damage pierces spawn shield so short-respawn fixtures can re-kill.
    const scriptedPierce = p.skill_id === "scripted";
    if (
      !scriptedPierce &&
      (state.t < target.spawn_shield_until || state.t < target.status.spawn_shield_until)
    ) {
      emit("hit", {
        source_id: p.source_id,
        target_id: p.target_id,
        skill_id: p.skill_id,
        raw: p.raw,
        mitigated: 0,
        amp: 1,
        crit: p.crit,
        shield_absorbed: p.raw,
        hp_after: Math.floor(target.hp),
      });
      continue;
    }

    const resist = effectiveResist(target, p.physical, state.t);
    let amp = 1;
    let mitigated: number;
    if (p.pre_mitigated !== undefined) {
      mitigated = p.pre_mitigated;
    } else {
      // Autos carry base raw (ATK * crit); apply kit amps here.
      // Skills already baked skill_scale+finisher into raw.
      amp = kitAmps(state.units, source, target, state.t);
      // Autos: also get Long Sight via kitAmps; skills too.
      void longSightAmp;
      const flank =
        source.flank_buff_until > state.t + 1e-12 ? 1 + c.BUFF_DMG : 1;
      const taken = hasPetrify(target.status) ? 1 - c.PETRIFY_DR : 1;
      const rawFlank = p.raw * flank;
      mitigated = rawFlank * amp * taken * mit(resist);
      amp = amp * flank * taken;
      // Expose damage-dealt amp in raw so §5.7 flank-buff checks can read it.
      (p as { raw: number }).raw = rawFlank;
    }

    const abs = absorbDamage(target.status, mitigated, state.t, {
      pierceSpawnShield: scriptedPierce,
    });
    const exactHp = target.hp - abs.hpLoss;
    target.hp = exactHp;
    if (abs.hpLoss > 0) {
      if (breakSleepOnHpLoss(target.status, abs.hpLoss)) {
        emit("sleep_break", { target_id: target.id, source_id: source.id });
        emit("status_expire", { target_id: target.id, kind: "sleep" });
      }
      target.last_hit_by = p.source_id;
      target.damage_log.push({ source_id: p.source_id, t: state.t });
      target.assist_log.push({ source_id: p.source_id, t: state.t, kind: "damage" });
      target.last_damage_t = state.t;
      target.status.last_damage_t = state.t;
      const taken = (target.recent_taken ??= []);
      taken.push({ t: state.t, hp: abs.hpLoss });
      const cutoff = state.t - 1.2;
      while (taken.length > 0 && taken[0]!.t < cutoff) taken.shift();
      source.last_dealt_t = state.t;
      source.status.last_dealt_t = state.t;
    }
    emit("hit", {
      source_id: p.source_id,
      target_id: p.target_id,
      skill_id: p.skill_id,
      raw: p.raw,
      mitigated,
      amp,
      crit: p.crit,
      shield_absorbed: abs.shieldAbsorbed,
      hp_after: Math.floor(exactHp),
    });

    // Rewound Moment after HP drop
    const rw = tryRewoundMoment(target, state.t);
    if (rw) {
      const sh = addShield(target.status, rw.amount, target.max_hp, c.SHIELD_CAP_FRAC, rw.duration_s);
      emit("shield_apply", {
        source_id: target.id,
        target_id: target.id,
        amount: rw.amount,
        expires_at: state.t + rw.duration_s,
        capped_to: sh.capped_to,
      });
    }
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
