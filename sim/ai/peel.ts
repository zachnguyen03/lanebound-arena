/**
 * Auto-peel (§9.5) + dive events (Appendix R #3 / OQ-S2-4).
 */
import { CHAMPIONS } from "../../data/champions/defs.js";
import type { Constants } from "../constants.js";
import { inOwnSanctuary } from "../map.js";
import { isLocked, isTimeStopped } from "../status.js";
import type { UnitId, UnitState } from "../types.js";
import { perceptionDelayS, perceptionRadiusTiles, reactionDelayS, teamworkMaySkipPeel } from "./attributes.js";

function dist(a: UnitState, b: UnitState): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export interface DiveEvent {
  diver_id: UnitId;
  carry_id: UnitId;
  /** Geometric peeler available this tick (condition 2). */
  geometric_ok: boolean;
  peeler_id: UnitState | null;
  peeler_perceived: boolean;
}

function isCarry(u: UnitState): boolean {
  const cls = CHAMPIONS[u.champ]?.class;
  return cls === "Marksman" || cls === "Enchanter";
}

function isMelee(u: UnitState): boolean {
  return u.stats.range <= 2.0;
}

function isPeelerClass(u: UnitState): boolean {
  const cls = CHAMPIONS[u.champ]?.class;
  return cls === "Tank" || cls === "Enchanter" || cls === "Fighter" || cls === "Mage";
}

/**
 * Perception / reaction (R #3 S2-1):
 * - Newly appeared enemy (first seen while already a dive threat): act after
 *   max(perception_delay, reaction_delay) from firstSeen.
 * - Already perceived (firstSeen + perception_delay ≤ diveStart): only
 *   reaction_delay from diveStart.
 */
export function peelerPerceivesDiver(
  peeler: UnitState,
  diver: UnitState,
  firstSeenT: number | undefined,
  now: number,
  ignore: boolean,
  diveStartT: number | undefined,
): boolean {
  if (ignore) return true;
  const pr = perceptionRadiusTiles(peeler.attrs.decision);
  if (dist(peeler, diver) > pr) return false;
  if (firstSeenT === undefined) return false;
  const pDelay = perceptionDelayS(peeler.attrs.decision);
  const rDelay = reactionDelayS(peeler.attrs.reflexes);
  const diveT = diveStartT ?? firstSeenT;
  // Already perceived iff the perception window elapsed before the dive began.
  const alreadyPerceived = firstSeenT + pDelay <= diveT + 1e-9;
  if (alreadyPerceived) {
    return now >= diveT + rDelay - 1e-9;
  }
  // Newly appeared inside the threat: max(perception, reaction) from first seen.
  return now >= firstSeenT + Math.max(pDelay, rDelay) - 1e-9;
}

export function detectDives(
  units: UnitState[],
  c: Constants,
  opts: {
    a_true: number;
    tactic: "hold_the_pit" | "hunt" | "starve";
    ignore_perception?: boolean;
    now: number;
    /** First t the peeler saw the diver inside perception radius. */
    seenAt: Partial<Record<string, number>>;
    /** First t this diver-carry pair was inside PEEL_DIVE_R this fight. */
    diveStartAt?: Partial<Record<string, number>>;
  },
): DiveEvent[] {
  const out: DiveEvent[] = [];
  const diveStartAt = opts.diveStartAt ?? {};
  for (const carry of units) {
    if (!carry.alive || !isCarry(carry)) continue;
    const divers = units
      .filter(
        (diver) =>
          diver.alive &&
          diver.team !== carry.team &&
          (isMelee(diver) || diver.champ === "kerrig") &&
          dist(diver, carry) <= c.PEEL_DIVE_R,
      )
      .sort((a, b) => dist(a, carry) - dist(b, carry));
    for (const diver of divers) {
      const d = dist(diver, carry);

      const pairKey = `${diver.id}>${carry.id}`;
      if (diveStartAt[pairKey] === undefined) diveStartAt[pairKey] = opts.now;
      const diveStartT = diveStartAt[pairKey]!;

      const hardCommit = opts.tactic === "hunt" && opts.a_true >= 0.62;

      let bestPeeler: UnitState | null = null;
      let bestEta = Infinity;
      let bestPerceived = false;
      for (const p of units) {
        if (!p.alive || p.team !== carry.team) continue;
        if (p.id === carry.id) continue;
        if (isLocked(p.status) || isTimeStopped(p.status)) continue;
        // Pad residents are not peelers — keeps unused spawn slots out of S1 labs.
        if (inOwnSanctuary(p.team, p.x, p.y, c)) continue;
        if (!isPeelerClass(p)) continue;
        const cls = CHAMPIONS[p.champ]?.class;
        const tankOrEnc = cls === "Tank" || cls === "Enchanter";
        if (hardCommit && !tankOrEnc) continue;
        if (teamworkMaySkipPeel(p.attrs.teamwork, tankOrEnc)) continue;

        const etaDiver = dist(p, diver) / Math.max(0.1, p.stats.ms);
        const etaCarry = dist(p, carry) / Math.max(0.1, p.stats.ms);
        const eta = Math.min(etaDiver, etaCarry);
        const inRangeSkill = dist(p, diver) <= 6.5 || dist(p, carry) <= 6.5;
        if (eta > c.PEEL_REACH_S && !inRangeSkill) continue;

        const seenKey = `${p.id}>${diver.id}`;
        const perceived = peelerPerceivesDiver(
          p,
          diver,
          opts.seenAt[seenKey],
          opts.now,
          opts.ignore_perception === true,
          diveStartT,
        );

        if (eta < bestEta) {
          bestEta = eta;
          bestPeeler = p;
          bestPerceived = perceived;
        }
      }

      const geometric_ok = bestPeeler !== null;
      out.push({
        diver_id: diver.id,
        carry_id: carry.id,
        geometric_ok,
        peeler_id: bestPeeler,
        peeler_perceived: bestPerceived,
      });
    }
  }
  return out;
}

/** Track first-seen times for perception (call each AI tick). */
export function updatePerceptionSeen(
  units: UnitState[],
  seenAt: Partial<Record<string, number>>,
  now: number,
): void {
  for (const observer of units) {
    if (!observer.alive) continue;
    const pr = perceptionRadiusTiles(observer.attrs.decision);
    for (const other of units) {
      if (!other.alive || other.team === observer.team) continue;
      const key = `${observer.id}>${other.id}`;
      // Sticky knowledge once acquired: leaving the radius does not wipe firstSeen
      // (R #3 already-perceived = reaction-only on a later dive).
      if (dist(observer, other) <= pr) {
        if (seenAt[key] === undefined) seenAt[key] = now;
      }
    }
  }
}
