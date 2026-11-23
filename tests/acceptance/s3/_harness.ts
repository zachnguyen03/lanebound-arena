/**
 * S3 acceptance harness. Imports only the public sim entry
 * (`simulate`, `defaultEvenConfig`, `digestEvents`, `DEFAULT_CONSTANTS`,
 * `XP_TO_LEVEL`) plus exported types. No sim internals, no data/ or kits.ts.
 *
 * Unnamed defaultEvenConfig slots stay at their spawn with autos off (same
 * idea as S1 run() / the S2 harness), so a mid-map scoring fixture is not
 * accidentally a 5v5 fight.
 *
 * New S3 fields (`scripted_claim_open`, `MatchState.zone` / `orbs` / `buffs` /
 * `claim` / `phase`, `SimulateResult.player_stats`) are defined in
 * `_contract.md`. Helpers widen the S1 types so this suite typechecks against
 * the frozen S1 tip and goes red at runtime until S3 lands those fields.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_CONSTANTS,
  XP_TO_LEVEL,
  defaultEvenConfig,
  digestEvents,
  simulate,
} from "../../../sim/index.js";
import type { MatchConfig, SimEvent, SimulateResult, UnitId } from "../../../sim/index.js";

export type Ev = SimEvent;
export type UId = UnitId;
export type Team = "blue" | "red";
export type Slot = "top" | "jungle" | "mid" | "adc" | "support";

export const SLOTS = ["top", "jungle", "mid", "adc", "support"] as const;
export const DT = 0.1;

/** Zone centre is a point on the seam, not a tile centre (Appendix R #2 L1906, §5.5 L269). */
export const ZONE = { x: 12, y: 8 };
export const ZONE_RADIUS = 3.0;

/**
 * §5.7 L303 orb pad *tiles*, placed at tile centres per Appendix R #2 L1906
 * (same rule already applied to spawn and buff pads in S1).
 * Order is the authored §5.7 list.
 */
export const ORB_PAD_TILES: ReadonlyArray<readonly [number, number]> = [
  [2, 4],
  [2, 11],
  [21, 4],
  [21, 11],
  [8, 1],
  [15, 1],
  [8, 14],
  [15, 14],
];
export const ORB_PADS: ReadonlyArray<readonly [number, number]> = ORB_PAD_TILES.map(
  ([x, y]) => [x + 0.5, y + 0.5] as const,
);

/** Buff tiles (7,7) / (16,7) → centres (Appendix R #2 L1906, §15 L1612). */
export const BUFF_PADS: ReadonlyArray<readonly [number, number]> = [
  [7.5, 7.5],
  [16.5, 7.5],
];

/** Event types introduced or required by S3 scoring / zone / orbs / buffs / claims (§4.4 L174–184). */
export const S3_EVENT_TYPES = new Set([
  "orb_spawn",
  "orb_pickup",
  "buff_spawn",
  "buff_pickup",
  "zone_capture",
  "zone_tick",
  "claim_open",
  "claim_award",
  "claim_deny",
  "takedown_score",
]);

/**
 * Official S1 PM-passed tip `2cdcf26` gold (tests/s0-gold-hash.test.ts).
 * Used by the AI-off regression after stripping S3 event types.
 */
export const S1_GOLD = {
  seed_20261122: {
    digest: "7e6516f4fad170ab9893de7d8a225271c42b19d837a5dfedefeda6bdd97aee1f",
    constants_hash: "69f5b9e615f3e57f458c0dd40875d2cd178cc4ac728da2f9e5f4f51e8ff54fc1",
    data_hash: "af2cbafa03a1cea2485b6118b09232a7c511e682189102e486d3e2cd549a32f2",
  },
  seed_20261123: {
    digest: "f3946e13929209cf9fd179cf20b147b050a6402ab09a83d2bdf6306e3c744cd0",
    constants_hash: "69f5b9e615f3e57f458c0dd40875d2cd178cc4ac728da2f9e5f4f51e8ff54fc1",
    data_hash: "af2cbafa03a1cea2485b6118b09232a7c511e682189102e486d3e2cd549a32f2",
  },
} as const;

