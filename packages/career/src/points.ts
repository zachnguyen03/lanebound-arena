/** §7.2 placement table. Proposal for qualification, and the only point row v1 writes. */
export const REGULAR_SEASON_POINTS = [12, 10, 8, 6, 4, 3, 2, 1] as const;

export const PLAYOFF_BONUS = { champion: 12, runner_up: 7, semi: 4 } as const;

/** The only function that turns a place and a playoff bonus into points. */
export function placementPoints(place: number, playoffBonus: number): number {
  if (!Number.isInteger(place) || place < 1 || place > 8) throw new Error(`place ${place}`);
  const base = REGULAR_SEASON_POINTS[place - 1];
  if (base === undefined) throw new Error(`place ${place}`);
  return base + playoffBonus;
}

export function seasonPointTotal(): number {
  const regular = REGULAR_SEASON_POINTS.reduce((sum, value) => sum + value, 0);
  return regular + PLAYOFF_BONUS.champion + PLAYOFF_BONUS.runner_up + PLAYOFF_BONUS.semi * 2;
}
