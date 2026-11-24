/**
 * Build-spec §15 constant catalogue for the tuning panel.
 * Defaults for keys that live in sim/constants.ts come from DEFAULT_CONSTANTS.
 * Keys that are fixed, retired, or hardcoded outside the Constants table are
 * listed here so the panel can show every §15 row without editing sim/.
 */
import {
  DEFAULT_CONSTANTS,
  type Constants,
} from "../../../sim/constants.js";

export type ConstantGroup =
  | "Combat"
  | "XP / levels"
  | "Zone / claim"
  | "Respawn / sanctuary"
  | "Orbs / buffs / score / clock"
  | "AI weights and thresholds"
  | "Attribute hooks (P)"
  | "Cards (unused in sandbox)"
  | "Lab"
  | "Retired / unused"
  | "GD extras";

export type ConstantEditability =
  | "editable"
  | "fixed"
  | "retired"
  | "sim-hardcoded"
  | "unused";

export interface ConstantMeta {
  key: string;
  group: ConstantGroup;
  default: unknown;
  /** Inclusive numeric range, or null when non-numeric / fixed structure. */
  min?: number;
  max?: number;
  editability: ConstantEditability;
  notes?: string;
  /** True when the key exists on Constants and mergeConstants will apply it. */
  inSimTable: boolean;
}

function num(
  key: keyof Constants,
  group: ConstantGroup,
  min: number,
  max: number,
  editability: ConstantEditability = "editable",
  notes?: string,
): ConstantMeta {
  return {
    key,
    group,
    default: DEFAULT_CONSTANTS[key],
    min,
    max,
    editability,
    notes,
    inSimTable: true,
  };
}

function fixed(
  key: keyof Constants,
  group: ConstantGroup,
  notes?: string,
): ConstantMeta {
  return {
    key,
    group,
    default: DEFAULT_CONSTANTS[key],
    editability: "fixed",
    notes,
    inSimTable: true,
  };
}

