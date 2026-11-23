/**
 * S2 acceptance harness. Imports only the public sim entry
 * (`simulate`, `defaultEvenConfig`) plus the exported MatchConfig / event types.
 * No sim internals, no data/ or kits.ts. Coordinates are real map tiles (no S1 ZONE_SHIFT):
 * fight, chase, peel and sanctuary geometry is about the authored map.
 *
 * Unnamed defaultEvenConfig slots stay at their spawn with autos off (same idea as S1 run()),
 * so a mid-map cluster is not accidentally a 5v5 fight (spawn is >8 tiles from the lab pit).
 */
import { defaultEvenConfig, simulate } from "../../../sim/index.js";
import type { MatchConfig, SimEvent, UnitId } from "../../../sim/index.js";

export type Ev = SimEvent;
export type UId = UnitId;
export type TacticPreset = "hold_the_pit" | "hunt" | "starve";

export const SLOTS = ["top", "jungle", "mid", "adc", "support"] as const;
export type Slot = (typeof SLOTS)[number];
export type Team = "blue" | "red";

export const DT = 0.1;
/** Lab pit — off the zone (12,8) r=3 and off the four pillars. */
export const PIT = { x: 12, y: 4 };
export const COMMITS = ["engage", "hold", "disengage"] as const;

export interface PlaceSpec {
  champ?: string;
  level?: number;
  x: number;
  y: number;
  hp?: number;
  auto?: boolean | number;
  range?: number;
  as?: number;
  attrs?: Partial<{
    aim: number;
    reflexes: number;
    execution: number;
    decision: number;
    positioning: number;
    teamwork: number;
  }>;
  /** Mastery 0–100 for this unit's picked champion. */
  mastery?: number;
}

export interface AiScenario {
  seed?: number;
  T: number;
  units?: Partial<Record<UId, PlaceSpec>>;
  tactics?: { blue?: Partial<MatchConfig["blue"]["tactics"]>; red?: Partial<MatchConfig["blue"]["tactics"]> };
  cc?: Array<{ tick: number; target: UId; kind: string; duration: number; source?: UId }>;
  casts?: Array<{
    tick: number;
    by: UId;
    skill: "Q" | "W" | "R";
    target?: UId;
    aim?: [number, number];
    force_hit?: boolean;
  }>;
  damage?: Array<{ tick: number; source: UId; target: UId; raw: number }>;
  motor?: Partial<Record<UId, { to: [number, number][]; arrive_r?: number; hold_at_end?: boolean }>>;
  skillshots?: Array<{ tick: number; source: UId; target: UId; count: number }>;
  pos?: boolean;
  constants?: Record<string, unknown>;
}

export function parseId(id: UId): { team: Team; slot: Slot; index: number } {
  const [team, slot] = id.split(":") as [Team, Slot];
  return { team, slot, index: SLOTS.indexOf(slot) };
}

export function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return NaN;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

export class Run {
  constructor(
    public events: Ev[],
    public units: Record<string, { id: string; x: number; y: number; hp: number; max_hp: number; alive: boolean; intent: string; [k: string]: unknown }>,
    public digest: string,
    public constants_hash: string,
    public sc: AiScenario,
  ) {}

  of(type: string, pred?: (e: Ev) => boolean): Ev[] {
    return this.events.filter((e) => e.type === type && (!pred || pred(e)));
  }

  unit(id: UId) {
    return this.units[id];
  }

  fightCalls(team?: Team): Ev[] {
    return this.of("fight_call", (e) => !team || e.team === team);
  }
}

