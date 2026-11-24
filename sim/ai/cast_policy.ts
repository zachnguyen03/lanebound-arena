/**
 * §9.4.1 cast policy. One cast per tick, tiers P1 → P4s.
 * K-1 / K-2 / K-3 are not applied (no Kerrig damage cut, no skillshot
 * formula change, no Maelis number change).
 *
 * A test `table` override keeps the old Q→W→R stub evaluator so plumbing
 * fixtures stay stable. Production calls omit `table` and use CAST_POLICIES.
 */
import { CHAMPIONS } from "../../data/champions/defs.js";
import { KITS, type AbilityDef } from "../../data/champions/kits.js";
import { canCastSkill } from "../cast.js";
import type { Constants } from "../constants.js";
import { abilityBaseRaw } from "../formula.js";
import {
  circleHitsUnit,
  coneHitsUnit,
  lineHitsUnit,
  lineLengthUntilPillar,
} from "../geometry.js";
import { clipMove, inOwnSanctuary } from "../map.js";
import { hasMark } from "../marks.js";
import { dist as distPts, normalize } from "../math.js";
import { mit, skillScale } from "../stats.js";
import {
  isBanished,
  isLeashed,
  isLocked,
  isRooted,
  isTimeStopped,
  lockOwed,
  strongestSlow,
  type CcKind,
} from "../status.js";
import type { MatchState, UnitId, UnitState } from "../types.js";
import {
  clamp,
  comboFollowS,
  diveSlack,
  effAim,
  effExecution,
  perceptionDelayS,
  reactionDelayS,
  rHoldA,
  rHoldHp,
  skillshotHitChance,
} from "./attributes.js";
import { commitThresholds, type CommitKind } from "./fight.js";
import { pickUnitTarget } from "./target.js";

export type SkillKey = "Q" | "W" | "R";

export type CastTier = "P1a" | "P1b" | "P1c" | "P1d" | "P2" | "P2c" | "P3" | "P4" | "P4s";

export type CastTargetKind =
  | "focus_enemy"
  | "nearest_enemy"
  | "self"
  | "lowest_hp_ally"
  | "peel_diver"
  | "none";

export interface SkillCastPolicy {
  enabled: boolean;
  target: CastTargetKind;
  prefer_cc_chain?: boolean;
  requires_mark?: "huntress" | "kerrig";
  execution_setup_min?: number;
  decision_min?: number;
  skillshot?: boolean;
}

export type KitCastPolicy = Partial<Record<SkillKey, SkillCastPolicy>>;

export interface PolicySkill {
  skill: SkillKey;
  /** Tiers this skill may fire. Anything else is a no-cast. */
  tiers: readonly CastTier[];
}

const TIERS: readonly CastTier[] = ["P1a", "P1b", "P1c", "P1d", "P2", "P2c", "P3", "P4", "P4s"];

/** Per-kit rows from §9.4.1.5. The evaluator only fires listed tiers. */
export const CAST_POLICIES: Readonly<Record<string, readonly PolicySkill[]>> = Object.freeze({
  huntress: [
    { skill: "Q", tiers: ["P2", "P4"] },
    { skill: "W", tiers: ["P1d"] },
    { skill: "R", tiers: ["P2", "P4"] },
  ],
  maelis: [
    { skill: "Q", tiers: ["P2", "P4"] },
    { skill: "W", tiers: ["P1d"] },
    { skill: "R", tiers: ["P2", "P4"] },
  ],
  isra: [
    { skill: "Q", tiers: ["P2", "P4"] },
    { skill: "W", tiers: ["P1d"] },
    { skill: "R", tiers: ["P2", "P4"] },
  ],
  sedge: [
    { skill: "Q", tiers: ["P2", "P4"] },
    { skill: "W", tiers: ["P1b", "P2c", "P3", "P4s"] },
    { skill: "R", tiers: ["P1b", "P1d", "P3", "P4"] },
  ],
  torun: [
    { skill: "Q", tiers: ["P1a", "P1b", "P2c", "P3", "P4s"] },
    { skill: "W", tiers: ["P1b", "P1c", "P1d", "P3"] },
    { skill: "R", tiers: ["P1a", "P1b", "P2c", "P3", "P4"] },
  ],
  tolle: [
    { skill: "Q", tiers: ["P1a", "P1b", "P2c", "P3", "P4s"] },
    { skill: "W", tiers: ["P1b", "P1c"] },
    { skill: "R", tiers: ["P2c", "P3", "P4"] },
  ],
  helvar: [
    { skill: "Q", tiers: ["P2", "P4"] },
    { skill: "W", tiers: ["P1b", "P2c", "P3", "P4s"] },
    { skill: "R", tiers: ["P1b", "P4"] },
  ],
  calder: [
    { skill: "Q", tiers: ["P2", "P4"] },
    { skill: "W", tiers: ["P1d"] },
    { skill: "R", tiers: ["P1b", "P1d", "P4"] },
  ],
  kerrig: [
    { skill: "Q", tiers: ["P2", "P3", "P4s"] },
    { skill: "W", tiers: ["P2", "P4"] },
    { skill: "R", tiers: ["P2", "P4"] },
  ],
  mirren: [
    { skill: "Q", tiers: ["P2", "P4"] },
    { skill: "W", tiers: ["P1a", "P1b", "P2c", "P3", "P4s"] },
    { skill: "R", tiers: ["P1a", "P3", "P4"] },
  ],
  rhedan: [
    { skill: "Q", tiers: ["P2", "P4"] },
    // R7: Wake Hook is a rule-1 disable basic → P4s spill after 4 s.
    { skill: "W", tiers: ["P1b", "P3", "P4s"] },
    { skill: "R", tiers: ["P1a", "P2c", "P3", "P4"] },
  ],
  brannoch: [
    { skill: "Q", tiers: ["P2", "P4"] },
    { skill: "W", tiers: ["P1a", "P1b", "P2c", "P3"] },
    { skill: "R", tiers: ["P1a", "P1b", "P2c", "P3", "P4"] },
  ],
  ysol: [
    { skill: "Q", tiers: ["P1a", "P1b", "P4", "P4s"] },
    { skill: "W", tiers: ["P1c"] },
    { skill: "R", tiers: ["P1a", "P1b", "P2c", "P3", "P4"] },
  ],
  saelo: [
    { skill: "Q", tiers: ["P1b", "P2", "P4"] },
    { skill: "W", tiers: ["P1b", "P1c", "P4"] },
    { skill: "R", tiers: ["P1a", "P1c", "P3", "P4"] },
  ],
});

const SPILL: Readonly<Record<string, readonly SkillKey[]>> = {
  torun: ["Q"],
  tolle: ["Q"],
  sedge: ["W"],
  helvar: ["W"],
  kerrig: ["Q"],
  mirren: ["W"],
  rhedan: ["W"],
  brannoch: ["W"],
  ysol: ["Q"],
};

const COS45 = 0.7071067811865476;
const SIN45 = 0.7071067811865476;

export interface CastMemory {
  applyAt: Record<string, number>;
  remAt: Record<string, number>;
  endedAt: Record<string, number>;
  hadDisable: Record<string, boolean>;
  /** Perceived cast_start notes. `lock` marks Lock-category CC (R7-4). */
  casts: Array<{
    t: number;
    caster: UnitId;
    skill: SkillKey;
    target: UnitId | null;
    disable: boolean;
    lock: boolean;
  }>;
  readySince: Record<string, number>;
  castSeen: Record<string, number>;
}

export function createCastMemory(): CastMemory {
  return {
    applyAt: {},
    remAt: {},
    endedAt: {},
    hadDisable: {},
    casts: [],
    readySince: {},
    castSeen: {},
  };
}

export type CastProposal = {
  skill: SkillKey;
  target_id: UnitId | null;
  tier?: CastTier;
  aim_x?: number;
  aim_y?: number;
};

export interface CastPolicyOpts {
  c: Constants;
  focusId: UnitId | null;
  peelDiverId?: UnitId | null;
  commit?: CommitKind;
  table?: Readonly<Record<string, KitCastPolicy>>;
  aTrue?: number;
  tactic?: "hold_the_pit" | "hunt" | "starve";
  fightIds?: readonly UnitId[];
  intentTarget?: Partial<Record<UnitId, UnitId | null>>;
  comboStyle?: "auto" | "hold_R";
  seenAt?: Partial<Record<string, number>>;
  ignorePerception?: boolean;
  memory?: CastMemory;
  peeling?: boolean;
  currentTarget?: UnitId | null;
  /** Mobile Retreat/Regroup: only P1 (§9.4.1.2 gate 4). */
  p1Only?: boolean;
}

function d(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return distPts(a.x, a.y, b.x, b.y);
}

function abil(champ: string, skill: SkillKey): AbilityDef | null {
  return KITS[champ]?.[skill] ?? null;
}

function ccOf(champ: string, skill: SkillKey): Array<{ kind: string; category: string }> {
  const ab = abil(champ, skill);
  return (ab?.cc ?? []).map((c) => ({ kind: c.kind.toLowerCase(), category: c.category.toLowerCase() }));
}

function appliesLock(champ: string, skill: SkillKey): boolean {
  return ccOf(champ, skill).some((c) => c.category === "lock");
}

function appliesBind(champ: string, skill: SkillKey): boolean {
  return ccOf(champ, skill).some((c) => c.category === "bind");
}

function appliesDisable(champ: string, skill: SkillKey): boolean {
  return appliesLock(champ, skill) || appliesBind(champ, skill);
}

function hasPull(champ: string, skill: SkillKey): boolean {
  return (abil(champ, skill)?.pull ?? 0) > 0;
}

function hasKnock(champ: string, skill: SkillKey): boolean {
  return (abil(champ, skill)?.knockback ?? 0) > 0;
}

function hasTaunt(champ: string, skill: SkillKey): boolean {
  return ccOf(champ, skill).some((c) => c.kind === "taunt");
}

function isInterruptibleCast(e: UnitState): boolean {
  if (!e.cast_skill || e.cast_left <= 1e-12) return false;
  if (e.cast_skill === "R") return true;
  return appliesDisable(e.champ, e.cast_skill) || ccOf(e.champ, e.cast_skill).some((c) => c.kind === "silence");
}

function isSpill(champ: string, skill: SkillKey): boolean {
  return (SPILL[champ] ?? []).includes(skill);
}

export function notePolicyCast(
  mem: CastMemory,
  u: UnitState,
  skill: SkillKey,
  target: UnitId | null,
  t: number,
): void {
  mem.casts.push({
    t,
    caster: u.id,
    skill,
    target,
    disable: appliesDisable(u.champ, skill) || ccOf(u.champ, skill).some((c) => c.kind === "silence"),
    lock: appliesLock(u.champ, skill),
  });
  delete mem.readySince[`${u.id}|${skill}`];
  const cutoff = t - 8;
  mem.casts = mem.casts.filter((c) => c.t >= cutoff);
}

function perceivedBy(
  observer: UnitState,
  other: UnitState,
  now: number,
  seenAt: Partial<Record<string, number>> | undefined,
  ignore: boolean,
): boolean {
  if (ignore || !seenAt) return true;
  const t0 = seenAt[`${observer.id}>${other.id}`];
  if (t0 === undefined) return false;
  const wait = Math.max(perceptionDelayS(observer.attrs.decision), reactionDelayS(observer.attrs.reflexes));
  return now >= t0 + wait - 1e-9;
}

function unitInFightNow(
  u: UnitState,
  state: MatchState,
  c: Constants,
  fightIds: readonly UnitId[],
  seenAt: Partial<Record<string, number>> | undefined,
  ignore: boolean,
): boolean {
  if (fightIds.includes(u.id)) return true;
  for (const e of state.units) {
    if (!e.alive || e.team === u.team || isBanished(e.status)) continue;
    if (d(u, e) > 8 + 1e-9) continue;
    if (perceivedBy(u, e, state.t, seenAt, ignore)) return true;
  }
  return false;
}

/** Track disable apply times, enemy cast sightings, and spill clocks. */
export function observeCastMemory(
  state: MatchState,
  mem: CastMemory,
  c: Constants,
  fightIds: readonly UnitId[],
  seenAt: Partial<Record<string, number>>,
  ignore: boolean,
): void {
  const now = state.t;
  mem.casts = mem.casts.filter((x) => now - x.t <= 8);
  for (const u of state.units) {
    if (u.cast_left > 1e-12 && u.cast_skill) {
      const k = `${u.id}|${u.cast_seq}`;
      if (mem.castSeen[k] === undefined) mem.castSeen[k] = now;
    }
    let active = false;
    const live = new Set<string>();
    for (const e of u.status.effects) {
      if (e.category !== "lock" && e.category !== "bind") continue;
      if (e.remaining <= 1e-9) continue;
      active = true;
      const key = `${u.id}|${e.kind}`;
      live.add(key);
      if (mem.applyAt[key] === undefined || (mem.remAt[key] !== undefined && e.remaining > mem.remAt[key]! + 0.05)) {
        mem.applyAt[key] = now - c.DT;
      }
      mem.remAt[key] = e.remaining;
    }
    for (const key of Object.keys(mem.remAt)) {
      if (!key.startsWith(`${u.id}|`)) continue;
      if (!live.has(key)) {
        delete mem.remAt[key];
        delete mem.applyAt[key];
      }
    }
    if (mem.hadDisable[u.id] && !active) mem.endedAt[u.id] = now - c.DT;
    mem.hadDisable[u.id] = active;

    const inF = u.alive && unitInFightNow(u, state, c, fightIds, seenAt, ignore);
    for (const skill of ["Q", "W"] as const) {
      if (!isSpill(u.champ, skill)) continue;
      const cd = skill === "Q" ? u.cd_q : u.cd_w;
      const rk = `${u.id}|${skill}`;
      if (!inF || cd > 1e-9) delete mem.readySince[rk];
      else if (mem.readySince[rk] === undefined) mem.readySince[rk] = now;
    }
  }
}

