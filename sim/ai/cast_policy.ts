/**
 * Data-driven §9.4 cast policy — table shape + evaluator.
 *
 * Per-kit firing choices land in §9.4.1 (Game Designer). Until then
 * CAST_POLICIES stays empty: evaluateCastPolicy returns null and
 * chooseExecutionCast keeps the Kerrig / Huntress mark-gated R path.
 *
 * Do not invent per-kit numbers here.
 */
import { KITS } from "../../data/champions/kits.js";
import type { Constants } from "../constants.js";
import { inOwnSanctuary } from "../map.js";
import { hasMark, type MarkInstance } from "../marks.js";
import { isBanished, isLocked, isTimeStopped } from "../status.js";
import type { MatchState, UnitId, UnitState } from "../types.js";
import { effExecution } from "./attributes.js";
import type { CommitKind } from "./fight.js";

export type SkillKey = "Q" | "W" | "R";

/**
 * Who the cast aims at. §9.4.1 fills these per skill; the evaluator resolves
 * them against live units. Unknown / unmet → skip that skill.
 */
export type CastTargetKind =
  | "focus_enemy"
  | "nearest_enemy"
  | "self"
  | "lowest_hp_ally"
  | "peel_diver"
  | "none";

/**
 * One skill's cast policy. All fields except `enabled` + `target` are optional
 * gates for §9.4.1. Empty / missing kit entries mean "no policy cast".
 */
export interface SkillCastPolicy {
  /** When false or omitted, the evaluator never proposes this skill. */
  enabled: boolean;
  target: CastTargetKind;
  /** Prefer firing when the chosen target already has Lock/Bind (CC chain). */
  prefer_cc_chain?: boolean;
  /** Require a living mark kind on the target (kit mark id). */
  requires_mark?: MarkInstance["kind"];
  /**
   * Minimum eff_Execution to honour authored setup order (spec §8.4 default 45).
   * Below this, the evaluator still may fire if the entry is enabled — §9.4.1
   * decides whether low-Exec waste is allowed per skill.
   */
  execution_setup_min?: number;
  /** Optional Decision floor before this skill is legal for the brain. */
  decision_min?: number;
  /**
   * When true, beginCast uses the Aim vs Reflexes skillshot model (already in
   * the cast interpreter). Flag is informational for §9.4.1 / lab filters.
   */
  skillshot?: boolean;
}

export type KitCastPolicy = Partial<Record<SkillKey, SkillCastPolicy>>;

/**
 * Per-champion policies. Stubbed empty until §9.4.1 lands.
 * Kerrig / Huntress R remain in chooseExecutionCast until superseded.
 */
export const CAST_POLICIES: Readonly<Record<string, KitCastPolicy>> = Object.freeze({});

export type CastProposal = { skill: SkillKey; target_id: UnitId | null };

export interface CastPolicyOpts {
  c: Constants;
  focusId: UnitId | null;
  peelDiverId?: UnitId | null;
  commit?: CommitKind;
  /** Override table for unit tests — production callers omit this. */
  table?: Readonly<Record<string, KitCastPolicy>>;
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Universal brain gates before any policy or legacy cast proposal.
 * Windup here means an in-progress skill cast (`cast_left`), not auto windup
 * (skill start cancels auto windup — §6.9).
 */
export function castGatesClear(u: UnitState, c: Constants): boolean {
  if (!u.alive) return false;
  if (u.cast_left > 1e-12) return false;
  if (isBanished(u.status) || isLocked(u.status) || isTimeStopped(u.status)) return false;
  if (inOwnSanctuary(u.team, u.x, u.y, c)) return false;
  return true;
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
    const d = state.units.find((x) => x.id === id);
    if (!d || !d.alive || isBanished(d.status)) return null;
    return d.id;
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
      if (!best || a.hp / Math.max(1, a.max_hp) < best.hp / Math.max(1, best.max_hp)) {
        best = a;
      }
    }
    return best?.id ?? null;
  }

  // nearest_enemy
  let best: UnitState | null = null;
  let bestD = Infinity;
  for (const e of state.units) {
    if (!e.alive || e.team === u.team || isBanished(e.status)) continue;
    if (inOwnSanctuary(e.team, e.x, e.y, opts.c)) continue;
    const d = dist(u.x, u.y, e.x, e.y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best?.id ?? null;
}

function skillReady(u: UnitState, skill: SkillKey): boolean {
  const kit = KITS[u.champ];
  if (!kit) return false;
  const ab = kit[skill];
  if (!ab) return false;
  if (skill === "R" && u.level < 5) return false;
  const cd = skill === "Q" ? u.cd_q : skill === "W" ? u.cd_w : u.cd_r;
  return cd <= 1e-9;
}

function targetInRange(
  state: MatchState,
  u: UnitState,
  skill: SkillKey,
  targetId: UnitId | null,
): boolean {
  const kit = KITS[u.champ];
  if (!kit) return false;
  const ab = kit[skill];
  if (!ab) return false;
  // Self / no-target shapes: range check N/A.
  if (targetId === null || targetId === u.id) return true;
  const t = state.units.find((x) => x.id === targetId);
  if (!t) return false;
  return dist(u.x, u.y, t.x, t.y) <= ab.range + 1e-9;
}

/**
 * Evaluate the data-driven table for this unit. Returns the first ready skill
 * in Q → W → R order whose entry is enabled and whose gates pass.
 * Empty / stubbed table → null (callers fall through to legacy Kerrig/Huntress).
 */
export function evaluateCastPolicy(
  state: MatchState,
  u: UnitState,
  opts: CastPolicyOpts,
): CastProposal | null {
  if (!castGatesClear(u, opts.c)) return null;

  const table = opts.table ?? CAST_POLICIES;
  const kitPolicy = table[u.champ];
  if (!kitPolicy) return null;

  const ex = effExecution(u.attrs, u.mastery, opts.c);
  const order: SkillKey[] = ["Q", "W", "R"];

  for (const skill of order) {
    const entry = kitPolicy[skill];
    if (!entry || !entry.enabled) continue;
    if (!skillReady(u, skill)) continue;
    if (entry.decision_min !== undefined && u.attrs.decision < entry.decision_min) continue;
    if (entry.execution_setup_min !== undefined && ex < entry.execution_setup_min) continue;

    const targetId = resolveTarget(state, u, entry.target, opts);
    if (entry.target !== "none" && entry.target !== "self" && targetId === null) continue;

    if (entry.requires_mark && targetId) {
      const tgt = state.units.find((x) => x.id === targetId);
      if (!tgt || !hasMark(tgt.marks, entry.requires_mark, state.t)) continue;
    }

    if (entry.prefer_cc_chain && targetId) {
      const tgt = state.units.find((x) => x.id === targetId);
      // Soft preference: still allow the cast; §9.4.1 may tighten. No skip.
      void tgt;
    }

    if (!targetInRange(state, u, skill, targetId)) continue;

    return { skill, target_id: targetId };
  }
  return null;
}
