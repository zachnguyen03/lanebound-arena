/**
 * Build-spec §15 defaults. Do not change a default without reporting in lab REPORT.md.
 * SEPARATION_STRENGTH is GD-accepted (Appendix R #2). SCRIPTED_ARRIVE_R is lab-only
 * (not in this table / constants_hash).
 */

/** Lab-only scripted-motor arrive radius — not a gameplay constant. */
export const LAB_SCRIPTED_ARRIVE_R = 0.15;

export const XP_TO_LEVEL: Record<number, number> = {
  1: 0,
  2: 140,
  3: 320,
  4: 540,
  5: 820,
  6: 1160,
  7: 1560,
  8: 2040,
  9: 2600,
  10: 3240,
};

/** Layout B pillars as inclusive tile ranges [x0,x1,y0,y1]. */
export const PILLARS_DEFAULT = [
  { name: "NW", x0: 5, x1: 6, y0: 2, y1: 3 },
  { name: "NE", x0: 17, x1: 18, y0: 2, y1: 3 },
  { name: "SW", x0: 5, x1: 6, y0: 12, y1: 13 },
  { name: "SE", x0: 17, x1: 18, y0: 12, y1: 13 },
] as const;

export interface Constants {
  DT: number;
  MAP_W: number;
  MAP_H: number;
  BODY_RADIUS: number;
  BLUE_SPAWN: [number, number];
  RED_SPAWN: [number, number];
  SANCTUARY_BLUE_X: number[];
  SANCTUARY_RED_X: number[];
  PILLARS: typeof PILLARS_DEFAULT;
  ZONE_CENTER: [number, number];
  ZONE_RADIUS: number;
  ZONE_CAPTURE_S: number;
  ZONE_TICK_S: number;
  ZONE_AURA_RES: number;
  ZONE_AURA_HPS: number;
  CLAIM_DELAY_S: number;
  CLAIM_DENY_DWELL_S: number;
  FIGHT_RADIUS: number;
  TWO_V2_RADIUS: number;
  TWO_V2_SWING: number;
  FIGHT_END_GRACE_S: number;
  TIME_XP_PER_S: number;
  ORB_XP: number;
  KILL_XP: number;
  ASSIST_XP: number;
  CATCHUP_GAP: number;
  CATCHUP_BONUS: number;
  ORB_FIRST_SPAWN_S: number;
  ORB_RESPAWN_S: number;
  ORB_PICKUP_R: number;
  BUFF_FIRST_SPAWN_S: number;
  BUFF_RESPAWN_S: number;
  BUFF_DURATION_S: number;
  BUFF_DMG: number;
  BUFF_MS: number;
  BUFF_PADS: [number, number][];
  SCORE_TO_WIN: number;
  MATCH_T: number;
  SUDDEN_DEATH_T: number;
  BO1_EXTRA_S: number;
  RESPAWN_BASE: number;
  RESPAWN_PER_LEVEL: number;
  SPAWN_SHIELD_S: number;
  SKILL_SCALE_PER_LV: number;
  CRIT_MULT: number;
  CRIT_CAP: number;
  COMBAT_HEAL_SCALE: number;
  COMBAT_HEAL_WINDOW_S: number;
  SHIELD_CAP_FRAC: number;
  DR_WINDOW_S: number;
  DR_FACTOR: number;
  DR_FLOOR: number;
  LOCK_BUDGET_S: number;
  LOCK_TAPER: number;
  PETRIFY_DR: number;
  MISSILE_SPEED: number;
  /** Windup duration = AUTO_WINDUP / AS seconds (§6.8 / §15). */
  AUTO_WINDUP: number;
  ASSIST_WINDOW_S: number;
  CHASE_LEASH: number;
  CHASE_TTK_STOP: number;
  PEEL_DIVE_R: number;
  PEEL_REACH_S: number;
  PEEL_MIN_RATE: number;
  L1_PERIOD_S: number;
  PLANNER_PERIOD_S: number;
  CARD_BUDGET: number;
  CARD_PICKS: number;
  CARD_DUR_CAP_S: number;
  CARD_LEAD_DUR_S: number;
  CARD_STACK_MAX: number;
  CARD_STACK_2ND: number;
  CARD_DEBUFF_MAX: number;
  CARD_SWING_CAP: number;
  CARD_RESPAWN_ADD: number;
  CARD_RESPAWN_WIN_S: number;
  XP_TO_LEVEL: Record<number, number>;
  MASTERY_COEF: number;
  MASTERY_MOD_CAP: number;
  HIT_BASE: number;
  HIT_COEF: number;
  HIT_FLOOR: number;
  HIT_CEIL: number;
  DENY_ANY_UNIT: boolean;
  LAB_GAMES: number;
  LAB_SEED: number;
  /** Soft ally separation radius (tiles). */
  SEPARATION_RADIUS: number;
  /** Soft ally separation push at dist=0 (tiles/s). GD-accepted Appendix R #2. */
  SEPARATION_STRENGTH: number;
  /** Invention INV-SPAWN-JITTER: ±y when two units would overlap on pad. */
  SPAWN_JITTER_Y: number;
}

