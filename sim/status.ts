/**
 * CC / DR / Lock budget (§6.5–6.6). CC duration is not player-modified (v1.1).
 */
import { clamp } from "./math.js";

export type CcCategory = "lock" | "bind" | "handicap";
export type CcKind =
  | "stun"
  | "knockup"
  | "sleep"
  | "hex"
  | "banish"
  | "fear"
  | "timestop"
  | "root"
  | "leash"
  | "silence"
  | "slow"
  | "disarm"
  | "break"
  | "mute"
  | "blind"
  | "taunt"
  | "petrify";

export interface StatusInstance {
  kind: CcKind;
  category: CcCategory;
  school: "physical" | "magic";
  remaining: number;
  raw_duration: number;
  applied_duration: number;
  source_id: string;
  /** Extra payload (slow value, petrify DR flag, leash anchor, etc.) */
  slow?: number;
  petrify?: boolean;
  hex_from?: string; // Mirren unit id for Kiln-Cured
}

export interface DrWindow {
  category: CcCategory;
  apply_times: number[]; // sim t of each apply
}

export interface StatusState {
  effects: StatusInstance[];
  dr: DrWindow[];
  /** Applied Lock durations in the last LOCK_BUDGET_S window: { t_apply, applied } */
  lock_applies: Array<{ t: number; applied: number }>;
  shield_pool: number;
  /** Remaining shield duration (s); ticks down, pauses under time-stop. */
  shield_remaining: number;
  spawn_shield_until: number;
  spellward_until: number;
  break_until: number;
  combat_until: number; // last damage dealt/received t + window tracked externally
  last_damage_t: number;
  last_dealt_t: number;
}

export function emptyStatus(spawnShieldUntil = 0): StatusState {
  return {
    effects: [],
    dr: [
      { category: "lock", apply_times: [] },
      { category: "bind", apply_times: [] },
      { category: "handicap", apply_times: [] },
    ],
    lock_applies: [],
    shield_pool: 0,
    shield_remaining: 0,
    spawn_shield_until: spawnShieldUntil,
    spellward_until: 0,
    break_until: 0,
    combat_until: 0,
    last_damage_t: -Infinity,
    last_dealt_t: -Infinity,
  };
}

export function kindCategory(kind: CcKind): CcCategory {
  switch (kind) {
    case "stun":
    case "knockup":
    case "sleep":
    case "hex":
    case "banish":
    case "fear":
    case "timestop":
    case "petrify":
      return "lock";
    case "root":
    case "leash":
      return "bind";
    default:
      return "handicap";
  }
}

/**
 * DR factor: n = prior applies of this category in last DR_WINDOW_S.
 * factor = max(DR_FLOOR, DR_FACTOR ** n)
 */
export function drFactor(
  st: StatusState,
  category: CcCategory,
  now: number,
  windowS: number,
  factor: number,
  floor: number,
): number {
  const w = st.dr.find((d) => d.category === category)!;
  const recent = w.apply_times.filter((t) => now - t <= windowS);
  const n = recent.length;
  let f = 1;
  for (let i = 0; i < n; i++) f *= factor;
  return Math.max(floor, f);
}

export function lockOwed(st: StatusState, now: number, budgetWindow: number): number {
  let sum = 0;
  for (const a of st.lock_applies) {
    if (now - a.t <= budgetWindow) sum += a.applied;
  }
  return sum;
}

export interface ApplyCcResult {
  applied_duration: number;
  dr_factor: number;
  lock_taper: boolean;
  rejected: boolean;
  reason?: string;
}

