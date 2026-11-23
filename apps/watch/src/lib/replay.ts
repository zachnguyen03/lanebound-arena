import { digestEvents } from "@sim/canonical";
import type { SimEvent as CoreSimEvent } from "@sim/types";
import { DUMMY_MAX_HP, spawnPose, unitId } from "./spawn";
import type {
  MatchViewState,
  SimEvent,
  Slot,
  Team,
  UnitId,
  UnitView,
} from "./types";
import { CHAMP_ART, SLOTS } from "./types";

/**
 * Pure replay: derive MatchViewState at tick T from the event log only.
 * Never invokes the sim core and never mutates the source events array.
 */
export class ReplayEngine {
  readonly events: readonly SimEvent[];
  readonly digest: string;
  readonly maxTick: number;
  readonly eventsByTick: ReadonlyMap<number, readonly SimEvent[]>;
  readonly indexBySeq: ReadonlyMap<number, number>;

  constructor(events: SimEvent[]) {
    this.events = Object.freeze(events.slice());
    this.digest = digestEvents(this.events as CoreSimEvent[]);
    let maxTick = 0;
    const byTick = new Map<number, SimEvent[]>();
    const bySeq = new Map<number, number>();
    for (let i = 0; i < this.events.length; i++) {
      const ev = this.events[i]!;
      maxTick = Math.max(maxTick, ev.tick);
      const list = byTick.get(ev.tick);
      if (list) list.push(ev);
      else byTick.set(ev.tick, [ev]);
      bySeq.set(ev.seq, i);
    }
    this.maxTick = maxTick;
    this.eventsByTick = byTick;
    this.indexBySeq = bySeq;
  }

  /** Recompute digest from a fresh parse of the same events — must match. */
  verifyDigestUnchanged(): { before: string; after: string; ok: boolean } {
    const after = digestEvents(this.events as CoreSimEvent[]);
    return { before: this.digest, after, ok: this.digest === after };
  }

  /** Cache for forward playback; invalidated on backward scrub. */
  private cache: { tick: number; state: MatchViewState; cursor: number } | null =
    null;

  stateAt(tick: number): MatchViewState {
    const t = Math.max(0, Math.min(tick, this.maxTick));
    if (this.cache && this.cache.tick === t) {
      return cloneState(this.cache.state);
    }
    let state: MatchViewState;
    let cursor: number;
    if (this.cache && this.cache.tick < t) {
      state = cloneState(this.cache.state);
      cursor = this.cache.cursor;
    } else {
      state = emptyState();
      cursor = 0;
    }
    while (cursor < this.events.length) {
      const ev = this.events[cursor]!;
      if (ev.tick > t) break;
      applyEvent(state, ev);
      cursor += 1;
    }
    state.tick = t;
    state.t = t / 10;
    this.cache = { tick: t, state: cloneState(state), cursor };
    return state;
  }

  eventsUpTo(tick: number): SimEvent[] {
    return this.events.filter((e) => e.tick <= tick);
  }

  tickForSeq(seq: number): number | null {
    const idx = this.indexBySeq.get(seq);
    if (idx === undefined) return null;
    return this.events[idx]!.tick;
  }
}

function cloneState(s: MatchViewState): MatchViewState {
  const units = {} as Record<UnitId, UnitView>;
  for (const id of Object.keys(s.units) as UnitId[]) {
    units[id] = { ...s.units[id]! };
  }
  return {
    ...s,
    units,
    blueLineup: s.blueLineup.slice(),
    redLineup: s.redLineup.slice(),
    fallbackChamps: s.fallbackChamps.slice(),
  };
}

function emptyState(): MatchViewState {
  const units = {} as Record<UnitId, UnitView>;
  for (const team of ["blue", "red"] as Team[]) {
    for (const slot of SLOTS) {
      const id = unitId(team, slot);
      const pose = spawnPose(team, slot);
      units[id] = {
        id,
        team,
        slot,
        champ: "unknown",
        x: pose.x,
        y: pose.y,
        vx: 0,
        vy: 0,
        hp: DUMMY_MAX_HP,
        maxHp: DUMMY_MAX_HP,
        xp: 0,
        level: 1,
        alive: true,
        respawnAt: null,
        facing: team === "blue" ? "right" : "left",
        hitStartedAt: null,
        deathStartedAt: null,
        fallback: true,
      };
    }
  }
  return {
    tick: 0,
    t: 0,
    seed: null,
    constantsHash: null,
    scoreBlue: 0,
    scoreRed: 0,
    ended: false,
    endReason: null,
    winner: null,
    units,
    blueLineup: [],
    redLineup: [],
    fallbackChamps: [],
  };
}