interface Ctx {
  state: MatchState;
  u: UnitState;
  c: Constants;
  focusId: UnitId | null;
  peelDiverId: UnitId | null;
  commit: CommitKind;
  aTrue: number;
  tactic: "hold_the_pit" | "hunt" | "starve";
  fightIds: readonly UnitId[];
  intentTarget: Partial<Record<UnitId, UnitId | null>>;
  comboStyle?: "auto" | "hold_R";
  seenAt?: Partial<Record<string, number>>;
  ignorePerception: boolean;
  memory?: CastMemory;
  peeling: boolean;
  currentTarget: UnitId | null;
  p1Only: boolean;
  ex: number;
  perceived: UnitState[];
  allies: UnitState[];
  T: UnitState | null;
  F: UnitState | null;
}

function cls(u: UnitState): string {
  return CHAMPIONS[u.champ]?.class ?? "Fighter";
}

function isCarry(u: UnitState): boolean {
  const c = cls(u);
  return c === "Marksman" || c === "Enchanter";
}

function isSquishy(u: UnitState): boolean {
  const c = cls(u);
  return c === "Marksman" || c === "Mage" || c === "Enchanter";
}

function isBackliner(u: UnitState): boolean {
  return isSquishy(u);
}

function legalEnemy(u: UnitState, e: UnitState, c: Constants): boolean {
  return e.alive && e.team !== u.team && !isBanished(e.status) && !inOwnSanctuary(e.team, e.x, e.y, c);
}

function inRange(u: UnitState, e: { x: number; y: number }, range: number): boolean {
  return d(u, e) <= range + 1e-9;
}

function skillReady(u: UnitState, skill: SkillKey): boolean {
  if (!KITS[u.champ]) return false;
  if (skill === "R" && u.level < 5) return false;
  const cd = skill === "Q" ? u.cd_q : skill === "W" ? u.cd_w : u.cd_r;
  return cd <= 1e-9;
}

function leadTicks(u: UnitState, skill: SkillKey): number {
  const ab = abil(u.champ, skill);
  if (!ab) return 99;
  return Math.ceil(ab.cast_s * 10 - 1e-9) + Math.ceil((ab.land_delay_s ?? 0) * 10 - 1e-9);
}

function chainErrTicks(ex: number): number {
  return Math.round(clamp(0.3 - 0.005 * (ex - 50), 0.1, 0.5) * 10);
}

function disableEffects(e: UnitState) {
  return e.status.effects.filter((x) => (x.category === "lock" || x.category === "bind") && x.remaining > 1e-9);
}

function disableRemaining(e: UnitState): number {
  let m = 0;
  for (const x of disableEffects(e)) if (x.remaining > m) m = x.remaining;
  return m;
}

function remTicks(seconds: number): number {
  return Math.max(0, Math.round(seconds * 10));
}

function inChainWindow(ctx: Ctx, target: UnitState, skill: SkillKey): boolean {
  const rem = disableRemaining(target);
  if (rem <= 1e-9) return false;
  const rt = remTicks(rem);
  return rt <= leadTicks(ctx.u, skill) + chainErrTicks(ctx.ex);
}

function wastesDisable(ctx: Ctx, target: UnitState, skill: SkillKey, tier: CastTier): boolean {
  if (!appliesDisable(ctx.u.champ, skill)) return false;
  if (tier === "P1a") return false;
  if (tier === "P1b" && (hasTaunt(ctx.u.champ, skill) || hasPull(ctx.u.champ, skill) || hasKnock(ctx.u.champ, skill))) {
    return false;
  }
  if (isTimeStopped(target.status)) return !inChainWindow(ctx, target, skill);
  const rem = disableRemaining(target);
  if (rem <= 1e-9) return false;
  return remTicks(rem) > leadTicks(ctx.u, skill) + chainErrTicks(ctx.ex);
}

function lastEnemy(ctx: Ctx): boolean {
  if (ctx.fightIds.length > 0) {
    let n = 0;
    for (const id of ctx.fightIds) {
      const e = ctx.state.units.find((x) => x.id === id);
      if (e && e.alive && e.team !== ctx.u.team) n += 1;
    }
    return n <= 1;
  }
  return ctx.perceived.length <= 1;
}

/** Seconds → whole ticks (match clock is tick/10). */
function tickOf(tSec: number): number {
  return Math.round(tSec * 10);
}

/**
 * R7-4 / rule 4: Lock count on one unit at decision time.
 * Applied Locks with apply tick > decision + lead − 50, plus perceived
 * allied in-flight Lock casts on that target (ally-targeted excluded).
 */
function countedLocksOn(ctx: Ctx, target: UnitState, skill: SkillKey): number {
  const cutoff = ctx.state.tick + leadTicks(ctx.u, skill) - 50;
  let n = 0;
  const w = target.status.dr.find((x) => x.category === "lock");
  for (const t of w?.apply_times ?? []) {
    if (tickOf(t) > cutoff) n += 1;
  }
  const react = reactionDelayS(ctx.u.attrs.reflexes);
  const now = ctx.state.t;
  for (const cast of ctx.memory?.casts ?? []) {
    if (!cast.lock || cast.target !== target.id) continue;
    if (now + 1e-9 < cast.t + react) continue;
    const caster = ctx.state.units.find((u) => u.id === cast.caster);
    if (!caster || caster.team !== ctx.u.team) continue;
    const tgt = cast.target ? ctx.state.units.find((u) => u.id === cast.target) : null;
    // Ally-targeted casts (Tolle W P1c) are not enemy Locks.
    if (tgt && tgt.team === caster.team) continue;
    const ab = abil(caster.champ, cast.skill);
    const landAt = cast.t + (ab?.cast_s ?? 0) + (ab?.land_delay_s ?? 0);
    // Landed casts are already in apply_times; only count in-flight.
    if (landAt <= now + 1e-9) continue;
    if (tickOf(cast.t) > cutoff || tickOf(landAt) > cutoff) n += 1;
  }
  return n;
}

/** Body already at 2 counted Locks — excluded from nE ≥ 2 (R7-4). */
function lockCapFull(ctx: Ctx, target: UnitState, skill: SkillKey): boolean {
  if (lockOwed(target.status, ctx.state.t, ctx.c.LOCK_BUDGET_S) >= ctx.c.LOCK_BUDGET_S - 1e-9) return true;
  return countedLocksOn(ctx, target, skill) >= 2;
}

function lockCapBlocks(ctx: Ctx, target: UnitState, skill: SkillKey, tier: CastTier): boolean {
  if (!appliesLock(ctx.u.champ, skill)) return false;
  if (tier === "P1a" || tier === "P1b" || lastEnemy(ctx)) return false;
  return lockCapFull(ctx, target, skill);
}

/** nE for Lock-row triggers: bodies already at 2 counted Locks do not count. */
function lockEligibleHits(ctx: Ctx, hits: UnitState[], skill: SkillKey): UnitState[] {
  if (!appliesLock(ctx.u.champ, skill)) return hits;
  return hits.filter((h) => !lockCapFull(ctx, h, skill));
}

function spellwardBlocks(ctx: Ctx, target: UnitState, skill: SkillKey): boolean {
  if (ctx.state.t >= target.status.spellward_until - 1e-9) return false;
  const ab = abil(ctx.u.champ, skill);
  if (!ab) return false;
  const magic = ab.school === "magic" || (ab.cc ?? []).some((c) => (c.school ?? ab.school) === "magic");
  return magic && (appliesDisable(ctx.u.champ, skill) || ccOf(ctx.u.champ, skill).length > 0);
}

function ccOk(ctx: Ctx, target: UnitState, skill: SkillKey, tier: CastTier): boolean {
  if (isBanished(target.status)) return false;
  if (spellwardBlocks(ctx, target, skill)) return false;
  if (lockCapBlocks(ctx, target, skill, tier)) return false;
  if (wastesDisable(ctx, target, skill, tier)) return false;
  return true;
}

function isX(ctx: Ctx, e: UnitState): boolean {
  if (disableRemaining(e) > 1e-9) return true;
  const ended = ctx.memory?.endedAt[e.id];
  return ended !== undefined && ctx.state.t - ended <= 0.5 + 1e-9;
}

function comboFollowTicks(ex: number): number {
  // Whole ticks: round(combo_follow_s × 10). +1e-9 avoids 0.15*10 float → 1.
  return Math.round(comboFollowS(ex) * 10 + 1e-9);
}

function comboReady(ctx: Ctx, target: UnitState): boolean {
  const now = ctx.state.t;
  const followTicks = comboFollowTicks(ctx.ex);
  const follow = followTicks / 10;
  const effects = disableEffects(target);
  let applyT = now;
  let expireT = now;
  let source = "";
  if (effects.length > 0) {
    let best = effects[0]!;
    for (const e of effects) if (e.remaining > best.remaining) best = e;
    const key = `${target.id}|${best.kind}`;
    applyT = ctx.memory?.applyAt[key] ?? now - ctx.c.DT;
    expireT = now + best.remaining;
    source = best.source_id;
  } else {
    const ended = ctx.memory?.endedAt[target.id];
    if (ended === undefined || now - ended > 0.5 + 1e-9) return false;
    applyT = ended;
    expireT = ended;
  }
  // §8.4 cash-the-window: eff_E ≥ 50 and disable would expire before follow.
  if (ctx.ex >= 50 && expireT <= applyT + follow + 1e-9) return now + 1e-9 >= applyT;
  // R7-1 own disable: apply tick + round(combo_follow_s × 10).
  let earliest = applyT + follow;
  if (source && source !== ctx.u.id) {
    // Ally disable: §9.4.1.3 P2 bound.
    const react = reactionDelayS(ctx.u.attrs.reflexes);
    const castT =
      [...(ctx.memory?.casts ?? [])].reverse().find((c) => c.caster === source && c.disable)?.t ?? applyT;
    earliest = Math.max(applyT, castT + react, applyT + follow);
  }
  return now + 1e-9 >= earliest;
}

function skillHasTier(champ: string, skill: SkillKey, tier: CastTier): boolean {
  return CAST_POLICIES[champ]?.find((r) => r.skill === skill)?.tiers.includes(tier) ?? false;
}

/**
 * R7-1: if T is X and the skill has a P2 row, P4 may not fire before the
 * P2 earliest tick — hold (P2 path logs tier P2 once ready).
 */
function p4BlockedByComboFollow(ctx: Ctx, skill: SkillKey, target: UnitState | null): boolean {
  if (!target || !skillHasTier(ctx.u.champ, skill, "P2")) return false;
  return isX(ctx, target);
}

function incoming1s(u: UnitState, now: number): number {
  let s = 0;
  for (const e of u.recent_taken ?? []) {
    if (now - e.t <= 1 + 1e-9) s += e.hp;
  }
  return s;
}

function doomed(u: UnitState, now: number): boolean {
  const inc = incoming1s(u, now);
  if (inc <= 0) return false;
  return u.hp + u.status.shield_pool <= 1.5 * inc + 1e-9;
}

function threatWithin(ctx: Ctx, who: UnitState, r: number): boolean {
  for (const e of ctx.perceived) {
    const distE = d(who, e);
    if (distE > r + 1e-9) continue;
    const aimed = e.ai_target_id === who.id || ctx.intentTarget[e.id] === who.id;
    if (aimed) return true;
    if (e.stats.range <= 2 && distE <= 2 + 1e-9) return true;
  }
  return false;
}

function diveOn(ctx: Ctx, carry: UnitState): boolean {
  for (const e of ctx.perceived) {
    if (!(e.stats.range <= 2 || e.champ === "kerrig")) continue;
    if (d(e, carry) <= ctx.c.PEEL_DIVE_R + 1e-9) return true;
  }
  return false;
}

function inZone(u: { x: number; y: number }, c: Constants): boolean {
  return distPts(u.x, u.y, c.ZONE_CENTER[0]!, c.ZONE_CENTER[1]!) <= c.ZONE_RADIUS + 1e-9;
}

function distOwnPad(u: { x: number; team?: UnitState["team"] }, team: UnitState["team"], c: Constants): number {
  const xs = team === "blue" ? c.SANCTUARY_BLUE_X : c.SANCTUARY_RED_X;
  let best = Infinity;
  for (const tx of xs) {
    const dd = Math.abs(u.x - (tx + 0.5));
    if (dd < best) best = dd;
  }
  return best;
}

function movingTowardPad(e: UnitState, c: Constants): boolean {
  if (distOwnPad(e, e.team, c) > 2 + 1e-9) return false;
  const xs = e.team === "blue" ? c.SANCTUARY_BLUE_X : c.SANCTUARY_RED_X;
  let nearest = xs[0]! + 0.5;
  let best = Math.abs(e.x - nearest);
  for (const tx of xs) {
    const cx = tx + 0.5;
    const dd = Math.abs(e.x - cx);
    if (dd < best) {
      best = dd;
      nearest = cx;
    }
  }
  return (nearest - e.x) * e.vx > 0.02;
}

function predict(e: UnitState, delay: number): { x: number; y: number } {
  const held = isLocked(e.status) || isRooted(e.status) || isLeashed(e.status);
  if (held) return { x: e.x, y: e.y };
  return { x: e.x + e.vx * delay, y: e.y + e.vy * delay };
}

function landDelay(u: UnitState, skill: SkillKey): number {
  const ab = abil(u.champ, skill);
  if (!ab) return 0;
  return ab.cast_s + (ab.land_delay_s ?? 0);
}

function holdRBlocks(ctx: Ctx, target: UnitState): boolean {
  if (ctx.comboStyle !== "hold_R") return false;
  const focus = ctx.F && ctx.F.team !== ctx.u.team ? ctx.F : target;
  const hp = focus.hp / Math.max(1, focus.max_hp);
  return ctx.aTrue < 0.55 - 1e-9 && hp > 0.4 - 1e-9;
}