/** One champion per M3-26 class, used only as leftover deniers. */
export const CLASS_CHAMPS = {
  Tank: "brannoch",
  Fighter: "rhedan",
  Assassin: "kerrig",
  Marksman: "huntress",
  Mage: "helvar",
  Enchanter: "ysol",
} as const;

export interface PlaceSpec {
  champ?: string;
  level?: number;
  x: number;
  y: number;
  hp?: number;
  xp?: number;
  auto?: boolean | number;
  range?: number;
  as?: number;
  /** Lab-only move-speed override (tiles/s), same idea as `range` / `as`. */
  ms?: number;
  spawn_shield_until?: number;
}

export interface ScriptedClaimOpen {
  tick: number;
  team: Team;
  fight_id?: string;
}

export interface S3Scenario {
  seed?: number;
  T: number;
  /** Default false in this suite — real §5.8 win conditions (see _contract.md). */
  forced_clock_end?: boolean;
  units?: Partial<Record<UId, PlaceSpec>>;
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
  /** Lab hook — see _contract.md. Opens a claim as a qualifying net +1 win on that tick. */
  claims?: ScriptedClaimOpen[];
  pos?: boolean;
  assert_sanctuary?: boolean;
  constants?: Record<string, unknown>;
}

/** Lab-only widening of MatchConfig; fields are in _contract.md. */
export type S3MatchConfig = MatchConfig & {
  scripted_claim_open?: ScriptedClaimOpen[];
};

export interface ZoneState {
  owner: Team | null;
  progress_blue: number;
  progress_red: number;
  tick_timer: number;
  occupied: UId[];
  control_time: [number, number] | { blue: number; red: number };
}

export interface ClaimState {
  team: Team;
  resolve_at: number;
  fight_id?: string;
}

export interface OrbState {
  orb_id?: string | number;
  x: number;
  y: number;
  up: boolean;
  respawn_at?: number;
}

export interface BuffState {
  buff_id?: string | number;
  x: number;
  y: number;
  up: boolean;
  respawn_at?: number;
  holders?: UId[];
}

export interface PlayerStat {
  unit_id?: UId;
  player_id?: string;
  slot?: Slot;
  side?: Team;
  claim_denies: number;
  zone_seconds?: number;
}

export type S3Phase = "play" | "sudden_death" | "extra_15" | "ended";

export interface S3ResultFields {
  player_stats?: PlayerStat[];
  summary?: {
    score_parts?: { kills: number; ticks: number; claims: number }[] | { blue: { kills: number; ticks: number; claims: number }; red: { kills: number; ticks: number; claims: number } };
    claim_opened?: unknown;
    claim_denied?: unknown;
    claim_paid?: unknown;
    players?: PlayerStat[];
  };
}

export type S3SimulateResult = SimulateResult & S3ResultFields;

export class Run {
  constructor(
    public events: Ev[],
    public units: Record<
      string,
      { id: string; x: number; y: number; hp: number; max_hp: number; alive: boolean; xp: number; level: number; [k: string]: unknown }
    >,
    public digest: string,
    public constants_hash: string,
    public sc: S3Scenario,
    public raw: S3SimulateResult,
  ) {}

  of(type: string, pred?: (e: Ev) => boolean): Ev[] {
    return this.events.filter((e) => e.type === type && (!pred || pred(e)));
  }

  unit(id: UId) {
    return this.units[id];
  }

  get state() {
    return this.raw.state;
  }

  get tick_count() {
    return this.raw.tick_count;
  }

  get winner() {
    return this.raw.state.winner;
  }

  get end_reason() {
    return this.raw.state.end_reason;
  }

  matchEnd(): Ev | undefined {
    return this.of("match_end")[0];
  }
}

