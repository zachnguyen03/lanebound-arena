/**
 * Targeting v1 (§9.3) + Decision lerp toward focus (§8.4).
 * Reach / Teamwork follow-call per Appendix R #4.
 * Focus slot ×1.25 score only (no hard override) — R #3 S2-6 / v4 probe.
 * Lock ×1.25 on killability — §9.3 L1128.
 */
import { CHAMPIONS, type ChampClass } from "../../data/champions/defs.js";
import type { Constants } from "../constants.js";
import { inOwnSanctuary } from "../map.js";
import { isBanished, isLocked } from "../status.js";
import type { Team, Teamfight, UnitId, UnitState } from "../types.js";
import { callFollowSlack, clamp } from "./attributes.js";
import { estTtk } from "./dps.js";

/** §9.3 L1125 class value table. */
const VALUE: Record<ChampClass, number> = {
  Marksman: 1.3,
  Mage: 1.15,
  Assassin: 1.1,
  Enchanter: 1.05,
  Fighter: 0.95,
  Tank: 0.75,
};

function dist(a: UnitState, b: UnitState): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Appendix R #4 reach: 1 if in range or eta ≤ 1.5 s;
 * else 1 / (1 + 0.4*d + 0.08*d*d) with d = eta − 1.5 (+ − × ÷ only).
 */
export function reachFactor(self: UnitState, target: UnitState): number {
  const d = dist(self, target);
  const eta = d / Math.max(0.1, self.stats.ms);
  if (d <= self.stats.range || eta <= 1.5) return 1.0;
  const dd = eta - 1.5;
  return 1 / (1 + 0.4 * dd + 0.08 * dd * dd);
}

export function targetingScore(
  self: UnitState,
  target: UnitState,
  opts: {
    c: Constants;
    focusId: UnitId | null;
    peeling: boolean;
    tactic: "hold_the_pit" | "hunt" | "starve";
    currentTarget: UnitId | null;
    zoneOccupiedByTarget: boolean;
    isolated: boolean;
    all: UnitState[];
    intentTarget: Partial<Record<UnitId, UnitId | null>>;
    coachFocusSlot?: string | null;
    teamwork?: number;
    tf?: Teamfight;
  },
): number {
  if (!target.alive || isBanished(target.status)) return 0;
  if (inOwnSanctuary(target.team, target.x, target.y, opts.c)) return 0;

  const cls = CHAMPIONS[target.champ]?.class ?? "Fighter";
  const missing = 1 - target.hp / Math.max(1, target.max_hp);
  // §9.3 L1125 VALUE × (1 + 0.4 × missing_hp); coach Focus slot ×1.25 (§12 L1352 / R #3).
  let value = (VALUE[cls] ?? 1) * (1 + 0.4 * missing);
  if (opts.coachFocusSlot && target.slot === opts.coachFocusSlot) value *= 1.25;

  const ttk = estTtk(self, target, opts.all, opts.intentTarget);
  let killability = 1 / (ttk + 0.5);
  // Lock ×1.25 on killability (§9.3 L1128). exp combo: ×2.2 so allies converge
  // on the locked body (CC → burst).
  if (isLocked(target.status)) killability *= opts.tf?.combo ? 2.2 : 1.25;

  const reach = reachFactor(self, target);
  const sticky = opts.currentTarget === target.id ? 1.25 : 1.0;

  // §9.3 / R #4: call factor is 1.30 on the L1 focus, else 1.00.
  let call = 1.0;
  if (opts.focusId === target.id) call = 1.3;
  if (opts.peeling) call = 0.85;

  let tactic = 1.0;
  if (opts.tactic === "hunt" && (cls === "Marksman" || cls === "Mage")) tactic = 1.2;
  if (opts.tactic === "hold_the_pit" && opts.zoneOccupiedByTarget) tactic = 1.2;
  if (opts.tactic === "starve" && opts.isolated) tactic = 1.2;

  const ward = 1.0;
  const role = opts.tf?.roles ? roleMult(self, target) : 1.0;
  return value * killability * reach * sticky * call * tactic * ward * role;
}

/** exp/teamfight-dynamics role split (not build spec). */
export function isDiver(u: UnitState): boolean {
  return (CHAMPIONS[u.champ]?.class ?? "Fighter") === "Assassin" || u.slot === "jungle";
}

export function isFrontline(u: UnitState): boolean {
  const c = CHAMPIONS[u.champ]?.class ?? "Fighter";
  return (c === "Tank" || c === "Fighter") && !isDiver(u);
}

function roleMult(self: UnitState, target: UnitState): number {
  const tc = CHAMPIONS[target.champ]?.class ?? "Fighter";
  const backline = tc === "Marksman" || tc === "Mage" || tc === "Enchanter";
  if (isDiver(self)) return backline ? 1.8 : 0.7;
  if (isFrontline(self)) return 1 / (1 + 0.25 * dist(self, target));
  return 1.0;
}

/**
 * Appendix R6-7(d) Teamwork follow-call:
 * follow if local_score < call_score × clamp(1 + 0.01·(T − 50), 0.70, 1.40).
 * Disengage calls are always followed (handled by caller).
 */
export function shouldFollowFocus(
  callScore: number,
  localScore: number,
  teamwork: number,
): boolean {
  return localScore < callScore * callFollowSlack(teamwork);
}