function rHoldBlocks(ctx: Ctx, target: UnitState): boolean {
  const hp = target.hp / Math.max(1, target.max_hp);
  return ctx.aTrue < rHoldA(ctx.ex) - 1e-9 && hp > rHoldHp(ctx.ex) - 1e-9;
}

function engageOk(ctx: Ctx, meleeGate: boolean): boolean {
  if (ctx.commit !== "engage") return false;
  if (!meleeGate) return true;
  const melee = ctx.u.stats.range <= 2 || cls(ctx.u) === "Assassin";
  if (!melee) return true;
  const own = ctx.state.zone?.owner === ctx.u.team;
  const th = commitThresholds(ctx.tactic, own);
  return ctx.aTrue + 1e-9 >= th.engage - diveSlack(ctx.u.attrs.positioning);
}

function openerClean(ctx: Ctx, t: UnitState): boolean {
  if (disableRemaining(t) > 1e-6) return false;
  for (const a of ctx.allies) {
    if (a.id === ctx.u.id) continue;
    if (a.cast_left <= 1e-9 || !a.cast_skill) continue;
    if (!appliesDisable(a.champ, a.cast_skill) && a.cast_skill !== "R") continue;
    if (a.cast_target === t.id) return false;
  }
  return true;
}

function lineHits(ctx: Ctx, aim: { x: number; y: number }, skill: SkillKey): UnitState[] {
  const ab = abil(ctx.u.champ, skill);
  if (!ab) return [];
  const n = normalize(aim.x - ctx.u.x, aim.y - ctx.u.y);
  if (n.len < 1e-12) return [];
  const full = ab.length ?? ab.range;
  const len = lineLengthUntilPillar(ctx.u.x, ctx.u.y, n.x, n.y, full, ctx.c);
  const hits: UnitState[] = [];
  for (const e of ctx.perceived) {
    if (lineHitsUnit(ctx.u, n.x, n.y, len, ab.width ?? 0.5, e, ctx.c.BODY_RADIUS)) hits.push(e);
  }
  return hits;
}

function firstOnLine(ctx: Ctx, aim: { x: number; y: number }, skill: SkillKey): UnitState | null {
  const hits = lineHits(ctx, aim, skill);
  const n = normalize(aim.x - ctx.u.x, aim.y - ctx.u.y);
  let best: UnitState | null = null;
  let along = Infinity;
  for (const e of hits) {
    const a = (e.x - ctx.u.x) * n.x + (e.y - ctx.u.y) * n.y;
    if (a < along - 1e-9 || (Math.abs(a - along) <= 1e-9 && (best === null || e.index < best.index))) {
      along = a;
      best = e;
    }
  }
  return best;
}

function coneHits(ctx: Ctx, aim: { x: number; y: number }, skill: SkillKey): UnitState[] {
  const ab = abil(ctx.u.champ, skill);
  if (!ab) return [];
  const n = normalize(aim.x - ctx.u.x, aim.y - ctx.u.y);
  const nx = n.len < 1e-12 ? 1 : n.x;
  const ny = n.len < 1e-12 ? 0 : n.y;
  const hits: UnitState[] = [];
  for (const e of ctx.perceived) {
    if (coneHitsUnit(ctx.u, nx, ny, ab.range, ab.angle_deg ?? 60, e, ctx.c.BODY_RADIUS)) hits.push(e);
  }
  return hits;
}

function circleAt(ctx: Ctx, x: number, y: number, r: number, team: "enemy" | "ally", predicted = false): UnitState[] {
  const pool = team === "enemy" ? ctx.perceived : ctx.state.units.filter((a) => a.alive && a.team === ctx.u.team);
  const hits: UnitState[] = [];
  for (const e of pool) {
    if (team === "ally" && e.id === ctx.u.id) continue;
    if (isBanished(e.status)) continue;
    if (inOwnSanctuary(e.team, e.x, e.y, ctx.c)) continue;
    const pos = team === "enemy" && predicted ? predict(e, 0) : e;
    if (circleHitsUnit(x, y, r, pos, ctx.c.BODY_RADIUS)) hits.push(e);
  }
  return hits;
}

interface Pick {
  x: number;
  y: number;
  who: UnitState | null;
  n: number;
  hits: UnitState[];
  score: number;
}

function kCandidates(ctx: Ctx, primary: UnitState | null): UnitState[] {
  const pool = ctx.perceived.slice();
  const origin = primary ?? ctx.u;
  pool.sort((a, b) => {
    const da = d(a, origin);
    const db = d(b, origin);
    if (Math.abs(da - db) > 1e-9) return da - db;
    return a.index - b.index;
  });
  const K = clamp(1 + Math.floor((ctx.u.attrs.decision - 20) / 15), 1, 6);
  const cands = pool.slice(0, K);
  if (primary && !cands.some((c) => c.id === primary.id)) {
    cands[cands.length - 1] = primary;
  }
  return cands;
}

function choosePick(ctx: Ctx, picks: Pick[], skillshot: boolean, mustHit?: UnitState | null): Pick | null {
  const usable = mustHit ? picks.filter((p) => p.hits.some((h) => h.id === mustHit.id)) : picks.filter((p) => p.n > 0);
  if (usable.length === 0) return null;
  const maxN = Math.max(...usable.map((p) => p.score));
  const near = usable.filter((p) => Math.abs(p.score - maxN) <= 0.1 * Math.max(maxN, 1e-6) + 1e-9);
  const ranked = near.map((p) => {
    let s = p.score;
    if (skillshot && p.who && near.length > 1) {
      s *= skillshotHitChance(effAim(ctx.u.attrs, ctx.u.mastery, ctx.c), p.who.attrs.reflexes, ctx.c);
    }
    return { p, s };
  });
  ranked.sort((a, b) => {
    if (Math.abs(a.s - b.s) > 1e-9) return b.s - a.s;
    const aT = ctx.T && a.p.hits.some((h) => h.id === ctx.T!.id) ? 1 : 0;
    const bT = ctx.T && b.p.hits.some((h) => h.id === ctx.T!.id) ? 1 : 0;
    if (aT !== bT) return bT - aT;
    const aF = ctx.F && a.p.hits.some((h) => h.id === ctx.F!.id) ? 1 : 0;
    const bF = ctx.F && b.p.hits.some((h) => h.id === ctx.F!.id) ? 1 : 0;
    if (aF !== bF) return bF - aF;
    return (a.p.who?.index ?? 999) - (b.p.who?.index ?? 999);
  });
  return ranked[0]!.p;
}

function bestLine(ctx: Ctx, skill: SkillKey, must?: UnitState | null): Pick | null {
  const picks: Pick[] = [];
  for (const who of kCandidates(ctx, must ?? ctx.T)) {
    if (!inRange(ctx.u, who, abil(ctx.u.champ, skill)?.range ?? 0)) continue;
    const hits = lineHits(ctx, who, skill);
    picks.push({ x: who.x, y: who.y, who, n: hits.length, hits, score: hits.length });
  }
  return choosePick(ctx, picks, true, must ?? null);
}

function bestCone(ctx: Ctx, skill: SkillKey, must?: UnitState | null): Pick | null {
  const picks: Pick[] = [];
  for (const who of kCandidates(ctx, must ?? ctx.T)) {
    if (!inRange(ctx.u, who, abil(ctx.u.champ, skill)?.range ?? 0)) continue;
    const hits = coneHits(ctx, who, skill);
    picks.push({ x: who.x, y: who.y, who, n: hits.length, hits, score: hits.length });
  }
  return choosePick(ctx, picks, true, must ?? null);
}

function bestCircle(
  ctx: Ctx,
  range: number,
  radius: number,
  scoreOf?: (hits: UnitState[]) => number,
  predicted = false,
): Pick | null {
  const picks: Pick[] = [];
  for (const who of kCandidates(ctx, ctx.T)) {
    if (!inRange(ctx.u, who, range)) continue;
    const pos = predicted ? predict(who, 0) : who;
    const hits = circleAt(ctx, pos.x, pos.y, radius, "enemy", false);
    const score = scoreOf ? scoreOf(hits) : hits.length;
    picks.push({ x: pos.x, y: pos.y, who, n: hits.length, hits, score });
  }
  return choosePick(ctx, picks, true, null);
}

function prop(skill: SkillKey, tier: CastTier, target: UnitId | null, aim?: { x: number; y: number }): CastProposal {
  const p: CastProposal = { skill, target_id: target, tier };
  if (aim) {
    p.aim_x = aim.x;
    p.aim_y = aim.y;
  }
  return p;
}

function can(ctx: Ctx, skill: SkillKey): boolean {
  return skillReady(ctx.u, skill) && canCastSkill(ctx.u, skill, ctx.state, ctx.c);
}

function windupBlocks(u: UnitState): boolean {
  return u.auto_windup_left > 1e-12 && u.auto_windup_left <= 0.1 + 1e-9;
}

function skillOrder(champ: string, tier: CastTier): SkillKey[] {
  if (champ === "torun" && tier === "P1b") return ["W", "Q", "R"];
  return ["Q", "W", "R"];
}

function peelPair(ctx: Ctx): { diver: UnitState; carry: UnitState } | null {
  if (ctx.peelDiverId) {
    const diver = ctx.state.units.find((x) => x.id === ctx.peelDiverId);
    if (diver && diver.alive && diver.team !== ctx.u.team) {
      let carry: UnitState | null = null;
      let best = Infinity;
      for (const a of ctx.allies) {
        if (!isCarry(a)) continue;
        const dd = d(diver, a);
        if (dd < best) {
          best = dd;
          carry = a;
        }
      }
      if (!carry) {
        for (const a of ctx.allies) {
          const dd = d(diver, a);
          if (dd < best) {
            best = dd;
            carry = a;
          }
        }
      }
      if (carry) return { diver, carry };
    }
  }
  let best: { diver: UnitState; carry: UnitState; dd: number } | null = null;
  for (const carry of ctx.allies) {
    if (!isCarry(carry) && carry.id !== ctx.u.id) continue;
    if (!isCarry(carry)) continue;
    for (const e of ctx.perceived) {
      if (!(e.stats.range <= 2 || e.champ === "kerrig")) continue;
      const dd = d(e, carry);
      if (dd > ctx.c.PEEL_DIVE_R + 1e-9) continue;
      if (!best || dd < best.dd || (Math.abs(dd - best.dd) < 1e-9 && e.index < best.diver.index)) {
        best = { diver: e, carry, dd };
      }
    }
  }
  return best ? { diver: best.diver, carry: best.carry } : null;
}

function chasingAllies(ctx: Ctx): UnitState[] {
  const out: UnitState[] = [];
  for (const e of ctx.perceived) {
    if (e.intent !== "Chase" && e.intent !== "Engage") continue;
    const tid = e.ai_target_id ?? ctx.intentTarget[e.id] ?? null;
    if (!tid) continue;
    const ally = ctx.state.units.find((a) => a.id === tid);
    if (!ally || ally.team !== ctx.u.team || !ally.alive) continue;
    if (d(e, ally) <= 4 + 1e-9) out.push(e);
  }
  return out;
}

function healAmt(u: UnitState, ab: AbilityDef): number {
  if (!ab.heal) return 0;
  return (ab.heal.base + ab.heal.pow * u.stats.pow) * skillScale(u.level);
}

function escapeAim(ctx: Ctx, tiles: number): { x: number; y: number } | null {
  if (isRooted(ctx.u.status)) return null;
  let threat: UnitState | null = null;
  let best = Infinity;
  for (const e of ctx.perceived) {
    const dd = d(ctx.u, e);
    if (dd < best) {
      best = dd;
      threat = e;
    }
  }
  if (!threat) return null;
  const away = normalize(ctx.u.x - threat.x, ctx.u.y - threat.y);
  const dx = away.len < 1e-12 ? 1 : away.x;
  const dy = away.len < 1e-12 ? 0 : away.y;
  const angles = [
    { c: 1, s: 0 },
    { c: COS45, s: SIN45 },
    { c: COS45, s: -SIN45 },
    { c: 0, s: 1 },
    { c: 0, s: -1 },
  ];
  const startEnemy = best;
  const startSan = distOwnPad(ctx.u, ctx.u.team === "blue" ? "red" : "blue", ctx.c);
  for (const a of angles) {
    const rx = dx * a.c - dy * a.s;
    const ry = dx * a.s + dy * a.c;
    const x1 = ctx.u.x + rx * tiles;
    const y1 = ctx.u.y + ry * tiles;
    const clipped = clipMove(ctx.u.team, ctx.u.x, ctx.u.y, x1, y1, ctx.c);
    const travel = Math.hypot(clipped.x - ctx.u.x, clipped.y - ctx.u.y);
    if (travel < 1.5 - 1e-9) continue;
    let endEnemy = Infinity;
    for (const e of ctx.perceived) {
      const dd = distPts(clipped.x, clipped.y, e.x, e.y);
      if (dd < endEnemy) endEnemy = dd;
    }
    if (endEnemy < startEnemy - 1e-9) continue;
    const endSan = distOwnPad({ x: clipped.x }, ctx.u.team === "blue" ? "red" : "blue", ctx.c);
    if (endSan < startSan - 1e-9) continue;
    return { x: clipped.x, y: clipped.y };
  }
  return null;
}

function shapeWouldHit(caster: UnitState, skill: SkillKey, at: { x: number; y: number }, c: Constants): boolean {
  const ab = abil(caster.champ, skill);
  if (!ab || !caster.cast_skill) return false;
  const aim = { x: caster.cast_aim_x, y: caster.cast_aim_y };
  const n = normalize(aim.x - caster.x, aim.y - caster.y);
  const nx = n.len < 1e-12 ? 1 : n.x;
  const ny = n.len < 1e-12 ? 0 : n.y;
  if (ab.shape === "line") {
    return lineHitsUnit(caster, nx, ny, ab.length ?? ab.range, ab.width ?? 0.5, at, c.BODY_RADIUS);
  }
  if (ab.shape === "cone" || ab.shape === "cone_target") {
    return coneHitsUnit(caster, nx, ny, ab.range, ab.angle_deg ?? 60, at, c.BODY_RADIUS);
  }
  if (ab.shape === "circle_point" || ab.shape === "circle_target" || ab.shape === "circle_self") {
    const cx = ab.shape === "circle_self" ? caster.x : aim.x;
    const cy = ab.shape === "circle_self" ? caster.y : aim.y;
    return circleHitsUnit(cx, cy, ab.radius ?? ab.range, at, c.BODY_RADIUS);
  }
  return caster.cast_target !== null && d(caster, at) <= ab.range;
}