export const DEFAULT_CONSTANTS: Constants = {
  DT: 0.1,
  MAP_W: 24,
  MAP_H: 16,
  BODY_RADIUS: 0.4,
  BLUE_SPAWN: [1.0, 7.0],
  RED_SPAWN: [22.0, 7.0],
  SANCTUARY_BLUE_X: [0, 1],
  SANCTUARY_RED_X: [22, 23],
  PILLARS: PILLARS_DEFAULT,
  ZONE_CENTER: [12.0, 8.0],
  ZONE_RADIUS: 3.0,
  ZONE_CAPTURE_S: 3.0,
  ZONE_TICK_S: 12.0,
  ZONE_AURA_RES: 10,
  ZONE_AURA_HPS: 15,
  CLAIM_DELAY_S: 8.0,
  CLAIM_DENY_DWELL_S: 0.0,
  FIGHT_RADIUS: 8.0,
  TWO_V2_RADIUS: 6.0,
  TWO_V2_SWING: 0.2,
  FIGHT_END_GRACE_S: 1.0,
  TIME_XP_PER_S: 11.5,
  ORB_XP: 120,
  KILL_XP: 45,
  ASSIST_XP: 20,
  CATCHUP_GAP: 2,
  CATCHUP_BONUS: 0.15,
  ORB_FIRST_SPAWN_S: 8.0,
  ORB_RESPAWN_S: 18.0,
  ORB_PICKUP_R: 0.9,
  BUFF_FIRST_SPAWN_S: 90.0,
  BUFF_RESPAWN_S: 90.0,
  BUFF_DURATION_S: 45.0,
  BUFF_DMG: 0.12,
  BUFF_MS: 0.1,
  BUFF_PADS: [
    [7, 7],
    [16, 7],
  ],
  SCORE_TO_WIN: 10,
  MATCH_T: 240.0,
  SUDDEN_DEATH_T: 270.0,
  BO1_EXTRA_S: 15.0,
  RESPAWN_BASE: 6.0,
  RESPAWN_PER_LEVEL: 1.5,
  SPAWN_SHIELD_S: 1.5,
  SKILL_SCALE_PER_LV: 0.05,
  CRIT_MULT: 1.75,
  CRIT_CAP: 0.8,
  COMBAT_HEAL_SCALE: 0.75,
  COMBAT_HEAL_WINDOW_S: 3.0,
  SHIELD_CAP_FRAC: 0.25,
  DR_WINDOW_S: 5.0,
  DR_FACTOR: 0.7,
  DR_FLOOR: 0.35,
  LOCK_BUDGET_S: 7.5,
  LOCK_TAPER: 0.35,
  PETRIFY_DR: 0.25,
  MISSILE_SPEED: 18.0,
  AUTO_WINDUP: 0.25,
  ASSIST_WINDOW_S: 6.0,
  CHASE_LEASH: 10.0,
  CHASE_TTK_STOP: 2.0,
  PEEL_DIVE_R: 3.0,
  PEEL_REACH_S: 1.5,
  PEEL_MIN_RATE: 0.7,
  L1_PERIOD_S: 0.5,
  PLANNER_PERIOD_S: 1.0,
  CARD_BUDGET: 6,
  CARD_PICKS: 3,
  CARD_DUR_CAP_S: 60,
  CARD_LEAD_DUR_S: 45,
  CARD_STACK_MAX: 2,
  CARD_STACK_2ND: 0.75,
  CARD_DEBUFF_MAX: 1,
  CARD_SWING_CAP: 0.2,
  CARD_RESPAWN_ADD: 4.0,
  CARD_RESPAWN_WIN_S: 45,
  XP_TO_LEVEL: { ...XP_TO_LEVEL },
  MASTERY_COEF: 0.15,
  MASTERY_MOD_CAP: 8,
  HIT_BASE: 0.55,
  HIT_COEF: 0.01,
  HIT_FLOOR: 0.25,
  HIT_CEIL: 0.9,
  DENY_ANY_UNIT: true,
  LAB_GAMES: 2000,
  LAB_SEED: 20261122,
  SEPARATION_RADIUS: 0.6,
  SEPARATION_STRENGTH: 2.0,
  SPAWN_JITTER_Y: 0.3,
};

export function mergeConstants(overrides?: Partial<Record<string, unknown>>): Constants {
  if (!overrides) return { ...DEFAULT_CONSTANTS, XP_TO_LEVEL: { ...XP_TO_LEVEL }, PILLARS: PILLARS_DEFAULT, BUFF_PADS: [...DEFAULT_CONSTANTS.BUFF_PADS], SANCTUARY_BLUE_X: [...DEFAULT_CONSTANTS.SANCTUARY_BLUE_X], SANCTUARY_RED_X: [...DEFAULT_CONSTANTS.SANCTUARY_RED_X] };
  const c: Constants = {
    ...DEFAULT_CONSTANTS,
    XP_TO_LEVEL: { ...XP_TO_LEVEL },
    PILLARS: PILLARS_DEFAULT,
    BUFF_PADS: [...DEFAULT_CONSTANTS.BUFF_PADS],
    SANCTUARY_BLUE_X: [...DEFAULT_CONSTANTS.SANCTUARY_BLUE_X],
    SANCTUARY_RED_X: [...DEFAULT_CONSTANTS.SANCTUARY_RED_X],
  };
  // Sort keys so override application order is explicit (values are independent;
  // order cannot affect results today, but we never rely on Object.keys order).
  const keys = Object.keys(overrides).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const key of keys) {
    const k = key as keyof Constants;
    if (k in c && overrides[key] !== undefined) {
      (c as unknown as Record<string, unknown>)[key] = overrides[key];
    }
  }
  return c;
}
