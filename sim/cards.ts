/**
 * exp/cards (not build spec): Tactic Cards, off unless MatchConfig.cards is set.
 * Each tick (after scoring, before the end check) the runtime reads the tick's new
 * events and the state, fires cards whose trigger holds (once per game; Repeat cards
 * fire again each time the trigger becomes true) and emits `card_fire`. Timed effects
 * become multipliers on the units (`UnitState.card`) and per-team (capture, respawn),
 * read by combat, motor, cast cooldowns, objectives and the death phase.
 */
import { CHAMPIONS } from "../data/champions/defs.js";
import { addShield } from "./status.js";
import type { MatchState, SimEvent, Slot, Tactics, Team, UnitId, UnitState } from "./types.js";

/** One trigger: `on` plus the fields that trigger reads. */
export interface CardTrigger {
  on:
    | "first_capture" // we make the game's first point capture
    | "majority" //      we own 2 of the 3 points
    | "point_lost" //    the enemy captures a point we owned
    | "hold" //          we hold majority for s seconds straight
    | "behind" //        we trail by x+ points
    | "ahead" //         we lead by x+ points
    | "close" //         at t, the score is within x
    | "time" //          the clock reaches t
    | "first_blood" //   first blood for us (us: true) or them
    | "kills" //         the owner reaches n kills
    | "deaths" //        the owner (or our / their `role`) has died n times
    | "multikill" //     an ally gets n kills within 10 s
    | "alive" //         the owner has not died by t
    | "enemy_class" //   draft: the enemy fields n+ champions of class cls (checked at 0:00)
    | "owner_champ"; //  draft: the owner plays champ (checked at 0:00)
  n?: number;
  t?: number;
  x?: number;
  s?: number;
  us?: boolean;
  role?: Slot;
  enemy?: boolean;
  cls?: string;
  champ?: string;
}

/** dmg, taken, ms, cd (cooldown recovery), cap (capture speed), respawn: multiplier 1 + v for dur s.
 * shield: v × max HP, one-shot (lasts dur s). score: +v points now. tactic: override the side's tactics for dur s. */
export interface CardEffect {
  stat: "dmg" | "taken" | "ms" | "cd" | "cap" | "respawn" | "shield" | "score" | "tactic";
  v?: number;
  target?: "owner" | "team" | "enemy";
  dur?: number;
  tactic?: Partial<Tactics>;
}

export interface CardSpec {
  id: string;
  /** Slot of the player who holds the card. */
  owner: Slot;
  trigger: CardTrigger;
  effects: CardEffect[];
  repeat?: boolean;
}

export interface Cards {
  blue: CardSpec[];
  red: CardSpec[];
}

type UnitMods = NonNullable<UnitState["card"]>;
interface Active { team: Team; unit: UnitId | null; stat: CardEffect["stat"]; v: number; until: number; tactic?: Partial<Tactics> }
export interface CardRuntime {
  seen: number;
  fired: Record<Team, boolean[]>;
  was: Record<Team, boolean[]>;
  owner: Record<string, Team>;
  firstCap: Team | null;
  fb: Team | null;
  kills: Record<string, number[]>;
  deaths: Record<string, number>;
  holdSince: Record<Team, number | null>;
  active: Active[];
  tactics: Record<Team, Tactics>;
  /** Per-team capture-speed and respawn-time multipliers, read by objectives and the death phase. */
  team: Record<Team, { cap: number; respawn: number }>;
}

const other = (t: Team): Team => (t === "blue" ? "red" : "blue");

export function createCardRuntime(state: MatchState): CardRuntime {
  const cfg = state.config;
  const n = (t: Team) => cfg.cards![t].map(() => false);
  return {
    seen: 0, fired: { blue: n("blue"), red: n("red") }, was: { blue: n("blue"), red: n("red") }, owner: {}, firstCap: null, fb: null,
    kills: {}, deaths: {}, holdSince: { blue: null, red: null }, active: [],
    tactics: { blue: { ...cfg.blue.tactics }, red: { ...cfg.red.tactics } },
    team: { blue: { cap: 1, respawn: 1 }, red: { cap: 1, respawn: 1 } },
  };
}

/** Read this tick's new events into the runtime's counters; returns the tick's one-tick facts. */
function scan(state: MatchState, rt: CardRuntime, events: SimEvent[]) {
  const lost = { blue: false, red: false }, multi: Record<string, number> = {};
  for (const e of events.slice(rt.seen)) {
    if (e.type === "point_capture") {
      const team = e.team as Team, prev = rt.owner[e.point as string];
      if (prev && prev !== team) lost[prev] = true;
      rt.owner[e.point as string] = team;
      rt.firstCap ??= team;
    } else if (e.type === "death") {
      const v = e.unit_id as UnitId, k = e.killer_id as UnitId | null;
      rt.deaths[v] = (rt.deaths[v] ?? 0) + 1;
      if (!k) continue;
      const team = k.split(":")[0] as Team;
      rt.fb ??= team;
      const ks = (rt.kills[k] ??= []);
      ks.push(state.t);
      multi[k] = ks.filter((t) => t >= state.t - 10 - 1e-9).length;
    }
  }
  rt.seen = events.length;
  return { lost, multi };
}

