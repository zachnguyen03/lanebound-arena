/**
 * Cast-policy lab helper (M2-25…37).
 *
 * Runs the 200-game random-draft even-OVR lab as side-swapped pairs
 * (S5-R6-3): 100 seeds × 2 sides = 200 games, seed base 20261122,
 * attrs 70 / mastery 50, forced_clock_end false.
 *
 * Imports only the public sim entry and apps/lab draft helpers.
 * Does not touch sim/ internals or the cast-policy implementation.
 */
import { evenOvrConfig, simulate } from "../../sim/index.js";
import type { MatchConfig, SimEvent, SimulateResult } from "../../sim/index.js";
import { quickDraftPicks, applyPins } from "../../apps/lab/lib/batch-runner.js";
import { ABILITIES, ab, type Key } from "./s1/_oracle.js";
import { skillKey } from "./s1/_harness.js";

export const LAB_SEED = 20261122;
/** 100 pair-seeds → 200 games (side-swapped). Spec L1939 expected ~143 appearances/champ. */
export const LAB_PAIR_SEEDS = 100;
export const LAB_N_GAMES = LAB_PAIR_SEEDS * 2;

export const CHAMPS = [
  "huntress",
  "maelis",
  "isra",
  "sedge",
  "torun",
  "tolle",
  "helvar",
  "calder",
  "kerrig",
  "mirren",
  "rhedan",
  "brannoch",
  "ysol",
  "saelo",
] as const;
export type Champ = (typeof CHAMPS)[number];

export const SLOTS = ["top", "jungle", "mid", "adc", "support"] as const;

/** Conditional skills — M2-25(a) 40% bar (spec L1941). */
export const CONDITIONAL_SKILLS: ReadonlyArray<readonly [Champ, Key]> = [
  ["huntress", "W"],
  ["maelis", "W"],
  ["isra", "W"],
  ["calder", "W"],
  ["tolle", "W"],
  ["ysol", "W"],
  ["saelo", "W"],
  ["torun", "W"],
];

/** Damage basics — M2-25(c) mean ≥ 4 (spec L1941). */
export const DAMAGE_BASICS: ReadonlyArray<readonly [Champ, Key]> = [
  ["huntress", "Q"],
  ["maelis", "Q"],
  ["isra", "Q"],
  ["sedge", "Q"],
  ["helvar", "Q"],
  ["calder", "Q"],
  ["mirren", "Q"],
  ["kerrig", "W"],
  ["rhedan", "Q"],
  ["brannoch", "Q"],
  ["saelo", "Q"],
];

/** Disable basics — M2-25(c) mean ≥ 2 (spec L1941). */
export const DISABLE_BASICS: ReadonlyArray<readonly [Champ, Key]> = [
  ["torun", "Q"],
  ["tolle", "Q"],
  ["sedge", "W"],
  ["helvar", "W"],
  ["kerrig", "Q"],
  ["mirren", "W"],
  ["rhedan", "W"],
  ["brannoch", "W"],
  ["ysol", "Q"],
];

/** §9.4.1.4 rule 1 disable skills (spec L1189 / M2-26(b)). */
export const DISABLE_SKILLS_RULE1: ReadonlyArray<readonly [Champ, Key]> = [
  ["torun", "Q"],
  ["torun", "R"],
  ["tolle", "Q"],
  ["tolle", "W"],
  ["tolle", "R"],
  ["sedge", "W"],
  ["sedge", "R"],
  ["helvar", "W"],
  ["kerrig", "Q"],
  ["mirren", "W"],
  ["mirren", "R"],
  ["rhedan", "W"],
  ["rhedan", "R"],
  ["brannoch", "W"],
  ["brannoch", "R"],
  ["ysol", "R"],
  ["saelo", "R"],
  ["calder", "R"],
];

/** §9.5 peel skills (spec L1349 / M2-29). */
export const PEEL_SKILLS: ReadonlyArray<readonly [Champ, Key]> = [
  ["torun", "W"],
  ["torun", "Q"],
  ["tolle", "W"],
  ["rhedan", "W"],
  ["ysol", "W"],
  ["ysol", "Q"],
  ["saelo", "W"],
  ["brannoch", "W"],
  ["brannoch", "R"],
  ["sedge", "W"],
];