function dashLeavesShape(ctx: Ctx, end: { x: number; y: number }): boolean {
  for (const e of ctx.perceived) {
    if (!isInterruptibleCast(e) || !e.cast_skill) continue;
    const nowHit = shapeWouldHit(e, e.cast_skill, ctx.u, ctx.c);
    const endHit = shapeWouldHit(e, e.cast_skill, end, ctx.c);
    if (nowHit && !endHit) return true;
  }
  return false;
}

function commitR(ctx: Ctx): boolean {
  if (ctx.commit !== "engage") return false;
  const own = ctx.state.zone?.owner === ctx.u.team;
  const th = commitThresholds(ctx.tactic, own);
  let n = 0;
  for (const id of ctx.fightIds) {
    const e = ctx.state.units.find((u) => u.id === id);
    if (e && e.alive && e.team !== ctx.u.team) n += 1;
  }
  return ctx.aTrue + 1e-9 >= th.engage + 0.1 && n >= 3;
}

/** R7-5: commit-R lifts only nA ≤ 1; nE ≥ 2 always holds. */
function friendlyOk(nE: number, nA: number, ctx: Ctx): boolean {
  if (nE < 2) return false;
  return nA <= 1 || commitR(ctx);
}

function fearSafe(ctx: Ctx, hits: UnitState[]): boolean {
  const backs = ctx.allies.filter((a) => isBackliner(a));
  if (backs.length === 0) return true;
  for (const e of hits) {
    let bl = backs[0]!;
    let best = d(e, bl);
    for (const b of backs) {
      const dd = d(e, b);
      if (dd < best) {
        best = dd;
        bl = b;
      }
    }
    const n = normalize(e.x - ctx.u.x, e.y - ctx.u.y);
    if (n.len < 1e-12) return false;
    const fx = e.x + n.x * e.stats.ms * 1.6;
    const fy = e.y + n.y * e.stats.ms * 1.6;
    const fleeD = distPts(fx, fy, bl.x, bl.y);
    if (fleeD < best - 1e-9) return false;
  }
  return true;
}

function estDamage(src: UnitState, tgt: UnitState, ab: AbilityDef): number {
  let raw = abilityBaseRaw(ab, src.stats.atk, src.stats.pow) * skillScale(src.level);
  if (ab.finisher) raw *= 1 + ab.finisher * (1 - tgt.hp / Math.max(1, tgt.max_hp));
  const resist = ab.school === "physical" ? tgt.stats.pres : tgt.stats.mres;
  return raw * mit(resist);
}

function followX(ctx: Ctx, range: number): UnitState | null {
  const xs = ctx.perceived.filter((e) => isX(ctx, e) && inRange(ctx.u, e, range) && comboReady(ctx, e));
  if (xs.length === 0) return null;
  xs.sort((a, b) => {
    const aT = ctx.T && a.id === ctx.T.id ? 0 : 1;
    const bT = ctx.T && b.id === ctx.T.id ? 0 : 1;
    if (aT !== bT) return aT - bT;
    const aF = ctx.F && a.id === ctx.F.id ? 0 : 1;
    const bF = ctx.F && b.id === ctx.F.id ? 0 : 1;
    if (aF !== bF) return aF - bF;
    return a.index - b.index;
  });
  return xs[0]!;
}

function spillTarget(ctx: Ctx, skill: SkillKey): UnitState | null {
  const t0 = ctx.memory?.readySince[`${ctx.u.id}|${skill}`];
  if (t0 === undefined || ctx.state.t - t0 < 4 - 1e-9) return null;
  const ab = abil(ctx.u.champ, skill);
  if (!ab) return null;
  let best: UnitState | null = null;
  let bestN = -1;
  for (const e of ctx.perceived) {
    if (!inRange(ctx.u, e, ab.range)) continue;
    if (!ccOk(ctx, e, skill, "P4s")) continue;
    let n = 1;
    if (ab.shape === "line") n = lineHits(ctx, e, skill).length;
    else if (ab.shape === "cone" || ab.shape === "cone_target") n = coneHits(ctx, e, skill).length;
    else if (ab.radius) n = circleAt(ctx, e.x, e.y, ab.radius, "enemy").length;
    const better =
      n > bestN ||
      (n === bestN &&
        best &&
        ((ctx.T && e.id === ctx.T.id && best.id !== ctx.T.id) ||
          ((!ctx.T || best.id !== ctx.T.id) && e.index < best.index)));
    if (!best || better) {
      best = e;
      bestN = n;
    }
  }
  return best;
}

/**
 * R7-6 P1a whole-tick inequality (no R7-6b P1A_READ_MULT):
 * lead_ticks < (cast_start_tick + ceil(cast_s×10)) − decision_tick
 * Decision tick ≥ cast_start + ceil(reaction_delay×10 − 1e-9). Strict.
 */
function interruptOf(ctx: Ctx, skill: SkillKey, maxRange: number): UnitState | null {
  let best: UnitState | null = null;
  const decisionTick = ctx.state.tick;
  const reactTicks = Math.ceil(reactionDelayS(ctx.u.attrs.reflexes) * 10 - 1e-9);
  const ourLead = leadTicks(ctx.u, skill);
  for (const e of ctx.perceived) {
    if (!isInterruptibleCast(e) || !e.cast_skill) continue;
    if (!inRange(ctx.u, e, maxRange)) continue;
    const enemyAb = abil(e.champ, e.cast_skill);
    if (!enemyAb) continue;
    const seenT = ctx.memory?.castSeen[`${e.id}|${e.cast_seq}`];
    // Reconstruct cast_start from remaining windup when unseen in memory.
    const castStartT =
      seenT !== undefined ? seenT : ctx.state.t - (enemyAb.cast_s - e.cast_left);
    const castStartTick = tickOf(castStartT);
    if (decisionTick < castStartTick + reactTicks) continue;
    const castEndTick = castStartTick + Math.ceil(enemyAb.cast_s * 10 - 1e-9);
    const castLeftTicks = castEndTick - decisionTick;
    if (!(ourLead < castLeftTicks)) continue;
    if (!ccOk(ctx, e, skill, "P1a")) continue;
    const ab = abil(ctx.u.champ, skill);
    if (!ab) continue;
    if (ab.shape === "line" && firstOnLine(ctx, e, skill)?.id !== e.id && ab.pierce === "first") continue;
    if (ab.shape === "cone" || ab.shape === "cone_target") {
      if (!coneHits(ctx, e, skill).some((h) => h.id === e.id)) continue;
    }
    if (!best || e.cast_left < best.cast_left - 1e-9 || (Math.abs(e.cast_left - best.cast_left) < 1e-9 && e.index < best.index)) {
      best = e;
    }
  }
  return best;
}

function zoneBreakHelvar(ctx: Ctx): boolean {
  const z = ctx.state.zone;
  if (!z) return false;
  const enemy = ctx.u.team === "blue" ? "red" : "blue";
  const prog = enemy === "blue" ? z.progress_blue : z.progress_red;
  const ours = enemy === "blue" ? z.progress_red : z.progress_blue;
  const exclusive = z.owner === enemy || (z.owner == null && prog > 0 && ours <= 0);
  if (!exclusive) return false;
  const occ = (z.occupied ?? [])
    .map((id) => ctx.state.units.find((u) => u.id === id))
    .filter((e): e is UnitState => !!e && e.alive && e.team === enemy);
  if (occ.length < 1 || occ.length > 2) return false;
  const ab = abil(ctx.u.champ, "R");
  if (!ab) return false;
  for (const e of occ) {
    if (!inRange(ctx.u, e, ab.range)) return false;
    if (!lineHits(ctx, e, "R").some((h) => h.id === e.id)) return false;
    const n = normalize(e.x - ctx.u.x, e.y - ctx.u.y);
    if (n.len < 1e-12) return false;
    const x = e.x + n.x * (ab.knockback ?? 2.2);
    const y = e.y + n.y * (ab.knockback ?? 2.2);
    if (distPts(x, y, ctx.c.ZONE_CENTER[0]!, ctx.c.ZONE_CENTER[1]!) <= ctx.c.ZONE_RADIUS + 1e-9) return false;
  }
  return true;
}

