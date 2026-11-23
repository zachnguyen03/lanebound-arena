/**
 * S3 arena systems — zone, claims, orbs, buffs (Appendix R #5 / §5.5–5.8).
 * Phase 11 order (S3-R5-1): occupancy → bars → capture → timer/control/zone_seconds
 * → zone_tick → claim resolve → orb/buff spawn → pickup.
 */
import type { Constants } from "./constants.js";
import { isBanished, isTimeStopped } from "./status.js";
import type {
  MatchConfig,
  MatchState,
  Team,
  UnitId,
  UnitState,
} from "./types.js";

export type ZoneOwner = Team | null;

export interface ZoneState {
  owner: ZoneOwner;
  /** Internal bars in ticks 0..30. Public seconds = ticks/10. */
  progress_blue_ticks: number;
  progress_red_ticks: number;
  tick_timer_ticks: number;
  control_time_ticks: { blue: number; red: number };
  occupied: UnitId[];
  /** Previous-tick exclusive ownership for aura (S3-R5-7). */
  aura_owner: ZoneOwner;
  aura_exclusive: boolean;
  /** Previous-tick occupant ids (aura eligibility). */
  aura_occupied: UnitId[];
  /** Per-unit consecutive occupation ticks (claim dwell, S3-R5-8). */
  dwell: Partial<Record<UnitId, number>>;
  /** Per-unit raw occupant ticks (zone_seconds). */
  zone_ticks: Partial<Record<UnitId, number>>;
}

export interface ClaimState {
  team: Team;
  resolve_at: number;
  fight_id?: string;
}

export interface OrbPad {
  orb_id: string;
  x: number;
  y: number;
  up: boolean;
  respawn_at: number;
}

export interface BuffPad {
  buff_id: string;
  x: number;
  y: number;
  up: boolean;
  respawn_at: number;
  holders: UnitId[];
}

export interface ArenaRuntime {
  zone: ZoneState;
  claim: ClaimState | null;
  orbs: OrbPad[];
  buffs: BuffPad[];
  phase: "play" | "sudden_death" | "extra_15" | "ended";
  /** Level snapshot at tick start for catch-up (S3-R5-3). */
  level_snap: Partial<Record<UnitId, number>>;
  claim_denies: Partial<Record<UnitId, number>>;
  /** Buff expiry per holder. */
  buff_until: Partial<Record<UnitId, number>>;
}

const ORB_PAD_TILES: ReadonlyArray<readonly [number, number]> = [
  [2, 4],
  [2, 11],
  [21, 4],
  [21, 11],
  [8, 1],
  [15, 1],
  [8, 14],
  [15, 14],
];

function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function createArenaRuntime(c: Constants): ArenaRuntime {
  const orbs: OrbPad[] = ORB_PAD_TILES.map(([tx, ty], i) => ({
    orb_id: `orb:${i}`,
    x: tx + 0.5,
    y: ty + 0.5,
    up: false,
    respawn_at: c.ORB_FIRST_SPAWN_S,
  }));
  const buffs: BuffPad[] = c.BUFF_PADS.map((p, i) => ({
    buff_id: `buff:${i}`,
    x: p[0]!,
    y: p[1]!,
    up: false,
    respawn_at: c.BUFF_FIRST_SPAWN_S,
    holders: [],
  }));
  return {
    zone: {
      owner: null,
      progress_blue_ticks: 0,
      progress_red_ticks: 0,
      tick_timer_ticks: 0,
      control_time_ticks: { blue: 0, red: 0 },
      occupied: [],
      aura_owner: null,
      aura_exclusive: false,
      aura_occupied: [],
      dwell: {},
      zone_ticks: {},
    },
    claim: null,
    orbs,
    buffs,
    phase: "play",
    level_snap: {},
    claim_denies: {},
    buff_until: {},
  };
}