/** Full §15 + GD extras catalogue. Order is display order within groups. */
export const CONSTANT_META: ConstantMeta[] = [
  // Combat
  fixed("DT", "Combat", "10 Hz only in v1"),
  num("BODY_RADIUS", "Combat", 0.3, 0.5),
  fixed("SKILL_SCALE_PER_LV", "Combat"),
  fixed("CRIT_MULT", "Combat"),
  num("CRIT_CAP", "Combat", 0.6, 0.9),
  num("COMBAT_HEAL_SCALE", "Combat", 0.5, 1.0),
  num("COMBAT_HEAL_WINDOW_S", "Combat", 2, 5, "editable", "(P)"),
  num("SHIELD_CAP_FRAC", "Combat", 0.15, 0.4),
  fixed("DR_WINDOW_S", "Combat"),
  fixed("DR_FACTOR", "Combat"),
  fixed("DR_FLOOR", "Combat"),
  num("LOCK_BUDGET_S", "Combat", 5, 10),
  num("LOCK_TAPER", "Combat", 0.25, 0.5),
  num("PETRIFY_DR", "Combat", 0.15, 0.35),
  num("MISSILE_SPEED", "Combat", 12, 24, "editable", "(P)"),
  num("AUTO_WINDUP", "Combat", 0.15, 0.35, "editable", "(P) / AS"),
  num("ASSIST_WINDOW_S", "Combat", 3, 8, "editable", "(P)"),
  fixed("HIT_BASE", "Combat", "Locked Aim vs Reflexes intercept"),
  fixed("HIT_COEF", "Combat"),
  fixed("HIT_FLOOR", "Combat"),
  fixed("HIT_CEIL", "Combat"),

  // Map fixed
  fixed("MAP_W", "Respawn / sanctuary"),
  fixed("MAP_H", "Respawn / sanctuary"),
  fixed("BLUE_SPAWN", "Respawn / sanctuary"),
  fixed("RED_SPAWN", "Respawn / sanctuary"),
  fixed("SANCTUARY_BLUE_X", "Respawn / sanctuary"),
  fixed("SANCTUARY_RED_X", "Respawn / sanctuary"),
  fixed("PILLARS", "Respawn / sanctuary"),
  num("RESPAWN_BASE", "Respawn / sanctuary", 4, 8),
  num("RESPAWN_PER_LEVEL", "Respawn / sanctuary", 1.0, 2.0),
  num("SPAWN_SHIELD_S", "Respawn / sanctuary", 1.0, 2.5),

  // Zone / claim
  fixed("ZONE_CENTER", "Zone / claim"),
  num("ZONE_RADIUS", "Zone / claim", 2.5, 3.5),
  num("ZONE_CAPTURE_S", "Zone / claim", 2.0, 4.0),
  num("ZONE_TICK_S", "Zone / claim", 8.0, 16.0),
  num("ZONE_AURA_RES", "Zone / claim", 0, 20),
  num("ZONE_AURA_HPS", "Zone / claim", 0, 30),
  num("CLAIM_DELAY_S", "Zone / claim", 5.0, 12.0, "editable", "First triangle knob"),
  num("CLAIM_DENY_DWELL_S", "Zone / claim", 0.0, 2.0),
  fixed("DENY_ANY_UNIT", "Zone / claim", "v1.1 lock; do not restore a class tag"),

  // XP
  num("TIME_XP_PER_S", "XP / levels", 8.0, 14.0),
  num("ORB_XP", "XP / levels", 80, 160),
  num("KILL_XP", "XP / levels", 25, 80),
  num("ASSIST_XP", "XP / levels", 10, 40),
  num("CATCHUP_GAP", "XP / levels", 1, 3),
  num("CATCHUP_BONUS", "XP / levels", 0, 0.3),
  {
    key: "XP_TO_LEVEL",
    group: "XP / levels",
    default: DEFAULT_CONSTANTS.XP_TO_LEVEL,
    editability: "editable",
    notes: "(P) table — edit as JSON object",
    inSimTable: true,
  },
  num("MASTERY_COEF", "XP / levels", 0.1, 0.25, "editable", "(P)"),
  num("MASTERY_MOD_CAP", "XP / levels", 6, 12, "editable", "(P)"),

  // Orbs / buffs / score / clock
  num("ORB_FIRST_SPAWN_S", "Orbs / buffs / score / clock", 5, 15),
  num("ORB_RESPAWN_S", "Orbs / buffs / score / clock", 12, 30),
  num("ORB_PICKUP_R", "Orbs / buffs / score / clock", 0.6, 1.2),
  num("BUFF_FIRST_SPAWN_S", "Orbs / buffs / score / clock", 60, 120),
  num("BUFF_RESPAWN_S", "Orbs / buffs / score / clock", 60, 150),
  num("BUFF_DURATION_S", "Orbs / buffs / score / clock", 30, 60),
  num("BUFF_DMG", "Orbs / buffs / score / clock", 0.05, 0.2),
  num("BUFF_MS", "Orbs / buffs / score / clock", 0.05, 0.2),
  fixed("BUFF_PADS", "Orbs / buffs / score / clock"),
  num("SCORE_TO_WIN", "Orbs / buffs / score / clock", 8, 15),
  num("MATCH_T", "Orbs / buffs / score / clock", 180, 300),
  num("SUDDEN_DEATH_T", "Orbs / buffs / score / clock", 240, 330),
  num("BO1_EXTRA_S", "Orbs / buffs / score / clock", 10, 30),

  // AI
  num("FIGHT_RADIUS", "AI weights and thresholds", 6, 10),
  num("TWO_V2_RADIUS", "AI weights and thresholds", 5, 8),
  num("TWO_V2_SWING", "AI weights and thresholds", 0.1, 0.3),
  num("FIGHT_END_GRACE_S", "AI weights and thresholds", 0.5, 2.0),
  num("CHASE_LEASH", "AI weights and thresholds", 6, 14),
  num("CHASE_TTK_STOP", "AI weights and thresholds", 1.0, 3.0),
  num("PEEL_DIVE_R", "AI weights and thresholds", 2.0, 4.0),
  num("PEEL_REACH_S", "AI weights and thresholds", 1.0, 2.5),
  num("PEEL_MIN_RATE", "AI weights and thresholds", 0.5, 1.0, "editable", "test target"),
  num("L1_PERIOD_S", "AI weights and thresholds", 0.3, 1.0),
  num("PLANNER_PERIOD_S", "AI weights and thresholds", 0.5, 2.0),

  // Attribute hooks — formulas live in sim/ai/attributes.ts; not in Constants.
  {
    key: "REACTION_BASE",
    group: "Attribute hooks (P)",
    default: 0.7,
    min: 0.2,
    max: 0.9,
    editability: "sim-hardcoded",
    notes: "reactionDelayS: 0.7 - 0.008*(R-50); not in Constants table",
    inSimTable: false,
  },
  {
    key: "REACTION_COEF",
    group: "Attribute hooks (P)",
    default: 0.008,
    editability: "sim-hardcoded",
    notes: "Hardcoded in sim/ai/attributes.ts",
    inSimTable: false,
  },
  {
    key: "PERCEPTION_RADIUS_BASE",
    group: "Attribute hooks (P)",
    default: 7.0,
    editability: "sim-hardcoded",
    notes: "perceptionRadiusTiles; S2 locked (P)",
    inSimTable: false,
  },
  {
    key: "PERCEPTION_DELAY_BASE",
    group: "Attribute hooks (P)",
    default: 0.4,
    editability: "sim-hardcoded",
    notes: "perceptionDelayS; S2 locked (P)",
    inSimTable: false,
  },
  {
    key: "EXECUTION_COMBO_FOLLOW_BASE",
    group: "Attribute hooks (P)",
    default: 0.35,
    editability: "sim-hardcoded",
    notes: "comboFollowS",
    inSimTable: false,
  },
  {
    key: "POSITIONING_HOLD_FRAC",
    group: "Attribute hooks (P)",
    default: 0.75,
    editability: "sim-hardcoded",
    notes: "holdDist",
    inSimTable: false,
  },
  {
    key: "OVR_WEIGHTS",
    group: "Attribute hooks (P)",
    default: "see build spec §8.2",
    editability: "sim-hardcoded",
    notes: "(P) not in Constants table; OVR is display/cards only",
    inSimTable: false,
  },

  // Cards — present in Constants, unused in sandbox
  fixed("CARD_BUDGET", "Cards (unused in sandbox)"),
  fixed("CARD_PICKS", "Cards (unused in sandbox)"),
  num("CARD_DUR_CAP_S", "Cards (unused in sandbox)", 45, 60, "unused"),
  num("CARD_LEAD_DUR_S", "Cards (unused in sandbox)", 30, 60, "unused"),
  fixed("CARD_STACK_MAX", "Cards (unused in sandbox)"),
  fixed("CARD_STACK_2ND", "Cards (unused in sandbox)"),
  fixed("CARD_DEBUFF_MAX", "Cards (unused in sandbox)"),
  fixed("CARD_SWING_CAP", "Cards (unused in sandbox)"),
  num("CARD_RESPAWN_ADD", "Cards (unused in sandbox)", 2, 6, "unused"),
  num("CARD_RESPAWN_WIN_S", "Cards (unused in sandbox)", 30, 60, "unused"),

  // Lab
  num("LAB_GAMES", "Lab", 1000, 5000),
  num("LAB_SEED", "Lab", 0, 4294967295),

  // Retired
  {
    key: "CONTROL_COEF",
    group: "Retired / unused",
    default: null,
    editability: "retired",
    notes: "Do not implement. CC is not player-modified.",
    inSimTable: false,
  },

  // GD extras (in Constants, not original §15 prose table)
  num("SEPARATION_RADIUS", "GD extras", 0.3, 1.2, "editable", "Appendix R #2"),
  num("SEPARATION_STRENGTH", "GD extras", 0, 4, "editable", "Appendix R #2"),
  num("SPAWN_SLOT_SPACING", "GD extras", 0.8, 1.2, "editable", "L214"),
];