function trySkill(ctx: Ctx, tier: CastTier, skill: SkillKey): CastProposal | null {
  const rows = CAST_POLICIES[ctx.u.champ];
  const row = rows?.find((r) => r.skill === skill);
  if (!row || !row.tiers.includes(tier)) return null;
  if (!can(ctx, skill)) return null;
  const ab = abil(ctx.u.champ, skill);
  if (!ab) return null;
  if (ab.shape === "self_dash" && !ab.shield && !ab.heal && isRooted(ctx.u.status)) return null;

  const champ = ctx.u.champ;
  const T = ctx.T;
  const pair = peelPair(ctx);

  // ----- Huntress / Maelis / Isra / shared damage lines handled per champ -----
  if (champ === "huntress" && skill === "Q") {
    if (tier === "P2") {
      const x = followX(ctx, 8);
      if (!x) return null;
      const hits = lineHits(ctx, x, "Q");
      if (!hits.some((h) => h.id === x.id)) return null;
      return prop("Q", "P2", x.id, { x: x.x, y: x.y });
    }
    if (tier === "P4") {
      if (p4BlockedByComboFollow(ctx, "Q", T)) return null;
      const prefer = ctx.u.level >= 5 && ctx.u.cd_r <= 4 + 1e-9;
      let aimAt = T;
      if (prefer) {
        const marked = ctx.perceived.filter(
          (e) => hasMark(e.marks, "huntress", ctx.state.t) && inRange(ctx.u, e, 8),
        );
        if (marked.length > 0) {
          marked.sort((a, b) => {
            const aT = T && a.id === T.id ? 0 : 1;
            const bT = T && b.id === T.id ? 0 : 1;
            if (aT !== bT) return aT - bT;
            return a.index - b.index;
          });
          aimAt = marked[0]!;
        }
      }
      if (!aimAt || !inRange(ctx.u, aimAt, 8)) return null;
      const hits = lineHits(ctx, aimAt, "Q");
      if (!hits.some((h) => h.id === aimAt!.id)) return null;
      return prop("Q", "P4", aimAt.id, { x: aimAt.x, y: aimAt.y });
    }
  }

  if (champ === "huntress" && skill === "W" && tier === "P1d") {
    const trigger =
      (threatWithin(ctx, ctx.u, 2.5) && (ctx.u.hp / ctx.u.max_hp <= 0.5 + 1e-9 || doomed(ctx.u, ctx.state.t))) ||
      diveOn(ctx, ctx.u);
    if (!trigger) return null;
    const aim = escapeAim(ctx, ab.dash_tiles ?? 2);
    if (!aim) return null;
    return prop("W", "P1d", null, aim);
  }

  if (champ === "huntress" && skill === "R") {
    return markFinisher(ctx, tier, "huntress", 7.5, 2.6);
  }

  if (champ === "maelis" && skill === "Q") {
    if (tier === "P2") {
      const x = followX(ctx, 7.8);
      if (!x) return null;
      const pick = bestLine(ctx, "Q", x);
      if (!pick) return null;
      return prop("Q", "P2", x.id, { x: pick.x, y: pick.y });
    }
    if (tier === "P4" && T && inRange(ctx.u, T, 7.8)) {
      if (p4BlockedByComboFollow(ctx, "Q", T)) return null;
      const pick = bestLine(ctx, "Q", T);
      if (!pick) return null;
      return prop("Q", "P4", T.id, { x: pick.x, y: pick.y });
    }
  }

  if (champ === "maelis" && skill === "W" && tier === "P1d") {
    const aim = escapeAim(ctx, ab.dash_tiles ?? 2.5);
    const dodge = aim ? dashLeavesShape(ctx, aim) : false;
    const trigger =
      doomed(ctx.u, ctx.state.t) ||
      (threatWithin(ctx, ctx.u, 2.5) && ctx.u.hp / ctx.u.max_hp <= 0.6 + 1e-9) ||
      dodge;
    if (!trigger || !aim) return null;
    return prop("W", "P1d", null, aim);
  }

  if (champ === "maelis" && skill === "R") {
    if (holdRBlocks(ctx, T ?? ctx.u)) return null;
    if (tier === "P2") {
      const x = followX(ctx, 7.6);
      if (!x || x.hp / x.max_hp > 0.6 + 1e-9) return null;
      const pick = bestCircle(ctx, 7.6, 2.0, (hs) => hs.reduce((s, h) => s + (1 - h.hp / Math.max(1, h.max_hp)), 0));
      if (!pick || !pick.hits.some((h) => h.id === x.id)) {
        return prop("R", "P2", x.id, { x: x.x, y: x.y });
      }
      return prop("R", "P2", x.id, { x: pick.x, y: pick.y });
    }
    if (tier === "P4" && T && inRange(ctx.u, T, 7.6)) {
      const hpOk = T.hp / T.max_hp <= rHoldHp(ctx.ex) + 1e-9;
      const clump =
        ctx.commit === "engage" && ctx.aTrue + 1e-9 >= rHoldA(ctx.ex) && circleAt(ctx, T.x, T.y, 2, "enemy").length >= 2;
      if (!hpOk && !clump) return null;
      const pick = bestCircle(ctx, 7.6, 2.0, (hs) => hs.reduce((s, h) => s + (1 - h.hp / Math.max(1, h.max_hp)), 0));
      const aim = pick && pick.hits.some((h) => h.id === T.id) ? pick : { x: T.x, y: T.y };
      return prop("R", "P4", T.id, { x: aim.x, y: aim.y });
    }
  }

  if (champ === "isra" && skill === "Q") {
    const delay = landDelay(ctx.u, "Q");
    const bad = (e: UnitState) => movingTowardPad(e, ctx.c) || inOwnSanctuary(e.team, predict(e, delay).x, predict(e, delay).y, ctx.c);
    if (tier === "P2") {
      const x = followX(ctx, ab.range);
      if (!x || bad(x)) return null;
      if (remTicks(disableRemaining(x)) < 11) return null;
      const p = predict(x, delay);
      return prop("Q", "P2", x.id, p);
    }
    if (tier === "P4" && T && inRange(ctx.u, T, ab.range) && !bad(T)) {
      if (p4BlockedByComboFollow(ctx, "Q", T)) return null;
      return prop("Q", "P4", T.id, predict(T, delay));
    }
  }

  if (champ === "isra" && skill === "W" && tier === "P1d") {
    if (!(threatWithin(ctx, ctx.u, 3) && (ctx.u.hp / ctx.u.max_hp <= 0.6 + 1e-9 || doomed(ctx.u, ctx.state.t)))) {
      return null;
    }
    const aim = escapeAim(ctx, ab.dash_tiles ?? 2.5);
    if (!aim) return null;
    return prop("W", "P1d", null, aim);
  }

  if (champ === "isra" && skill === "R") {
    const delay = landDelay(ctx.u, "R");
    const predHits = (aim: { x: number; y: number }) => {
      const hits: UnitState[] = [];
      for (const e of ctx.perceived) {
        if (movingTowardPad(e, ctx.c) && inOwnSanctuary(e.team, predict(e, delay).x, predict(e, delay).y, ctx.c)) continue;
        const p = predict(e, delay);
        if (inOwnSanctuary(e.team, p.x, p.y, ctx.c)) continue;
        if (circleHitsUnit(aim.x, aim.y, 3.4, p, ctx.c.BODY_RADIUS)) hits.push(e);
      }
      return hits;
    };
    if (tier === "P4" && holdRBlocks(ctx, T ?? ctx.u)) return null;
    if (tier === "P2") {
      const x = ctx.perceived.find(
        (e) => isX(ctx, e) && remTicks(disableRemaining(e)) >= 15 && comboReady(ctx, e),
      );
      if (!x) return null;
      const aim = predict(x, delay);
      if (!inRange(ctx.u, aim, ab.range)) return null;
      if (predHits(aim).length < 2) return null;
      return prop("R", "P2", x.id, aim);
    }
    if (tier === "P4") {
      const picks: Pick[] = [];
      for (const who of kCandidates(ctx, T)) {
        const aim = predict(who, delay);
        if (!inRange(ctx.u, aim, ab.range)) continue;
        const hits = predHits(aim);
        picks.push({ x: aim.x, y: aim.y, who, n: hits.length, hits, score: hits.length });
      }
      const pick = choosePick(ctx, picks, true, null);
      if (!pick || pick.n < 2) return null;
      if (rHoldBlocks(ctx, pick.who ?? T ?? ctx.u) && ctx.comboStyle !== "hold_R") return null;
      if (ctx.comboStyle === "hold_R" && holdRBlocks(ctx, pick.who ?? T ?? ctx.u)) return null;
      return prop("R", "P4", pick.who?.id ?? null, { x: pick.x, y: pick.y });
    }
  }

  if (champ === "sedge" && skill === "Q") {
    if (tier === "P2") {
      const x = followX(ctx, 5.5);
      if (!x) return null;
      return prop("Q", "P2", x.id, { x: x.x, y: x.y });
    }
    if (tier === "P4" && T && inRange(ctx.u, T, 5.5)) {
      if (p4BlockedByComboFollow(ctx, "Q", T)) return null;
      const pick = bestCircle(ctx, 5.5, 2.2);
      if (pick && pick.n >= 1) return prop("Q", "P4", pick.who?.id ?? T.id, { x: pick.x, y: pick.y });
      return prop("Q", "P4", T.id, { x: T.x, y: T.y });
    }
  }

  if (champ === "sedge" && skill === "W") {
    if (tier === "P1b" && pair && inRange(ctx.u, pair.diver, 6.5) && ccOk(ctx, pair.diver, "W", tier)) {
      const pick = bestLine(ctx, "W", pair.diver);
      if (pick && pick.hits.some((h) => h.id === pair.diver.id)) return prop("W", "P1b", pair.diver.id, { x: pick.x, y: pick.y });
    }
    if (tier === "P2c") {
      const x = ctx.perceived.find((e) => inRange(ctx.u, e, 6.5) && inChainWindow(ctx, e, "W") && ccOk(ctx, e, "W", tier));
      if (!x) return null;
      return prop("W", "P2c", x.id, { x: x.x, y: x.y });
    }
    if (tier === "P3" && ctx.F && engageOk(ctx, false) && openerClean(ctx, ctx.F) && inRange(ctx.u, ctx.F, 6.5)) {
      if (!ccOk(ctx, ctx.F, "W", tier)) return null;
      return prop("W", "P3", ctx.F.id, { x: ctx.F.x, y: ctx.F.y });
    }
    if (tier === "P4s") {
      const e = spillTarget(ctx, "W");
      if (!e) return null;
      return prop("W", "P4s", e.id, { x: e.x, y: e.y });
    }
  }

  if (champ === "sedge" && skill === "R") {
    if ((tier === "P1b" || tier === "P1d") && chasingAllies(ctx).length >= 2) {
      if (tier === "P1b" && !ctx.peeling && !ctx.peelDiverId) return null;
      if (tier === "P1d" && (ctx.peeling || ctx.peelDiverId)) return null;
      const pick = bestCircle(ctx, 11, 3.8);
      if (!pick) return null;
      const anchor = pick.who ?? ctx.F ?? ctx.T;
      if (anchor && !ccOk(ctx, anchor, "R", tier)) return null;
      const nA = circleAt(ctx, pick.x, pick.y, 3.8, "ally").length;
      if (nA > 1) return null;
      return prop("R", tier, pick.who?.id ?? null, { x: pick.x, y: pick.y });
    }
    if (tier === "P3" || tier === "P4") {
      const pick = bestCircle(ctx, 11, 3.8);
      if (!pick) return null;
      const anchor = pick.who ?? ctx.F ?? ctx.T;
      if (anchor && !ccOk(ctx, anchor, "R", tier)) return null;
      const nE = lockEligibleHits(ctx, pick.hits, "R").length;
      const nA = circleAt(ctx, pick.x, pick.y, 3.8, "ally").length;
      if (!friendlyOk(nE, nA, ctx)) return null;
      if (tier === "P3" && !engageOk(ctx, false)) return null;
      return prop("R", tier, pick.who?.id ?? null, { x: pick.x, y: pick.y });
    }
  }

  if (champ === "torun" && skill === "Q") {
    if (tier === "P1a") {
      const e = interruptOf(ctx, "Q", 2.2);
      if (e) return prop("Q", "P1a", e.id);
    }
    if (tier === "P1b" && pair && inRange(ctx.u, pair.diver, 2.2) && ccOk(ctx, pair.diver, "Q", tier)) {
      return prop("Q", "P1b", pair.diver.id);
    }
    if (tier === "P2c") {
      const x = ctx.perceived.find((e) => inRange(ctx.u, e, 2.2) && inChainWindow(ctx, e, "Q") && ccOk(ctx, e, "Q", tier));
      if (x) return prop("Q", "P2c", x.id);
    }
    if (tier === "P3" && ctx.F && engageOk(ctx, true) && openerClean(ctx, ctx.F) && inRange(ctx.u, ctx.F, 2.2) && ccOk(ctx, ctx.F, "Q", tier)) {
      return prop("Q", "P3", ctx.F.id);
    }
    if (tier === "P4s") {
      const e = spillTarget(ctx, "Q");
      if (e) return prop("Q", "P4s", e.id);
    }
  }

  if (champ === "torun" && skill === "W") {
    if (tier === "P1b" && pair && d(pair.diver, pair.carry) <= 1.2 + 1e-9 && inRange(ctx.u, pair.carry, 6)) {
      return prop("W", "P1b", pair.carry.id, { x: pair.carry.x, y: pair.carry.y });
    }
    if (tier === "P1c") {
      const ally = ctx.allies
        .filter((a) => doomed(a, ctx.state.t) && inRange(ctx.u, a, 6))
        .sort((a, b) => a.hp / a.max_hp - b.hp / b.max_hp || a.index - b.index)[0];
      if (ally) return prop("W", "P1c", ally.id, { x: ally.x, y: ally.y });
    }
    if (tier === "P3" && ctx.commit === "engage") {
      let best: UnitState | null = null;
      let bestN = 0;
      for (const a of ctx.allies) {
        if (!inRange(ctx.u, a, 6)) continue;
        const n = ctx.allies.filter((o) => d(o, a) <= 1.2 + 1e-9).length;
        const enemyNear = ctx.perceived.some((e) => d(e, a) <= 4 + 1e-9);
        if (n >= 2 && enemyNear && (n > bestN || (n === bestN && best && a.index < best.index))) {
          best = a;
          bestN = n;
        }
      }
      if (best) return prop("W", "P3", best.id, { x: best.x, y: best.y });
    }
    if (tier === "P1d" && ctx.u.hp / ctx.u.max_hp <= 0.5 + 1e-9 && threatWithin(ctx, ctx.u, 3)) {
      return prop("W", "P1d", ctx.u.id, { x: ctx.u.x, y: ctx.u.y });
    }
  }

  if (champ === "torun" && skill === "R") {
    if (tier === "P1a") {
      const e = interruptOf(ctx, "R", 6);
      if (e) return prop("R", "P1a", e.id, { x: e.x, y: e.y });
    }
    if (tier === "P1b" && pair && inRange(ctx.u, pair.diver, 6)) {
      const hits = circleAt(ctx, pair.diver.x, pair.diver.y, 3.2, "enemy");
      if (hits.some((h) => h.id === pair.diver.id)) return prop("R", "P1b", pair.diver.id, { x: pair.diver.x, y: pair.diver.y });
    }
    if (tier === "P2c") {
      const x = ctx.perceived.find((e) => inRange(ctx.u, e, 6) && inChainWindow(ctx, e, "R") && ccOk(ctx, e, "R", tier));
      if (x) return prop("R", "P2c", x.id, { x: x.x, y: x.y });
    }
    if (tier === "P3" || tier === "P4") {
      if (tier === "P3" && !engageOk(ctx, true)) return null;
      const pick = bestCircle(ctx, 6, 3.2);
      if (!pick) return null;
      const anchor = pick.who ?? ctx.F ?? ctx.T;
      if (anchor && !ccOk(ctx, anchor, "R", tier)) return null;
      if (lockEligibleHits(ctx, pick.hits, "R").length >= 2) {
        return prop("R", tier, pick.who?.id ?? null, { x: pick.x, y: pick.y });
      }
    }
  }

  if (champ === "tolle" && skill === "Q") {
    if (tier === "P1a") {
      const e = interruptOf(ctx, "Q", 2.2);
      if (e) return prop("Q", "P1a", e.id);
    }
    if (tier === "P1b" && pair && inRange(ctx.u, pair.diver, 2.2) && ccOk(ctx, pair.diver, "Q", tier)) {
      return prop("Q", "P1b", pair.diver.id);
    }
    if (tier === "P2c") {
      const x = ctx.perceived.find((e) => inRange(ctx.u, e, 2.2) && inChainWindow(ctx, e, "Q") && ccOk(ctx, e, "Q", tier));
      if (x) return prop("Q", "P2c", x.id);
    }
    if (tier === "P3" && ctx.F && engageOk(ctx, true) && openerClean(ctx, ctx.F) && inRange(ctx.u, ctx.F, 2.2) && ccOk(ctx, ctx.F, "Q", tier)) {
      return prop("Q", "P3", ctx.F.id);
    }
    if (tier === "P4s") {
      const e = spillTarget(ctx, "Q");
      if (e) return prop("Q", "P4s", e.id);
    }
  }

  if (champ === "tolle" && skill === "W") {
    if (tier === "P1c") {
      const intentsOn = (a: UnitState) =>
        ctx.perceived.filter((e) => e.ai_target_id === a.id || ctx.intentTarget[e.id] === a.id).length;
      const ally = ctx.allies
        .filter(
          (a) =>
            a.id !== ctx.u.id &&
            (isCarry(a) || cls(a) === "Tank") &&
            doomed(a, ctx.state.t) &&
            intentsOn(a) >= 2 &&
            inRange(ctx.u, a, 6),
        )
        .sort((a, b) => a.index - b.index)[0];
      if (ally) return prop("W", "P1c", ally.id);
    }
    if (tier === "P1b" && pair && ctx.aTrue < 0.62 - 1e-9 && inRange(ctx.u, pair.diver, 6)) {
      if (tolleBanOk(ctx, pair.diver) && ccOk(ctx, pair.diver, "W", tier)) {
        return prop("W", "P1b", pair.diver.id);
      }
    }
  }

  if (champ === "tolle" && skill === "R") {
    const delay = landDelay(ctx.u, "R");
    const counts = (e: UnitState) => {
      const slow = strongestSlow(e.status);
      const disabled = disableRemaining(e) > 1e-9;
      const stationary = Math.hypot(e.vx, e.vy) < 0.05 || disabled;
      const holdOcc = ctx.tactic === "hold_the_pit" && inZone(e, ctx.c);
      return stationary || disabled || slow >= 0.3 - 1e-9 || holdOcc;
    };
    if (tier === "P2c") {
      const x = ctx.perceived.find((e) => {
        if (!isLocked(e.status)) return false;
        const lock = e.status.effects.find((f) => f.category === "lock" && f.remaining > 1e-9);
        if (!lock || remTicks(lock.remaining) < 12) return false;
        return inChainWindow(ctx, e, "R") && ccOk(ctx, e, "R", tier);
      });
      if (!x) return null;
      const p = predict(x, delay);
      if (!inRange(ctx.u, p, 7)) return null;
      if (inOwnSanctuary(x.team, p.x, p.y, ctx.c)) return null;
      return prop("R", "P2c", x.id, p);
    }
    if (tier === "P3" || tier === "P4") {
      if (tier === "P3" && !engageOk(ctx, true)) return null;
      let best: { e: UnitState; p: { x: number; y: number }; n: number } | null = null;
      for (const who of kCandidates(ctx, T)) {
        if (!ccOk(ctx, who, "R", tier)) continue;
        const p = predict(who, delay);
        if (!inRange(ctx.u, p, 7)) continue;
        if (inOwnSanctuary(who.team, p.x, p.y, ctx.c)) continue;
        const hits: UnitState[] = [];
        for (const e of ctx.perceived) {
          if (!counts(e)) continue;
          const ep = predict(e, delay);
          if (circleHitsUnit(p.x, p.y, 3.4, ep, ctx.c.BODY_RADIUS)) hits.push(e);
        }
        const n = lockEligibleHits(ctx, hits, "R").length;
        if (!best || n > best.n || (n === best.n && who.index < best.e.index)) best = { e: who, p, n };
      }
      if (best && best.n >= 2) return prop("R", tier, best.e.id, best.p);
    }
  }

  if (champ === "helvar" && skill === "Q") {
    if (tier === "P2") {
      const x = followX(ctx, 8);
      if (!x) return null;
      const pick = bestLine(ctx, "Q", x);
      if (!pick) return null;
      return prop("Q", "P2", x.id, { x: pick.x, y: pick.y });
    }
    if (tier === "P4" && T && inRange(ctx.u, T, 8)) {
      if (p4BlockedByComboFollow(ctx, "Q", T)) return null;
      const pick = bestLine(ctx, "Q", T);
      if (!pick) return null;
      return prop("Q", "P4", T.id, { x: pick.x, y: pick.y });
    }
  }

  if (champ === "helvar" && skill === "W") {
    if (tier === "P1b") {
      const diver = pair?.diver;
      if (diver && d(ctx.u, diver) <= 8 + 1e-9 && inRange(ctx.u, diver, 8.5) && ccOk(ctx, diver, "W", tier)) {
        return prop("W", "P1b", diver.id, { x: diver.x, y: diver.y });
      }
    }
    if (tier === "P2c") {
      const x = ctx.perceived.find((e) => inRange(ctx.u, e, 8.5) && inChainWindow(ctx, e, "W") && ccOk(ctx, e, "W", tier));
      if (x) return prop("W", "P2c", x.id, { x: x.x, y: x.y });
    }
    if (tier === "P3" && engageOk(ctx, false)) {
      const focus = ctx.F;
      const pick = bestLine(ctx, "W", focus);
      if (pick && (pick.n >= 2 || (focus && pick.hits.some((h) => h.id === focus.id) && openerClean(ctx, focus)))) {
        const who = pick.who ?? focus;
        if (who && ccOk(ctx, who, "W", tier) && (pick.n >= 2 || openerClean(ctx, who))) {
          return prop("W", "P3", who.id, { x: pick.x, y: pick.y });
        }
      }
    }
    if (tier === "P4s") {
      const e = spillTarget(ctx, "W");
      if (e) return prop("W", "P4s", e.id, { x: e.x, y: e.y });
    }
  }

  if (champ === "helvar" && skill === "R") {
    if (tier === "P1b" && pair) {
      const n = normalize(pair.diver.x - ctx.u.x, pair.diver.y - ctx.u.y);
      if (n.len > 1e-12 && inRange(ctx.u, pair.diver, 9) && lineHits(ctx, pair.diver, "R").some((h) => h.id === pair.diver.id)) {
        const x = pair.diver.x + n.x * 2.2;
        const y = pair.diver.y + n.y * 2.2;
        const nowD = d(pair.diver, pair.carry);
        const nextD = distPts(x, y, pair.carry.x, pair.carry.y);
        if (nextD + 1e-9 >= 2 && nextD > nowD + 1e-6) return prop("R", "P1b", pair.diver.id, { x: pair.diver.x, y: pair.diver.y });
      }
    }
    if (tier === "P4") {
      if (zoneBreakHelvar(ctx) && !holdRBlocks(ctx, T ?? ctx.u)) {
        const occ = (ctx.state.zone?.occupied ?? [])
          .map((id) => ctx.state.units.find((u) => u.id === id))
          .find((e) => e && e.team !== ctx.u.team && e.alive);
        if (occ) return prop("R", "P4", occ.id, { x: occ.x, y: occ.y });
      }
      if (holdRBlocks(ctx, T ?? ctx.u)) return null;
      const pick = bestLine(ctx, "R", T);
      if (!pick || pick.n < 2) return null;
      const who = pick.who ?? T;
      if (who && rHoldBlocks(ctx, who)) return null;
      return prop("R", "P4", who?.id ?? null, { x: pick.x, y: pick.y });
    }
  }

  if (champ === "calder" && skill === "Q") {
    if (tier === "P2") {
      const x = followX(ctx, 6.4);
      if (!x) return null;
      const pick = bestCone(ctx, "Q", x);
      if (!pick) return null;
      return prop("Q", "P2", x.id, { x: pick.x, y: pick.y });
    }
    if (tier === "P4" && T && inRange(ctx.u, T, 6.4)) {
      if (p4BlockedByComboFollow(ctx, "Q", T)) return null;
      const pick = bestCone(ctx, "Q", T);
      if (!pick) return null;
      return prop("Q", "P4", T.id, { x: pick.x, y: pick.y });
    }
  }

  if (champ === "calder" && skill === "W" && tier === "P1d") {
    const hp = ctx.u.hp / ctx.u.max_hp;
    const retreating = ctx.p1Only || ctx.commit === "disengage" || ctx.u.intent === "Retreat" || ctx.u.intent === "Regroup";
    const inF = unitInFightNow(ctx.u, ctx.state, ctx.c, ctx.fightIds, ctx.seenAt, ctx.ignorePerception);
    const worth = ctx.u.max_hp - ctx.u.hp + 1e-9 >= 0.75 * healAmt(ctx.u, ab);
    if (doomed(ctx.u, ctx.state.t) || (hp <= 0.6 + 1e-9 && (inF || retreating) && worth)) {
      return prop("W", "P1d", ctx.u.id);
    }
  }

  if (champ === "calder" && skill === "R") {
    if (tier === "P1b" || tier === "P1d") {
      if (tier === "P1b" && !ctx.peeling && !ctx.peelDiverId && !pair) return null;
      if (tier === "P1d" && (ctx.peeling || ctx.peelDiverId)) return null;
      const chasers = chasingAllies(ctx);
      if (chasers.length < 1) return null;
      const who = chasers[0]!;
      if (!inRange(ctx.u, who, 7)) return null;
      const hits = circleAt(ctx, who.x, who.y, 3, "enemy");
      if (!fearSafe(ctx, hits)) return null;
      if (!ccOk(ctx, who, "R", tier)) return null;
      return prop("R", tier, who.id, { x: who.x, y: who.y });
    }
    if (tier === "P4") {
      const picks: Pick[] = [];
      for (const who of kCandidates(ctx, T)) {
        if (!inZone(who, ctx.c) || !inRange(ctx.u, who, 7)) continue;
        if (!ccOk(ctx, who, "R", tier)) continue;
        const hits = circleAt(ctx, who.x, who.y, 3, "enemy").filter((e) => inZone(e, ctx.c));
        const nE = lockEligibleHits(ctx, hits, "R").length;
        picks.push({ x: who.x, y: who.y, who, n: nE, hits, score: nE });
      }
      const pick = choosePick(ctx, picks, true, null);
      if (!pick || pick.n < 2) return null;
      if (!fearSafe(ctx, pick.hits)) return null;
      return prop("R", "P4", pick.who?.id ?? null, { x: pick.x, y: pick.y });
    }
  }

  if (champ === "kerrig" && skill === "Q") {
    const hookOk = (e: UnitState) =>
      inRange(ctx.u, e, 6.5) && firstOnLine(ctx, e, "Q")?.id === e.id && ccOk(ctx, e, "Q", tier);
    if (tier === "P2") {
      const x = followX(ctx, 6.5);
      if (x && hookOk(x)) return prop("Q", "P2", x.id, { x: x.x, y: x.y });
    }
    if (tier === "P3" && engageOk(ctx, true)) {
      const pool = ctx.perceived.filter((e) => isSquishy(e) && hookOk(e) && openerClean(ctx, e));
      pool.sort((a, b) => {
        const aF = ctx.F && a.id === ctx.F.id ? 0 : 1;
        const bF = ctx.F && b.id === ctx.F.id ? 0 : 1;
        if (aF !== bF) return aF - bF;
        const ah = a.hp / a.max_hp;
        const bh = b.hp / b.max_hp;
        if (Math.abs(ah - bh) > 1e-9) return ah - bh;
        return a.index - b.index;
      });
      const e = pool[0];
      if (e) return prop("Q", "P3", e.id, { x: e.x, y: e.y });
    }
    if (tier === "P4s") {
      const e = spillTarget(ctx, "Q");
      if (e && firstOnLine(ctx, e, "Q")?.id === e.id) return prop("Q", "P4s", e.id, { x: e.x, y: e.y });
    }
  }

  if (champ === "kerrig" && skill === "W") {
    const ownSetup = (e: UnitState) =>
      hasMark(e.marks, "kerrig", ctx.state.t) ||
      e.status.effects.some((f) => f.kind === "leash" && f.source_id === ctx.u.id && f.remaining > 1e-9);
    if (tier === "P2") {
      // Prefer own Q mark/leash target within 1.8 after combo_follow.
      const marked = ctx.perceived.filter((e) => ownSetup(e) && inRange(ctx.u, e, 1.8) && comboReady(ctx, e));
      if (marked.length > 0) {
        marked.sort((a, b) => d(ctx.u, a) - d(ctx.u, b) || a.index - b.index);
        return prop("W", "P2", marked[0]!.id);
      }
      const x = followX(ctx, 1.8);
      if (x) return prop("W", "P2", x.id);
    }
    if (tier === "P4") {
      // Prefer T in 1.8; else own mark/leash in range; else nearest perceived in 1.8.
      let aim: UnitState | null = T && inRange(ctx.u, T, 1.8) ? T : null;
      if (!aim) {
        const marked = ctx.perceived.filter((e) => ownSetup(e) && inRange(ctx.u, e, 1.8));
        marked.sort((a, b) => d(ctx.u, a) - d(ctx.u, b) || a.index - b.index);
        aim = marked[0] ?? null;
      }
      if (!aim) {
        const near = ctx.perceived.filter((e) => inRange(ctx.u, e, 1.8));
        near.sort((a, b) => d(ctx.u, a) - d(ctx.u, b) || a.index - b.index);
        aim = near[0] ?? null;
      }
      if (!aim) return null;
      if (p4BlockedByComboFollow(ctx, "W", aim)) return null;
      return prop("W", "P4", aim.id);
    }
  }

  if (champ === "kerrig" && skill === "R") {
    return markFinisher(ctx, tier, "kerrig", 5.5, 0);
  }

  if (champ === "mirren" && skill === "Q") {
    if (tier === "P2") {
      const x = followX(ctx, 6);
      if (x) return prop("Q", "P2", x.id);
    }
    if (tier === "P4" && T && inRange(ctx.u, T, 6)) {
      if (p4BlockedByComboFollow(ctx, "Q", T)) return null;
      return prop("Q", "P4", T.id);
    }
  }

  if (champ === "mirren" && skill === "W") {
    if (tier === "P1a") {
      const e = interruptOf(ctx, "W", 6);
      if (e) return prop("W", "P1a", e.id);
    }
    if (tier === "P1b" && pair && inRange(ctx.u, pair.diver, 6) && ccOk(ctx, pair.diver, "W", tier)) {
      return prop("W", "P1b", pair.diver.id);
    }
    if (tier === "P2c") {
      const x = ctx.perceived.find((e) => inRange(ctx.u, e, 6) && inChainWindow(ctx, e, "W") && ccOk(ctx, e, "W", tier));
      if (x) return prop("W", "P2c", x.id);
    }
    if (tier === "P3" && engageOk(ctx, false)) {
      const carries = ctx.perceived.filter((e) => e.slot === "adc" || isCarry(e));
      carries.sort((a, b) => {
        const as = a.slot === "adc" ? 0 : 1;
        const bs = b.slot === "adc" ? 0 : 1;
        if (as !== bs) return as - bs;
        return b.stats.atk + b.stats.pow - (a.stats.atk + a.stats.pow);
      });
      const e = carries.find((c0) => inRange(ctx.u, c0, 6) && openerClean(ctx, c0) && ccOk(ctx, c0, "W", tier));
      if (e) return prop("W", "P3", e.id);
    }
    if (tier === "P4s") {
      const e = spillTarget(ctx, "W");
      if (e) return prop("W", "P4s", e.id);
    }
  }

  if (champ === "mirren" && skill === "R") {
    if (tier === "P1a") {
      const e = interruptOf(ctx, "R", 8);
      if (e) return prop("R", "P1a", e.id, { x: e.x, y: e.y });
    }
    if (tier === "P3" || tier === "P4") {
      if (tier === "P3" && !engageOk(ctx, false)) return null;
      const picks: Pick[] = [];
      for (const who of kCandidates(ctx, T)) {
        if (!inRange(ctx.u, who, 8)) continue;
        if (!ccOk(ctx, who, "R", tier)) continue;
        const hits = circleAt(ctx, who.x, who.y, 2.8, "enemy").filter((e) => !isLocked(e.status));
        const nE = lockEligibleHits(ctx, hits, "R").length;
        picks.push({ x: who.x, y: who.y, who, n: nE, hits, score: nE });
      }
      const pick = choosePick(ctx, picks, true, null);
      if (pick && pick.n >= 2) return prop("R", tier, pick.who?.id ?? null, { x: pick.x, y: pick.y });
    }
  }

  if (champ === "rhedan" && skill === "Q") {
    if (tier === "P2") {
      const x = followX(ctx, 3);
      if (x) return prop("Q", "P2", x.id, { x: x.x, y: x.y });
    }
    if (tier === "P4" && T && inRange(ctx.u, T, 3)) {
      if (p4BlockedByComboFollow(ctx, "Q", T)) return null;
      return prop("Q", "P4", T.id, { x: T.x, y: T.y });
    }
  }

  if (champ === "rhedan" && skill === "W") {
    const hook = (e: UnitState) =>
      inRange(ctx.u, e, 5.5) && firstOnLine(ctx, e, "W")?.id === e.id && ccOk(ctx, e, "W", tier);
    if (tier === "P3" && engageOk(ctx, true)) {
      const pool = ctx.perceived.filter((e) => isBackliner(e) && hook(e) && openerClean(ctx, e));
      for (const e of pool) {
        const remain = Math.max(0, d(ctx.u, e) - (ab.pull ?? 4));
        if (remain <= 2.5 + 1e-9) return prop("W", "P3", e.id, { x: e.x, y: e.y });
      }
    }
    if (tier === "P1b" && pair && hook(pair.diver)) {
      const n = normalize(ctx.u.x - pair.diver.x, ctx.u.y - pair.diver.y);
      const step = Math.min(ab.pull ?? 4, d(ctx.u, pair.diver));
      const nx = pair.diver.x + (n.len < 1e-12 ? 0 : n.x * step);
      const ny = pair.diver.y + (n.len < 1e-12 ? 0 : n.y * step);
      if (distPts(nx, ny, pair.carry.x, pair.carry.y) > d(pair.diver, pair.carry) + 1e-6) {
        return prop("W", "P1b", pair.diver.id, { x: pair.diver.x, y: pair.diver.y });
      }
    }
    if (tier === "P4s") {
      const e = spillTarget(ctx, "W");
      if (e && firstOnLine(ctx, e, "W")?.id === e.id) return prop("W", "P4s", e.id, { x: e.x, y: e.y });
    }
  }

  if (champ === "rhedan" && skill === "R") {
    if (tier === "P1a") {
      const e = interruptOf(ctx, "R", 2.8);
      if (e) return prop("R", "P1a", e.id);
    }
    if (tier === "P2c") {
      const x = ctx.perceived.find(
        (e) =>
          inRange(ctx.u, e, 2.8) &&
          (isRooted(e.status) || e.status.effects.some((f) => f.kind === "root" && f.source_id === ctx.u.id)) &&
          inChainWindow(ctx, e, "R") &&
          ccOk(ctx, e, "R", tier),
      );
      if (x) return prop("R", "P2c", x.id);
    }
    if (tier === "P3" || tier === "P4") {
      if (tier === "P3" && !engageOk(ctx, true)) return null;
      if (
        T &&
        inRange(ctx.u, T, 2.8) &&
        ccOk(ctx, T, "R", tier) &&
        lockEligibleHits(ctx, circleAt(ctx, T.x, T.y, 2.4, "enemy"), "R").length >= 2
      ) {
        return prop("R", tier, T.id);
      }
    }
  }

  if (champ === "brannoch" && skill === "Q") {
    if (tier === "P2") {
      const x = followX(ctx, 6.5);
      if (!x) return null;
      const pick = bestLine(ctx, "Q", x);
      if (!pick) return null;
      return prop("Q", "P2", x.id, { x: pick.x, y: pick.y });
    }
    if (tier === "P4" && T && inRange(ctx.u, T, 6.5)) {
      if (p4BlockedByComboFollow(ctx, "Q", T)) return null;
      const fleeing = ctx.perceived.filter(
        (e) => inRange(ctx.u, e, 6.5) && (e.intent === "Retreat" || e.intent === "Regroup"),
      );
      const aimAt = fleeing[0] && lineHits(ctx, fleeing[0], "Q").some((h) => h.id === fleeing[0]!.id) ? fleeing[0]! : T;
      const pick = bestLine(ctx, "Q", aimAt);
      if (!pick) return null;
      return prop("Q", "P4", aimAt.id, { x: pick.x, y: pick.y });
    }
  }

  if (champ === "brannoch" && skill === "W") {
    if (tier === "P1a") {
      const e = interruptOf(ctx, "W", 3.5);
      if (e) return prop("W", "P1a", e.id);
    }
    if (tier === "P1b" && pair && inRange(ctx.u, pair.diver, 3.5) && ccOk(ctx, pair.diver, "W", tier)) {
      return prop("W", "P1b", pair.diver.id);
    }
    if (tier === "P2c") {
      const x = ctx.perceived.find((e) => inRange(ctx.u, e, 3.5) && inChainWindow(ctx, e, "W") && ccOk(ctx, e, "W", tier));
      if (x) return prop("W", "P2c", x.id);
    }
    if (tier === "P3" && engageOk(ctx, true)) {
      const pool = ctx.perceived.filter(
        (e) => inRange(ctx.u, e, 3.5) && openerClean(ctx, e) && ccOk(ctx, e, "W", tier) && (e.id === ctx.F?.id || isBackliner(e)),
      );
      pool.sort((a, b) => {
        const aF = ctx.F && a.id === ctx.F.id ? 0 : 1;
        const bF = ctx.F && b.id === ctx.F.id ? 0 : 1;
        if (aF !== bF) return aF - bF;
        return a.index - b.index;
      });
      if (pool[0]) return prop("W", "P3", pool[0].id);
    }
  }

  if (champ === "brannoch" && skill === "R") {
    const here = circleAt(ctx, ctx.u.x, ctx.u.y, 2.6, "enemy");
    const nHere = lockEligibleHits(ctx, here, "R").length;
    if (tier === "P1a") {
      const e = interruptOf(ctx, "R", 2.6);
      if (e && here.some((h) => h.id === e.id)) return prop("R", "P1a", e.id);
    }
    if (tier === "P1b" && pair && d(ctx.u, pair.diver) <= 2.6 + 1e-9 && ccOk(ctx, pair.diver, "R", tier)) {
      return prop("R", "P1b", pair.diver.id);
    }
    if (tier === "P2c" && ctx.F && inChainWindow(ctx, ctx.F, "R") && ccOk(ctx, ctx.F, "R", tier)) {
      const ownW = ctx.memory?.casts.some(
        (c) => c.caster === ctx.u.id && c.skill === "W" && ctx.state.t - c.t <= 0.6 + 1e-9,
      );
      if (ownW && d(ctx.u, ctx.F) <= 2.6 + 1e-9) return prop("R", "P2c", ctx.F.id);
    }
    if ((tier === "P3" || tier === "P4") && nHere >= 2) {
      if (tier === "P3" && !engageOk(ctx, true)) return null;
      const anchor = ctx.F ?? ctx.T ?? here[0] ?? null;
      if (anchor && !ccOk(ctx, anchor, "R", tier)) return null;
      return prop("R", tier, null);
    }
  }

  if (champ === "ysol" && skill === "Q") {
    if (tier === "P1a") {
      const e = interruptOf(ctx, "Q", 7.2);
      if (e && coneHits(ctx, e, "Q").some((h) => h.id === e.id)) return prop("Q", "P1a", e.id, { x: e.x, y: e.y });
    }
    if (tier === "P1b" && pair && inRange(ctx.u, pair.diver, 7.2)) {
      const kerr = ctx.perceived.find((e) => e.champ === "kerrig" && inRange(ctx.u, e, 7.2) && d(e, pair.carry) <= ctx.c.PEEL_DIVE_R);
      const who = kerr ?? pair.diver;
      if (coneHits(ctx, who, "Q").some((h) => h.id === who.id)) return prop("Q", "P1b", who.id, { x: who.x, y: who.y });
    }
    if (tier === "P4") {
      const pick = bestCone(ctx, "Q", T);
      if (pick && pick.n >= 2) return prop("Q", "P4", pick.who?.id ?? T?.id ?? null, { x: pick.x, y: pick.y });
    }
    if (tier === "P4s") {
      const e = spillTarget(ctx, "Q");
      if (e) return prop("Q", "P4s", e.id, { x: e.x, y: e.y });
    }
  }

  if (champ === "ysol" && skill === "W" && tier === "P1c") {
    const strongLeft = (a: UnitState) => {
      let m = 0;
      for (const e of a.status.effects) {
        const k = e.kind as CcKind;
        const listed =
          k === "stun" ||
          k === "sleep" ||
          k === "hex" ||
          k === "fear" ||
          k === "root" ||
          k === "leash" ||
          k === "silence" ||
          k === "taunt" ||
          (k === "slow" && (e.slow ?? 0) >= 0.3 - 1e-9);
        if (listed && e.remaining > m) m = e.remaining;
      }
      return m;
    };
    const inF = (a: UnitState) => unitInFightNow(a, ctx.state, ctx.c, ctx.fightIds, ctx.seenAt, ctx.ignorePerception);
    const dispellable = ctx.allies.filter((a) => inRange(ctx.u, a, 6.5) && inF(a) && strongLeft(a) >= 0.5 - 1e-9);
    dispellable.sort((a, b) => {
      const ac = isCarry(a) ? 0 : 1;
      const bc = isCarry(b) ? 0 : 1;
      if (ac !== bc) return ac - bc;
      const ad = doomed(a, ctx.state.t) ? 0 : 1;
      const bd = doomed(b, ctx.state.t) ? 0 : 1;
      if (ad !== bd) return ad - bd;
      return a.index - b.index;
    });
    if (dispellable[0]) return prop("W", "P1c", dispellable[0].id, { x: dispellable[0].x, y: dispellable[0].y });
    const doom = ctx.allies
      .filter((a) => doomed(a, ctx.state.t) && inRange(ctx.u, a, 6.5))
      .sort((a, b) => a.hp / a.max_hp - b.hp / b.max_hp || a.index - b.index)[0];
    if (doom) return prop("W", "P1c", doom.id, { x: doom.x, y: doom.y });
    const heal = ctx.allies.filter((a) => {
      if (!inRange(ctx.u, a, 6.5)) return false;
      if (a.hp / a.max_hp > 0.6 + 1e-9) return false;
      return a.max_hp - a.hp + 1e-9 >= 0.75 * healAmt(ctx.u, ab);
    });
    if (heal.length === 0) return null;
    heal.sort((a, b) => {
      const na = ctx.allies.filter((o) => d(o, a) <= 1.2 + 1e-9).length;
      const nb = ctx.allies.filter((o) => d(o, b) <= 1.2 + 1e-9).length;
      if (na !== nb) return nb - na;
      return a.index - b.index;
    });
    return prop("W", "P1c", heal[0]!.id, { x: heal[0]!.x, y: heal[0]!.y });
  }

  if (champ === "ysol" && skill === "R") {
    if (tier === "P1a") {
      const e = interruptOf(ctx, "R", 6);
      if (e) return prop("R", "P1a", e.id, { x: e.x, y: e.y });
    }
    if (tier === "P1b" && pair && inRange(ctx.u, pair.diver, 6)) {
      return prop("R", "P1b", pair.diver.id, { x: pair.diver.x, y: pair.diver.y });
    }
    if (tier === "P2c") {
      const x = ctx.perceived.find((e) => inRange(ctx.u, e, 6) && inChainWindow(ctx, e, "R") && ccOk(ctx, e, "R", tier));
      if (x) return prop("R", "P2c", x.id, { x: x.x, y: x.y });
    }
    if (tier === "P3" || tier === "P4") {
      if (tier === "P3" && !engageOk(ctx, false)) return null;
      const pick = bestCircle(ctx, 6, 2.6);
      if (!pick) return null;
      const anchor = pick.who ?? ctx.F ?? ctx.T;
      if (anchor && !ccOk(ctx, anchor, "R", tier)) return null;
      if (lockEligibleHits(ctx, pick.hits, "R").length >= 2) {
        return prop("R", tier, pick.who?.id ?? null, { x: pick.x, y: pick.y });
      }
    }
  }

  if (champ === "saelo" && skill === "Q") {
    if (tier === "P1b" && pair && inRange(ctx.u, pair.diver, 7) && lineHits(ctx, pair.diver, "Q").some((h) => h.id === pair.diver.id)) {
      return prop("Q", "P1b", pair.diver.id, { x: pair.diver.x, y: pair.diver.y });
    }
    if (tier === "P2") {
      const x = followX(ctx, 7);
      if (!x) return null;
      const pick = bestLine(ctx, "Q", x);
      if (!pick) return null;
      return prop("Q", "P2", x.id, { x: pick.x, y: pick.y });
    }
    if (tier === "P4" && T && inRange(ctx.u, T, 7)) {
      if (p4BlockedByComboFollow(ctx, "Q", T)) return null;
      const pick = bestLine(ctx, "Q", T);
      if (!pick) return null;
      return prop("Q", "P4", T.id, { x: pick.x, y: pick.y });
    }
  }

  if (champ === "saelo" && skill === "W") {
    const handicap = (a: UnitState) => {
      let m = 0;
      for (const e of a.status.effects) {
        const ok =
          e.kind === "silence" ||
          e.kind === "taunt" ||
          e.kind === "blind" ||
          e.kind === "disarm" ||
          (e.kind === "slow" && (e.slow ?? 0) >= 0.3 - 1e-9);
        if (ok && e.remaining > m) m = e.remaining;
      }
      return m;
    };
    const inF = (a: UnitState) => unitInFightNow(a, ctx.state, ctx.c, ctx.fightIds, ctx.seenAt, ctx.ignorePerception);
    // R7-2 P1b: auto-peel assigned, dived carry within 6.5, Handicap or incoming_1s from diver.
    if (tier === "P1b" && (ctx.peeling || ctx.peelDiverId) && pair) {
      const carry = pair.carry;
      if (inRange(ctx.u, carry, 6.5)) {
        const fromDiver = (carry.damage_log ?? []).some(
          (g) => g.source_id === pair.diver.id && ctx.state.t - g.t <= 1 + 1e-9,
        );
        if (handicap(carry) > 1e-9 || fromDiver) return prop("W", "P1b", carry.id);
      }
    }
    if (tier === "P1c") {
      const cc = ctx.allies.filter((a) => a.id !== ctx.u.id && inRange(ctx.u, a, 6.5) && inF(a) && handicap(a) >= 0.5 - 1e-9);
      cc.sort((a, b) => (isCarry(a) ? 0 : 1) - (isCarry(b) ? 0 : 1) || a.index - b.index);
      if (cc[0]) return prop("W", "P1c", cc[0].id);
      const doom = ctx.allies
        .filter((a) => a.id !== ctx.u.id && doomed(a, ctx.state.t) && inRange(ctx.u, a, 6.5))
        .sort((a, b) => (isCarry(a) ? 0 : 1) - (isCarry(b) ? 0 : 1) || a.hp / a.max_hp - b.hp / b.max_hp)[0];
      if (doom) return prop("W", "P1c", doom.id);
    }
    if (tier === "P4") {
      const heal = ctx.allies
        .filter((a) => inRange(ctx.u, a, 6.5) && a.hp / a.max_hp <= 0.6 + 1e-9)
        .sort((a, b) => a.hp / a.max_hp - b.hp / b.max_hp || a.index - b.index)[0];
      if (heal) return prop("W", "P4", heal.id);
    }
  }

  if (champ === "saelo" && skill === "R") {
    if (tier === "P1a") {
      const e = interruptOf(ctx, "R", 8);
      if (e && !spellwardBlocks(ctx, e, "R")) return prop("R", "P1a", e.id, { x: e.x, y: e.y });
    }
    if (tier === "P1c") {
      const ally = ctx.allies.find((a) => doomed(a, ctx.state.t) && inRange(ctx.u, a, 8));
      if (ally) {
        const damagers = new Set(
          (ally.damage_log ?? []).filter((g) => ctx.state.t - g.t <= 1 + 1e-9).map((g) => g.source_id),
        );
        const foes = ctx.perceived.filter((e) => damagers.has(e.id));
        const caught = foes.filter((e) => circleHitsUnit(ally.x, ally.y, 2.4, e, ctx.c.BODY_RADIUS));
        if (foes.length > 0 && caught.length === foes.length) {
          const nA = circleAt(ctx, ally.x, ally.y, 2.4, "ally").length;
          if (nA <= 1) return prop("R", "P1c", ally.id, { x: ally.x, y: ally.y });
        }
      }
    }
    if (tier === "P3" || tier === "P4") {
      if (tier === "P3" && !engageOk(ctx, false)) return null;
      const pick = bestCircle(ctx, 8, 2.4);
      if (!pick) return null;
      const anchor = pick.who ?? ctx.F ?? ctx.T;
      if (anchor && !ccOk(ctx, anchor, "R", tier)) return null;
      const nE = lockEligibleHits(ctx, pick.hits, "R").length;
      const nA = circleAt(ctx, pick.x, pick.y, 2.4, "ally").length;
      if (!friendlyOk(nE, nA, ctx)) return null;
      return prop("R", tier, pick.who?.id ?? null, { x: pick.x, y: pick.y });
    }
  }

  return null;
}

