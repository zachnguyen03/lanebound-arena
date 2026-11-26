/**
 * exp/milestones (not build spec): in-game milestones, off unless MatchConfig.milestones is set.
 * Read once per tick after scoring (from the tick's new events and the point owners):
 * - kill streak: kills since the unit's last death; at `spree` the unit is on fire (+fire_dmg damage) -> `spree`.
 * - shutdown: killing an on-fire unit pays the killer's team `bounty` extra points -> `shutdown`.
 * - anchor: `anchor_s` straight on a point its team owns -> −anchor_taken damage taken while on it -> `anchor_start` / `anchor_end`.
 * - sweep: one team owns all 3 points for `sweep_s` straight -> +sweep_score once per sweep -> `sweep`.
 */
import { isBanished } from "./status.js";
import type { MatchState, SimEvent, Team, UnitId } from "./types.js";

export interface Milestones {
  spree: number;
  fire_dmg: number;
  bounty: number;
  anchor_s: number;
  anchor_taken: number;
  sweep_s: number;
  sweep_score: number;
}

export const MILESTONES: Milestones = { spree: 3, fire_dmg: 0.05, bounty: 1, anchor_s: 20, anchor_taken: 0.1, sweep_s: 10, sweep_score: 1 };

export interface MilestoneRuntime {
  k: Milestones;
  seen: number;
  streak: Record<string, number>;
  anchor: Record<string, { point: string; since: number; on: boolean }>;
  sweepSince: Record<Team, number | null>;
  swept: Record<Team, boolean>;
}

export function createMilestoneRuntime(state: MatchState): MilestoneRuntime {
  const cfg = state.config.milestones!;
  return { k: cfg === true ? MILESTONES : { ...MILESTONES, ...cfg }, seen: 0, streak: {}, anchor: {}, sweepSince: { blue: null, red: null }, swept: { blue: false, red: false } };
}

type Emit = (type: string, p: Record<string, unknown>) => void;

function addScore(state: MatchState, team: Team, v: number): number {
  if (team === "blue") return (state.score_blue += v);
  return (state.score_red += v);
}

/** One tick of milestones. Returns true when a milestone scored. */
export function tickMilestones(state: MatchState, rt: MilestoneRuntime, events: SimEvent[], emit: Emit): boolean {
  const k = rt.k;
  let scored = false;
  // takedown_score (killer alive) comes before the victim's death in the log, so the victim's streak is still intact.
  const fresh = events.slice(rt.seen);
  for (const e of fresh) {
    if (e.type === "takedown_score") {
      const killer = e.killer_id as UnitId, victim = e.victim_id as UnitId, team = e.team as Team;
      const vs = rt.streak[victim] ?? 0;
      if (vs >= k.spree && k.bounty) {
        scored = true;
        emit("shutdown", { team, killer_id: killer, victim_id: victim, streak: vs, score_after: addScore(state, team, k.bounty) });
      }
      const n = (rt.streak[killer] = (rt.streak[killer] ?? 0) + 1);
      if (n === k.spree || n === k.spree + 2) emit("spree", { unit_id: killer, n });
    } else if (e.type === "death") rt.streak[e.unit_id as string] = 0;
  }
  const pts = state.objectives ?? [];
  for (const u of state.units) {
    const p = u.alive && !isBanished(u.status) ? pts.find((q) => q.owner === u.team && Math.hypot(u.x - q.x, u.y - q.y) <= q.r + 1e-9) : undefined;
    const a = rt.anchor[u.id];
    if (a && a.point !== p?.id) {
      if (a.on) emit("anchor_end", { unit_id: u.id, point_id: a.point });
      delete rt.anchor[u.id];
    }
    if (p && !rt.anchor[u.id]) rt.anchor[u.id] = { point: p.id, since: state.t, on: false };
    const b = rt.anchor[u.id];
    if (b && !b.on && state.t - b.since >= k.anchor_s - 1e-9) {
      b.on = true;
      emit("anchor_start", { unit_id: u.id, point_id: b.point });
    }
    const fire = (rt.streak[u.id] ?? 0) >= k.spree;
    u.milestone = fire || b?.on ? { dmg: fire ? 1 + k.fire_dmg : 1, taken: b?.on ? 1 - k.anchor_taken : 1 } : undefined;
  }
  for (const team of ["blue", "red"] as Team[]) {
    const all = pts.length === 3 && pts.every((q) => q.owner === team);
    if (!all) { rt.sweepSince[team] = null; rt.swept[team] = false; continue; }
    rt.sweepSince[team] ??= state.t;
    if (!rt.swept[team] && state.t - rt.sweepSince[team]! >= k.sweep_s - 1e-9) {
      rt.swept[team] = true;
      if (k.sweep_score) scored = true;
      emit("sweep", { team, score_after: addScore(state, team, k.sweep_score) });
    }
  }
  rt.seen = events.length;
  return scored;
}
