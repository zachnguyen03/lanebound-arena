/**
 * exp/objectives (not build spec): alternative objective layouts, off unless
 * MatchConfig.objectives is set. See Objectives in types.ts.
 */
import type { Constants } from "./constants.js";
import { isBanished } from "./status.js";
import type { MatchState, Team, UnitState } from "./types.js";

export interface ObjPoint {
  id: "north" | "centre" | "south";
  x: number;
  y: number;
  r: number;
  owner: Team | null;
  bar_blue: number;
  bar_red: number;
  /** pulse shrines: already paid out this window. */
  paid: boolean;
}

/** objective_state cadence in ticks (0.5 s at 10 Hz). */
export const OBJ_STATE_EVERY = 5;

export const PULSE_CYCLE_S = 50;
export const PULSE_OPEN_S = 30;

export function pitOpen(t: number): boolean {
  return t % PULSE_CYCLE_S < PULSE_OPEN_S - 1e-9;
}

/** Seconds until the pit next opens (0 while open). */
export function pitOpensIn(t: number): number {
  return pitOpen(t) ? 0 : PULSE_CYCLE_S - (t % PULSE_CYCLE_S);
}

export function createPoints(mode: "points" | "pulse"): ObjPoint[] {
  const mk = (id: ObjPoint["id"], y: number, r: number): ObjPoint => ({
    id, x: 12, y, r, owner: null, bar_blue: 0, bar_red: 0, paid: false,
  });
  const sides = [mk("north", 2.2, 1.6), mk("south", 13.8, 1.6)];
  return mode === "points" ? [sides[0]!, mk("centre", 8, 2), sides[1]!] : sides;
}

export function pointLive(p: ObjPoint, mode: "points" | "pulse", t: number): boolean {
  return mode === "points" || (!pitOpen(t) && !p.paid);
}

function presence(units: UnitState[], p: ObjPoint, team: Team): number {
  return units.filter(
    (u) => u.alive && u.team === team && !isBanished(u.status) && Math.hypot(u.x - p.x, u.y - p.y) <= p.r + 1e-9,
  ).length;
}

type Emit = (type: string, payload: Record<string, unknown>) => void;

/** One tick of point capture + scoring. Returns whether a score fired. */
export function tickObjectives(
  state: MatchState,
  points: ObjPoint[],
  majority: { timer: number },
  mode: "points" | "pulse",
  c: Constants,
  emit: Emit,
): boolean {
  if (state.tick === 1) {
    emit("objectives_init", { mode, score_to_win: c.SCORE_TO_WIN, majority_tick_s: c.MAJORITY_TICK_S, points: points.map(({ id, x, y, r }) => ({ id, x, y, r })) });
  }
  const need = Math.round(c.ZONE_CAPTURE_S / c.DT);
  let scored = false;
  const score = (team: Team, extra: Record<string, unknown>) => {
    if (team === "blue") state.score_blue += 1;
    else state.score_red += 1;
    scored = true;
    emit("zone_tick", { team, score_after: team === "blue" ? state.score_blue : state.score_red, ...extra });
  };
  // Pulse: shrines reset when the pit opens.
  if (mode === "pulse" && pitOpen(state.t)) {
    for (const p of points) Object.assign(p, { owner: null, bar_blue: 0, bar_red: 0, paid: false });
    return false;
  }
  const capRate = (t: Team) => state.cards?.team[t].cap ?? 1;
  for (const p of points) {
    if (!pointLive(p, mode, state.t)) continue;
    const b = presence(state.units, p, "blue");
    const r = presence(state.units, p, "red");
    if (b > 0 && r === 0) {
      if (p.owner !== "blue") p.bar_blue += capRate("blue");
      p.bar_red = Math.max(0, p.bar_red - 1);
    } else if (r > 0 && b === 0) {
      if (p.owner !== "red") p.bar_red += capRate("red");
      p.bar_blue = Math.max(0, p.bar_blue - 1);
    } else if (b === 0 && r === 0) {
      p.bar_blue = Math.max(0, p.bar_blue - 1);
      p.bar_red = Math.max(0, p.bar_red - 1);
    }
    const cap: Team | null = p.bar_blue >= need ? "blue" : p.bar_red >= need ? "red" : null;
    if (!cap) continue;
    p.owner = cap;
    p.bar_blue = 0;
    p.bar_red = 0;
    emit("point_capture", { point: p.id, team: cap });
    if (mode === "pulse") {
      p.paid = true;
      score(cap, { point: p.id });
    }
  }
  if (mode === "points") {
    const own = (t: Team) => points.filter((p) => p.owner === t).length;
    const holder: Team | null = own("blue") >= 2 ? "blue" : own("red") >= 2 ? "red" : null;
    if (!holder) majority.timer = 0;
    else if (++majority.timer >= Math.round(c.MAJORITY_TICK_S / c.DT)) {
      majority.timer = 0;
      score(holder, { point: "majority" });
    }
    // Spectator HUD feed: capture progress, contest and majority countdown.
    if (state.tick % OBJ_STATE_EVERY === 0) {
      const ticks = Math.round(c.MAJORITY_TICK_S / c.DT);
      emit("objective_state", {
        points: points.map((p) => {
          const b = presence(state.units, p, "blue");
          const r = presence(state.units, p, "red");
          const lead = p.bar_blue >= p.bar_red ? "blue" : "red";
          const bar = Math.max(p.bar_blue, p.bar_red);
          return {
            id: p.id,
            owner: p.owner,
            by: bar > 0 ? lead : null,
            progress: Math.round((bar / need) * 100) / 100,
            contested: b > 0 && r > 0,
          };
        }),
        majority: holder ? { team: holder, left_s: Math.round((ticks - majority.timer) * c.DT * 10) / 10 } : null,
      });
    }
  }
  return scored;
}