function markFinisher(ctx: Ctx, tier: CastTier, kind: "huntress" | "kerrig", range: number, radius: number): CastProposal | null {
  if (tier !== "P2" && tier !== "P4") return null;
  const foe =
    (ctx.F && legalEnemy(ctx.u, ctx.F, ctx.c) ? ctx.F : null) ||
    (ctx.T && legalEnemy(ctx.u, ctx.T, ctx.c) ? ctx.T : null) ||
    ctx.perceived.slice().sort((a, b) => d(ctx.u, a) - d(ctx.u, b) || a.index - b.index)[0] ||
    null;
  if (!foe || !inRange(ctx.u, foe, range)) return null;
  if (holdRBlocks(ctx, foe)) return null;
  const marked = hasMark(foe.marks, kind, ctx.state.t);
  const ab = abil(ctx.u.champ, "R")!;

  if (kind === "kerrig" && distOwnPad(foe, foe.team, ctx.c) <= 1.5 + 1e-9) {
    const est = marked ? estDamage(ctx.u, foe, ab) : 0;
    if (est < foe.hp + foe.status.shield_pool - 1e-9) return null;
  }

  if (ctx.ex >= 45) {
    if (!marked) return null;
    if (tier === "P2") {
      if (foe.hp / foe.max_hp > 0.6 + 1e-9) return null;
      if (!isX(ctx, foe) || !comboReady(ctx, foe)) return null;
    } else if (rHoldBlocks(ctx, foe)) {
      return null;
    }
  } else {
    if (tier !== "P4") return null;
    if (!(ctx.u.cd_q > 0.5)) return null;
  }

  let aim = { x: foe.x, y: foe.y };
  if (kind === "huntress" && radius > 0) {
    const base = circleAt(ctx, foe.x, foe.y, radius, "enemy").length;
    const pick = bestCircle(ctx, range, radius);
    if (
      pick &&
      pick.n >= base + 1 &&
      circleHitsUnit(pick.x, pick.y, radius, foe, ctx.c.BODY_RADIUS) &&
      inRange(ctx.u, pick, range)
    ) {
      aim = { x: pick.x, y: pick.y };
    }
  }
  return prop("R", tier, foe.id, aim);
}