export function chooseFocus(
  selfTeam: Team,
  units: UnitState[],
  sc: UnitState,
  fightIds: UnitId[],
  opts: {
    c: Constants;
    tactic: "hold_the_pit" | "hunt" | "starve";
    zoneCenter: [number, number];
    zoneR: number;
    intentTarget: Partial<Record<UnitId, UnitId | null>>;
    coachFocusSlot?: string | null;
  },
): UnitId | null {
  const enemies = units.filter(
    (u) =>
      u.alive &&
      u.team !== selfTeam &&
      fightIds.includes(u.id) &&
      !isBanished(u.status) &&
      !inOwnSanctuary(u.team, u.x, u.y, opts.c),
  );
  if (enemies.length === 0) return null;

  // Focus is a ×1.25 score multiplier only — no hard-return (R #3 / v4 probe).
  const blend = clamp((sc.attrs.decision - 20) / 60, 0, 1);
  let bestId: UnitId | null = null;
  let bestScore = -1;
  for (const e of enemies) {
    const d = dist(sc, e);
    const closestScore = 1 / (d + 0.5);
    const trueScore = targetingScore(sc, e, {
      c: opts.c,
      focusId: null,
      peeling: false,
      tactic: opts.tactic,
      currentTarget: null,
      zoneOccupiedByTarget:
        Math.hypot(e.x - opts.zoneCenter[0], e.y - opts.zoneCenter[1]) <= opts.zoneR,
      isolated: !units.some(
        (a) => a.alive && a.team === e.team && a.id !== e.id && dist(a, e) <= 4,
      ),
      all: units,
      intentTarget: opts.intentTarget,
      coachFocusSlot: opts.coachFocusSlot,
    });
    const score = closestScore * (1 - blend) + trueScore * blend;
    if (score > bestScore) {
      bestScore = score;
      bestId = e.id;
    }
  }
  return bestId;
}

export function pickUnitTarget(
  self: UnitState,
  enemies: UnitState[],
  opts: {
    c: Constants;
    focusId: UnitId | null;
    peeling: boolean;
    peelDiverId: UnitId | null;
    tactic: "hold_the_pit" | "hunt" | "starve";
    currentTarget: UnitId | null;
    zoneCenter: [number, number];
    zoneR: number;
    all: UnitState[];
    intentTarget: Partial<Record<UnitId, UnitId | null>>;
    coachFocusSlot?: string | null;
    teamwork?: number;
    commitDisengage?: boolean;
    tf?: Teamfight;
  },
): UnitId | null {
  if (opts.peeling && opts.peelDiverId) return opts.peelDiverId;

  let legal = enemies.filter(
    (e) => e.alive && !isBanished(e.status) && !inOwnSanctuary(e.team, e.x, e.y, opts.c),
  );
  if (legal.length === 0) return null;
  // Round 3 `target_cap`: skip enemies that already have `cap` allies on them.
  const cap = opts.tf?.target_cap;
  if (cap) {
    const on = (e: UnitState) =>
      Object.entries(opts.intentTarget).filter(
        ([id, t]) => t === e.id && id !== self.id && id.startsWith(self.team),
      ).length;
    const open = legal.filter((e) => on(e) < cap);
    if (open.length > 0) legal = open;
  }

  const scoreOf = (e: UnitState, asFocus: boolean): number =>
    targetingScore(self, e, {
      c: opts.c,
      focusId: asFocus ? e.id : null,
      peeling: opts.peeling,
      tactic: opts.tactic,
      currentTarget: opts.currentTarget,
      zoneOccupiedByTarget:
        Math.hypot(e.x - opts.zoneCenter[0], e.y - opts.zoneCenter[1]) <= opts.zoneR,
      isolated: !opts.all.some(
        (a) => a.alive && a.team === e.team && a.id !== e.id && dist(a, e) <= 4,
      ),
      all: opts.all,
      intentTarget: opts.intentTarget,
      coachFocusSlot: opts.coachFocusSlot,
      teamwork: opts.teamwork ?? self.attrs.teamwork,
      tf: opts.tf,
    });

  if (opts.commitDisengage && opts.focusId) {
    const f = legal.find((e) => e.id === opts.focusId);
    if (f) return f.id;
  }

  let localBest: { id: UnitId; score: number } | null = null;
  for (const e of legal) {
    const s = scoreOf(e, false);
    if (!localBest || s > localBest.score) localBest = { id: e.id, score: s };
  }
  if (!localBest) return null;

  // exp roles: divers and the front line play their own target, not the call.
  const ownsTarget = !!opts.tf?.roles && (isDiver(self) || isFrontline(self));
  if (opts.focusId && !ownsTarget) {
    const focusUnit = legal.find((e) => e.id === opts.focusId);
    if (focusUnit) {
      const callScore = scoreOf(focusUnit, true);
      const tw = opts.teamwork ?? self.attrs.teamwork;
      if (shouldFollowFocus(callScore, localBest.score, tw)) return focusUnit.id;
    }
  }

  if (opts.currentTarget && localBest.id !== opts.currentTarget) {
    const cur = legal.find((e) => e.id === opts.currentTarget);
    if (cur) {
      const currentScore = scoreOf(cur, cur.id === opts.focusId);
      if (localBest.score < currentScore * 1.4) return opts.currentTarget;
    }
  }
  return localBest.id;
}