export function parseId(id: UId): { team: Team; slot: Slot; index: number } {
  const [team, slot] = id.split(":") as [Team, Slot];
  return { team, slot, index: SLOTS.indexOf(slot) };
}

export function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function tickOf(t: number): number {
  return Math.round(t / DT);
}

export function inZone(x: number, y: number, radius = ZONE_RADIUS): boolean {
  return dist({ x, y }, ZONE) <= radius + 1e-9;
}

export function configOf(sc: S3Scenario): S3MatchConfig {
  const cfg: S3MatchConfig = {
    ...defaultEvenConfig(sc.seed ?? 20261122),
    constants: { MATCH_T: sc.T, ...(sc.constants ?? {}) },
    debug_pos: sc.pos ?? false,
    forced_clock_end: sc.forced_clock_end ?? false,
    assert_sanctuary: sc.assert_sanctuary,
    sim_until: sc.T,
  };

  const uo: NonNullable<MatchConfig["unit_overrides"]> = {};
  for (const [id, u] of Object.entries(sc.units ?? {}) as [UId, PlaceSpec][]) {
    const { team, index } = parseId(id);
    const o: NonNullable<MatchConfig["unit_overrides"]>[UId] = {
      level: u.level ?? 1,
      x: u.x,
      y: u.y,
      spawn_shield_until: u.spawn_shield_until ?? 0,
      auto_next_start_t: u.auto === true ? 0 : typeof u.auto === "number" ? u.auto : 999,
    };
    if (u.champ) {
      o.champ = u.champ;
      cfg[team].picks[index] = u.champ;
    }
    if (u.hp !== undefined) o.hp = u.hp;
    if (u.xp !== undefined) o.xp = u.xp;
    if (u.as !== undefined) o.as = u.as;
    if (u.range !== undefined) o.range = u.range;
    if (u.ms !== undefined) (o as { ms?: number }).ms = u.ms;
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
      kind: c.kind as "stun" | "banish" | "timestop" | "disarm" | "blind" | "sleep" | "hex" | "root" | "knockup",
      duration: c.duration,
      ...(c.source ? { source_id: c.source } : {}),
    }));
  }
  if (sc.damage) {
    cfg.scripted_damage = sc.damage.map((d) => ({
      tick: d.tick,
      source_id: d.source,
      target_id: d.target,
      raw: d.raw,
    }));
  }
  if (sc.motor) {
    cfg.scripted_motor = {};
    for (const [id, m] of Object.entries(sc.motor) as [UId, NonNullable<S3Scenario["motor"]>[UId]][]) {
      if (!m) continue;
      cfg.scripted_motor[id] = {
        waypoints: m.to.map(([x, y]) => ({ x, y })),
        arrive_r: m.arrive_r ?? 0.15,
        hold_at_end: m.hold_at_end ?? true,
      };
    }
  }
  if (sc.claims) cfg.scripted_claim_open = sc.claims;
  return cfg;
}

export function runS3(sc: S3Scenario): Run {
  const cfg = configOf(sc);
  const r = simulate(cfg) as S3SimulateResult;
  const units: Run["units"] = {};
  for (const u of r.state.units) units[u.id] = { ...u };
  return new Run(r.events, units, r.digest, r.constants_hash, sc, r);
}

/** Kill a unit with a huge scripted physical packet (lab). */
export function killAt(tick: number, source: UId, target: UId, raw = 10_000) {
  return { tick, source, target, raw };
}

export function placeInZone(
  id: UId,
  extra: Partial<PlaceSpec> = {},
  offset: { x?: number; y?: number } = {},
): PlaceSpec {
  return {
    x: ZONE.x + (offset.x ?? 0),
    y: ZONE.y + (offset.y ?? 0),
    spawn_shield_until: 0,
    auto: false,
    ...extra,
  };
}