function applyEvent(state: MatchViewState, ev: SimEvent): void {
  switch (ev.type) {
    case "match_start": {
      state.seed = typeof ev.seed === "number" ? ev.seed : null;
      state.constantsHash =
        typeof ev.constants_hash === "string" ? ev.constants_hash : null;
      const blue = Array.isArray(ev.blue_lineup)
        ? (ev.blue_lineup as string[])
        : [];
      const red = Array.isArray(ev.red_lineup) ? (ev.red_lineup as string[]) : [];
      state.blueLineup = blue;
      state.redLineup = red;
      applyLineup(state, "blue", blue);
      applyLineup(state, "red", red);
      break;
    }
    case "pos":
    case "move": {
      const u = getUnit(state, ev.unit_id);
      if (!u) break;
      if (typeof ev.x === "number") u.x = ev.x;
      if (typeof ev.y === "number") u.y = ev.y;
      if (typeof ev.vx === "number") u.vx = ev.vx;
      if (typeof ev.vy === "number") u.vy = ev.vy;
      // Facing from movement; hold last while idle.
      if (typeof ev.vx === "number" && Math.abs(ev.vx) > 1e-6) {
        u.facing = ev.vx > 0 ? "right" : "left";
      }
      break;
    }
    case "xp_gain": {
      const u = getUnit(state, ev.unit_id);
      if (!u) break;
      if (typeof ev.amount === "number") u.xp += ev.amount;
      break;
    }
    case "level_up": {
      const u = getUnit(state, ev.unit_id);
      if (!u) break;
      if (typeof ev.new_level === "number") u.level = ev.new_level;
      break;
    }
    case "hit": {
      const u = getUnit(state, ev.target_id);
      if (!u) break;
      if (typeof ev.hp_after === "number") u.hp = ev.hp_after;
      if (u.alive) u.hitStartedAt = ev.t;
      break;
    }
    case "death": {
      const u = getUnit(state, ev.unit_id);
      if (!u) break;
      u.alive = false;
      u.hp = 0;
      u.vx = 0;
      u.vy = 0;
      u.respawnAt = typeof ev.respawn_at === "number" ? ev.respawn_at : null;
      u.deathStartedAt = ev.t;
      u.hitStartedAt = null;
      break;
    }
    case "respawn": {
      const u = getUnit(state, ev.unit_id);
      if (!u) break;
      u.alive = true;
      u.hp = u.maxHp;
      u.respawnAt = null;
      u.hitStartedAt = null;
      u.deathStartedAt = null;
      u.vx = 0;
      u.vy = 0;
      if (typeof ev.x === "number") u.x = ev.x;
      if (typeof ev.y === "number") u.y = ev.y;
      break;
    }
    case "takedown_score": {
      if (ev.team === "blue" && typeof ev.score_after === "number") {
        state.scoreBlue = ev.score_after;
      }
      if (ev.team === "red" && typeof ev.score_after === "number") {
        state.scoreRed = ev.score_after;
      }
      break;
    }
    case "zone_tick":
    case "claim_award": {
      if (ev.team === "blue" && typeof ev.score_after === "number") {
        state.scoreBlue = ev.score_after;
      }
      if (ev.team === "red" && typeof ev.score_after === "number") {
        state.scoreRed = ev.score_after;
      }
      break;
    }
    case "match_end": {
      state.ended = true;
      state.endReason = typeof ev.reason === "string" ? ev.reason : null;
      state.winner =
        ev.winner === "blue" || ev.winner === "red" || ev.winner === "draw"
          ? ev.winner
          : null;
      if (typeof ev.score_blue === "number") state.scoreBlue = ev.score_blue;
      if (typeof ev.score_red === "number") state.scoreRed = ev.score_red;
      break;
    }
    default:
      break;
  }
}

function applyLineup(state: MatchViewState, team: Team, lineup: string[]): void {
  const fallbacks = new Set(state.fallbackChamps);
  for (let i = 0; i < SLOTS.length; i++) {
    const slot = SLOTS[i]!;
    const champ = lineup[i] ?? "unknown";
    const id = unitId(team, slot);
    const u = state.units[id]!;
    u.champ = champ;
    const hasArt = CHAMP_ART.has(champ);
    u.fallback = !hasArt;
    if (u.fallback) fallbacks.add(champ);
    else fallbacks.delete(champ);
    const pose = spawnPose(team, slot);
    u.x = pose.x;
    u.y = pose.y;
    u.vx = 0;
    u.vy = 0;
    u.hp = DUMMY_MAX_HP;
    u.maxHp = DUMMY_MAX_HP;
    u.level = 1;
    u.xp = 0;
    u.alive = true;
    u.facing = team === "blue" ? "right" : "left";
    u.hitStartedAt = null;
    u.deathStartedAt = null;
  }
  state.fallbackChamps = [...fallbacks].sort();
}

function getUnit(
  state: MatchViewState,
  id: unknown,
): UnitView | null {
  if (typeof id !== "string") return null;
  return state.units[id as UnitId] ?? null;
}

export function formatClock(tSeconds: number): string {
  const s = Math.max(0, Math.floor(tSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export type { Slot };