/** Build a MatchConfig from defaultEvenConfig + placements. Autos off unless PlaceSpec.auto is set. */
export function configOf(sc: AiScenario): MatchConfig {
  const cfg: MatchConfig = {
    ...defaultEvenConfig(sc.seed ?? 20261122),
    constants: { MATCH_T: sc.T, ...(sc.constants ?? {}) },
    debug_pos: sc.pos ?? false,
  };
  if (sc.tactics?.blue) cfg.blue = { ...cfg.blue, tactics: { ...cfg.blue.tactics, ...sc.tactics.blue } };
  if (sc.tactics?.red) cfg.red = { ...cfg.red, tactics: { ...cfg.red.tactics, ...sc.tactics.red } };

  const uo: NonNullable<MatchConfig["unit_overrides"]> = {};
  for (const [id, u] of Object.entries(sc.units ?? {}) as [UId, PlaceSpec][]) {
    const { team, index } = parseId(id);
    const level = u.level ?? 7;
    const o: NonNullable<MatchConfig["unit_overrides"]>[UId] = {
      level,
      x: u.x,
      y: u.y,
      spawn_shield_until: 0,
      auto_next_start_t: u.auto === true ? 0 : typeof u.auto === "number" ? u.auto : 999,
    };
    if (u.champ) {
      o.champ = u.champ;
      cfg[team].picks[index] = u.champ;
    }
    if (u.hp !== undefined) o.hp = u.hp;
    if (u.as !== undefined) o.as = u.as;
    if (u.range !== undefined) o.range = u.range;
    if (u.attrs) o.attrs = u.attrs;
    if (u.attrs) {
      const pl = cfg[team].players[index]!;
      pl.attrs = { ...pl.attrs, ...u.attrs };
    }
    if (u.mastery !== undefined) {
      const champ = u.champ ?? cfg[team].picks[index]!;
      cfg[team].players[index]!.mastery = { ...cfg[team].players[index]!.mastery, [champ]: u.mastery };
    }
    uo[id] = o;
  }
  for (const team of ["blue", "red"] as const) {
    for (const slot of SLOTS) {
      const id = `${team}:${slot}` as UId;
      if (!uo[id]) uo[id] = { auto_next_start_t: 999, spawn_shield_until: 0 };
    }
  }
  cfg.unit_overrides = uo;
  if (sc.casts) {
    cfg.scripted_casts = sc.casts.map((c) => ({
      tick: c.tick,
      source_id: c.by,
      skill: c.skill,
      ...(c.target ? { target_id: c.target } : {}),
      ...(c.aim ? { aim_x: c.aim[0], aim_y: c.aim[1] } : {}),
      force_hit: c.force_hit ?? true,
    }));
  }
  if (sc.cc) {
    cfg.scripted_cc = sc.cc.map((c) => ({
      tick: c.tick,
      target_id: c.target,
      kind: c.kind as "stun" | "banish" | "timestop" | "disarm" | "blind" | "sleep" | "hex" | "root",
      duration: c.duration,
      ...(c.source ? { source_id: c.source } : {}),
    }));
  }
  if (sc.damage) cfg.scripted_damage = sc.damage.map((d) => ({ tick: d.tick, source_id: d.source, target_id: d.target, raw: d.raw }));
  if (sc.motor) {
    cfg.scripted_motor = {};
    for (const [id, m] of Object.entries(sc.motor) as [UId, NonNullable<AiScenario["motor"]>[UId]][]) {
      if (!m) continue;
      cfg.scripted_motor[id] = {
        waypoints: m.to.map(([x, y]) => ({ x, y })),
        arrive_r: m.arrive_r ?? 0.15,
        hold_at_end: m.hold_at_end ?? true,
      };
    }
  }
  if (sc.skillshots) {
    cfg.scripted_skillshots = sc.skillshots.map((s) => ({
      tick: s.tick,
      source_id: s.source,
      target_id: s.target,
      count: s.count,
    }));
  }
  return cfg;
}

export function runAi(sc: AiScenario): Run {
  const cfg = configOf(sc);
  const r = simulate(cfg);
  const units: Run["units"] = {};
  for (const u of r.state.units) units[u.id] = { ...u };
  return new Run(r.events, units, r.digest, r.constants_hash, sc);
}

/** Same-champ 2v2 or 3v3 around a point, so A_true is a symmetry (or a forced HP swing), not a kit guess. */
export function cluster(
  at: { x: number; y: number },
  pairs: Array<{ id: UId; champ: string; hp?: number; attrs?: PlaceSpec["attrs"]; mastery?: number; range?: number; auto?: boolean | number }>,
  spacing = 0.8,
): Partial<Record<UId, PlaceSpec>> {
  const units: Partial<Record<UId, PlaceSpec>> = {};
  pairs.forEach((p, i) => {
    const ang = (2 * Math.PI * i) / pairs.length;
    units[p.id] = {
      champ: p.champ,
      level: 7,
      x: at.x + spacing * Math.cos(ang),
      y: at.y + spacing * Math.sin(ang),
      hp: p.hp,
      attrs: p.attrs,
      mastery: p.mastery,
      range: p.range,
      auto: p.auto,
    };
  });
  return units;
}

/** Positions of a unit over time from debug `pos` events (spec L165, lab-verbose, not in the digest). */
export function pathOf(events: Ev[], id: UId): Array<{ tick: number; t: number; x: number; y: number }> {
  return events
    .filter((e) => e.type === "pos" && (e.unit_id === id || e.id === id))
    .map((e) => ({
      tick: e.tick as number,
      t: e.t as number,
      x: e.x as number,
      y: e.y as number,
    }));
}

export function inRedSanctuary(x: number): boolean {
  // Tile-based: red sanctuary x ∈ {22, 23} (spec L215). Centre points with x∈[22,24).
  return x >= 22 && x < 24;
}

export function inBlueSanctuary(x: number): boolean {
  return x >= 0 && x < 2;
}