function holds(state: MatchState, rt: CardRuntime, team: Team, owner: UnitId, tr: CardTrigger, f: ReturnType<typeof scan>): boolean {
  const us = team === "blue" ? state.score_blue : state.score_red;
  const them = team === "blue" ? state.score_red : state.score_blue;
  const owned = Object.values(rt.owner).filter((t) => t === team).length;
  const foe = team === "blue" ? state.config.red : state.config.blue;
  switch (tr.on) {
    case "first_capture": return rt.firstCap === team;
    case "majority": return owned >= 2;
    case "point_lost": return f.lost[team];
    case "hold": { const s = rt.holdSince[team]; return s !== null && state.t - s >= (tr.s ?? 0) - 1e-9; }
    case "behind": return them - us >= (tr.x ?? 1);
    case "ahead": return us - them >= (tr.x ?? 1);
    case "close": return state.t >= (tr.t ?? 0) - 1e-9 && state.t < (tr.t ?? 0) + 0.05 && Math.abs(us - them) <= (tr.x ?? 0);
    case "time": return state.t >= (tr.t ?? 0) - 1e-9;
    case "first_blood": return rt.fb === (tr.us ? team : other(team));
    case "kills": return (rt.kills[owner]?.length ?? 0) >= (tr.n ?? 1);
    case "deaths": {
      const who = tr.role ? (`${tr.enemy ? other(team) : team}:${tr.role}` as UnitId) : owner;
      return (rt.deaths[who] ?? 0) >= (tr.n ?? 1);
    }
    case "multikill": return state.units.some((u) => u.team === team && (f.multi[u.id] ?? 0) >= (tr.n ?? 2));
    case "alive": return state.t >= (tr.t ?? 0) - 1e-9 && state.t < (tr.t ?? 0) + 0.05 && !rt.deaths[owner];
    case "enemy_class": return state.tick === 1 && foe.picks.filter((c) => CHAMPIONS[c]?.class === tr.cls).length >= (tr.n ?? 1);
    case "owner_champ": return state.tick === 1 && state.units.find((u) => u.id === owner)?.champ === tr.champ;
  }
  return false;
}

function fire(state: MatchState, rt: CardRuntime, team: Team, card: CardSpec, emit: (type: string, p: Record<string, unknown>) => void): number {
  const owner = `${team}:${card.owner}` as UnitId;
  let score = 0;
  for (const e of card.effects) {
    const tt = e.target === "enemy" ? other(team) : team, v = e.v ?? 0;
    const units = state.units.filter((u) => (e.target === "owner" ? u.id === owner : u.team === tt));
    if (e.stat === "score") score += v;
    else if (e.stat === "shield") for (const u of units) { if (u.alive) addShield(u.status, v * u.max_hp, u.max_hp, 1, e.dur ?? 6); }
    else {
      if (e.stat === "respawn") for (const u of units) if (!u.alive) u.respawn_at = state.t + (u.respawn_at - state.t) * (1 + v);
      rt.active.push({ team: tt, unit: e.target === "owner" ? owner : null, stat: e.stat, v, until: state.t + (e.dur ?? 1e9), tactic: e.tactic });
    }
  }
  if (score) {
    if (team === "blue") state.score_blue += score;
    else state.score_red += score;
  }
  emit("card_fire", { team, card_id: card.id, owner, ...(score ? { score, score_after: team === "blue" ? state.score_blue : state.score_red } : {}) });
  return score;
}

/** Expire effects and rebuild unit / team multipliers and the sides' tactics. */
function apply(state: MatchState, rt: CardRuntime): void {
  rt.active = rt.active.filter((a) => a.until > state.t + 1e-9);
  for (const team of ["blue", "red"] as Team[]) {
    rt.team[team] = { cap: 1, respawn: 1 };
    Object.assign(team === "blue" ? state.config.blue.tactics : state.config.red.tactics, rt.tactics[team]);
  }
  for (const u of state.units) u.card = undefined;
  for (const a of rt.active) {
    if (a.stat === "tactic") Object.assign(a.team === "blue" ? state.config.blue.tactics : state.config.red.tactics, a.tactic);
    else if (a.stat === "cap" || a.stat === "respawn") rt.team[a.team][a.stat] *= 1 + a.v;
    else for (const u of state.units) {
      if (u.team !== a.team || (a.unit && u.id !== a.unit)) continue;
      const m: UnitMods = (u.card ??= { dmg: 1, taken: 1, ms: 1, cd: 1 });
      m[a.stat as keyof UnitMods] *= 1 + a.v;
    }
  }
}

/** One tick of the card runtime. Returns true when a card scored. */
export function tickCards(state: MatchState, rt: CardRuntime, events: SimEvent[], emit: (type: string, p: Record<string, unknown>) => void): boolean {
  const f = scan(state, rt, events);
  let scored = false;
  for (const team of ["blue", "red"] as Team[]) {
    const owned = Object.values(rt.owner).filter((t) => t === team).length;
    if (owned < 2) rt.holdSince[team] = null;
    else rt.holdSince[team] ??= state.t;
  }
  for (const team of ["blue", "red"] as Team[]) {
    state.config.cards![team].forEach((card, i) => {
      const now = holds(state, rt, team, `${team}:${card.owner}` as UnitId, card.trigger, f);
      const edge = now && !rt.was[team][i];
      rt.was[team][i] = now;
      if (!edge || (rt.fired[team][i] && !card.repeat)) return;
      rt.fired[team][i] = true;
      if (fire(state, rt, team, card, emit)) scored = true;
    });
  }
  apply(state, rt);
  return scored;
}
