import type { MatchState } from "./types.js";

/** exp/teamfight-dynamics: R unlock level (build spec: 5). */
export function rMinLevel(state: MatchState | null | undefined): number {
  return state?.config?.teamfight?.r_min_level ?? 5;
}