export function zoneOf(r: Run): ZoneState {
  const z = (r.state as { zone?: ZoneState }).zone;
  if (!z) throw new Error("MatchState.zone is missing — S3 _contract.md requires ZoneState on the public result");
  return z;
}

export function claimOf(r: Run): ClaimState | null | undefined {
  return (r.state as { claim?: ClaimState | null }).claim;
}

export function orbsOf(r: Run): OrbState[] {
  const o = (r.state as { orbs?: OrbState[] }).orbs;
  if (!o) throw new Error("MatchState.orbs is missing — S3 _contract.md requires OrbState[8] on the public result");
  return o;
}

export function buffsOf(r: Run): BuffState[] {
  const b = (r.state as { buffs?: BuffState[] }).buffs;
  if (!b) throw new Error("MatchState.buffs is missing — S3 _contract.md requires BuffPad[2] on the public result");
  return b;
}

export function phaseOf(r: Run): S3Phase | undefined {
  return (r.state as { phase?: S3Phase }).phase;
}

export function controlTime(z: ZoneState, team: Team): number {
  const rawB = Array.isArray(z.control_time) ? z.control_time[0]! : z.control_time.blue;
  const rawR = Array.isArray(z.control_time) ? z.control_time[1]! : z.control_time.red;
  // Match length is at most a few hundred seconds; values above 400 are ticks.
  const secB = rawB > 400 ? rawB / 10 : rawB;
  const secR = rawR > 400 ? rawR / 10 : rawR;
  return team === "blue" ? secB : secR;
}

/**
 * Public zone counters may be seconds (ticks/10, 4 dp, the contract default)
 * or raw integer ticks (0..30 / 0..120 / control_time). If any value in the
 * pair exceeds `maxSeconds`, treat the fields as ticks.
 */
export function asSeconds(raw: number, sibling: number, maxSeconds: number): number {
  if (raw > maxSeconds + 1e-9 || sibling > maxSeconds + 1e-9) return raw / 10;
  return raw;
}

export function barSeconds(z: ZoneState, team: Team): number {
  const raw = team === "blue" ? z.progress_blue : z.progress_red;
  const sibling = team === "blue" ? z.progress_red : z.progress_blue;
  return asSeconds(raw, sibling, 3);
}

export function barTicks(z: ZoneState, team: Team): number {
  const sec = team === "blue" ? asSeconds(z.progress_blue, z.progress_red, 3) : asSeconds(z.progress_red, z.progress_blue, 3);
  return Math.round(sec * 10);
}

export function timerSeconds(z: ZoneState): number {
  // tick_timer is a single value; if it is an integer > 12, treat as ticks.
  const t = z.tick_timer;
  if (t > 12 + 1e-9) return t / 10;
  return t;
}

export function timerTicks(z: ZoneState): number {
  return Math.round(timerSeconds(z) * 10);
}

/** claim_deny.deniers (S3-R5-8 L1966). Reads the additive field; does not assert the exact key set of the event. */
export function deniersOf(e: Ev): UId[] {
  const raw = e.deniers;
  if (!Array.isArray(raw)) {
    throw new Error("claim_deny.deniers is missing — S3 _contract.md / S3-R5-8 L1966 requires unit_id[]");
  }
  return raw as UId[];
}

export function zoneSecondsOf(r: Run, id: UId): number {
  const stats = r.raw.player_stats ?? r.raw.summary?.players;
  if (!stats) {
    throw new Error("SimulateResult.player_stats is missing — S3-R5-9 L1968 requires zone_seconds per unit");
  }
  const row = stats.find((p) => p.unit_id === id || p.player_id === id);
  if (!row || row.zone_seconds === undefined) {
    throw new Error(`no zone_seconds for ${id} (S3-R5-9 L1968)`);
  }
  return row.zone_seconds;
}

export function allPlayerStats(r: Run): PlayerStat[] {
  const stats = r.raw.player_stats ?? r.raw.summary?.players;
  if (!stats) throw new Error("SimulateResult.player_stats is missing — _contract.md");
  return stats;
}

