/**
 * Acceptance harness. Imports ONLY the sim's public entry (`simulate`, `defaultEvenConfig`) and drives it through
 * MatchConfig lab hooks. No sim internals, no kits.ts, no data/ imports. See README.md for the required surface.
 */
import { defaultEvenConfig, simulate } from "../../../sim/index.js";
import { ABILITIES, ab, statAt, type Ability, type Key } from "./_oracle.js";

export type UId = "blue:top" | "blue:jungle" | "blue:mid" | "blue:adc" | "blue:support" | "red:top" | "red:jungle" | "red:mid" | "red:adc" | "red:support";
export type Ev = { t: number; tick: number; seq: number; type: string; [k: string]: any };

export interface UnitSpec {
  champ: string; level?: number; x: number; y: number;
  /** absolute HP, or {frac} of the unit's max HP at its level (max HP comes from the spec table via the oracle) */
  hp?: number | { frac: number };
  /** let this unit auto-attack from t=0 (default: autos disabled via auto_next_start_t=999) */
  auto?: boolean | number;
  as?: number; range?: number;
  attrs?: Partial<{ aim: number; reflexes: number; execution: number; decision: number; positioning: number; teamwork: number }>;
}
export interface CastSpec { tick: number; by: UId; key: Key; target?: UId; aim?: [number, number]; force_hit?: boolean }
export interface CcSpecIn { tick: number; target: UId; kind: string; duration: number; source?: UId }
export interface Scenario {
  seed?: number; T: number;
  units: Partial<Record<UId, UnitSpec>>;
  casts?: CastSpec[]; cc?: CcSpecIn[];
  damage?: { tick: number; source: UId; target: UId; raw: number }[];
  motor?: Partial<Record<UId, { to: [number, number][]; arrive_r?: number }>>;
  attack_reset?: { tick: number; unit: UId; pending: boolean }[];
  skillshots?: { tick: number; source: UId; target: UId; count: number }[];
  pos?: boolean;
  /** use real map coordinates (sanctuary / pillar / brawl scenarios); default: logical coords shifted by -ZONE_SHIFT in x */
  abs?: boolean;
}

export const DT = 0.1;
/**
 * Zone avoidance (spec §5.5 L270: zone centre (12,8) r=3.0; exclusive occupation for 3.0 s makes the zone owned, which grants +10 resists).
 * Scenarios are written in LOGICAL coordinates (caster ≈ (6,8)); the harness translates x by -ZONE_SHIFT so that damaged targets stay
 * ≥3.5 tiles from the zone centre, and translates positions read back. Scenarios with `abs: true` use real map coordinates.
 */
export const ZONE_SHIFT = 3.5;
export const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
export const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

export class Run {
  constructor(public events: Ev[], public units: Record<string, any>, public digest: string, public sc: Scenario, public shift = 0) {}
  of(type: string, pred?: (e: Ev) => boolean): Ev[] { return this.events.filter((e) => e.type === type && (!pred || pred(e))); }
  unit(id: UId) { return this.units[id]; }
  static isAuto(e: Ev) { return e.auto === true || e.skill_id === "auto" || e.skill_id === "Auto"; }
  /** Spec §4.4 `hit`: skill hits (non-auto). */
  skillHits(src?: UId, tgt?: UId, key?: { champ: string; key: Key }): Ev[] {
    return this.of("hit", (e) => !Run.isAuto(e) && (!src || e.source_id === src) && (!tgt || e.target_id === tgt) && (!key || skillIs(e, key.champ, key.key)));
  }
  autoHits(src: UId, t0 = 0, t1 = 1e9, tgt?: UId): Ev[] { return this.of("hit", (e) => Run.isAuto(e) && e.source_id === src && (!tgt || e.target_id === tgt) && e.t >= t0 - 1e-9 && e.t <= t1 + 1e-9); }
  casts(by: UId, key?: Key): Ev[] { return this.of("cast_start", (e) => e.unit_id === by && (!key || skillKey(e.skill_id) === key)); }
  status(target: UId, kind?: string | string[], src?: UId): Ev[] {
    const ks = kind === undefined ? undefined : Array.isArray(kind) ? kind : [kind];
    return this.of("status_apply", (e) => e.target_id === target && (!ks || ks.includes(e.kind)) && (!src || e.source_id === src));
  }
  expires(target: UId, kind: string | string[]): Ev[] { const ks = Array.isArray(kind) ? kind : [kind]; return this.of("status_expire", (e) => e.target_id === target && ks.includes(e.kind)); }
  heals(src?: UId, tgt?: UId): Ev[] { return this.of("heal", (e) => (!src || e.source_id === src) && (!tgt || e.target_id === tgt)); }
  shields(src?: UId, tgt?: UId): Ev[] { return this.of("shield_apply", (e) => (!src || e.source_id === src) && (!tgt || e.target_id === tgt)); }
  /** §4.4 `move` (lab-verbose, enabled by debug_pos): per-tick samples. */
  series(id: UId): { t: number; x: number; y: number }[] { return this.of("move", (e) => e.unit_id === id).map((e) => ({ t: e.t, x: e.x + this.shift, y: e.y })); }
  posAt(id: UId, t: number): { x: number; y: number } {
    const s = this.series(id);
    if (!s.length) throw new Error(`no \`move\` events for ${id}: sim must emit spec §4.4 move events when MatchConfig.debug_pos=true`);
    let best = s[0]!; for (const p of s) if (p.t <= t + 1e-9) best = p; return best;
  }
  /** per-tick speed samples between consecutive `move` samples */
  speeds(id: UId): { t: number; v: number }[] {
    const s = this.series(id); const out: { t: number; v: number }[] = [];
    for (let i = 1; i < s.length; i++) out.push({ t: s[i]!.t, v: Math.hypot(s[i]!.x - s[i - 1]!.x, s[i]!.y - s[i - 1]!.y) / (s[i]!.t - s[i - 1]!.t) });
    return out;
  }
}

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
/** Event `skill_id` is not specified by the spec beyond "skill_id". Accepted forms: the ability name (any case/punctuation),
 *  `<champ><key>` with any separator, or the bare key. See README. */
