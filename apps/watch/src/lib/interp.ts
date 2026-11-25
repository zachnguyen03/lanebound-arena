import type { MatchViewState, UnitView } from "./types";

/** Farther than this in one tick is a blink / respawn: snap, do not glide. */
const SNAP_TILES = 2;

/**
 * View-only blend of tick `a` toward tick `b` (= a + 1) by `frac` in [0, 1):
 * unit positions and HP glide; everything else is `a`'s. Never feeds the sim.
 */
export function blendStates(a: MatchViewState, b: MatchViewState | null, frac: number): MatchViewState {
  const t = a.t + frac * 0.1;
  if (!b || frac <= 0) return { ...a, t };
  const units = {} as Record<string, UnitView>;
  for (const [id, u] of Object.entries(a.units)) {
    const n = b.units[id as keyof typeof b.units];
    if (!n || !u.alive || !n.alive || Math.hypot(n.x - u.x, n.y - u.y) > SNAP_TILES) {
      units[id] = u;
      continue;
    }
    units[id] = {
      ...u,
      x: u.x + (n.x - u.x) * frac,
      y: u.y + (n.y - u.y) * frac,
      hp: u.hp + (n.hp - u.hp) * frac,
    };
  }
  return { ...a, t, units: units as MatchViewState["units"] };
}