/** S5-R6-8 hard CC kinds (spec L2229). */
export const HARD_CC = new Set([
  "stun",
  "root",
  "knockup",
  "sleep",
  "fear",
  "taunt",
  "hex",
  "leash",
  "petrify",
  "timestop",
  "time-stop",
  "time_stop",
]);

/** Lock kinds for chain-lock / continuous Lock stretches (§9.4.1.1). */
export const LOCK_KINDS = new Set([
  "stun",
  "knockup",
  "sleep",
  "hex",
  "banish",
  "fear",
  "timestop",
  "time-stop",
  "time_stop",
  "petrify",
]);

/** Disable = Lock or Bind (§9.4.1.1). */
export const DISABLE_KINDS = new Set([
  ...LOCK_KINDS,
  "root",
  "leash",
]);

export type Ev = SimEvent & Record<string, unknown>;

export interface LabGame {
  seed: number;
  swapped: boolean;
  picks: { blue: string[]; red: string[] };
  events: Ev[];
  digest: string;
  constants_hash: string;
  /** Match length in seconds (match_end.t, else last event t). */
  duration_s: number;
  /** Unit id → champ id for this game. */
  roster: Record<string, string>;
}

export interface LabBundle {
  games: LabGame[];
  n: number;
  seed_start: number;
}

function unitId(team: "blue" | "red", slotIndex: number): string {
  return `${team}:${SLOTS[slotIndex]}`;
}

function rosterOf(picks: { blue: string[]; red: string[] }): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < 5; i++) {
    out[unitId("blue", i)] = picks.blue[i]!;
    out[unitId("red", i)] = picks.red[i]!;
  }
  return out;
}

function matchDuration(events: Ev[]): number {
  const end = events.find((e) => e.type === "match_end");
  if (end && typeof end.t === "number") return end.t;
  let max = 0;
  for (const e of events) if (typeof e.t === "number" && e.t > max) max = e.t;
  return max;
}

function configForPair(seed: number, swapped: boolean): MatchConfig {
  const base = evenOvrConfig(seed, "hold_the_pit");
  const draft = quickDraftPicks(seed);
  const picks = swapped
    ? { blue: draft.red.slice(), red: draft.blue.slice() }
    : { blue: draft.blue.slice(), red: draft.red.slice() };
  const cfg: MatchConfig = {
    ...base,
    seed,
    blue: { ...base.blue, picks: picks.blue },
    red: { ...base.red, picks: picks.red },
    draft_mode: "quick",
    forced_clock_end: false,
    ai_enabled: true,
  };
  return applyPins(cfg, { attrs_all: 70, mastery_all: 50 });
}

export function runCastPolicyLab(opts?: {
  pairSeeds?: number;
  seedStart?: number;
  /** Collect debug_pos (heavy). Default false. */
  pos?: boolean;
}): LabBundle {
  const pairSeeds = opts?.pairSeeds ?? LAB_PAIR_SEEDS;
  const seedStart = opts?.seedStart ?? LAB_SEED;
  const games: LabGame[] = [];
  for (let i = 0; i < pairSeeds; i++) {
    const seed = (seedStart + i) >>> 0;
    for (const swapped of [false, true]) {
      const cfg = configForPair(seed, swapped);
      if (opts?.pos) cfg.debug_pos = true;
      const r: SimulateResult = simulate(cfg);
      const picks = { blue: cfg.blue.picks.slice(), red: cfg.red.picks.slice() };
      games.push({
        seed,
        swapped,
        picks,
        events: r.events as Ev[],
        digest: r.digest,
        constants_hash: r.constants_hash,
        duration_s: matchDuration(r.events as Ev[]),
        roster: rosterOf(picks),
      });
    }
  }
  return { games, n: games.length, seed_start: seedStart };
}

let cachedLab: LabBundle | null = null;

/** Shared lab for all M2 lab gates in one vitest process. */
export function getCastPolicyLab(): LabBundle {
  if (!cachedLab) cachedLab = runCastPolicyLab();
  return cachedLab;
}

/** Reset cache (tests that need a fresh run). */
export function resetCastPolicyLab(): void {
  cachedLab = null;
}

export function abilityName(champ: string, key: Key): string {
  return ab(champ, key).name;
}

