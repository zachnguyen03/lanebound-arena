import { sha256Hex } from "./sha256.js";
import type { Constants } from "./constants.js";
import type { SimEvent } from "./types.js";

/**
 * G10 canonical JSON recipe (frozen in lab/s0/REPORT.md → becomes spec):
 *
 * 1. UTF-8 text.
 * 2. Objects: keys sorted lexicographically (Array.sort with a < b ? -1 : a > b ? 1 : 0).
 * 3. No whitespace anywhere (JSON.stringify default separators).
 * 4. Numbers:
 *    - Integers (Number.isInteger): unadorned decimal (JSON number).
 *    - Physical floats (positions x/y/vx/vy, HP fields hp/max_hp/hp_after/raw/mitigated/
 *      shield_absorbed/applied/amount, and keys listed in PHYSICAL_FLOAT_KEYS):
 *      fixed to exactly 4 decimal places as a JSON number (parseFloat(n.toFixed(4))).
 *    - `t` (sim time): exactly 1 decimal place (parseFloat(n.toFixed(1))).
 *    - All other floats: shortest round-trip via JSON.stringify(number) (ECMA-262).
 * 5. Event log: one canonical object per line, in `seq` order, joined by "\n", with a
 *    trailing "\n". Events with type "move" or "pos" are omitted from the digest.
 * 6. constants_hash = SHA-256 hex (lowercase) of canonicalJSON(effectiveConstantsTable),
 *    where the table is a flat/nested name→value object of all Constants fields,
 *    keys sorted recursively.
 */

const PHYSICAL_FLOAT_KEYS = new Set([
  "x",
  "y",
  "vx",
  "vy",
  "hp",
  "max_hp",
  "hp_after",
  "raw",
  "mitigated",
  "shield_absorbed",
  "applied",
  "amount",
  "amp",
]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function encodeNumber(n: number, keyHint: string | null): string {
  if (!Number.isFinite(n)) {
    throw new Error(`non-finite number in canonical JSON: ${n}`);
  }
  if (keyHint === "t") {
    return JSON.stringify(parseFloat(n.toFixed(1)));
  }
  if (keyHint !== null && PHYSICAL_FLOAT_KEYS.has(keyHint)) {
    return JSON.stringify(parseFloat(n.toFixed(4)));
  }
  if (Number.isInteger(n)) {
    return JSON.stringify(n);
  }
  // Shortest round-trip
  return JSON.stringify(n);
}

function encodeValue(v: unknown, keyHint: string | null): string {
  if (v === null) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return encodeNumber(v, keyHint);
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) {
    return `[${v.map((item) => encodeValue(item, null)).join(",")}]`;
  }
  if (isPlainObject(v)) {
    const keys = Object.keys(v).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const parts: string[] = [];
    for (const k of keys) {
      parts.push(`${JSON.stringify(k)}:${encodeValue(v[k], k)}`);
    }
    return `{${parts.join(",")}}`;
  }
  throw new Error(`unsupported canonical value: ${typeof v}`);
}

/** Canonical JSON of any JSON-compatible value (sorted keys, no whitespace). */
export function canonicalJSON(value: unknown): string {
  return encodeValue(value, null);
}

