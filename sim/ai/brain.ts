/**
 * L2 Unit Brain — intents, chase / chase-stop, WalkFromPad (§9.4, §9.6).
 */
import type { Constants } from "../constants.js";
import { inOwnSanctuary } from "../map.js";
import { hasMark } from "../marks.js";
import { hasKind, isBanished, isLocked, isTimeStopped } from "../status.js";
import type { MatchState, UnitId, UnitState } from "../types.js";
import { effExecution, holdDist, kiteSlackTiles, rHoldA, rHoldHp } from "./attributes.js";
import { estTtk } from "./dps.js";
import type { CommitKind } from "./fight.js";
import { pickUnitTarget } from "./target.js";

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
  /** Sim time when this chase opened (for ttk-stop observation window). */
  start_t?: number;
  /** After a leash/ttk/sanctuary stop, do not re-chase this target until cleared. */
  leashed?: boolean;
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
  // §9.4 L1143: stop when est_ttk > CHASE_TTK_STOP (no deferred window).
  if (ttk > c.CHASE_TTK_STOP && !lockIncoming) {
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
    /** Fight A_true for this unit's team (hold_R gate, §12 L1357). */
    aTrue?: number;
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

  // WalkFromPad: leave own sanctuary within 1.5 s of respawn only (§9.6 L1164).
  // Match-start spawn leaves walk_from_pad_until at 0 — stay put on the pad
  // (do not Hunt/Approach out; unused default slots must not flood S1/S2 labs).
  if (inOwnSanctuary(u.team, u.x, u.y, opts.c)) {
    if (state.t <= u.walk_from_pad_until + 1e-9 && u.walk_from_pad_until > 0) {
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
    return { intent: "Idle", target_id: null, waypoint: null, chase: null, cast: null };
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
  // Hunt: any living non-sanctuary enemy is a legal body (reach never 0 — R #4).
  // Do not require senseR contact before walking in.
  const huntEnemy =
    opts.tactic === "hunt" &&
    state.units.some(
      (e) =>
        e.alive &&
        e.team !== u.team &&
        !isBanished(e.status) &&
        !inOwnSanctuary(e.team, e.x, e.y, opts.c),
    );
  let effectiveCommit: CommitKind = opts.commit;
  if (opts.commit === "hold" && opts.tactic === "hunt" && (nearEnemy || huntEnemy)) {
    effectiveCommit = "engage";
  }
  // Hunt keeps engage while a far legal body exists; other presets drop to hold
  // once the local sense ring is empty.
  if (opts.commit === "engage" && !nearEnemy && opts.tactic !== "hunt") {
    effectiveCommit = "hold";
  }

  // R #4 S2-R4-2 L1926: a disengage call is always followed. Retreat precedes
  // offensive execution casts and auto windups (Peel / locked / hex already
  // returned above).
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

  if (!opts.peeling && !nearEnemy && !huntEnemy) {
    return { intent: "Idle", target_id: null, waypoint: null, chase: null, cast: null };
  }

  // Hold pose while an auto windup is in progress (missile spawns from fire pose).
  if (u.auto_windup_left > 1e-12) {
    return {
      intent: "Engage",
      target_id: u.auto_windup_target,
      waypoint: null,
      chase: opts.chase,
      cast: null,
    };
  }

  // Outside a Fight Call:
  // - Hunt / engage commit: still chase & hold_dist (chase-stop suite is 1v1).
  // - Otherwise keep authored poses for scripted S1 labs (autos off → Idle;
  //   first AA from stand so OQ-7 distance holds; then Positioning may kite).
  if (opts.fightIds.length === 0 && !opts.peeling) {
    const huntOrEngage = opts.tactic === "hunt" || effectiveCommit === "engage";
    if (!huntOrEngage) {
      const autosOn = u.auto_next_start_t < 900;
      if (!autosOn) {
        return { intent: "Idle", target_id: null, waypoint: null, chase: null, cast: null };
      }
      if (!u.ai_first_auto_done) {
        const aa = state.units.find(
          (e) =>
            e.alive &&
            e.team !== u.team &&
            !isBanished(e.status) &&
            dist(u.x, u.y, e.x, e.y) <= u.stats.range,
        );
        if (aa) {
          return {
            intent: "Engage",
            target_id: aa.id,
            waypoint: null,
            chase: null,
            cast: null,
          };
        }
        return { intent: "Idle", target_id: null, waypoint: null, chase: null, cast: null };
      }
    }
  }

  const enemies = state.units.filter(
    (e) => e.alive && e.team !== u.team && !isBanished(e.status) && opts.fightIds.includes(e.id),
  );
  const allEnemies = state.units.filter((e) => e.alive && e.team !== u.team && !isBanished(e.status));
  const pool = enemies.length > 0 ? enemies : allEnemies;

  // R #4 Teamwork: follow focus via call_score vs local_score threshold (not a hard ≥50 stick).
  // Focus dead / illegal → pickUnitTarget falls through to local best.
  const targetId = pickUnitTarget(u, pool, {
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
    commitDisengage: opts.commit === "disengage",
  });

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
  // Open chase tracking only inside FIGHT_RADIUS (or an active fight). Far Hunt
  // walk-ins use Approach without the §9.4 ttk leash — otherwise est_ttk > 2
  // would Idle before the unit ever moves (R #4 far-body acquisition).
  const inChaseBand = d <= opts.c.FIGHT_RADIUS || opts.fightIds.length > 0;
  if (!chase || chase.target_id !== targetId || chase.leashed) {
    if (effectiveCommit === "engage" && d > u.stats.range && !chase?.leashed && inChaseBand) {
      chase = { target_id: targetId, start_x: u.x, start_y: u.y, start_t: state.t };
    } else if (chase?.leashed && chase.target_id !== targetId && inChaseBand) {
      chase = { target_id: targetId, start_x: u.x, start_y: u.y, start_t: state.t };
    } else if (!chase || chase.target_id !== targetId) {
      chase = inChaseBand ? chase : null;
      if (!inChaseBand) chase = null;
    }
  }

  if (chase && chase.target_id === targetId) {
    // TTK stop only after chase has begun (suite: begin, then stop within 1 s).
    // No multi-tick grace — tip's ticks>=5 / 0.5 s delay was test-tuned (remove).
    const continuing =
      !!opts.chase && opts.chase.target_id === targetId && !opts.chase.leashed;
    const stop = chaseShouldStop(u, target, chase, opts.c, ttk, false);
    if (stop.stop && (stop.reason !== "ttk" || continuing)) {
      const stopped = {
        target_id: targetId,
        start_x: chase.start_x,
        start_y: chase.start_y,
        start_t: chase.start_t,
        leashed: true,
      };
      return { intent: "Idle", target_id: targetId, waypoint: null, chase: stopped, cast: null };
    }
  }

  if (effectiveCommit === "engage" && d > u.stats.range) {
    if (chase) {
      return {
        intent: "Chase",
        target_id: targetId,
        waypoint: { x: target.x, y: target.y },
        chase,
        cast: null,
      };
    }
    // Hunt / engage acquisition outside the chase band — walk in (reach never 0).
    return {
      intent: "Approach",
      target_id: targetId,
      waypoint: { x: target.x, y: target.y },
      chase: null,
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

  // Backliners always seek the Positioning hold_dist ring (§8.4 L1025).
  if (u.stats.range > 2) {
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
 * hold_R: suppress R while a_true < 0.55 (§12 L1357 / suite) and focus HP% > rHoldHp;
 * also respects Execution rHoldA when A_true is provided.
 */
function chooseExecutionCast(
  state: MatchState,
  u: UnitState,
  opts: {
    c: Constants;
    focusId: UnitId | null;
    comboStyle?: "auto" | "hold_R";
    commit?: CommitKind;
    aTrue?: number;
    fightIds?: UnitId[];
  },
): { skill: "Q" | "W" | "R"; target_id: UnitId | null } | null {
  if (u.champ !== "kerrig" && u.champ !== "huntress") return null;
  if (u.cast_left > 0) return null;
  const ex = effExecution(u.attrs, u.mastery, opts.c);
  const focusFoe =
    opts.focusId && state.units.find((x) => x.id === opts.focusId && x.alive && !isBanished(x.status));
  // Prefer focus; else nearest living non-sanctuary enemy (not "first in unit array").
  let foe = focusFoe || null;
  if (!foe) {
    let bestD = Infinity;
    for (const x of state.units) {
      if (!x.alive || x.team === u.team || isBanished(x.status)) continue;
      if (inOwnSanctuary(x.team, x.x, x.y, opts.c)) continue;
      const d = dist(u.x, u.y, x.x, x.y);
      if (d < bestD) {
        bestD = d;
        foe = x;
      }
    }
  }
  if (!foe) return null;

  const aTrue = opts.aTrue ?? 0.5;
  const focusHpFrac = foe.hp / Math.max(1, foe.max_hp);

  // §12 L1357 / L1007: coach hold_R holds until A_true ≥ 0.55 or Focus below 40%.
  if (opts.comboStyle === "hold_R" && u.cd_r <= 1e-9 && u.level >= 5) {
    if (aTrue < 0.55 - 1e-9 && focusHpFrac > 0.4 - 1e-9) {
      return null;
    }
  }

  const marked = hasMark(foe.marks, u.champ === "kerrig" ? "kerrig" : "huntress", state.t);
  if (u.cd_r <= 1e-9 && u.level >= 5) {
    if (ex >= 45) {
      // §8.4 L1007: auto holds the mark-gated finisher until A_true / Focus HP gates.
      if (
        (opts.comboStyle === "auto" || opts.comboStyle === undefined) &&
        aTrue < rHoldA(ex) - 1e-9 &&
        focusHpFrac > rHoldHp(ex) - 1e-9
      ) {
        return null;
      }
      if (marked) return { skill: "R", target_id: foe.id };
      return null;
    }
    // L998: low Execution fires R without a mark once Q is on CD (may fizzle).
    if (u.cd_q > 0.5) return { skill: "R", target_id: foe.id };
  }
  return null;
}