export const CONSTANT_META_BY_KEY: Record<string, ConstantMeta> = Object.fromEntries(
  CONSTANT_META.map((m) => [m.key, m]),
);

export function defaultConstantsSnapshot(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const m of CONSTANT_META) {
    if (!m.inSimTable) continue;
    const v = DEFAULT_CONSTANTS[m.key as keyof Constants];
    out[m.key] = structuredClone(v);
  }
  return out;
}

export class ConstantValidationError extends Error {
  constructor(
    public readonly key: string,
    message: string,
  ) {
    super(message);
    this.name = "ConstantValidationError";
  }
}

/**
 * Validate one override. Rejects illegal ranges, fixed/retired/hardcoded keys.
 * Returns the (possibly coerced) value on success.
 */
export function validateConstantOverride(
  key: string,
  value: unknown,
): unknown {
  const meta = CONSTANT_META_BY_KEY[key];
  if (!meta) {
    throw new ConstantValidationError(key, `Unknown constant "${key}"`);
  }
  if (meta.editability === "fixed") {
    throw new ConstantValidationError(
      key,
      `${key} is fixed and not user-editable`,
    );
  }
  if (meta.editability === "retired") {
    throw new ConstantValidationError(key, `${key} is retired — do not set`);
  }
  if (meta.editability === "sim-hardcoded") {
    throw new ConstantValidationError(
      key,
      `${key} is wired in sim formulas and not in the Constants table (editing sim/ is out of S5 scope)`,
    );
  }
  if (!meta.inSimTable) {
    throw new ConstantValidationError(key, `${key} cannot be applied via MatchConfig.constants`);
  }

  if (key === "XP_TO_LEVEL") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new ConstantValidationError(key, "XP_TO_LEVEL must be an object");
    }
    return value;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ConstantValidationError(key, `${key} must be a finite number`);
  }
  if (meta.min !== undefined && value < meta.min) {
    throw new ConstantValidationError(
      key,
      `${key}=${value} is below legal min ${meta.min} (band ${meta.min}–${meta.max})`,
    );
  }
  if (meta.max !== undefined && value > meta.max) {
    throw new ConstantValidationError(
      key,
      `${key}=${value} is above legal max ${meta.max} (band ${meta.min}–${meta.max})`,
    );
  }
  return value;
}