export function skillKey(skill_id: unknown): Key | null {
  const s = String(skill_id ?? "");
  if (/^[QWR]$/i.test(s)) return s.toUpperCase() as Key;
  const n = norm(s);
  for (const a of ABILITIES) if (n === norm(a.name) || n.includes(norm(a.name))) return a.key;
  const m = /(?:^|[^a-z])([qwr])$/i.exec(s); if (m) return m[1]!.toUpperCase() as Key;
  const m2 = /^[a-z]+([qwr])$/i.exec(s); if (m2) return m2[1]!.toUpperCase() as Key;
  return null;
}
export function skillIs(e: Ev, champ: string, key: Key): boolean {
  const a = ab(champ, key); const n = norm(e.skill_id);
  if (n === norm(a.name) || n.includes(norm(a.name))) return true;
  if (/^[qwr]$/.test(n)) return n === key.toLowerCase();
  return (n === `${champ}${key.toLowerCase()}` || n.endsWith(`${champ}${key.toLowerCase()}`));
}

export function maxHp(champ: string, level: number) { return statAt(champ, level).hp; }

export function run(sc: Scenario): Run {
  const sh = sc.abs ? 0 : ZONE_SHIFT;
  const cfg: any = { ...defaultEvenConfig(sc.seed ?? 20261122), constants: { MATCH_T: sc.T }, debug_pos: sc.pos ?? false };
  const uo: any = {};
  for (const [id, u] of Object.entries(sc.units)) {
    const level = u!.level ?? 7;
    const o: any = { champ: u!.champ, level, x: u!.x - sh, y: u!.y, spawn_shield_until: 0, auto_next_start_t: u!.auto ? (typeof u!.auto === "number" ? u!.auto : 0) : 999 };
    if (u!.hp !== undefined) o.hp = typeof u!.hp === "number" ? u!.hp : maxHp(u!.champ, level) * u!.hp.frac;
    if (u!.as !== undefined) o.as = u!.as; if (u!.range !== undefined) o.range = u!.range;
    if (u!.attrs) o.attrs = u!.attrs;
    uo[id] = o;
  }
  // every default unit NOT named by the scenario is idle: no autos (it would contaminate hp/xp/assist/event assertions) and it stays at its spawn.
  for (const team of ["blue", "red"]) for (const role of ["top", "jungle", "mid", "adc", "support"]) { const id = `${team}:${role}`; if (!uo[id]) uo[id] = { auto_next_start_t: 999, spawn_shield_until: 0 }; }
  cfg.unit_overrides = uo;
  cfg.scripted_casts = (sc.casts ?? []).map((c) => ({ tick: c.tick, source_id: c.by, skill: c.key, ...(c.target ? { target_id: c.target } : {}), ...(c.aim ? { aim_x: c.aim[0] - sh, aim_y: c.aim[1] } : {}), ...(c.force_hit !== undefined ? { force_hit: c.force_hit } : { force_hit: true }) }));
  if (sc.cc) cfg.scripted_cc = sc.cc.map((c) => ({ tick: c.tick, target_id: c.target, kind: c.kind, duration: c.duration, ...(c.source ? { source_id: c.source } : {}) }));
  if (sc.damage) cfg.scripted_damage = sc.damage.map((d) => ({ tick: d.tick, source_id: d.source, target_id: d.target, raw: d.raw }));
  if (sc.motor) { cfg.scripted_motor = {}; for (const [id, m] of Object.entries(sc.motor)) cfg.scripted_motor[id] = { waypoints: m!.to.map(([x, y]) => ({ x: x - sh, y })), arrive_r: m!.arrive_r ?? 0.05, hold_at_end: true }; }
  if (sc.attack_reset) cfg.scripted_attack_reset = sc.attack_reset.map((a) => ({ tick: a.tick, unit_id: a.unit, pending: a.pending }));
  if (sc.skillshots) cfg.scripted_skillshots = sc.skillshots.map((s) => ({ tick: s.tick, source_id: s.source, target_id: s.target, count: s.count }));
  const r: any = simulate(cfg);
  const units: Record<string, any> = {}; for (const u of r.state.units) units[u.id] = { ...u, x: u.x + sh };
  return new Run(r.events as Ev[], units, r.digest, sc, sh);
}