function tolleBanOk(ctx: Ctx, target: UnitState): boolean {
  if (target.id === ctx.u.id) return false;
  const winning = ctx.commit === "engage" && ctx.aTrue >= 0.62 - 1e-9;
  if (winning && ctx.perceived.length <= 1) return false;
  const claim = ctx.state.claim;
  if (claim && claim.team === ctx.u.team) {
    const inZ = ctx.perceived.filter((e) => inZone(e, ctx.c));
    if (inZ.length === 1 && inZ[0]!.id === target.id) return false;
  }
  return true;
}

function buildCtx(state: MatchState, u: UnitState, opts: CastPolicyOpts): Ctx {
  const seenAt = opts.seenAt;
  const ignore = opts.ignorePerception === true;
  const perceived = state.units.filter(
    (e) => legalEnemy(u, e, opts.c) && perceivedBy(u, e, state.t, seenAt, ignore),
  );
  const allies = state.units.filter((a) => a.alive && a.team === u.team && !isBanished(a.status));
  const fightIds = opts.fightIds ?? [];
  const focusId = opts.focusId;
  const F = focusId ? state.units.find((x) => x.id === focusId && x.alive && !isBanished(x.status)) ?? null : null;
  const pool = perceived.filter((e) => fightIds.length === 0 || fightIds.includes(e.id));
  const usePool = pool.length > 0 ? pool : perceived;
  const tid = pickUnitTarget(u, usePool, {
    c: opts.c,
    focusId,
    peeling: opts.peeling === true,
    peelDiverId: opts.peelDiverId ?? null,
    tactic: opts.tactic ?? "hold_the_pit",
    currentTarget: opts.currentTarget ?? null,
    zoneCenter: [opts.c.ZONE_CENTER[0]!, opts.c.ZONE_CENTER[1]!],
    zoneR: opts.c.ZONE_RADIUS,
    all: state.units,
    intentTarget: opts.intentTarget ?? {},
    teamwork: u.attrs.teamwork,
    commitDisengage: opts.commit === "disengage",
  });
  const T = tid ? state.units.find((x) => x.id === tid) ?? null : null;
  return {
    state,
    u,
    c: opts.c,
    focusId,
    peelDiverId: opts.peelDiverId ?? null,
    commit: opts.commit ?? "hold",
    aTrue: opts.aTrue ?? 0.5,
    tactic: opts.tactic ?? "hold_the_pit",
    fightIds,
    intentTarget: opts.intentTarget ?? {},
    comboStyle: opts.comboStyle,
    seenAt,
    ignorePerception: ignore,
    memory: opts.memory,
    peeling: opts.peeling === true,
    currentTarget: opts.currentTarget ?? null,
    p1Only: opts.p1Only === true,
    ex: effExecution(u.attrs, u.mastery, opts.c),
    perceived,
    allies,
    T,
    F: F && F.team !== u.team ? F : null,
  };
}