export function applyCc(
  st: StatusState,
  opts: {
    kind: CcKind;
    raw_duration: number;
    school: "physical" | "magic";
    source_id: string;
    now: number;
    dr_window: number;
    dr_factor: number;
    dr_floor: number;
    lock_budget: number;
    lock_taper: number;
    slow?: number;
    petrify?: boolean;
    hex_from?: string;
  },
): ApplyCcResult {
  const category = kindCategory(opts.kind);

  // Spellward: immune to magic CC
  if (opts.now < st.spellward_until && opts.school === "magic") {
    return { applied_duration: 0, dr_factor: 1, lock_taper: false, rejected: true, reason: "spellward" };
  }

  const dr = drFactor(st, category, opts.now, opts.dr_window, opts.dr_factor, opts.dr_floor);
  let applied = opts.raw_duration * dr;
  let tapered = false;

  if (category === "lock") {
    const owed = lockOwed(st, opts.now, opts.lock_budget);
    if (owed >= opts.lock_budget) {
      applied *= opts.lock_taper;
      tapered = true;
    }
  }

  // Same kind: remaining = max(remaining, new)
  const existing = st.effects.find((e) => e.kind === opts.kind);
  if (existing) {
    existing.remaining = Math.max(existing.remaining, applied);
    existing.applied_duration = Math.max(existing.applied_duration, applied);
  } else {
    st.effects.push({
      kind: opts.kind,
      category,
      school: opts.school,
      remaining: applied,
      raw_duration: opts.raw_duration,
      applied_duration: applied,
      source_id: opts.source_id,
      slow: opts.slow,
      petrify: opts.petrify ?? opts.kind === "petrify",
      hex_from: opts.hex_from,
    });
  }

  const w = st.dr.find((d) => d.category === category)!;
  w.apply_times.push(opts.now);
  // prune
  w.apply_times = w.apply_times.filter((t) => opts.now - t <= opts.dr_window);

  if (category === "lock") {
    st.lock_applies.push({ t: opts.now, applied });
    st.lock_applies = st.lock_applies.filter((a) => opts.now - a.t <= opts.lock_budget);
  }

  return { applied_duration: applied, dr_factor: dr, lock_taper: tapered, rejected: false };
}

/**
 * Tick CC / shield timers.
 * Time-stop pauses every timer on the victim EXCEPT the time-stop effect itself (OQ-8).
 * Returns kinds that expired this tick (for status_expire events).
 */
export function tickStatuses(st: StatusState, dt: number, paused: boolean): string[] {
  const expired: string[] = [];
  for (const e of st.effects) {
    if (paused && e.kind !== "timestop") continue;
    e.remaining -= dt;
  }
  const keep: StatusInstance[] = [];
  for (const e of st.effects) {
    if (e.remaining > 0) keep.push(e);
    else expired.push(e.kind);
  }
  st.effects = keep;

  if (!paused) {
    if (st.shield_remaining > 0) {
      st.shield_remaining -= dt;
      if (st.shield_remaining <= 0) {
        st.shield_remaining = 0;
        st.shield_pool = 0;
      }
    }
  }
  return expired;
}

export function hasKind(st: StatusState, kind: CcKind): boolean {
  return st.effects.some((e) => e.kind === kind && e.remaining > 0);
}

export function isLocked(st: StatusState): boolean {
  return st.effects.some((e) => e.category === "lock" && e.remaining > 0);
}

/**
 * K-2 (§8.4 L935): Lock- or Bind-disabled for the skillshot override.
 * Explicit kind list (includes taunt even though it is Handicap in DR);
 * slows are excluded. Petrify flag on a stun also counts.
 */
const K2_SKILLSHOT_DISABLED_KINDS: ReadonlySet<CcKind> = new Set([
  "stun",
  "root",
  "knockup",
  "sleep",
  "fear",
  "taunt",
  "hex",
  "leash",
  "petrify",
  "timestop",
]);

export function isSkillshotDisabled(st: StatusState): boolean {
  return st.effects.some(
    (e) =>
      e.remaining > 0 &&
      (K2_SKILLSHOT_DISABLED_KINDS.has(e.kind) || e.petrify === true),
  );
}

export function isTimeStopped(st: StatusState): boolean {
  return hasKind(st, "timestop");
}