/**
 * L1899 makes every living same-team unit part of the hex centroid. `run()` parks
 * unnamed defaultEvenConfig slots as living idle champs at the team spawn, which
 * yanks a mid-lane hex victim toward that cluster. Call this when a scenario hexes
 * a unit whose motion is not under test: occupy every unused slot on `team` with
 * living allies placed explicitly so the centroid stays at `at`.
 *
 * Anchors sit at y±5 (off a typical mid-lane skillshot). Requires an even number
 * of unused slots (2 or 4 in the fixtures that use it) so the average is exactly `at`.
 * Robust to the L214 spawn-slot ruling (pad centre + role×SPAWN_SLOT_SPACING, and
 * the deletion of SPAWN_JITTER_Y): this helper never reads filler positions, the
 * pad centre, or jitter.
 */
export function occupyTeamAt(team: "blue" | "red", at: [number, number], existing: Partial<Record<UId, UnitSpec>>): Partial<Record<UId, UnitSpec>> {
  const unused = (["top", "jungle", "mid", "adc", "support"] as const)
    .map((role) => `${team}:${role}` as UId)
    .filter((id) => !existing[id]);
  const out: Partial<Record<UId, UnitSpec>> = {};
  unused.forEach((id, i) => {
    out[id] = { champ: "torun", level: 7, x: at[0], y: at[1] + (i % 2 === 0 ? 5 : -5) };
  });
  return out;
}

/** Shared geometry for single-ability scenarios. Caster blue:mid at (6,8); enemy red:mid; ally blue:adc. */
export const CASTER: UId = "blue:mid";
export const FOE: UId = "red:mid";
export const ALLY: UId = "blue:adc";
export const CX = 6, CY = 8;

/** Default test distance caster→primary target (kept inside range, outside body overlap). */
export function testDist(a: Ability): number {
  switch (a.shape) {
    case "circle_self": return 1.5;
    case "circle_target": return Math.min(1.2, a.range - 0.3);
    case "cone_target": return Math.min(2.0, a.range - 0.5);
    case "streak": return Math.min(3.0, a.range - 0.5);
    case "target": case "ally_target": case "circle_ally": return 3.0;
    default: return Math.min(3.0, Math.max(1.5, a.range - 0.5));
  }
}

/** Memoised lazy value: scenarios are built inside tests (never at collection time) so one sim crash fails tests, not the whole file. */
export function lazy<T>(f: () => T): () => T { let v: T | undefined; let done = false; return () => { if (!done) { v = f(); done = true; } return v as T; }; }

/**
 * Spec L124: HP is a displayed integer, "floor after applied damage" => an event's hp_after is floor(exact HP). So a recovered
 * hp_before = hp_after + mitigated + shield_absorbed is within [exact-1, exact] and exact HP after a hit satisfies hp_after <= exact < hp_after+1.
 */
export const floorsTo = (hp_after: number, exact: number) => hp_after <= exact + 1e-6 && hp_after > exact - 1 - 1e-6;