/** Validate a full overrides map; returns a cleaned map or throws. */
export function validateOverrides(
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const keys = Object.keys(overrides).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const key of keys) {
    if (overrides[key] === undefined) continue;
    out[key] = validateConstantOverride(key, overrides[key]);
  }
  return out;
}

/** Diff vs DEFAULT_CONSTANTS for keys present in the effective table. */
export function diffVsDefault(
  effective: Record<string, unknown>,
): Array<{ key: string; default: unknown; value: unknown }> {
  const diffs: Array<{ key: string; default: unknown; value: unknown }> = [];
  for (const m of CONSTANT_META) {
    if (!m.inSimTable) continue;
    if (!(m.key in effective)) continue;
    const def = DEFAULT_CONSTANTS[m.key as keyof Constants];
    const val = effective[m.key];
    if (JSON.stringify(def) !== JSON.stringify(val)) {
      diffs.push({ key: m.key, default: def, value: val });
    }
  }
  return diffs;
}

export function groupsInOrder(): ConstantGroup[] {
  return [
    "Combat",
    "XP / levels",
    "Zone / claim",
    "Respawn / sanctuary",
    "Orbs / buffs / score / clock",
    "AI weights and thresholds",
    "Attribute hooks (P)",
    "Cards (unused in sandbox)",
    "Lab",
    "GD extras",
    "Retired / unused",
  ];
}
