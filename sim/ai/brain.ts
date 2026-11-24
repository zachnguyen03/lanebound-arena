/**
 * L2 Unit Brain — intents, chase / chase-stop, WalkFromPad (§9.4, §9.6).
 */
import type { Constants } from "../constants.js";
import { inOwnSanctuary } from "../map.js";
import { hasKind, isBanished, isLocked, isTimeStopped } from "../status.js";
import type { MatchState, UnitId, UnitState } from "../types.js";
import { isFrontline } from "./target.js";
import { retreatImmobile } from "../retreat_combat.js";
import { effExecution, holdDist, kiteSlackTiles } from "./attributes.js";
import {
  castGatesClear,
  evaluateCastPolicy,
  type CastMemory,
  type CastProposal,
  type KitCastPolicy,
} from "./cast_policy.js";
import { estTtk } from "./dps.js";
import type { CommitKind } from "./fight.js";
import {
  atPlannerWaypoint,
  isLabParked,
  planObjective,
  roverPrey,
  roverDetached,
  roverOutnumbered,
} from "./planner.js";
import { pickUnitTarget } from "./target.js";
import { dodgeWaypoint, lowHpRetreat, rangedHoldWaypoint, ultWorthIt } from "./round3.js";

export type IntentName =
  | "HoldZone"
  | "CollectOrb"
  | "TakeBuff"
  | "Approach"
  | "Kite"
  | "Engage"
  | "Cast"
  | "Chase"
  | "Peel"
  | "Retreat"
  | "Regroup"
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

/**
 * exp/teamfight-dynamics chase relax (not build spec): multiplier on the chase
 * leash and TTK stop. ×2 on a target under 35% HP, ×1.5 more with an ally
 * within 4 tiles of the target. 1 when the flag is off.
 */
export function chaseRelax(state: MatchState, u: UnitState, target: UnitState): number {
  const tf = state.config?.teamfight;
  // Formation: the front line's job is to walk in first; a tank-vs-tank TTK
  // stop would idle it and deadlock a backline that waits behind it.
  const front = tf?.formation && isFrontline(u) ? Number.POSITIVE_INFINITY : 1;
  if (!tf?.chase) return front;
  let m = front;
  if (target.hp / Math.max(1, target.max_hp) < 0.35) m *= 2;
  const ally = state.units.some(
    (a) => a.alive && a.team === u.team && a.id !== u.id && dist(a.x, a.y, target.x, target.y) <= 4 + 1e-9,
  );
  if (ally) m *= 1.5;
  return m;
}