export function publicZone(z: ZoneState): {
  owner: ZoneOwner;
  progress_blue: number;
  progress_red: number;
  tick_timer: number;
  occupied: UnitId[];
  control_time: { blue: number; red: number };
} {
  return {
    owner: z.owner,
    progress_blue: z.progress_blue_ticks / 10,
    progress_red: z.progress_red_ticks / 10,
    tick_timer: z.tick_timer_ticks / 10,
    occupied: z.occupied.slice(),
    control_time: {
      blue: z.control_time_ticks.blue / 10,
      red: z.control_time_ticks.red / 10,
    },
  };
}

export function snapshotLevels(units: UnitState[], arena: ArenaRuntime): void {
  arena.level_snap = {};
  for (const u of units) {
    arena.level_snap[u.id] = u.level;
  }
}

export function catchupEligible(
  u: UnitState,
  units: UnitState[],
  arena: ArenaRuntime,
  c: Constants,
): boolean {
  const own = arena.level_snap[u.id] ?? u.level;
  let highest = 0;
  for (const e of units) {
    if (e.team === u.team) continue;
    const lv = arena.level_snap[e.id] ?? e.level;
    if (lv > highest) highest = lv;
  }
  return highest - own >= c.CATCHUP_GAP - 1e-12;
}

/** Living, not banished, dist ≤ ZONE_RADIUS (S3-R5-4). */
export function zoneOccupants(units: UnitState[], c: Constants): UnitState[] {
  const cx = c.ZONE_CENTER[0]!;
  const cy = c.ZONE_CENTER[1]!;
  const out: UnitState[] = [];
  for (const u of units) {
    if (!u.alive || isBanished(u.status)) continue;
    if (dist(u.x, u.y, cx, cy) <= c.ZONE_RADIUS + 1e-12) out.push(u);
  }
  return out;
}

function canPickup(u: UnitState): boolean {
  if (!u.alive) return false;
  if (isBanished(u.status) || isTimeStopped(u.status)) return false;
  return true;
}

export type EmitFn = (type: string, payload: Record<string, unknown>) => void;

/**
 * Phase 11 arena step. Mutates arena + scores. Returns whether a score event fired this tick
 * (for sudden-death / extra_15 tracking).
 */