function evaluateFull(state: MatchState, u: UnitState, opts: CastPolicyOpts): CastProposal | null {
  if (!castGatesClear(u, opts.c)) return null;
  if (!CAST_POLICIES[u.champ]) return null;
  const ctx = buildCtx(state, u, opts);
  const blockWind = windupBlocks(u);
  for (const tier of TIERS) {
    if (opts.p1Only && !tier.startsWith("P1")) continue;
    if (blockWind && !tier.startsWith("P1")) continue;
    for (const skill of skillOrder(u.champ, tier)) {
      const got = trySkill(ctx, tier, skill);
      if (got) return got;
    }
  }
  return null;
}

/**
 * Universal brain gates before any policy or legacy cast proposal.
 * Windup here means an in-progress skill cast (`cast_left`), not auto windup
 * (skill start cancels auto windup — §6.9). Own sanctuary stays blocked:
 * the S6 gate test pins it, and a unit on its pad is not casting.
 */
export function castGatesClear(u: UnitState, c: Constants): boolean {
  if (!u.alive) return false;
  if (u.cast_left > 1e-12) return false;
  if (isBanished(u.status) || isLocked(u.status) || isTimeStopped(u.status)) return false;
  if (inOwnSanctuary(u.team, u.x, u.y, c)) return false;
  return true;
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function resolveTarget(
  state: MatchState,
  u: UnitState,
  kind: CastTargetKind,
  opts: CastPolicyOpts,
): UnitId | null {
  if (kind === "none") return null;
  if (kind === "self") return u.id;
  if (kind === "peel_diver") {
    const id = opts.peelDiverId ?? null;
    if (!id) return null;
    const diver = state.units.find((x) => x.id === id);
    if (!diver || !diver.alive || isBanished(diver.status)) return null;
    return diver.id;
  }
  if (kind === "focus_enemy") {
    if (!opts.focusId) return null;
    const f = state.units.find((x) => x.id === opts.focusId);
    if (!f || !f.alive || f.team === u.team || isBanished(f.status)) return null;
    if (inOwnSanctuary(f.team, f.x, f.y, opts.c)) return null;
    return f.id;
  }
  if (kind === "lowest_hp_ally") {
    let best: UnitState | null = null;
    for (const a of state.units) {
      if (!a.alive || a.team !== u.team || isBanished(a.status)) continue;
      if (!best || a.hp / Math.max(1, a.max_hp) < best.hp / Math.max(1, best.max_hp)) best = a;
    }
    return best?.id ?? null;
  }
  let best: UnitState | null = null;
  let bestD = Infinity;
  for (const e of state.units) {
    if (!e.alive || e.team === u.team || isBanished(e.status)) continue;
    if (inOwnSanctuary(e.team, e.x, e.y, opts.c)) continue;
    const dd = dist(u.x, u.y, e.x, e.y);
    if (dd < bestD) {
      bestD = dd;
      best = e;
    }
  }
  return best?.id ?? null;
}

function simpleReady(u: UnitState, skill: SkillKey): boolean {
  const kit = KITS[u.champ];
  if (!kit?.[skill]) return false;
  if (skill === "R" && u.level < 5) return false;
  const cd = skill === "Q" ? u.cd_q : skill === "W" ? u.cd_w : u.cd_r;
  return cd <= 1e-9;
}

function simpleInRange(state: MatchState, u: UnitState, skill: SkillKey, targetId: UnitId | null): boolean {
  const ab = KITS[u.champ]?.[skill];
  if (!ab) return false;
  if (targetId === null || targetId === u.id) return true;
  const t = state.units.find((x) => x.id === targetId);
  if (!t) return false;
  return dist(u.x, u.y, t.x, t.y) <= ab.range + 1e-9;
}

/** Test-table path: first enabled Q→W→R entry. Production does not use this. */
function evaluateSimple(state: MatchState, u: UnitState, opts: CastPolicyOpts): CastProposal | null {
  if (!castGatesClear(u, opts.c)) return null;
  const kitPolicy = opts.table?.[u.champ];
  if (!kitPolicy) return null;
  const ex = effExecution(u.attrs, u.mastery, opts.c);
  for (const skill of ["Q", "W", "R"] as const) {
    const entry = kitPolicy[skill];
    if (!entry || !entry.enabled) continue;
    if (!simpleReady(u, skill)) continue;
    if (entry.decision_min !== undefined && u.attrs.decision < entry.decision_min) continue;
    if (entry.execution_setup_min !== undefined && ex < entry.execution_setup_min) continue;
    const targetId = resolveTarget(state, u, entry.target, opts);
    if (entry.target !== "none" && entry.target !== "self" && targetId === null) continue;
    if (entry.requires_mark && targetId) {
      const tgt = state.units.find((x) => x.id === targetId);
      if (!tgt || !hasMark(tgt.marks, entry.requires_mark, state.t)) continue;
    }
    if (!simpleInRange(state, u, skill, targetId)) continue;
    return { skill, target_id: targetId };
  }
  return null;
}

/**
 * §9.4.1 decision. At most one cast. `opts.table` forces the stub evaluator.
 */
export function evaluateCastPolicy(state: MatchState, u: UnitState, opts: CastPolicyOpts): CastProposal | null {
  if (opts.table) return evaluateSimple(state, u, opts);
  return evaluateFull(state, u, opts);
}
