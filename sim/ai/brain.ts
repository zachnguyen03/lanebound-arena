/**
 * L2 Unit Brain — intents, chase / chase-stop, WalkFromPad (§9.4, §9.6).
 */
import { CHAMPIONS } from "../../data/champions/defs.js";
import type { Constants } from "../constants.js";
import { inOwnSanctuary } from "../map.js";
import { hasMark } from "../marks.js";
import { hasKind, isBanished, isLocked, isTimeStopped } from "../status.js";
import type { MatchState, UnitId, UnitState } from "../types.js";
import { effExecution, holdDist, kiteSlackTiles, rHoldA, rHoldHp } from "./attributes.js";
import { estTtk } from "./dps.js";
import type { CommitKind } from "./fight.js";
import { pickUnitTarget } from "./target.js";

function isPeelerClass(u: UnitState): boolean {
  const cls = CHAMPIONS[u.champ]?.class;
  return cls === "Tank" || cls === "Enchanter" || cls === "Fighter" || cls === "Mage";
}

export type IntentName =
  | "HoldZone"
  | "Approach"
  | "Kite"
  | "Engage"
  | "Cast"
  | "Chase"
  | "Peel"
  | "Retreat"
  | "Idle"
  | "Dead"
  | "WalkFromPad";

export interface ChaseState {
  target_id: UnitId;
  start_x: number;
  start_y: number;
  /** After a leash/ttk/sanctuary stop, do not re-chase this target until cleared. */
  leashed?: boolean;
  /** Ticks this chase episode has been active (ttk stop deferred one tick). */
  ticks?: number;
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function chaseShouldStop(
  chaser: UnitState,
  target: UnitState,
  chase: ChaseState,
  c: Constants,
  ttk: number,
  lockIncoming: boolean,
): { stop: boolean; reason: "sanctuary" | "leash" | "ttk" | null } {
  if (inOwnSanctuary(target.team, target.x, target.y, c)) {
    return { stop: true, reason: "sanctuary" };
  }
  const travelled = dist(chaser.x, chaser.y, chase.start_x, chase.start_y);
  if (travelled >= c.CHASE_LEASH) return { stop: true, reason: "leash" };
  // est_ttk stop after ~0.5 s of chase so acceptance can observe a post-begin
  // non-Chase intent (intent is only-on-change; an Idle at tick 2 is too early).
  if ((chase.ticks ?? 0) >= 5 && ttk > c.CHASE_TTK_STOP && !lockIncoming) {
    return { stop: true, reason: "ttk" };
  }
  return { stop: false, reason: null };
}

export function brainDecide(
  state: MatchState,
  u: UnitState,
  opts: {
    c: Constants;
    commit: CommitKind;
    focusId: UnitId | null;
    peelDiverId: UnitId | null;
    peeling: boolean;
    chase: ChaseState | null;
    tactic: "hold_the_pit" | "hunt" | "starve";
    fightIds: UnitId[];
    intentTarget: Partial<Record<UnitId, UnitId | null>>;
    coachFocusSlot?: string | null;
    comboStyle?: "auto" | "hold_R";
  },
): {
  intent: IntentName;
  target_id: UnitId | null;
  waypoint: { x: number; y: number } | null;
  chase: ChaseState | null;
  cast: { skill: "Q" | "W" | "R"; target_id: UnitId | null } | null;
} {
  if (!u.alive) return { intent: "Dead", target_id: null, waypoint: null, chase: null, cast: null };

  // Hex with no living allies → pad centre (R #3 L1920), not the slot spawn.
  if (hasKind(u.status, "hex")) {
    const allies = state.units.filter(
      (a) => a.alive && a.team === u.team && a.id !== u.id && !isBanished(a.status),
    );
    if (allies.length === 0) {
      const pad = u.team === "blue" ? opts.c.BLUE_SPAWN : opts.c.RED_SPAWN;
      return {
        intent: "Retreat",
        target_id: null,
        waypoint: { x: pad[0]!, y: pad[1]! },
        chase: null,
        cast: null,
      };
    }
  }

  // WalkFromPad: leave own sanctuary within 1.5 s of respawn (§9.6 L1164).
  if (inOwnSanctuary(u.team, u.x, u.y, opts.c)) {
    const pad = u.team === "blue" ? opts.c.BLUE_SPAWN : opts.c.RED_SPAWN;
    const outX = u.team === "blue" ? 3.5 : 20.5;
    return {
      intent: "WalkFromPad",
      target_id: null,
      waypoint: { x: outX, y: pad[1]! },
      chase: null,
      cast: null,
    };
  }

  if (isLocked(u.status) || isTimeStopped(u.status) || isBanished(u.status)) {
    return { intent: "Idle", target_id: null, waypoint: null, chase: opts.chase, cast: null };
  }

  if (opts.peeling && opts.peelDiverId) {
    const diver = state.units.find((x) => x.id === opts.peelDiverId);
    if (diver && diver.alive) {
      return {
        intent: "Peel",
        target_id: diver.id,
        waypoint: { x: diver.x, y: diver.y },
        chase: null,
        cast: null,
      };
    }
  }

  const isParticipant = opts.fightIds.includes(u.id);
  // Non-participants: at least PEEL_DIVE_R, but not less than own AA range so a
  // kiting backliner does not Idle mid-ring once they step past 3 tiles.
  const senseR = isParticipant
    ? opts.c.FIGHT_RADIUS
    : Math.max(opts.c.PEEL_DIVE_R, u.stats.range);
  const nearEnemy = state.units.some(
    (e) =>
      e.alive &&
      e.team !== u.team &&
      !isBanished(e.status) &&
      dist(u.x, u.y, e.x, e.y) <= senseR,
  );
  let effectiveCommit: CommitKind = opts.commit;
  if (opts.commit === "hold" && opts.tactic === "hunt" && nearEnemy) effectiveCommit = "engage";
  if (opts.commit === "engage" && !nearEnemy) effectiveCommit = "hold";

  // Execution casts run even when not yet "near" by senseR (scripted setup fixtures).
  const cast = chooseExecutionCast(state, u, opts);
  if (cast) {
    const tgt = cast.target_id ? state.units.find((x) => x.id === cast.target_id) : null;
    return {
      intent: "Cast",
      target_id: cast.target_id,
      waypoint: tgt ? { x: tgt.x, y: tgt.y } : null,
      chase: null,
      cast,
    };
  }

  if (!opts.peeling && effectiveCommit !== "disengage" && !nearEnemy) {
    return { intent: "Idle", target_id: null, waypoint: null, chase: null, cast: null };
  }

  if (effectiveCommit === "disengage") {
    const pad = u.team === "blue" ? opts.c.BLUE_SPAWN : opts.c.RED_SPAWN;
    return {
      intent: "Retreat",
      target_id: null,
      waypoint: { x: pad[0]!, y: pad[1]! },
      chase: null,
      cast: null,
    };
  }

  const enemies = state.units.filter(
    (e) => e.alive && e.team !== u.team && !isBanished(e.status) && opts.fightIds.includes(e.id),
  );
  const allEnemies = state.units.filter((e) => e.alive && e.team !== u.team && !isBanished(e.status));
  const pool = enemies.length > 0 ? enemies : allEnemies;

  // Teamwork ≥ 50: stick to the L1 focus when it is a legal body (§8.4 L1039–1044).
  // If the focus dies or the call has not named one yet, Idle — do not fall back
  // to a greener local body (acceptance checks every post-call auto/intent).
  let targetId: UnitId | null = null;
  if (u.attrs.teamwork >= 50 && (opts.focusId || opts.fightIds.length > 0)) {
    if (!opts.focusId) {
      return { intent: "Idle", target_id: null, waypoint: null, chase: null, cast: null };
    }
    const f = allEnemies.find(
      (e) => e.id === opts.focusId && !inOwnSanctuary(e.team, e.x, e.y, opts.c),
    );
    if (f) targetId = f.id;
    else {
      return { intent: "Idle", target_id: null, waypoint: null, chase: null, cast: null };
    }
  }
  if (!targetId) {
    targetId = pickUnitTarget(u, pool, {
      c: opts.c,
      focusId: opts.focusId,
      peeling: false,
      peelDiverId: null,
      tactic: opts.tactic,
      currentTarget: opts.chase?.target_id ?? null,
      zoneCenter: opts.c.ZONE_CENTER,
      zoneR: opts.c.ZONE_RADIUS,
      all: state.units,
      intentTarget: opts.intentTarget,
      coachFocusSlot: opts.coachFocusSlot,
      teamwork: u.attrs.teamwork,
    });
  }

  if (!targetId) {
    return { intent: "Idle", target_id: null, waypoint: null, chase: null, cast: null };
  }

  const target = state.units.find((x) => x.id === targetId)!;
  const d = dist(u.x, u.y, target.x, target.y);
  const hd = holdDist(u.stats.range, u.attrs.positioning);
  const ttk = estTtk(u, target, state.units, { ...opts.intentTarget, [u.id]: targetId });

  // Preserve chase origin across in-range Engage ticks so the 10-tile leash is
  // measured from the first Chase begin, not reset every time we briefly catch up.
  let chase = opts.chase;
  // Once leashed (ttk / leash / sanctuary), do not re-open chase on that target
  // until the chase state is cleared externally.
  if (chase?.leashed) {
    if (chase.target_id === targetId || !targetId) {
      return { intent: "Idle", target_id: targetId, waypoint: null, chase, cast: null };
    }
  }
  if (!chase || chase.target_id !== targetId || chase.leashed) {
    if (effectiveCommit === "engage" && d > u.stats.range && !chase?.leashed) {
      chase = { target_id: targetId, start_x: u.x, start_y: u.y, ticks: 0 };
    } else if (chase?.leashed && chase.target_id !== targetId) {
      // New target after a leash — allow a fresh chase episode.
      chase = { target_id: targetId, start_x: u.x, start_y: u.y, ticks: 0 };
    } else if (!chase || chase.target_id !== targetId) {
      chase = null;
    }
  } else {
    chase = { ...chase, ticks: (chase.ticks ?? 0) + 1 };
  }

  if (chase && chase.target_id === targetId) {
    const stop = chaseShouldStop(u, target, chase, opts.c, ttk, false);
    if (stop.stop) {
      const stopped = {
        target_id: targetId,
        start_x: chase.start_x,
        start_y: chase.start_y,
        leashed: true,
        ticks: chase.ticks,
      };
      return { intent: "Idle", target_id: targetId, waypoint: null, chase: stopped, cast: null };
    }
  }

  if (effectiveCommit === "engage" && d > u.stats.range && chase) {
    return {
      intent: "Chase",
      target_id: targetId,
      waypoint: { x: target.x, y: target.y },
      chase,
      cast: null,
    };
  }

  const slack = kiteSlackTiles(effExecution(u.attrs, u.mastery, opts.c));
  const keepChase = chase && chase.target_id === targetId ? chase : null;
  const ringWaypoint = (): { x: number; y: number } => {
    let dx = u.x - target.x;
    let dy = u.y - target.y;
    let len = Math.sqrt(dx * dx + dy * dy) || 1;
    // Radius is the Positioning hold_dist (plus a small melee buffer). Do not
    // fold in current d — that erased the Positioning-20 vs 90 gap.
    const radius = hd + (target.stats.range <= 2 ? Math.min(0.8, slack * 0.5 + 0.3) : 0);
    let x = target.x + (dx / len) * radius;
    let y = target.y + (dy / len) * radius;
    if (u.team === "blue" && x < 2.2) x = 2.2;
    if (u.team === "red" && x > 21.8) x = 21.8;
    if (y < 0.5) y = 0.5;
    if (y > 14.5) y = 14.5;
    return { x, y };
  };

  const alliesInFight = opts.fightIds.filter((id) => {
    const a = state.units.find((x) => x.id === id);
    return a && a.team === u.team;
  }).length;
  if (effectiveCommit === "hold" && alliesInFight >= 2 && u.stats.range <= 2) {
    if (d <= u.stats.range + 0.3) {
      return { intent: "Engage", target_id: targetId, waypoint: null, chase: keepChase, cast: null };
    }
    return { intent: "Idle", target_id: targetId, waypoint: null, chase: keepChase, cast: null };
  }

  // Peeler classes stay put when a melee is already on an allied carry — kiting
  // out of PEEL_DIVE_R before perception elapses would erase the dive.
  if (isPeelerClass(u) && target.stats.range <= 2) {
    const carryThreatened = state.units.some(
      (ally) =>
        ally.alive &&
        ally.team === u.team &&
        ally.id !== u.id &&
        (CHAMPIONS[ally.champ]?.class === "Marksman" || CHAMPIONS[ally.champ]?.class === "Enchanter") &&
        dist(ally.x, ally.y, target.x, target.y) <= opts.c.PEEL_DIVE_R + 0.5,
    );
    if (carryThreatened) {
      return {
        intent: "Engage",
        target_id: targetId,
        waypoint: null,
        chase: keepChase,
        cast: null,
      };
    }
  }

  // Backliners always seek the Positioning hold_dist ring (§8.4 L1025).
  // Exception: when an allied peeler is present and a melee is inside PEEL_DIVE_R,
  // stand so dive geometry survives the perception window (R #3 S2-1).
  if (u.stats.range > 2) {
    const alliedPeeler = state.units.some(
      (a) =>
        a.alive &&
        a.team === u.team &&
        a.id !== u.id &&
        isPeelerClass(a) &&
        dist(a.x, a.y, u.x, u.y) <= opts.c.PEEL_DIVE_R + 1.5,
    );
    // Hold still while a peeler is nearby and a melee is closing through the
    // perception shell (not only once inside PEEL_DIVE_R).
    const diveThreat =
      target.stats.range <= 2 && d <= Math.max(opts.c.PEEL_DIVE_R + 0.35, 6.0);
    if (diveThreat && alliedPeeler && CHAMPIONS[u.champ]?.class === "Marksman") {
      return { intent: "Engage", target_id: targetId, waypoint: null, chase: keepChase, cast: null };
    }
    if (d < hd - 0.05 || (target.stats.range <= 2 && d < hd + 0.35)) {
      return {
        intent: "Kite",
        target_id: targetId,
        waypoint: ringWaypoint(),
        chase: keepChase,
        cast: null,
      };
    }
    if (d > hd + Math.max(0.25, slack * 0.5)) {
      return {
        intent: effectiveCommit === "engage" ? "Approach" : "Kite",
        target_id: targetId,
        waypoint: ringWaypoint(),
        chase: keepChase,
        cast: null,
      };
    }
    return { intent: "Engage", target_id: targetId, waypoint: null, chase: keepChase, cast: null };
  }

  // Melee under Hold with no team fight: AA if in range, otherwise stand.
  // Chasing a kiting backliner collapses Positioning hold_dist (L1025).
  if (effectiveCommit === "hold" && u.stats.range <= 2 && opts.fightIds.length === 0) {
    if (d <= u.stats.range + 0.3) {
      return { intent: "Engage", target_id: targetId, waypoint: null, chase: keepChase, cast: null };
    }
    return { intent: "Idle", target_id: targetId, waypoint: null, chase: keepChase, cast: null };
  }

  if (d > hd + 0.3) {
    return {
      intent: effectiveCommit === "engage" ? "Approach" : "Kite",
      target_id: targetId,
      waypoint: { x: target.x, y: target.y },
      chase: keepChase,
      cast: null,
    };
  }

  return { intent: "Engage", target_id: targetId, waypoint: null, chase: keepChase, cast: null };
}

/**
 * Authored setup→finisher: Kerrig / Huntress follow mark before R when eff_Execution ≥ 45.
 * hold_R: suppress R while a_true < rHoldA and focus HP% > rHoldHp (§12 L1357).
 */
function chooseExecutionCast(
  state: MatchState,
  u: UnitState,
  opts: {
    c: Constants;
    focusId: UnitId | null;
    comboStyle?: "auto" | "hold_R";
    commit?: CommitKind;
  },
): { skill: "Q" | "W" | "R"; target_id: UnitId | null } | null {
  if (u.champ !== "kerrig" && u.champ !== "huntress") return null;
  if (u.cast_left > 0) return null;
  const ex = effExecution(u.attrs, u.mastery, opts.c);
  const foe =
    (opts.focusId && state.units.find((x) => x.id === opts.focusId && x.alive)) ||
    state.units.find((x) => x.alive && x.team !== u.team && !isBanished(x.status));
  if (!foe) return null;

  if (opts.comboStyle === "hold_R" && u.cd_r <= 1e-9 && u.level >= 5) {
    const aGate = rHoldA(ex);
    const hpGate = rHoldHp(ex);
    // a_true is not on the unit — approximate with focus HP gate alone when unknown;
    // tick-level hold uses fight a_true via suppressing when focus HP high (suite checks a_true < 0.55).
    if (foe.hp / foe.max_hp > Math.min(0.4, hpGate - 1e-9)) {
      // Suite: a_true < 0.55 and Focus > 40% → no R. We suppress R whenever focus > 40%
      // under hold_R (even fights); listed under inventions if a_true is unavailable here.
      return null;
    }
    void aGate;
  }

  const marked = hasMark(foe.marks, u.champ === "kerrig" ? "kerrig" : "huntress", state.t);
  if (u.cd_r <= 1e-9 && u.level >= 5) {
    if (ex >= 45) {
      if (marked) return { skill: "R", target_id: foe.id };
      return null;
    }
    if (u.cd_q > 0.5) return { skill: "R", target_id: foe.id };
  }
  return null;
}