export function chaseShouldStop(
  chaser: UnitState,
  target: UnitState,
  chase: ChaseState,
  c: Constants,
  ttk: number,
  lockIncoming: boolean,
  relax = 1,
): { stop: boolean; reason: "sanctuary" | "leash" | "ttk" | null } {
  if (inOwnSanctuary(target.team, target.x, target.y, c)) {
    return { stop: true, reason: "sanctuary" };
  }
  const travelled = dist(chaser.x, chaser.y, chase.start_x, chase.start_y);
  if (travelled >= c.CHASE_LEASH * Math.min(relax, 1.5)) return { stop: true, reason: "leash" };
  // §9.4 L1143: stop when est_ttk > CHASE_TTK_STOP (no deferred window).
  if (ttk > c.CHASE_TTK_STOP * relax && !lockIncoming) {
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
    /** Test-only policy table override; production omits (uses CAST_POLICIES). */
    castPolicyTable?: Readonly<Record<string, KitCastPolicy>>;
    seenAt?: Partial<Record<string, number>>;
    ignorePerception?: boolean;
    castMemory?: CastMemory;
  },
): {
  intent: IntentName;
  target_id: UnitId | null;
  waypoint: { x: number; y: number } | null;
  chase: ChaseState | null;
  cast: CastProposal | null;
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

  // WalkFromPad is respawn-only (§9.6 L1166) and wins over lab-park Idle,
  // disengage Retreat, and sanctuary planner so a respawn can leave the pad
  // (otherwise Retreat↔WalkFromPad oscillates every tick).
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

  // Lab-parked unused pads (auto_next_start_t ≥ 900) stay Idle.
  // Live match-start units follow the §9.2 planner. §9.2 L1115: during
  // disengage / regroup_s / the 1 s no-trickle window, do not planner-walk
  // back out of the pad into HoldZone.
  if (inOwnSanctuary(u.team, u.x, u.y, opts.c)) {
    if (isLabParked(u)) {
      return { intent: "Idle", target_id: null, waypoint: null, chase: null, cast: null };
    }
    const pad = u.team === "blue" ? opts.c.BLUE_SPAWN : opts.c.RED_SPAWN;
    const holdPad =
      opts.commit === "disengage" ||
      state.t <= u.ai_retreat_suppress_until + 1e-9 ||
      state.t <= u.ai_no_trickle_until + 1e-9;
    if (holdPad) {
      return {
        intent:
          opts.commit === "disengage" && state.t > u.ai_no_trickle_until + 1e-9
            ? "Idle"
            : "Retreat",
        target_id: null,
        waypoint: { x: pad[0]!, y: pad[1]! },
        chase: null,
        cast: null,
      };
    }
    const plan = planObjective(state, u, opts.tactic, opts.c);
    if (plan && !atPlannerWaypoint(u, plan.waypoint)) {
      u.ai_at_planner_wp = false;
      return {
        intent: plan.intent,
        target_id: null,
        waypoint: plan.waypoint,
        chase: null,
        cast: null,
      };
    }
    if (plan) u.ai_at_planner_wp = true;
  }

  if (isLocked(u.status) || isTimeStopped(u.status) || isBanished(u.status)) {
    return { intent: "Idle", target_id: null, waypoint: null, chase: opts.chase, cast: null };
  }

  if (opts.peeling && opts.peelDiverId) {
    const diver = state.units.find((x) => x.id === opts.peelDiverId);
    if (diver && diver.alive) {
      const p1Only = opts.commit === "disengage" && !retreatImmobile(u, opts.c);
      const cast = chooseExecutionCast(state, u, opts, p1Only);
      return {
        intent: "Peel",
        target_id: diver.id,
        waypoint: { x: diver.x, y: diver.y },
        chase: null,
        cast,
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
  // exp/orb-buff-cadence: a rover that meets an enemy it is not outnumbered by
  // takes the skirmish instead of standing off under a Hold call.
  if (opts.commit === "disengage" && roverDetached(state, u) && !roverOutnumbered(state, u)) {
    effectiveCommit = "hold";
  }
  if (effectiveCommit === "hold" && nearEnemy && roverPrey(state, u)) {
    effectiveCommit = "engage";
  }
  // Hunt keeps engage while a far legal body exists; other presets drop to hold
  // once the local sense ring is empty.
  if (opts.commit === "engage" && !nearEnemy && opts.tactic !== "hunt") {
    effectiveCommit = "hold";
  }

  // R #4 S2-R4-2 L1926: a disengage call is always followed. Retreat precedes
  // offensive execution casts and auto windups (Peel / locked / hex already
  // returned above). S2-R4-5: immobile exception — keep Retreat, but name an
  // in-range foe so autos/casts are not starved (same retreatImmobile predicate).
  if (effectiveCommit === "disengage") {
    const pad = u.team === "blue" ? opts.c.BLUE_SPAWN : opts.c.RED_SPAWN;
    const atPad = dist(u.x, u.y, pad[0]!, pad[1]!) <= 1.0 + 1e-9;
    // §9.2: open the 1 s no-trickle window once per retreat march.
    if (!atPad && u.ai_no_trickle_until < state.t - 1e-9) {
      u.ai_no_trickle_until = state.t + 1.0;
    }
    if (
      atPad &&
      state.t > u.ai_no_trickle_until + 1e-9 &&
      state.t > u.ai_retreat_suppress_until + 1e-9
    ) {
      return { intent: "Idle", target_id: null, waypoint: null, chase: null, cast: null };
    }
    if (!retreatImmobile(u, opts.c)) {
      const cast = chooseExecutionCast(state, u, opts, true);
      return {
        intent: "Retreat",
        target_id: cast?.target_id ?? null,
        waypoint: { x: pad[0]!, y: pad[1]! },
        chase: null,
        cast,
      };
    }
    const immobileCast = chooseExecutionCast(state, u, opts, false);
    if (immobileCast) {
      return {
        intent: "Retreat",
        target_id: immobileCast.target_id,
        waypoint: { x: pad[0]!, y: pad[1]! },
        chase: null,
        cast: immobileCast,
      };
    }
    let inRange: UnitState | null = null;
    let bestD = Infinity;
    for (const e of state.units) {
      if (!e.alive || e.team === u.team || isBanished(e.status)) continue;
      const d = dist(u.x, u.y, e.x, e.y);
      if (d > u.stats.range + 1e-9) continue;
      if (d < bestD) {
        bestD = d;
        inRange = e;
      }
    }
    return {
      intent: "Retreat",
      target_id: inRange?.id ?? null,
      waypoint: { x: pad[0]!, y: pad[1]! },
      chase: null,
      cast: null,
    };
  }

  // Round 3: dodge a winding-up enemy area cast; low-HP units walk home.
  const dodge = dodgeWaypoint(state, u);
  if (dodge) {
    return { intent: "Kite", target_id: null, waypoint: dodge, chase: null, cast: chooseExecutionCast(state, u, opts) };
  }
  if (lowHpRetreat(state, u)) {
    const pad = u.team === "blue" ? opts.c.BLUE_SPAWN : opts.c.RED_SPAWN;
    const cast = chooseExecutionCast(state, u, opts, true);
    return { intent: "Retreat", target_id: cast?.target_id ?? null, waypoint: { x: pad[0]!, y: pad[1]! }, chase: null, cast };
  }

  // Casts ride the movement intent. Replacing it with Cast dropped the chase
  // leash (§9.4) and the Hold melee Approach. beginCast still fires because
  // the tick compares intent to this same decision.
  const cast = chooseExecutionCast(state, u, opts);

  if (!opts.peeling && !nearEnemy && !huntEnemy) {
    const plan = planObjective(state, u, opts.tactic, opts.c);
    if (plan) {
      const at = atPlannerWaypoint(u, plan.waypoint);
      u.ai_at_planner_wp = at;
      if (!at) {
        return {
          intent: plan.intent,
          target_id: null,
          waypoint: plan.waypoint,
          chase: null,
          cast,
        };
      }
    }
    return { intent: "Idle", target_id: null, waypoint: null, chase: null, cast };
  }

  // Hold pose while an auto windup is in progress (missile spawns from fire pose).
  if (u.auto_windup_left > 1e-12) {
    return {
      intent: "Engage",
      target_id: u.auto_windup_target,
      waypoint: null,
      chase: opts.chase,
      cast,
    };
  }

  // Outside a Fight Call:
  // - Hunt / engage commit: still chase & hold_dist (chase-stop suite is 1v1).
  // - Lab-parked slots stay Idle. Live units with an in-range foe take the first
  //   AA from stand; otherwise fall through to Positioning / kite. Far-away
  //   planner walks are handled above when !nearEnemy.
  if (opts.fightIds.length === 0 && !opts.peeling) {
    const huntOrEngage = opts.tactic === "hunt" || effectiveCommit === "engage";
    if (!huntOrEngage) {
      if (isLabParked(u)) {
        return { intent: "Idle", target_id: null, waypoint: null, chase: null, cast };
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
            cast,
          };
        }
        return { intent: "Idle", target_id: null, waypoint: null, chase: null, cast };
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
    tf: state.config?.teamfight,
  });

  if (!targetId) {
    return { intent: "Idle", target_id: null, waypoint: null, chase: null, cast };
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
      return { intent: "Idle", target_id: targetId, waypoint: null, chase, cast };
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
    const stop = chaseShouldStop(u, target, chase, opts.c, ttk, false, chaseRelax(state, u, target));
    if (stop.stop && (stop.reason !== "ttk" || continuing)) {
      const stopped = {
        target_id: targetId,
        start_x: chase.start_x,
        start_y: chase.start_y,
        start_t: chase.start_t,
        leashed: true,
      };
      return { intent: "Idle", target_id: targetId, waypoint: null, chase: stopped, cast };
    }
  }

  const hold = rangedHoldWaypoint(state, u, target, effectiveCommit === "engage");
  if (hold) {
    return { intent: d > u.stats.range ? "Approach" : "Kite", target_id: targetId, waypoint: hold, chase, cast };
  }

  if (effectiveCommit === "engage" && d > u.stats.range) {
    if (chase) {
      return {
        intent: "Chase",
        target_id: targetId,
        waypoint: { x: target.x, y: target.y },
        chase,
        cast,
      };
    }
    // Hunt / engage acquisition outside the chase band — walk in (reach never 0).
    return {
      intent: "Approach",
      target_id: targetId,
      waypoint: { x: target.x, y: target.y },
      chase: null,
      cast,
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
  // Hold + melee in a team fight (≥2 allies in fightIds): close into AA range.
  // Approach (not Chase) so the §9.4 ttk leash cannot Idle them at the ring
  // (S4/S5 even-Hold melee idling). Do NOT Approach in 1v1 / no-fight — that
  // collapses Positioning hold_dist on a kiting backliner (§8.4 L1025).
  if (effectiveCommit === "hold" && alliesInFight >= 2 && u.stats.range <= 2) {
    if (d <= u.stats.range + 0.3) {
      return { intent: "Engage", target_id: targetId, waypoint: null, chase: keepChase, cast };
    }
    return {
      intent: "Approach",
      target_id: targetId,
      waypoint: { x: target.x, y: target.y },
      chase: keepChase,
      cast,
    };
  }

  // Backliners always seek the Positioning hold_dist ring (§8.4 L1025).
  if (u.stats.range > 2) {
    if (d < hd - 0.05 || (target.stats.range <= 2 && d < hd + 0.35)) {
      return {
        intent: "Kite",
        target_id: targetId,
        waypoint: ringWaypoint(),
        chase: keepChase,
        cast,
      };
    }
    if (d > hd + Math.max(0.25, slack * 0.5)) {
      return {
        intent: effectiveCommit === "engage" ? "Approach" : "Kite",
        target_id: targetId,
        waypoint: ringWaypoint(),
        chase: keepChase,
        cast,
      };
    }
    return { intent: "Engage", target_id: targetId, waypoint: null, chase: keepChase, cast };
  }

  // Melee under Hold outside a team fight: AA if in range, otherwise stand.
  if (effectiveCommit === "hold" && u.stats.range <= 2) {
    if (d <= u.stats.range + 0.3) {
      return { intent: "Engage", target_id: targetId, waypoint: null, chase: keepChase, cast };
    }
    return { intent: "Idle", target_id: targetId, waypoint: null, chase: keepChase, cast };
  }

  if (d > hd + 0.3) {
    return {
      intent: effectiveCommit === "engage" ? "Approach" : "Kite",
      target_id: targetId,
      waypoint: { x: target.x, y: target.y },
      chase: keepChase,
      cast,
    };
  }

  return { intent: "Engage", target_id: targetId, waypoint: null, chase: keepChase, cast };
}

/**
 * §9.4.1 casts. A test `table` keeps the old Q→W→R stub. Production uses
 * CAST_POLICIES, including the Kerrig / Huntress mark gate.
 */
function chooseExecutionCast(
  state: MatchState,
  u: UnitState,
  opts: {
    c: Constants;
    focusId: UnitId | null;
    peelDiverId?: UnitId | null;
    comboStyle?: "auto" | "hold_R";
    commit?: CommitKind;
    aTrue?: number;
    fightIds?: UnitId[];
    tactic?: "hold_the_pit" | "hunt" | "starve";
    intentTarget?: Partial<Record<UnitId, UnitId | null>>;
    peeling?: boolean;
    chase?: ChaseState | null;
    castPolicyTable?: Readonly<Record<string, KitCastPolicy>>;
    seenAt?: Partial<Record<string, number>>;
    ignorePerception?: boolean;
    castMemory?: CastMemory;
  },
  p1Only = false,
): CastProposal | null {
  if (!castGatesClear(u, opts.c)) return null;
  const p = evaluateCastPolicy(state, u, {
    c: opts.c,
    focusId: opts.focusId,
    peelDiverId: opts.peelDiverId ?? null,
    commit: opts.commit,
    table: opts.castPolicyTable,
    aTrue: opts.aTrue,
    tactic: opts.tactic,
    fightIds: opts.fightIds,
    intentTarget: opts.intentTarget,
    comboStyle: opts.comboStyle,
    seenAt: opts.seenAt,
    ignorePerception: opts.ignorePerception,
    memory: opts.castMemory,
    peeling: opts.peeling,
    currentTarget: opts.chase?.target_id ?? null,
    p1Only,
  });
  return p && !ultWorthIt(state, u, p) ? null : p;
}
