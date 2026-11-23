import type { Constants } from "./constants.js";
import { dist } from "./math.js";
import type { RngBank } from "./rng.js";
import { unitKeyFromId } from "./rng.js";
import type { MatchState, PendingDamage, UnitState } from "./types.js";

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

function mit(resist: number): number {
  return 100 / (100 + Math.max(0, resist));
}

/**
 * S0 dummy autos: if a living enemy is in range, queue a physical auto.
 * Windup is ignored in S0 (instant on cooldown); CD = 1/AS.
 * Crit on stream `combat`.
 */
export function tickAutos(
  state: MatchState,
  c: Constants,
  rng: RngBank,
  emit: (type: string, payload: Record<string, unknown>) => void,
): void {
  void emit;
  // Stable unit order already on state.units
  for (const atk of state.units) {
    if (!atk.alive) continue;
    if (atk.auto_cd > 0) {
      atk.auto_cd -= c.DT;
      if (atk.auto_cd < 0) atk.auto_cd = 0;
      continue;
    }

    const target = pickAutoTarget(state, atk);
    if (!target) continue;

    const critChance = Math.min(c.CRIT_CAP, atk.stats.crit);
    const isCrit = rng.chance("combat", critChance, unitKeyFromId(atk.id));
    const mult = isCrit ? c.CRIT_MULT : 1.0;
    const raw = atk.stats.atk * mult;

    const pkt: PendingDamage = {
      seq: state.event_seq, // placeholder; real seq assigned at apply
      source_id: atk.id,
      target_id: target.id,
      skill_id: "auto",
      raw,
      physical: true,
      crit: isCrit,
    };
    state.pending_damage.push(pkt);
    atk.auto_cd = 1 / atk.stats.as;
  }
}

function pickAutoTarget(state: MatchState, atk: UnitState): UnitState | null {
  let best: UnitState | null = null;
  let bestD = Infinity;
  let bestIndex = Infinity;
  for (const u of state.units) {
    if (!u.alive || u.team === atk.team) continue;
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
  // Order: attackers in unit order, then spawn order — pending list is already in cast order.
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

    // Spawn shield blocks damage only.
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
    // Floor HP after applied packet (build-spec §4.1).
    target.hp = Math.floor(target.hp - mitigated);
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