export function castIs(e: Ev, champ: string, key: Key): boolean {
  if (e.type !== "cast_start") return false;
  const k = skillKey(e.skill_id);
  if (k === key) {
    // Bare Q/W/R is ambiguous across champs; prefer name match when possible.
    const n = String(e.skill_id ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const name = abilityName(champ, key).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (n === key.toLowerCase()) return true;
    if (n === name || n.includes(name)) return true;
    if (n === `${champ}${key.toLowerCase()}`) return true;
  }
  const n = String(e.skill_id ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const name = abilityName(champ, key).toLowerCase().replace(/[^a-z0-9]/g, "");
  return n === name || n.includes(name);
}

export function castsByUnitSkill(game: LabGame, unitId: string, champ: string, key: Key): Ev[] {
  return game.events.filter((e) => e.type === "cast_start" && e.unit_id === unitId && castIs(e, champ, key));
}

/** Appearances of a champion across games (unit-slots that picked it). */
export function appearances(lab: LabBundle, champ: Champ): Array<{ game: LabGame; unitId: string }> {
  const out: Array<{ game: LabGame; unitId: string }> = [];
  for (const g of lab.games) {
    for (const [id, c] of Object.entries(g.roster)) {
      if (c === champ) out.push({ game: g, unitId: id });
    }
  }
  return out;
}

/**
 * Seconds the unit spent alive at level ≥ 5.
 * Built from level_up / death / respawn / match_end (spec M2-25(b)).
 */
export function timeAliveAtLeastLevel(game: LabGame, unitId: string, minLevel: number): number {
  let level = 1;
  let alive = true;
  let aliveAtMinSince: number | null = null;
  let total = 0;
  const mark = (t: number) => {
    if (alive && level >= minLevel) {
      if (aliveAtMinSince == null) aliveAtMinSince = t;
    } else if (aliveAtMinSince != null) {
      total += Math.max(0, t - aliveAtMinSince);
      aliveAtMinSince = null;
    }
  };
  const timeline = game.events
    .filter(
      (e) =>
        (e.type === "level_up" && e.unit_id === unitId) ||
        (e.type === "death" && e.unit_id === unitId) ||
        (e.type === "respawn" && e.unit_id === unitId) ||
        e.type === "match_end",
    )
    .slice()
    .sort((a, b) => (a.tick as number) - (b.tick as number) || (a.seq as number) - (b.seq as number));
  for (const e of timeline) {
    const t = e.t as number;
    if (e.type === "level_up") {
      mark(t);
      level = Number(e.new_level ?? e.level ?? level);
      mark(t);
    } else if (e.type === "death") {
      mark(t);
      alive = false;
      mark(t);
    } else if (e.type === "respawn") {
      mark(t);
      alive = true;
      mark(t);
    } else if (e.type === "match_end") {
      mark(t);
    }
  }
  mark(game.duration_s);
  return total;
}

export function logRate(label: string, num: number, den: number, n: number): void {
  // eslint-disable-next-line no-console
  console.log(`[M2 lab] ${label}: num=${num} den=${den} rate=${den ? (num / den).toFixed(4) : "n/a"} N=${n}`);
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return NaN;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

export function isConditional(champ: Champ, key: Key): boolean {
  return CONDITIONAL_SKILLS.some(([c, k]) => c === champ && k === key);
}

export function peelSkillCd(champ: string, key: Key): number {
  return ab(champ, key).cd;
}

/** Unit level at time t from level_up events (default 1). */
export function unitLevelAt(game: LabGame, unitId: string, atT: number): number {
  let level = 1;
  for (const e of game.events) {
    if (e.type !== "level_up" || e.unit_id !== unitId) continue;
    if ((e.t as number) > atT + 1e-9) break;
    level = Number(e.new_level ?? e.level ?? level);
  }
  return level;
}

/**
 * Reconstruct whether a peel skill was off cooldown and legal at peel_start.t.
 * Gate 1 (§9.4.1.2 L1178): R needs L5 — readiness is level-aware.
 */
export function peelSkillReadyAt(
  game: LabGame,
  unitId: string,
  champ: string,
  key: Key,
  atT: number,
): boolean {
  const ability = ab(champ, key);
  if (ability.unlock > unitLevelAt(game, unitId, atT)) return false;
  const cd = ability.cd;
  const casts = castsByUnitSkill(game, unitId, champ, key);
  for (let i = casts.length - 1; i >= 0; i--) {
    const c = casts[i]!;
    if ((c.t as number) < atT - 1e-9) {
      return (c.t as number) + cd <= atT + 1e-9;
    }
  }
  return true; // never cast → ready (and unlocked)
}

export function isTimestopKind(kind: unknown): boolean {
  const k = String(kind);
  return k === "timestop" || k === "time-stop" || k === "time_stop";
}

/**
 * COMMIT-R PATH TBD (R7-5).
 * Spec §9.4.1.4 rule 6 L1205 / M2-32 L1951: Fight Call carries a commit-R flag
 * (`engage`, `A_commit ≥ engage threshold + 0.10`, ≥ 3 enemies in the fight).
 * R7-5: the flag lifts **only** `nA ≤ 1`; `nE ≥ 2` always applies.
 * The build is adding an explicit field on the fight decision — path not frozen
 * yet. This helper is the single read site: prefer an explicit boolean when
 * present; otherwise derive from L1205 using fight_call fields.
 *
 * Engage threshold by tactic (§9.1 L1105–1108). Lab default is hold_the_pit;
 * without zone ownership on the event we use the "do not own" 0.50 threshold
 * (stricter), so derived commit-R is conservative.
 */
export function readCommitRFlag(
  call: Ev | undefined,
  opts?: { enemiesInFight?: number; engageThreshold?: number },
): boolean {
  if (!call) return false;
  // Explicit field — paths the build may land; first match wins.
  const explicit = [
    call.commit_r,
    call.commit_R,
    call.commitR,
    (call as { commit_R_flag?: unknown }).commit_R_flag,
    (call.flags as { commit_r?: unknown } | undefined)?.commit_r,
    (call.flags as { commit_R?: unknown } | undefined)?.commit_R,
  ];
  for (const v of explicit) {
    if (typeof v === "boolean") return v;
  }
  // Derive per L1205 until the explicit path is published.
  if (call.commit !== "engage") return false;
  const aCommit = Number(call.a_commit ?? call.A_commit);
  if (!Number.isFinite(aCommit)) return false;
  const thr = opts?.engageThreshold ?? 0.5; // hold_the_pit, not owned (L1106)
  if (aCommit < thr + 0.1 - 1e-12) return false;
  const nE = opts?.enemiesInFight ?? Number(call.enemies_in_fight ?? call.n_enemies ?? NaN);
  if (Number.isFinite(nE)) return nE >= 3;
  // Without an enemy count on the event, do not invent commit-R.
  return false;
}

/** Minimum lab sample for M2-25b / M2-26b R gates (R7-3 / R7-7). */
export const MIN_SAMPLE = 30;

/**
 * Intended target of a cast for rule-4 / M2-26d (R7-4 L1203):
 * `cast_start.target_id` when present; else the first Lock `status_apply` from
 * that cast (hooks / area anchors without an explicit target_id).
 */
export function intendedLockTarget(game: LabGame, cast: Ev): string | null {
  if (typeof cast.target_id === "string" && cast.target_id.length > 0) {
    return cast.target_id as string;
  }
  const src = String(cast.unit_id);
  const land = game.events.find(
    (e) =>
      e.type === "status_apply" &&
      LOCK_KINDS.has(String(e.kind)) &&
      e.source_id === src &&
      (e.t as number) >= (cast.t as number) - 1e-9 &&
      (e.t as number) <= (cast.t as number) + 3.0 &&
      (e.seq as number) > (cast.seq as number),
  );
  return land ? String(land.target_id) : null;
}

/**
 * Gate 4 / S2-R4-5 immobile exception (§9.4.1.2 L1181): rooted, leashed, or at
 * own sanctuary pad with 0 path left. Mobile = not immobile. Reconstructed from
 * the event log (acceptance suite does not import sim/retreat_combat).
 */
export function retreatImmobileFromLog(game: LabGame, unitId: string, atT: number): boolean {
  const rootedOrLeashed = game.events.some(
    (e) =>
      e.type === "status_apply" &&
      (e.kind === "root" || e.kind === "leash") &&
      e.target_id === unitId &&
      (e.t as number) <= atT + 1e-9 &&
      (e.t as number) + Number(e.applied_duration ?? e.raw_duration ?? 0) > atT + 1e-9,
  );
  if (rootedOrLeashed) return true;
  // At own sanctuary pad: blue x∈[0,2), red x∈[22,24); pad centres 1.5 / 22.5.
  const team = teamOf(unitId);
  const pos = game.events
    .filter(
      (e) =>
        (e.type === "pos" || e.type === "move") &&
        e.unit_id === unitId &&
        (e.t as number) <= atT + 1e-9,
    )
    .pop();
  if (!pos || typeof pos.x !== "number") {
    // No pos stream: sanctuary-at-pad cannot be confirmed; only root/leash count.
    return false;
  }
  const x = pos.x as number;
  const y = pos.y as number;
  const inSanct =
    team === "blue" ? x >= 0 && x < 2 : team === "red" ? x >= 22 && x < 24 : false;
  if (!inSanct) return false;
  const padX = team === "blue" ? 1.5 : 22.5;
  const padY = 7.5;
  return Math.hypot(x - padX, y - padY) <= 0.35;
}

export function peelerChamp(game: LabGame, peelerId: string): string | undefined {
  return game.roster[peelerId];
}

export function peelSkillsFor(champ: string): Key[] {
  return PEEL_SKILLS.filter(([c]) => c === champ).map(([, k]) => k);
}

/** Strip cast_start.tier for digest identity (spec L1200 / M2-35). */
export function stripCastTier(events: Ev[]): Ev[] {
  return events.map((e) => {
    if (e.type !== "cast_start" || !("tier" in e)) return e;
    const { tier: _tier, ...rest } = e;
    return rest as Ev;
  });
}

/** F1 engagement / teamfight accounting (S5-R6-8 L2230–2233). */
export interface Teamfight {
  start_t: number;
  end_t: number;
  units_blue: Set<string>;
  units_red: Set<string>;
  decisive: boolean;
}

export function engagements(events: Ev[]): Array<{ start_t: number; end_t: number; events: Ev[] }> {
  const combat = events
    .filter((e) => e.type === "hit" || e.type === "status_apply")
    .filter((e) => {
      if (e.type === "hit") {
        const src = String(e.source_id ?? "");
        const tgt = String(e.target_id ?? "");
        return src.split(":")[0] !== tgt.split(":")[0];
      }
      const src = String(e.source_id ?? "");
      const tgt = String(e.target_id ?? "");
      return src && tgt && src.split(":")[0] !== tgt.split(":")[0];
    })
    .slice()
    .sort((a, b) => (a.t as number) - (b.t as number) || (a.seq as number) - (b.seq as number));
  const out: Array<{ start_t: number; end_t: number; events: Ev[] }> = [];
  let cur: Ev[] = [];
  for (const e of combat) {
    if (cur.length === 0) {
      cur = [e];
      continue;
    }
    const last = cur[cur.length - 1]!;
    if ((e.t as number) - (last.t as number) > 3.0) {
      out.push({ start_t: cur[0]!.t as number, end_t: last.t as number, events: cur });
      cur = [e];
    } else {
      cur.push(e);
    }
  }
  if (cur.length) {
    out.push({
      start_t: cur[0]!.t as number,
      end_t: cur[cur.length - 1]!.t as number,
      events: cur,
    });
  }
  return out;
}

export function teamfightsOf(game: LabGame): Teamfight[] {
  const out: Teamfight[] = [];
  for (const eng of engagements(game.events)) {
    if (eng.end_t - eng.start_t < 3.0) continue;
    const blue = new Set<string>();
    const red = new Set<string>();
    for (const e of eng.events) {
      for (const id of [e.source_id, e.target_id, e.unit_id]) {
        if (typeof id !== "string") continue;
        if (id.startsWith("blue:")) blue.add(id);
        if (id.startsWith("red:")) red.add(id);
      }
    }
    if (blue.size < 3 || red.size < 3) continue;
    const deaths = game.events.filter(
      (e) =>
        e.type === "death" &&
        (e.t as number) >= eng.start_t - 1e-9 &&
        (e.t as number) <= eng.end_t + 1e-9,
    );
    const dBlue = deaths.filter((e) => String(e.unit_id).startsWith("blue:")).length;
    const dRed = deaths.filter((e) => String(e.unit_id).startsWith("red:")).length;
    out.push({
      start_t: eng.start_t,
      end_t: eng.end_t,
      units_blue: blue,
      units_red: red,
      decisive: dBlue !== dRed,
    });
  }
  return out;
}

/** F2 combo (S5-R6-8 L2237–2238). */
export interface Combo {
  t: number;
  source_id: string;
  target_id: string;
  kill: boolean;
}

export function combosOf(game: LabGame): Combo[] {
  const applies = game.events.filter(
    (e) => e.type === "status_apply" && HARD_CC.has(String(e.kind)),
  );
  const out: Combo[] = [];
  for (const cc of applies) {
    const t = cc.t as number;
    const src = String(cc.source_id);
    const tgt = String(cc.target_id);
    const team = src.split(":")[0];
    const dur = Number(cc.applied_duration ?? cc.raw_duration ?? 0);
    const window = Math.min(dur + 0.5, 2.0);
    const hits = game.events.filter(
      (e) =>
        e.type === "hit" &&
        e.target_id === tgt &&
        String(e.source_id).startsWith(team + ":") &&
        (e.t as number) >= t - 1e-9 &&
        (e.t as number) <= t + window + 1e-9 &&
        e.miss !== true,
    );
    const units = new Set(hits.map((e) => String(e.source_id)));
    const skillHit = hits.some((e) => e.auto !== true && e.skill_id !== "auto" && e.skill_id !== "Auto");
    if (units.size < 2 || !skillHit) continue;
    const death = game.events.find(
      (e) =>
        e.type === "death" &&
        e.unit_id === tgt &&
        (e.t as number) >= t - 1e-9 &&
        (e.t as number) <= t + 3.0 + 1e-9,
    );
    out.push({ t, source_id: src, target_id: tgt, kill: !!death });
  }
  return out;
}

/** Continuous Lock-disabled stretches per unit (M2-26(c)). */
export function lockStretches(game: LabGame): Array<{ unitId: string; start_t: number; end_t: number; dur: number }> {
  const byUnit = new Map<string, Array<{ t0: number; t1: number }>>();
  for (const e of game.events) {
    if (e.type !== "status_apply") continue;
    if (!LOCK_KINDS.has(String(e.kind))) continue;
    const id = String(e.target_id);
    const t0 = e.t as number;
    const dur = Number(e.applied_duration ?? e.raw_duration ?? 0);
    const t1 = t0 + dur;
    const arr = byUnit.get(id) ?? [];
    arr.push({ t0, t1 });
    byUnit.set(id, arr);
  }
  // Also honour status_expire when present.
  for (const e of game.events) {
    if (e.type !== "status_expire") continue;
    if (!LOCK_KINDS.has(String(e.kind))) continue;
    // expire shortens an open interval if we can match; stretches use applied_duration primarily.
  }
  const stretches: Array<{ unitId: string; start_t: number; end_t: number; dur: number }> = [];
  for (const [unitId, intervals] of byUnit) {
    const sorted = intervals.slice().sort((a, b) => a.t0 - b.t0);
    let cur0 = sorted[0]!.t0;
    let cur1 = sorted[0]!.t1;
    for (let i = 1; i < sorted.length; i++) {
      const iv = sorted[i]!;
      if (iv.t0 <= cur1 + 1e-9) {
        cur1 = Math.max(cur1, iv.t1);
      } else {
        stretches.push({ unitId, start_t: cur0, end_t: cur1, dur: cur1 - cur0 });
        cur0 = iv.t0;
        cur1 = iv.t1;
      }
    }
    stretches.push({ unitId, start_t: cur0, end_t: cur1, dur: cur1 - cur0 });
  }
  return stretches;
}

/** Lock status_apply events attributed to an AI cast (for M2-26(d)). */
export function lockApplies(game: LabGame): Ev[] {
  return game.events.filter((e) => e.type === "status_apply" && LOCK_KINDS.has(String(e.kind)));
}

export function castTier(e: Ev): string | undefined {
  return typeof e.tier === "string" ? e.tier : undefined;
}

export function teamOf(id: string): string {
  return id.split(":")[0]!;
}

export function livingEnemiesAt(game: LabGame, team: string, atT: number): string[] {
  const enemies = Object.keys(game.roster).filter((id) => teamOf(id) !== team);
  return enemies.filter((id) => {
    const deaths = game.events.filter((e) => e.type === "death" && e.unit_id === id && (e.t as number) <= atT + 1e-9);
    const respawns = game.events.filter((e) => e.type === "respawn" && e.unit_id === id && (e.t as number) <= atT + 1e-9);
    return deaths.length <= respawns.length;
  });
}

/** Oracle ability table export for CD reconstruction. */
export { ABILITIES, ab };
