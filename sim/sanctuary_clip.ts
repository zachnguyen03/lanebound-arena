/**
 * Skill sanctuary clip (§5.1 / §6.8 / Isra R M1-09).
 * Enemy sanctuary tiles take no damage / CC / heals from enemies.
 * Land points and AoE circles truncate at the pad boundary.
 */
import type { Constants } from "./constants.js";
import { inEnemySanctuary, inOwnSanctuary } from "./map.js";
import type { Team } from "./types.js";

export interface ClipCircleResult {
  /** Adjusted land centre (clipped out of enemy sanctuary if needed). */
  land_x: number;
  land_y: number;
  clipped: boolean;
  reason: "projectile" | "aoe" | "dash" | "path" | null;
  /** True if a unit at (ux,uy) on the defending team is inside their own sanctuary. */
  unitInOwnSanctuary: (ux: number, uy: number, unitTeam: Team) => boolean;
}

/**
 * Clip a point-land skill aimed by `casterTeam` at (aimX, aimY).
 * If the aim point is inside the enemy sanctuary, snap to the threshold
 * and mark clipped; units standing in their own sanctuary take 0 from enemies.
 */
export function clipPointAoE(
  casterTeam: Team,
  aimX: number,
  aimY: number,
  c: Constants,
): ClipCircleResult {
  let land_x = aimX;
  let land_y = aimY;
  let clipped = false;
  let reason: ClipCircleResult["reason"] = null;

  if (inEnemySanctuary(casterTeam, aimX, aimY, c)) {
    // Snap land point to sanctuary threshold (just outside enemy pad).
    if (casterTeam === "blue") {
      // Red sanctuary x in {22,23}; threshold at x=22 from the west.
      land_x = Math.min(aimX, 21.9999);
    } else {
      // Blue sanctuary x in {0,1}; threshold at x=2 from the east.
      land_x = Math.max(aimX, 2.0);
    }
    clipped = true;
    reason = "aoe";
  }

  return {
    land_x,
    land_y,
    clipped,
    reason,
    unitInOwnSanctuary: (ux, uy, unitTeam) => inOwnSanctuary(unitTeam, ux, uy, c),
  };
}

/**
 * Isra R fixture: deals 0 to a unit standing in their own sanctuary when
 * the land circle would overlap the pad; logs sanctuary_clip.
 */
export function israRSanctuaryFixture(
  casterTeam: Team,
  aimX: number,
  aimY: number,
  targetX: number,
  targetY: number,
  targetTeam: Team,
  c: Constants,
): { damage: number; clipped: boolean; reason: string | null; in_sanctuary: boolean } {
  const clip = clipPointAoE(casterTeam, aimX, aimY, c);
  const inSanctuary = clip.unitInOwnSanctuary(targetX, targetY, targetTeam);
  // Enemy dealing into a unit's own sanctuary: 0 damage.
  const enemyHittingOwnPad = casterTeam !== targetTeam && inSanctuary;
  return {
    damage: enemyHittingOwnPad ? 0 : 1, // 1 = would deal; fixture cares about 0
    clipped: clip.clipped || enemyHittingOwnPad,
    reason: enemyHittingOwnPad || clip.clipped ? "aoe" : null,
    in_sanctuary: inSanctuary,
  };
}