/** §14.7 rng_counters. Used by S3-R5-6 to show the tiebreak stream was not drawn. */
export function streamCounter(r: Run, stream: string): number {
  const m = (r.state as { rng_counters?: Record<string, number> }).rng_counters;
  if (!m || typeof m[stream] !== "number") {
    throw new Error(`MatchState.rng_counters.${stream} is missing — §14.7 / S3-R5-6 L1961`);
  }
  return m[stream]!;
}

export function claimDeniesOf(r: Run, id: UId): number {
  const stats = r.raw.player_stats ?? r.raw.summary?.players;
  if (!stats) {
    throw new Error(
      "SimulateResult.player_stats (or summary.players) is missing — S3 _contract.md requires claim_denies per unit (career-match/1.x)",
    );
  }
  const row = stats.find((p) => p.unit_id === id || p.player_id === id);
  if (!row) {
    throw new Error(`no player_stats row for ${id}`);
  }
  return row.claim_denies ?? 0;
}

export function scorePartsFromEvents(events: Ev[], team: Team): { kills: number; ticks: number; claims: number } {
  return {
    kills: events.filter((e) => e.type === "takedown_score" && e.team === team).length,
    ticks: events.filter((e) => e.type === "zone_tick" && e.team === team).length,
    claims: events.filter((e) => e.type === "claim_award" && e.team === team).length,
  };
}

export function stripS3Events(events: Ev[]): Ev[] {
  return events.filter((e) => !S3_EVENT_TYPES.has(e.type));
}

export function pathOf(events: Ev[], id: UId): Array<{ tick: number; t: number; x: number; y: number }> {
  return events
    .filter((e) => (e.type === "pos" || e.type === "move") && (e.unit_id === id || e.id === id))
    .map((e) => ({
      tick: e.tick as number,
      t: e.t as number,
      x: e.x as number,
      y: e.y as number,
    }));
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const CHILD = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "_digest-child.ts");

export function digestFromChild(opts: { seed?: number; full?: boolean; config?: S3MatchConfig }): {
  digest: string;
  constants_hash: string;
  end_reason: string;
  winner: string;
  tick_count: string;
} {
  const args = ["--import", "tsx", CHILD];
  let tmp: string | undefined;
  if (opts.config) {
    tmp = path.join(os.tmpdir(), `s3-digest-${process.pid}-${Date.now()}.json`);
    fs.writeFileSync(tmp, JSON.stringify(opts.config));
    args.push("--config", tmp);
  } else {
    args.push("--seed", String(opts.seed ?? 20261122));
    if (opts.full) args.push("--full");
  }
  try {
    const r = spawnSync(process.execPath, args, {
      encoding: "utf8",
      cwd: ROOT,
      env: process.env,
      timeout: 120_000,
    });
    if (r.status !== 0) {
      throw new Error(`_digest-child failed (status=${r.status}): ${r.stderr || r.stdout}`);
    }
    const out = r.stdout;
    const digest = /^digest=(.+)$/m.exec(out)?.[1]?.trim();
    const constants_hash = /^constants_hash=(.+)$/m.exec(out)?.[1]?.trim();
    const end_reason = /^end_reason=(.*)$/m.exec(out)?.[1]?.trim() ?? "";
    const winner = /^winner=(.*)$/m.exec(out)?.[1]?.trim() ?? "";
    const tick_count = /^tick_count=(.*)$/m.exec(out)?.[1]?.trim() ?? "";
    if (!digest || !constants_hash) throw new Error(`child missing fields:\n${out}`);
    return { digest, constants_hash, end_reason, winner, tick_count };
  } finally {
    if (tmp) fs.rmSync(tmp, { force: true });
  }
}

export { DEFAULT_CONSTANTS, XP_TO_LEVEL, defaultEvenConfig, digestEvents, simulate };