export function isBanished(st: StatusState): boolean {
  return hasKind(st, "banish");
}

export function isDisarmed(st: StatusState): boolean {
  return hasKind(st, "disarm");
}

export function isBlind(st: StatusState): boolean {
  return hasKind(st, "blind");
}

export function isSilenced(st: StatusState): boolean {
  return hasKind(st, "silence");
}

export function isRooted(st: StatusState): boolean {
  return hasKind(st, "root");
}

export function isLeashed(st: StatusState): boolean {
  return hasKind(st, "leash");
}

export function isTaunted(st: StatusState): boolean {
  return hasKind(st, "taunt");
}

export function tauntSourceId(st: StatusState): string | null {
  const e = st.effects.find((x) => x.kind === "taunt" && x.remaining > 0);
  return e?.source_id ?? null;
}

export function leashSourceId(st: StatusState): string | null {
  const e = st.effects.find((x) => x.kind === "leash" && x.remaining > 0);
  return e?.source_id ?? null;
}

export function underBreak(st: StatusState, now: number): boolean {
  return now < st.break_until || hasKind(st, "break");
}

export function strongestSlow(st: StatusState): number {
  let m = 0;
  for (const e of st.effects) {
    if (e.kind === "slow" || e.kind === "hex") {
      if ((e.slow ?? 0) > m) m = e.slow ?? 0;
    }
  }
  return m;
}

export function hasPetrify(st: StatusState): boolean {
  return st.effects.some((e) => (e.kind === "petrify" || e.petrify) && e.remaining > 0);
}

/** Strong dispel: remove Lock/Bind/Handicap except knockup, banish, timestop, spellward. */
export function strongDispel(st: StatusState): string[] {
  const removed: string[] = [];
  const keep: StatusInstance[] = [];
  for (const e of st.effects) {
    if (e.kind === "knockup" || e.kind === "banish" || e.kind === "timestop") {
      keep.push(e);
      continue;
    }
    removed.push(e.kind);
  }
  st.effects = keep;
  return removed;
}

/** Basic dispel: Handicap only. */
export function basicDispel(st: StatusState): string[] {
  const removed: string[] = [];
  const keep: StatusInstance[] = [];
  for (const e of st.effects) {
    if (e.category === "handicap") removed.push(e.kind);
    else keep.push(e);
  }
  st.effects = keep;
  return removed;
}

export function addShield(
  st: StatusState,
  amount: number,
  maxHp: number,
  capFrac: number,
  duration_s?: number,
): { applied: number; capped_to: number } {
  st.shield_pool += amount;
  const cap = maxHp * capFrac;
  const capped = Math.min(st.shield_pool, cap);
  const applied = amount - Math.max(0, st.shield_pool - capped);
  st.shield_pool = capped;
  if (duration_s !== undefined && duration_s > 0) {
    st.shield_remaining = Math.max(st.shield_remaining, duration_s);
  }
  return { applied: Math.max(0, applied), capped_to: capped };
}

export function absorbDamage(
  st: StatusState,
  mitigated: number,
  now: number,
  opts?: { pierceSpawnShield?: boolean },
): { hpLoss: number; shieldAbsorbed: number } {
  if (!opts?.pierceSpawnShield && now < st.spawn_shield_until) {
    return { hpLoss: 0, shieldAbsorbed: mitigated };
  }
  if (st.shield_pool >= mitigated) {
    st.shield_pool -= mitigated;
    return { hpLoss: 0, shieldAbsorbed: mitigated };
  }
  const absorbed = st.shield_pool;
  st.shield_pool = 0;
  return { hpLoss: mitigated - absorbed, shieldAbsorbed: absorbed };
}

export function breakSleepOnHpLoss(st: StatusState, hpLoss: number): boolean {
  if (hpLoss <= 0) return false;
  const before = st.effects.length;
  st.effects = st.effects.filter((e) => e.kind !== "sleep");
  return st.effects.length < before;
}

export { clamp };
