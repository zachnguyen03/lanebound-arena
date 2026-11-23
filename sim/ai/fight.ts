/**
 * G9 fight detection + §9.1 L1 Fight Call (Appendix R #3).
 */
import { CHAMPIONS, type ChampClass } from "../../data/champions/defs.js";
import type { Constants } from "../constants.js";
import { inOwnSanctuary } from "../map.js";
import { isBanished, isLocked, isTimeStopped } from "../status.js";
import type { Team, UnitId, UnitState } from "../types.js";
import { hystS } from "./attributes.js";
import { dpsEst } from "./dps.js";

const CLASS_WEIGHT: Record<ChampClass, number> = {
  Tank: 1.15,
  Fighter: 1.05,
  Assassin: 0.95,
  Marksman: 1.0,
  Mage: 1.0,
  Enchanter: 0.9,
};

export interface FightSnapshot {
  centroid: { x: number; y: number };
  participants: UnitId[];
  blue: UnitId[];
  red: UnitId[];
  /** Geometric fight (≥2 per side). */
  exists: boolean;
  escalate_2v2: boolean;
  a_true_blue: number;
  a_true_red: number;
  fight_id: string | null;
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function nearOwnPad(u: UnitState, c: Constants): boolean {
  const pad = u.team === "blue" ? c.BLUE_SPAWN : c.RED_SPAWN;
  return dist(u.x, u.y, pad[0]!, pad[1]!) <= 4.0;
}

function livingNonBanished(u: UnitState, c: Constants): boolean {
  // Sanctuary / pad-leaver units do not seed or join a fight — otherwise
  // defaultEvenConfig fillers at spawn (or just outside via WalkFromPad) skew
  // the G9 centroid and turn a 2v1 lab into a false 2v2.
  return (
    u.alive &&
    !isBanished(u.status) &&
    !inOwnSanctuary(u.team, u.x, u.y, c) &&
    !nearOwnPad(u, c)
  );
}

/**
 * G9 (1): seed = living non-banished (non-sanctuary) with an enemy within FIGHT_RADIUS.
 * Centroid = mean of seeds. Candidates = all such units within FIGHT_RADIUS of
 * that seed centroid (pulls in ring-mates who lack a direct enemy contact).
 */
export function fightCandidates(units: UnitState[], c: Constants): UnitState[] {
  const seeds: UnitState[] = [];
  for (const u of units) {
    if (!livingNonBanished(u, c)) continue;
    for (const e of units) {
      if (!livingNonBanished(e, c) || e.team === u.team) continue;
      if (dist(u.x, u.y, e.x, e.y) <= c.FIGHT_RADIUS) {
        seeds.push(u);
        break;
      }
    }
  }
  if (seeds.length === 0) return [];
  let sx = 0;
  let sy = 0;
  for (const u of seeds) {
    sx += u.x;
    sy += u.y;
  }
  const cx = sx / seeds.length;
  const cy = sy / seeds.length;
  return units.filter(
    (u) => livingNonBanished(u, c) && dist(u.x, u.y, cx, cy) <= c.FIGHT_RADIUS,
  );
}

/**
 * G9: seed → centroid → candidates within FIGHT_RADIUS of seed centroid →
 * participants (= candidates; already distance-filtered) → fight if ≥2/side.
 * 2v2 escalate: max distance of each of the four to centroid ≤ 6 AND |A−0.5| > 0.20.
 */
export function evaluateFight(units: UnitState[], c: Constants, fightId: string | null): FightSnapshot {
  const cands = fightCandidates(units, c);
  if (cands.length === 0) {
    return {
      centroid: { x: c.ZONE_CENTER[0]!, y: c.ZONE_CENTER[1]! },
      participants: [],
      blue: [],
      red: [],
      exists: false,
      escalate_2v2: false,
      a_true_blue: 0.5,
      a_true_red: 0.5,
      fight_id: null,
    };
  }

  let sx = 0;
  let sy = 0;
  for (const u of cands) {
    sx += u.x;
    sy += u.y;
  }
  const centroid = { x: sx / cands.length, y: sy / cands.length };

  const participants = cands.filter((u) => dist(u.x, u.y, centroid.x, centroid.y) <= c.FIGHT_RADIUS);
  const blue = participants.filter((u) => u.team === "blue").map((u) => u.id);
  const red = participants.filter((u) => u.team === "red").map((u) => u.id);
  const exists = blue.length >= 2 && red.length >= 2;

  const a_true_blue = powerRatio(participants, "blue");
  const a_true_red = 1 - a_true_blue;

  let escalate_2v2 = false;
  if (exists && blue.length === 2 && red.length === 2) {
    let maxD = 0;
    for (const id of [...blue, ...red]) {
      const u = units.find((x) => x.id === id)!;
      const d = dist(u.x, u.y, centroid.x, centroid.y);
      if (d > maxD) maxD = d;
    }
    escalate_2v2 = maxD <= c.TWO_V2_RADIUS && Math.abs(a_true_blue - 0.5) > c.TWO_V2_SWING;
  }

  return {
    centroid,
    participants: participants.map((u) => u.id),
    blue,
    red,
    exists,
    escalate_2v2,
    a_true_blue,
    a_true_red,
    fight_id: exists ? fightId : null,
  };
}

function powerRatio(participants: UnitState[], us: Team): number {
  let usP = 0;
  let themP = 0;
  for (const u of participants) {
    const cls = CHAMPIONS[u.champ]?.class ?? "Fighter";
    const w = CLASS_WEIGHT[cls] ?? 1;
    let p = w * dpsEst(u) * Math.sqrt(Math.max(0.05, u.hp / u.max_hp));
    if (isLocked(u.status) || isTimeStopped(u.status)) p *= 0.4;
    if (u.team === us) usP += p;
    else themP += p;
  }
  return usP / (usP + themP + 1e-6);
}

export type CommitKind = "engage" | "hold" | "disengage";

export function commitThresholds(
  tactic: "hold_the_pit" | "hunt" | "starve",
  ownZone: boolean,
): { engage: number; disengage: number } {
  if (tactic === "hunt") return { engage: 0.45, disengage: 0.33 };
  if (tactic === "starve") return { engage: 0.55, disengage: 0.38 };
  return ownZone ? { engage: 0.42, disengage: 0.32 } : { engage: 0.5, disengage: 0.35 };
}

export function chooseCommit(
  aTrue: number,
  tactic: "hold_the_pit" | "hunt" | "starve",
  ownZone: boolean,
  prev: CommitKind,
  aggression: -1 | 0 | 1,
  mistakeBandHalf = 0,
  deathThisTick = false,
): CommitKind {
  const th = commitThresholds(tactic, ownZone);
  const adj = aggression * 0.03;
  const engageAt = th.engage + adj;
  const disengageAt = th.disengage + adj;
  let next: CommitKind;
  if (aTrue >= engageAt) next = "engage";
  else if (aTrue <= disengageAt) next = "disengage";
  else if (prev === "engage" || prev === "disengage") next = prev;
  else next = "hold";

  if (deathThisTick || next === prev || next === "hold") return next;
  if (next === "engage" && aTrue - engageAt < mistakeBandHalf) return prev;
  if (next === "disengage" && disengageAt - aTrue < mistakeBandHalf) return prev;
  return next;
}

/** Cadence: every 0.5 s, or queued for next tick after fight-start/end/death (OQ-S2-3). */
export function shouldRunL1(
  t: number,
  c: Constants,
  pendingEventCall: boolean,
  lastL1T: number,
): boolean {
  if (pendingEventCall) return true;
  if (t < 1e-9) return false;
  const half = c.L1_PERIOD_S;
  const k = Math.round(t / half);
  if (Math.abs(t - k * half) < c.DT * 0.5 + 1e-9) {
    return t - lastL1T >= half - 1e-9;
  }
  return false;
}

export function shotcaller(units: UnitState[], team: Team): UnitState | null {
  const order: Record<string, number> = { top: 0, jungle: 1, mid: 2, adc: 3, support: 4 };
  let best: UnitState | null = null;
  for (const u of units) {
    if (!u.alive || u.team !== team) continue;
    if (!best) {
      best = u;
      continue;
    }
    if (u.attrs.decision > best.attrs.decision) best = u;
    else if (u.attrs.decision === best.attrs.decision) {
      if ((order[u.slot] ?? 9) < (order[best.slot] ?? 9)) best = u;
    }
  }
  return best;
}

export function canFlipCommit(
  t: number,
  lastFlipT: number,
  decision: number,
  deathThisTick: boolean,
): boolean {
  if (deathThisTick) return true;
  return t - lastFlipT >= hystS(decision) - 1e-9;
}

export function fightIssuesCall(snap: FightSnapshot): boolean {
  if (!snap.exists) return false;
  if (snap.blue.length >= 3 || snap.red.length >= 3) return true;
  return snap.escalate_2v2;
}