export function constantsTable(c: Constants): Record<string, unknown> {
  // Explicit field list so iteration order for building is irrelevant; encode sorts keys.
  return {
    ASSIST_WINDOW_S: c.ASSIST_WINDOW_S,
    ASSIST_XP: c.ASSIST_XP,
    AUTO_WINDUP: c.AUTO_WINDUP,
    BLUE_SPAWN: c.BLUE_SPAWN,
    BODY_RADIUS: c.BODY_RADIUS,
    BO1_EXTRA_S: c.BO1_EXTRA_S,
    BUFF_DMG: c.BUFF_DMG,
    BUFF_DURATION_S: c.BUFF_DURATION_S,
    BUFF_FIRST_SPAWN_S: c.BUFF_FIRST_SPAWN_S,
    BUFF_MS: c.BUFF_MS,
    BUFF_PADS: c.BUFF_PADS,
    BUFF_RESPAWN_S: c.BUFF_RESPAWN_S,
    CARD_BUDGET: c.CARD_BUDGET,
    CARD_DEBUFF_MAX: c.CARD_DEBUFF_MAX,
    CARD_DUR_CAP_S: c.CARD_DUR_CAP_S,
    CARD_LEAD_DUR_S: c.CARD_LEAD_DUR_S,
    CARD_PICKS: c.CARD_PICKS,
    CARD_RESPAWN_ADD: c.CARD_RESPAWN_ADD,
    CARD_RESPAWN_WIN_S: c.CARD_RESPAWN_WIN_S,
    CARD_STACK_2ND: c.CARD_STACK_2ND,
    CARD_STACK_MAX: c.CARD_STACK_MAX,
    CARD_SWING_CAP: c.CARD_SWING_CAP,
    CATCHUP_BONUS: c.CATCHUP_BONUS,
    CATCHUP_GAP: c.CATCHUP_GAP,
    CHASE_LEASH: c.CHASE_LEASH,
    CHASE_TTK_STOP: c.CHASE_TTK_STOP,
    CLAIM_DELAY_S: c.CLAIM_DELAY_S,
    CLAIM_DENY_DWELL_S: c.CLAIM_DENY_DWELL_S,
    COMBAT_HEAL_SCALE: c.COMBAT_HEAL_SCALE,
    COMBAT_HEAL_WINDOW_S: c.COMBAT_HEAL_WINDOW_S,
    CRIT_CAP: c.CRIT_CAP,
    CRIT_MULT: c.CRIT_MULT,
    DENY_ANY_UNIT: c.DENY_ANY_UNIT,
    DR_FACTOR: c.DR_FACTOR,
    DR_FLOOR: c.DR_FLOOR,
    DR_WINDOW_S: c.DR_WINDOW_S,
    DT: c.DT,
    FIGHT_END_GRACE_S: c.FIGHT_END_GRACE_S,
    FIGHT_RADIUS: c.FIGHT_RADIUS,
    HIT_BASE: c.HIT_BASE,
    HIT_CEIL: c.HIT_CEIL,
    HIT_COEF: c.HIT_COEF,
    HIT_FLOOR: c.HIT_FLOOR,
    KILL_XP: c.KILL_XP,
    L1_PERIOD_S: c.L1_PERIOD_S,
    LAB_GAMES: c.LAB_GAMES,
    LAB_SEED: c.LAB_SEED,
    LOCK_BUDGET_S: c.LOCK_BUDGET_S,
    LOCK_TAPER: c.LOCK_TAPER,
    MAP_H: c.MAP_H,
    MAP_W: c.MAP_W,
    MASTERY_COEF: c.MASTERY_COEF,
    MASTERY_MOD_CAP: c.MASTERY_MOD_CAP,
    MATCH_T: c.MATCH_T,
    MISSILE_SPEED: c.MISSILE_SPEED,
    ORB_FIRST_SPAWN_S: c.ORB_FIRST_SPAWN_S,
    ORB_PICKUP_R: c.ORB_PICKUP_R,
    ORB_RESPAWN_S: c.ORB_RESPAWN_S,
    ORB_XP: c.ORB_XP,
    PEEL_DIVE_R: c.PEEL_DIVE_R,
    PEEL_MIN_RATE: c.PEEL_MIN_RATE,
    PEEL_REACH_S: c.PEEL_REACH_S,
    PETRIFY_DR: c.PETRIFY_DR,
    PILLARS: c.PILLARS.map((p) => ({ name: p.name, x0: p.x0, x1: p.x1, y0: p.y0, y1: p.y1 })),
    PLANNER_PERIOD_S: c.PLANNER_PERIOD_S,
    RED_SPAWN: c.RED_SPAWN,
    RESPAWN_BASE: c.RESPAWN_BASE,
    RESPAWN_PER_LEVEL: c.RESPAWN_PER_LEVEL,
    SANCTUARY_BLUE_X: c.SANCTUARY_BLUE_X,
    SANCTUARY_RED_X: c.SANCTUARY_RED_X,
    SCORE_TO_WIN: c.SCORE_TO_WIN,
    SEPARATION_RADIUS: c.SEPARATION_RADIUS,
    SEPARATION_STRENGTH: c.SEPARATION_STRENGTH,
    SHIELD_CAP_FRAC: c.SHIELD_CAP_FRAC,
    SKILL_SCALE_PER_LV: c.SKILL_SCALE_PER_LV,
    SPAWN_SHIELD_S: c.SPAWN_SHIELD_S,
    SPAWN_SLOT_SPACING: c.SPAWN_SLOT_SPACING,
    SUDDEN_DEATH_T: c.SUDDEN_DEATH_T,
    TIME_XP_PER_S: c.TIME_XP_PER_S,
    TWO_V2_RADIUS: c.TWO_V2_RADIUS,
    TWO_V2_SWING: c.TWO_V2_SWING,
    XP_TO_LEVEL: c.XP_TO_LEVEL,
    ZONE_AURA_HPS: c.ZONE_AURA_HPS,
    ZONE_AURA_RES: c.ZONE_AURA_RES,
    ZONE_CAPTURE_S: c.ZONE_CAPTURE_S,
    ZONE_CENTER: c.ZONE_CENTER,
    ZONE_RADIUS: c.ZONE_RADIUS,
    ZONE_TICK_S: c.ZONE_TICK_S,
  };
}

export function constantsHash(c: Constants): string {
  return sha256Hex(canonicalJSON(constantsTable(c)));
}

export function digestEvents(events: SimEvent[]): string {
  const lines: string[] = [];
  // Already in seq order from the sim; sort by seq with id tiebreak for safety.
  const sorted = events.slice().sort((a, b) => {
    if (a.seq !== b.seq) return a.seq - b.seq;
    if (a.type < b.type) return -1;
    if (a.type > b.type) return 1;
    return 0;
  });
  for (const ev of sorted) {
    if (ev.type === "move" || ev.type === "pos") continue;
    lines.push(canonicalJSON(ev));
  }
  return sha256Hex(lines.join("\n") + "\n");
}