export function tickArenaPhase11(
  state: MatchState,
  arena: ArenaRuntime,
  c: Constants,
  config: MatchConfig,
  emit: EmitFn,
): { scored: boolean } {
  let scored = false;
  const z = arena.zone;
  const occupants = zoneOccupants(state.units, c);
  z.occupied = occupants.map((u) => u.id);

  // Dwell + zone_seconds counters
  const occSet = new Set(z.occupied);
  for (const u of state.units) {
    if (occSet.has(u.id)) {
      z.dwell[u.id] = (z.dwell[u.id] ?? 0) + 1;
      z.zone_ticks[u.id] = (z.zone_ticks[u.id] ?? 0) + 1;
    } else {
      z.dwell[u.id] = 0;
    }
  }

  const blueOcc = occupants.filter((u) => u.team === "blue");
  const redOcc = occupants.filter((u) => u.team === "red");
  const exclusive: Team | null =
    blueOcc.length > 0 && redOcc.length === 0
      ? "blue"
      : redOcc.length > 0 && blueOcc.length === 0
        ? "red"
        : null;
  const contested = blueOcc.length > 0 && redOcc.length > 0;
  const empty = blueOcc.length === 0 && redOcc.length === 0;

  // Bars (S3-R5-1)
  if (exclusive) {
    if (exclusive === "blue") {
      if (z.owner !== "blue") z.progress_blue_ticks += 1;
      z.progress_red_ticks = Math.max(0, z.progress_red_ticks - 1);
    } else {
      if (z.owner !== "red") z.progress_red_ticks += 1;
      z.progress_blue_ticks = Math.max(0, z.progress_blue_ticks - 1);
    }
  } else if (empty) {
    z.progress_blue_ticks = Math.max(0, z.progress_blue_ticks - 1);
    z.progress_red_ticks = Math.max(0, z.progress_red_ticks - 1);
  }
  // contested: frozen

  // Owner's bar held at 0
  if (z.owner === "blue") z.progress_blue_ticks = 0;
  if (z.owner === "red") z.progress_red_ticks = 0;

  // Capture at 30
  const captureTicks = Math.round(c.ZONE_CAPTURE_S / c.DT);
  let captured: Team | null = null;
  if (z.progress_blue_ticks >= captureTicks && z.owner !== "blue") {
    captured = "blue";
  } else if (z.progress_red_ticks >= captureTicks && z.owner !== "red") {
    captured = "red";
  }
  if (captured) {
    z.owner = captured;
    z.progress_blue_ticks = 0;
    z.progress_red_ticks = 0;
    z.tick_timer_ticks = 0;
    emit("zone_capture", { team: captured, t: state.t });
  }

  // Timer / control time after capture step
  if (z.owner && exclusive === z.owner) {
    z.tick_timer_ticks += 1;
    z.control_time_ticks[z.owner] += 1;
    const tickNeed = Math.round(c.ZONE_TICK_S / c.DT);
    if (z.tick_timer_ticks >= tickNeed) {
      z.tick_timer_ticks = 0;
      if (z.owner === "blue") state.score_blue += 1;
      else state.score_red += 1;
      scored = true;
      emit("zone_tick", {
        team: z.owner,
        score_after: z.owner === "blue" ? state.score_blue : state.score_red,
      });
    }
  }

  // Scripted claim opens (lab)
  if (config.scripted_claim_open) {
    for (const sc of config.scripted_claim_open) {
      if (sc.tick !== state.tick) continue;
      openClaim(arena, sc.team, state.t + c.CLAIM_DELAY_S, sc.fight_id, emit);
    }
  }

  // Claim resolve
  if (arena.claim && state.t + 1e-12 >= arena.claim.resolve_at) {
    const claim = arena.claim;
    const N = Math.max(1, Math.round(c.CLAIM_DENY_DWELL_S * 10));
    const deniers: UnitState[] = [];
    for (const u of state.units) {
      if (u.team === claim.team) continue;
      if (!occSet.has(u.id)) continue;
      if ((z.dwell[u.id] ?? 0) >= N) deniers.push(u);
    }
    if (deniers.length > 0) {
      deniers.sort((a, b) => a.index - b.index);
      const cx = c.ZONE_CENTER[0]!;
      const cy = c.ZONE_CENTER[1]!;
      let best = deniers[0]!;
      let bestD = dist(best.x, best.y, cx, cy);
      for (const d of deniers) {
        const dd = dist(d.x, d.y, cx, cy);
        if (dd < bestD - 1e-12 || (Math.abs(dd - bestD) <= 1e-12 && d.index < best.index)) {
          best = d;
          bestD = dd;
        }
      }
      const denierIds = deniers.map((d) => d.id);
      for (const id of denierIds) {
        arena.claim_denies[id] = (arena.claim_denies[id] ?? 0) + 1;
      }
      emit("claim_deny", {
        team: claim.team,
        denier_id: best.id,
        deniers: denierIds,
      });
      arena.claim = null;
    } else {
      if (claim.team === "blue") state.score_blue += 1;
      else state.score_red += 1;
      scored = true;
      emit("claim_award", {
        team: claim.team,
        score_after: claim.team === "blue" ? state.score_blue : state.score_red,
      });
      arena.claim = null;
    }
  }

  // Orb / buff spawns then pickups (G4: spawn before pickup; already-on-pad picks next tick)
  for (const orb of arena.orbs) {
    if (!orb.up && state.t + 1e-12 >= orb.respawn_at) {
      orb.up = true;
      emit("orb_spawn", { orb_id: orb.orb_id, x: orb.x, y: orb.y });
    }
  }
  for (const buff of arena.buffs) {
    if (!buff.up && state.t + 1e-12 >= buff.respawn_at) {
      buff.up = true;
      emit("buff_spawn", { buff_id: buff.buff_id, x: buff.x, y: buff.y });
    }
  }

  // Pickups — unit order, once per pad
  for (const orb of arena.orbs) {
    if (!orb.up) continue;
    let picker: UnitState | null = null;
    for (const u of state.units) {
      if (!canPickup(u)) continue;
      if (dist(u.x, u.y, orb.x, orb.y) <= c.ORB_PICKUP_R + 1e-12) {
        picker = u;
        break;
      }
    }
    if (!picker) continue;
    orb.up = false;
    orb.respawn_at = state.t + c.ORB_RESPAWN_S;
    const base = c.ORB_XP;
    const xp = catchupEligible(picker, state.units, arena, c)
      ? base * (1 + c.CATCHUP_BONUS)
      : base;
    picker.xp += xp;
    emit("orb_pickup", { orb_id: orb.orb_id, unit_id: picker.id, xp });
    emit("xp_gain", { unit_id: picker.id, amount: xp, source: "orb" });
  }

  for (const buff of arena.buffs) {
    if (!buff.up) continue;
    let picker: UnitState | null = null;
    for (const u of state.units) {
      if (!canPickup(u)) continue;
      if (dist(u.x, u.y, buff.x, buff.y) <= c.ORB_PICKUP_R + 1e-12) {
        picker = u;
        break;
      }
    }
    if (!picker) continue;
    buff.up = false;
    buff.respawn_at = state.t + c.BUFF_RESPAWN_S;
    const until = state.t + c.BUFF_DURATION_S;
    arena.buff_until[picker.id] = until;
    if (!buff.holders.includes(picker.id)) buff.holders.push(picker.id);
    // Refresh: clear other holders? Spec: no stack — one buff instance per pad pickup
    emit("buff_pickup", {
      buff_id: buff.buff_id,
      unit_id: picker.id,
      expires_at: until,
    });
  }

  // Commit aura snapshot for NEXT tick (S3-R5-7): this tick's end state
  z.aura_owner = z.owner;
  z.aura_exclusive = !!(z.owner && exclusive === z.owner);
  z.aura_occupied = z.occupied.slice();

  return { scored };
}

export function openClaim(
  arena: ArenaRuntime,
  team: Team,
  resolveAt: number,
  fightId: string | undefined,
  emit: EmitFn,
): void {
  if (arena.claim && arena.claim.team === team) {
    arena.claim.resolve_at = resolveAt;
    if (fightId !== undefined) arena.claim.fight_id = fightId;
  } else {
    arena.claim = { team, resolve_at: resolveAt, fight_id: fightId };
  }
  emit("claim_open", {
    team,
    resolve_at: resolveAt,
    ...(fightId !== undefined ? { fight_id: fightId } : {}),
  });
}

/** Net +1 fight win → open claim (production path). */
export function maybeOpenClaimFromFight(
  arena: ArenaRuntime,
  team: Team,
  fightId: string | undefined,
  now: number,
  c: Constants,
  emit: EmitFn,
): void {
  openClaim(arena, team, now + c.CLAIM_DELAY_S, fightId, emit);
}

export function hasActiveBuff(arena: ArenaRuntime, unitId: UnitId, now: number): boolean {
  const until = arena.buff_until[unitId];
  return until !== undefined && until > now + 1e-12;
}

/** Aura from previous tick's exclusive ownership + occupant set (S3-R5-7). */
export function auraActiveFor(arena: ArenaRuntime, u: UnitState): boolean {
  if (!u.alive) return false;
  if (!arena.zone.aura_exclusive || arena.zone.aura_owner !== u.team) return false;
  return arena.zone.aura_occupied.includes(u.id);
}
