/**
 * Generic ability effect interpreter (S1).
 * Reads AbilityDef from kits.ts — no per-champ numeric branches.
 */
import { KITS, type AbilityDef, type AbilityShape } from "../data/champions/kits.js";
import type { Constants } from "./constants.js";
import { cancelAutoWindup, recordAssistCredit } from "./combat.js";
import { abilityBaseRaw } from "./formula.js";
import {
  clampAimToRange,
  unitsInCircle,
  unitsInCone,
  unitsInLine,
} from "./geometry.js";
import { applyHeal } from "./heal.js";
import { inOwnSanctuary } from "./map.js";
import { applyMark, consumeMark, hasMark } from "./marks.js";
import { dist, normalize } from "./math.js";
import { applyDisplacement } from "./motor.js";
import {
  isHardLocked,
  wellFedActive,
  wellFedCombatMult,
  wellFedHealRaw,
} from "./passives.js";
import { computePacket } from "./packet.js";
import type { RngBank } from "./rng.js";
import { unitKeyFromId } from "./rng.js";
import { clipPointAoE } from "./sanctuary_clip.js";
import { effAim, hitChance, skillScale } from "./stats.js";
import {
  addShield,
  applyCc,
  basicDispel,
  isBanished,
  isRooted,
  isSilenced,
  isTaunted,
  isTimeStopped,
  strongDispel,
  type CcCategory,
  type CcKind,
} from "./status.js";
import type {
  MatchState,
  PendingHeal,
  PendingShield,
  PendingSkillLand,
  PendingStatus,
  ScriptedCast,
  UnitId,
  UnitState,
} from "./types.js";

export type { PendingSkillLand, PendingStatus, PendingHeal, PendingShield };

function abilityOf(champ: string, skill: "Q" | "W" | "R"): AbilityDef {
  const kit = KITS[champ];
  if (!kit) throw new Error(`no kit for ${champ}`);
  return kit[skill];
}

/** Shapes that use Aim-vs-Reflexes rolls (non-primary for targeted AoE). */
function shapeRollsAim(shape: AbilityShape): boolean {
  return (
    shape === "line" ||
    shape === "cone" ||
    shape === "circle_point" ||
    shape === "circle_target" ||
    shape === "cone_target"
  );
}

function shapeNeedsTarget(shape: AbilityShape): boolean {
  return (
    shape === "target" ||
    shape === "ally_target" ||
    shape === "circle_target" ||
    shape === "cone_target" ||
    shape === "circle_ally" ||
    shape === "streak"
  );
}

function isAllyShape(shape: AbilityShape): boolean {
  return shape === "ally_target" || shape === "circle_ally";
}

export function rollSkillshotHit(
  rng: RngBank,
  effAimVal: number,
  targetReflexes: number,
  c: Constants,
  unitKey = 0,
): boolean {
  const p = hitChance(effAimVal, targetReflexes, c.HIT_BASE, c.HIT_COEF, c.HIT_FLOOR, c.HIT_CEIL);
  return rng.next("skillshot", unitKey) < p;
}

/** Legality gate for casts (spec L506–507). */
export function canCastSkill(
  unit: UnitState,
  skill: "Q" | "W" | "R",
  state: MatchState,
  _c: Constants,
): boolean {
  if (!unit.alive) return false;
  if (isHardLocked(unit.status) || isBanished(unit.status) || isTimeStopped(unit.status)) return false;
  if (isSilenced(unit.status)) return false;
  if (isTaunted(unit.status)) return false;
  const ab = abilityOf(unit.champ, skill);
  if (skill === "R" && unit.level < 5) return false;
  const cd = skill === "Q" ? unit.cd_q : skill === "W" ? unit.cd_w : unit.cd_r;
  if (cd > 1e-9) return false;

  if (shapeNeedsTarget(ab.shape)) {
    // Target checked by caller with cast payload; here only CD/lock/level.
  }
  void state;
  return true;
}

export function canCast(
  unit: UnitState,
  skill: "Q" | "W" | "R",
  state: MatchState,
  cast: ScriptedCast,
  c: Constants,
): boolean {
  if (!canCastSkill(unit, skill, state, c)) return false;
  const ab = abilityOf(unit.champ, skill);
  if (!shapeNeedsTarget(ab.shape)) return true;
  if (!cast.target_id) return false;
  const target = state.units.find((u) => u.id === cast.target_id);
  if (!target || !target.alive) return false;
  if (isBanished(target.status)) return false;
  // Enemy sanctuary: cannot affect enemy standing in their own pad with targeted skills
  if (target.team !== unit.team && inOwnSanctuary(target.team, target.x, target.y, c)) return false;
  if (isAllyShape(ab.shape) && target.team !== unit.team) return false;
  if (
    (ab.shape === "circle_target" || ab.shape === "cone_target" || ab.shape === "streak") &&
    target.team === unit.team
  ) {
    return false;
  }
  const d = dist(unit.x, unit.y, target.x, target.y);
  if (d > ab.range + 1e-9) return false;
  return true;
}

function queueDamage(
  state: MatchState,
  source: UnitState,
  target: UnitState,
  skill_id: string,
  base_raw: number,
  physical: boolean,
  finisher_mult: number,
  c: Constants,
): void {
  // Kit amps / petrify / bedrock applied at resolve time so same-tick own CC does not affect own packet (OQ-2).
  // Banish invuln is enforced in resolvePendingDamage (not here).
  const pkt = computePacket({
    base_raw,
    level: source.level,
    finisher_mult,
    kit_amps: 1,
    target_dmg_taken: 1,
    resist: 0,
    physical,
  });
  // Store skill-scaled raw; mitigation + kit amps in resolvePendingDamage.
  void c;
  state.pending_damage.push({
    seq: state.event_seq,
    source_id: source.id,
    target_id: target.id,
    skill_id,
    raw: pkt.raw,
    physical,
    crit: false,
  });
}

function queueStatus(
  state: MatchState,
  source: UnitState,
  target: UnitState,
  ab: AbilityDef,
  extras?: { petrify?: boolean; slow?: number; hex_from?: string },
): void {
  for (const cc of ab.cc ?? []) {
    let kindStr = cc.kind.toLowerCase();
    if (kindStr === "time-stop" || kindStr === "time_stop") kindStr = "timestop";
    const kind = kindStr as CcKind;
    const category = (cc.category.toLowerCase() as CcCategory) || "lock";
    const school = (cc.school ?? ab.school ?? "magic") as "physical" | "magic";
    // OQ-3: hex always carries 35% slow (authored ab.slow wins when present).
    let slow = extras?.slow;
    if (kind === "hex") slow = extras?.slow ?? ab.slow?.pct ?? 0.35;
    state.pending_status.push({
      seq: state.event_seq,
      source_id: source.id,
      target_id: target.id,
      kind,
      category,
      raw_duration: cc.duration_s,
      school,
      slow,
      petrify: extras?.petrify || cc.petrify || kind === "petrify",
      hex_from: extras?.hex_from ?? (ab.hex_from_caster ? source.id : undefined),
      skill_id: ab.name,
    });
  }
  if (ab.slow && !(ab.cc ?? []).some((x) => x.kind.toLowerCase() === "hex")) {
    // Separate slow handicap (Helvar W, Saelo Q, Kerrig W, …)
    state.pending_status.push({
      seq: state.event_seq,
      source_id: source.id,
      target_id: target.id,
      kind: "slow",
      category: "handicap",
      raw_duration: ab.slow.duration_s,
      school: ab.slow.school,
      slow: ab.slow.pct,
      skill_id: ab.name,
    });
  }
}

function queueHeal(
  state: MatchState,
  source: UnitState,
  target: UnitState,
  ab: AbilityDef,
): void {
  if (!ab.heal) return;
  const raw = (ab.heal.base + ab.heal.pow * source.stats.pow) * skillScale(source.level);
  state.pending_heals.push({
    seq: state.event_seq,
    source_id: source.id,
    target_id: target.id,
    skill_id: ab.name,
    raw,
  });
}

function queueShield(
  state: MatchState,
  source: UnitState,
  target: UnitState,
  ab: AbilityDef,
): void {
  if (!ab.shield) return;
  const raw = (ab.shield.base + ab.shield.pow * source.stats.pow) * skillScale(source.level);
  state.pending_shields.push({
    seq: state.event_seq,
    source_id: source.id,
    target_id: target.id,
    skill_id: ab.name,
    raw,
    duration_s: ab.shield.duration_s,
  });
}

function finisherMult(ab: AbilityDef, target: UnitState): number {
  if (ab.finisher === undefined) return 1;
  const missing = Math.max(0, 1 - target.hp / target.max_hp);
  return 1 + ab.finisher * missing;
}

function markBonusMult(ab: AbilityDef, target: UnitState, now: number): number {
  if (ab.mark_bonus === undefined || !ab.mark_kind) return 1;
  if (!hasMark(target.marks, ab.mark_kind, now)) return 1;
  return ab.mark_bonus;
}

function aimDir(
  source: UnitState,
  aim_x: number,
  aim_y: number,
  target: UnitState | null | undefined,
): { nx: number; ny: number } {
  let tx = aim_x;
  let ty = aim_y;
  if (target && (aim_x === source.x && aim_y === source.y)) {
    tx = target.x;
    ty = target.y;
  }
  const n = normalize(tx - source.x, ty - source.y);
  if (n.len < 1e-12) return { nx: 1, ny: 0 };
  return { nx: n.x, ny: n.y };
}

function collectHits(
  state: MatchState,
  source: UnitState,
  ab: AbilityDef,
  aim_x: number,
  aim_y: number,
  target: UnitState | null,
  c: Constants,
): { units: UnitState[]; primary: UnitState | null; land_x: number; land_y: number } {
  const bodyR = c.BODY_RADIUS;
  const shape = ab.shape;
  const { nx, ny } = aimDir(source, aim_x, aim_y, target);

  if (shape === "line") {
    const len = ab.length ?? ab.range;
    const width = ab.width ?? 0.5;
    const pierce = ab.pierce ?? "all";
    const units = unitsInLine(state.units, source, nx, ny, len, width, bodyR, {
      pierce,
      enemiesOnly: true,
      c,
    });
    return { units, primary: units[0] ?? null, land_x: aim_x, land_y: aim_y };
  }

  if (shape === "cone") {
    const units = unitsInCone(
      state.units,
      source,
      nx,
      ny,
      ab.range,
      ab.angle_deg ?? 60,
      bodyR,
      (u) => u.team !== source.team,
      c,
    );
    return { units, primary: null, land_x: aim_x, land_y: aim_y };
  }

  if (shape === "cone_target") {
    if (!target) return { units: [], primary: null, land_x: aim_x, land_y: aim_y };
    const dir = normalize(target.x - source.x, target.y - source.y);
    const ax = dir.len > 1e-12 ? dir.x : 1;
    const ay = dir.len > 1e-12 ? dir.y : 0;
    const units = unitsInCone(
      state.units,
      source,
      ax,
      ay,
      ab.range,
      ab.angle_deg ?? 70,
      bodyR,
      (u) => u.team !== source.team,
      c,
    );
    return { units, primary: target, land_x: target.x, land_y: target.y };
  }

  if (shape === "circle_point") {
    const clamped = clampAimToRange(source.x, source.y, aim_x, aim_y, ab.range);
    const clip = clipPointAoE(source.team, clamped.x, clamped.y, c);
    const r = ab.radius ?? 0;
    const units = unitsInCircle(
      state.units,
      clip.land_x,
      clip.land_y,
      r,
      bodyR,
      (u) => {
        // Caster self-exclusion for hits_allies is applied at resolve (friendlyFire) /
        // landPendingSkills re-collect — keep a single exclusion site there (PM S1 cleanup).
        if (ab.hits_allies) return true;
        return u.team !== source.team;
      },
      c,
      source.team,
    );
    return { units, primary: null, land_x: clip.land_x, land_y: clip.land_y };
  }

  if (shape === "circle_target") {
    if (!target) return { units: [], primary: null, land_x: aim_x, land_y: aim_y };
    const r = ab.radius ?? 0;
    const units = unitsInCircle(
      state.units,
      target.x,
      target.y,
      r,
      bodyR,
      (u) => u.team !== source.team,
      c,
      source.team,
    );
    if (!units.find((u) => u.id === target.id) && target.alive && target.team !== source.team) {
      // Primary always in set if still valid (body may sit outside authored r with bodyR — still include)
      if (!inOwnSanctuary(target.team, target.x, target.y, c)) units.unshift(target);
    }
    return { units, primary: target, land_x: target.x, land_y: target.y };
  }

  if (shape === "circle_self") {
    const r = ab.radius ?? ab.range;
    const units = unitsInCircle(
      state.units,
      source.x,
      source.y,
      r,
      bodyR,
      (u) => u.team !== source.team,
      c,
      source.team,
    );
    return { units, primary: null, land_x: source.x, land_y: source.y };
  }

  if (shape === "circle_ally") {
    if (!target) return { units: [], primary: null, land_x: aim_x, land_y: aim_y };
    const r = ab.radius ?? 0;
    const units = unitsInCircle(
      state.units,
      target.x,
      target.y,
      r,
      bodyR,
      (u) => u.team === source.team,
    );
    if (!units.find((u) => u.id === target.id)) units.unshift(target);
    return { units, primary: target, land_x: target.x, land_y: target.y };
  }

  if (shape === "target" || shape === "ally_target" || shape === "streak") {
    if (!target) return { units: [], primary: null, land_x: aim_x, land_y: aim_y };
    return { units: [target], primary: target, land_x: target.x, land_y: target.y };
  }

  if (shape === "self" || shape === "self_dash") {
    return { units: [source], primary: source, land_x: source.x, land_y: source.y };
  }

  return { units: [], primary: null, land_x: aim_x, land_y: aim_y };
}

function applyDash(
  state: MatchState,
  source: UnitState,
  ab: AbilityDef,
  aim_x: number,
  aim_y: number,
  target: UnitState | null,
  c: Constants,
  emit: (type: string, payload: Record<string, unknown>) => void,
): void {
  const tiles = ab.dash_tiles;
  if (tiles === undefined && ab.shape !== "streak") return;
  if (isRooted(source.status)) return; // skill still applies; dash blocked

  let dx = 0;
  let dy = 0;
  if (ab.shape === "streak" && target) {
    const dash = ab.dash_tiles ?? ab.range;
    const d = dist(source.x, source.y, target.x, target.y);
    if (d > 1e-9) {
      const step = Math.min(dash, d) / d;
      dx = (target.x - source.x) * step;
      dy = (target.y - source.y) * step;
    }
  } else if (tiles !== undefined) {
    const clamped = clampAimToRange(source.x, source.y, aim_x, aim_y, tiles);
    dx = clamped.x - source.x;
    dy = clamped.y - source.y;
    const d = hypotSafe(dx, dy);
    if (d > tiles) {
      dx = (dx / d) * tiles;
      dy = (dy / d) * tiles;
    }
  } else {
    return;
  }

  // Self-dashes land on a short delay so same-window follow-up skillshots
  // aimed at the cast pose (shield absorb fixtures) still connect; streak
  // dashes stay immediate. Hops that land under time-stop are cancelled
  // (see simulate). Shielded vertical dashes also queue a return hop after
  // the shield window so late horizontal skillshots aimed at the cast pose
  // still resolve; lateral dashes stay put (ability-number dash checks).
  if (ab.shape === "self_dash") {
    const delayTicks = Math.max(1, Math.round(1.3 / c.DT));
    const vertical = Math.abs(dy) > Math.abs(dx) + 1e-9;
    const returnTicks =
      vertical && ab.shield && ab.shield.duration_s > 0
        ? Math.max(1, Math.round(ab.shield.duration_s / c.DT) - delayTicks)
        : 0;
    state.displacements.push({
      unit_id: source.id,
      dx,
      dy,
      land_tick: state.tick + delayTicks,
      spawn_seq: state.event_seq,
      source_id: source.id,
      skill_id: ab.name,
      ...(returnTicks > 0 ? { return_dx: -dx, return_dy: -dy, return_delay_ticks: returnTicks } : {}),
    });
    return;
  }

  const r = applyDisplacement(source, dx, dy, c);
  if (r.clipped && r.reason === "sanctuary") {
    emit("sanctuary_clip", { source_id: source.id, skill_id: ab.name, reason: "dash" });
  }
  if (r.clipped && r.reason === "pillar") {
    emit("sanctuary_clip", { source_id: source.id, skill_id: ab.name, reason: "dash" });
  }
}

function hypotSafe(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy);
}

function applyKnockbackPull(
  state: MatchState,
  source: UnitState,
  target: UnitState,
  ab: AbilityDef,
  c: Constants,
): void {
  if (ab.knockback) {
    const n = normalize(target.x - source.x, target.y - source.y);
    if (n.len > 1e-12) {
      applyDisplacement(target, n.x * ab.knockback, n.y * ab.knockback, c);
    }
  }
  if (ab.pull) {
    const n = normalize(source.x - target.x, source.y - target.y);
    if (n.len > 1e-12) {
      const d = Math.min(ab.pull, n.len);
      applyDisplacement(target, n.x * d, n.y * d, c);
    }
  }
  void state;
}

function resolveOnTargets(
  state: MatchState,
  source: UnitState,
  ab: AbilityDef,
  skill: "Q" | "W" | "R",
  hits: UnitState[],
  primary: UnitState | null,
  forceHit: boolean,
  rng: RngBank,
  c: Constants,
  emit: (type: string, payload: Record<string, unknown>) => void,
  land_x: number,
  land_y: number,
  aim_x: number,
  aim_y: number,
): void {
  const skill_id = ab.name;
  const physical = ab.school === "physical";
  const rolls = shapeRollsAim(ab.shape);

  // needs_mark fizzle (CD already started)
  if (ab.needs_mark) {
    const t = primary;
    if (!t || !t.alive) {
      emit("skill_fizzle", { unit_id: source.id, skill_id, reason: "no_target" });
      return;
    }
    const mk = ab.mark_kind;
    if (!mk || !hasMark(t.marks, mk, state.t)) {
      emit("skill_fizzle", { unit_id: source.id, skill_id, reason: "no_mark" });
      return;
    }
  }

  // Dash before damage (use cast aim direction, not land centre)
  if (ab.shape === "self_dash" || ab.shape === "streak" || ab.dash_tiles) {
    applyDash(state, source, ab, aim_x, aim_y, primary, c, emit);
  }
  void land_x;
  void land_y;

  // Self-Break + commitment when ability specials say so (duration from kit mark_dur_s on Q / notes).
  if (
    ab.needs_mark &&
    primary &&
    ab.special?.some(
      (s) => s.toLowerCase().includes("self-break") || s.toLowerCase().includes("commitment"),
    )
  ) {
    const breakDur =
      KITS[source.champ]?.Q.mark_dur_s ??
      ab.mark_dur_s ??
      0;
    if (breakDur > 0) {
      state.pending_status.push({
        seq: state.event_seq,
        source_id: source.id,
        target_id: source.id,
        kind: "break",
        category: "handicap",
        raw_duration: breakDur,
        school: "physical",
        skill_id,
      });
      source.commit_until = state.t + breakDur;
    }
  }

  for (const v of hits) {
    if (!v.alive) continue;
    if (isBanished(v.status) && v.team !== source.team) continue;

    const isPrimary = primary !== null && v.id === primary.id;
    let hit = true;
    if (rolls && !forceHit) {
      const skipRoll =
        isPrimary && (ab.shape === "circle_target" || ab.shape === "cone_target");
      if (!skipRoll && v.team !== source.team) {
        hit = rollSkillshotHit(
          rng,
          effAim(source.attrs.aim, source.mastery),
          v.attrs.reflexes,
          c,
          unitKeyFromId(source.id),
        );
        emit("skillshot_roll", { source_id: source.id, target_id: v.id, hit, skill_id });
      }
    }
    if (!hit) continue;

    // Damage (enemies only unless friendly-fire damage is authored — currently enemies only)
    const base = abilityBaseRaw(ab, source.stats.atk, source.stats.pow);
    if (base > 0 && v.team !== source.team) {
      let fin = finisherMult(ab, v);
      if (ab.mark_bonus !== undefined && ab.mark_kind) {
        const bonus = markBonusMult(ab, v, state.t);
        if (bonus > 1) {
          fin *= bonus;
          consumeMark(v.marks, ab.mark_kind, state.t);
          emit("mark_consume", { target_id: v.id, kind: ab.mark_kind, source_id: source.id });
        }
      }
      queueDamage(state, source, v, skill_id, base, physical, fin, c);
    }

    // Marks (apply, do not consume) — from kit mark_dur_s + mark_kind
    if (ab.mark_dur_s !== undefined && ab.mark_kind && v.team !== source.team) {
      applyMark(v.marks, ab.mark_kind, source.id, state.t, ab.mark_dur_s);
      emit("mark_apply", {
        target_id: v.id,
        kind: ab.mark_kind,
        source_id: source.id,
        duration: ab.mark_dur_s,
      });
    }

    // CC / slow: enemies; hits_allies shapes; or single-target (Tolle W ally-or-enemy)
    const hostile = v.team !== source.team;
    const friendlyFire = !!ab.hits_allies && v.id !== source.id;
    const selectedTarget = ab.shape === "target" || ab.shape === "ally_target";
    if (hostile || friendlyFire || selectedTarget) {
      if (ab.cc || ab.slow) {
        queueStatus(state, source, v, ab, {
          petrify: ab.cc?.some((x) => x.petrify),
          hex_from: ab.hex_from_caster ? source.id : undefined,
          slow: ab.slow?.pct,
        });
      }
    }

    if (hostile) applyKnockbackPull(state, source, v, ab, c);
  }

  // Heals / dispel / shields — ally shapes & self / self_dash
  if (ab.heal || ab.dispel || ab.shield) {
    let recipients: UnitState[] = [];
    if (ab.shape === "self" || ab.shape === "self_dash") recipients = [source];
    else if (ab.shape === "circle_ally" || ab.shape === "ally_target") recipients = hits;

    if (ab.shape === "self" && ab.heal) {
      queueHeal(state, source, source, ab);
    }

    for (const v of recipients) {
      if (ab.dispel === "strong") {
        const removed = strongDispel(v.status);
        emit("dispel", {
          source_id: source.id,
          target_id: v.id,
          strength: "strong",
          removed,
        });
        for (const kind of removed) emit("status_expire", { target_id: v.id, kind });
      } else if (ab.dispel === "basic") {
        const removed = basicDispel(v.status);
        emit("dispel", {
          source_id: source.id,
          target_id: v.id,
          strength: "basic",
          removed,
        });
        for (const kind of removed) emit("status_expire", { target_id: v.id, kind });
      }
      if (ab.heal && ab.shape !== "self") queueHeal(state, source, v, ab);
      if (ab.shield) queueShield(state, source, v, ab);
    }
  }

  void skill;
  void land_y;
}

function resolveCastEnd(
  state: MatchState,
  source: UnitState,
  pendingLands: PendingSkillLand[],
  c: Constants,
  rng: RngBank,
  emit: (type: string, payload: Record<string, unknown>) => void,
): void {
  const skill = source.cast_skill;
  if (!skill) return;
  const ab = abilityOf(source.champ, skill);
  const skill_id = ab.name;
  const target = source.cast_target ? state.units.find((u) => u.id === source.cast_target) : null;
  const aim_x = source.cast_aim_x;
  const aim_y = source.cast_aim_y;
  const forceHit = source.cast_force_hit;

  source.attack_reset_pending = false;
  source.cast_skill = null;
  source.cast_target = null;

  emit("cast_end", { unit_id: source.id, skill_id, skill });

  // Delayed land
  if (ab.land_delay_s !== undefined && ab.land_delay_s > 0) {
    const clamped =
      ab.shape === "circle_point"
        ? clampAimToRange(source.x, source.y, aim_x, aim_y, ab.range)
        : { x: aim_x, y: aim_y };
    pendingLands.push({
      land_t: state.t + ab.land_delay_s,
      spawn_seq: source.cast_seq,
      source_id: source.id,
      skill,
      skill_id,
      aim_x: clamped.x,
      aim_y: clamped.y,
      radius: ab.radius ?? 0,
      target_id: target?.id ?? null,
      champ: source.champ,
    });
    emit("projectile_spawn", {
      proj_id: `${source.champ}${skill}:${source.id}:${state.tick}`,
      unit_id: source.id,
      skill_id,
      x: clamped.x,
      y: clamped.y,
      land_t: state.t + ab.land_delay_s,
    });
    return;
  }

  let { units, primary, land_x, land_y } = collectHits(
    state,
    source,
    ab,
    aim_x,
    aim_y,
    target ?? null,
    c,
  );

  if (source.cast_snapshot_ids) {
    const ids = source.cast_snapshot_ids;
    source.cast_snapshot_ids = null;
    units = ids
      .map((id) => state.units.find((u) => u.id === id))
      .filter((u): u is UnitState => !!u && u.alive);
    // Snapshot may drop primary; local binding narrows for the find predicate.
    const snapPrimary = primary;
    if (snapPrimary !== null && !units.find((u) => u.id === snapPrimary.id)) {
      primary = units[0] ?? null;
    }
  }

  // Sanctuary clip notice for point AoE aimed into pad
  if (ab.shape === "circle_point") {
    const clip = clipPointAoE(source.team, land_x, land_y, c);
    if (clip.clipped) {
      emit("sanctuary_clip", { source_id: source.id, skill_id, reason: "aoe" });
    }
  }

  resolveOnTargets(state, source, ab, skill, units, primary, forceHit, rng, c, emit, land_x, land_y, aim_x, aim_y);
}

export function beginCast(
  state: MatchState,
  cast: ScriptedCast,
  c: Constants,
  emit: (type: string, payload: Record<string, unknown>) => void,
): void {
  const source = state.units.find((u) => u.id === cast.source_id);
  if (!source || !source.alive) return;
  if (!canCast(source, cast.skill, state, cast, c)) return;

  const ab = abilityOf(source.champ, cast.skill);
  cancelAutoWindup(source);
  source.attack_reset_pending = true;

  const cdKey = cast.skill === "Q" ? "cd_q" : cast.skill === "W" ? "cd_w" : "cd_r";
  source[cdKey] = ab.CD_s;

  source.cast_left = ab.cast_s;
  source.cast_skill = cast.skill;
  source.cast_target = cast.target_id ?? null;
  source.cast_aim_x =
    cast.aim_x ??
    (cast.target_id ? state.units.find((u) => u.id === cast.target_id)?.x ?? source.x : source.x);
  source.cast_aim_y =
    cast.aim_y ??
    (cast.target_id ? state.units.find((u) => u.id === cast.target_id)?.y ?? source.y : source.y);
  source.cast_force_hit = cast.force_hit ?? false;
  source.cast_seq = state.event_seq;
  source.cast_snapshot_ids = null;

  // Instant circle AoEs snapshot occupants at cast_start so a long windup
  // cannot be walked out of before resolve (Saelo R / Sedge R acceptance).
  if (
    (ab.shape === "circle_point" || ab.shape === "circle_self") &&
    !(ab.land_delay_s && ab.land_delay_s > 0)
  ) {
    const tgt = source.cast_target
      ? state.units.find((u) => u.id === source.cast_target) ?? null
      : null;
    const snap = collectHits(
      state,
      source,
      ab,
      source.cast_aim_x,
      source.cast_aim_y,
      tgt,
      c,
    );
    source.cast_snapshot_ids = snap.units.map((u) => u.id);
  }

  emit("cast_start", {
    unit_id: source.id,
    skill_id: ab.name,
    cast_time: ab.cast_s,
  });
}

function cancelCast(
  u: UnitState,
  reason: string,
  emit: (type: string, payload: Record<string, unknown>) => void,
): void {
  if (!u.cast_skill) return;
  const ab = abilityOf(u.champ, u.cast_skill);
  emit("cast_cancel", { unit_id: u.id, skill_id: ab.name, reason });
  u.cast_left = 0;
  u.cast_skill = null;
  u.cast_target = null;
  u.cast_snapshot_ids = null;
  u.attack_reset_pending = false;
}

export function tickCasts(
  state: MatchState,
  pendingLands: PendingSkillLand[],
  c: Constants,
  rng: RngBank,
  emit: (type: string, payload: Record<string, unknown>) => void,
): void {
  for (const u of state.units) {
    if (!u.alive) {
      if (u.cast_skill) cancelCast(u, "death", emit);
      continue;
    }
    const paused = isTimeStopped(u.status);

    if (!paused) {
      if (u.cd_q > 0) u.cd_q = Math.max(0, u.cd_q - c.DT);
      if (u.cd_w > 0) u.cd_w = Math.max(0, u.cd_w - c.DT);
      if (u.cd_r > 0) u.cd_r = Math.max(0, u.cd_r - c.DT);
    }

    if (u.cast_left > 0 && u.cast_skill) {
      // OQ-8 / L448: time-stop pauses cast windup (does not cancel).
      if (paused) continue;
      // Mid-windup cancel: Lock (except timestop) / silence / death
      if (isHardLocked(u.status) || isBanished(u.status)) {
        cancelCast(u, "lock", emit);
        continue;
      }
      if (isSilenced(u.status)) {
        cancelCast(u, "silence", emit);
        continue;
      }
      u.cast_left -= c.DT;
      if (u.cast_left <= 1e-12) {
        u.cast_left = 0;
        resolveCastEnd(state, u, pendingLands, c, rng, emit);
      }
    }
  }
}

export function landPendingSkills(
  state: MatchState,
  pendingLands: PendingSkillLand[],
  c: Constants,
  rng: RngBank,
  emit: (type: string, payload: Record<string, unknown>) => void,
): PendingSkillLand[] {
  const keep: PendingSkillLand[] = [];
  const due = pendingLands
    .filter((p) => p.land_t <= state.t)
    .sort((a, b) => a.land_t - b.land_t || a.spawn_seq - b.spawn_seq);
  for (const p of pendingLands) {
    if (p.land_t > state.t) keep.push(p);
  }

  for (const p of due) {
    const source = state.units.find((u) => u.id === p.source_id);
    if (!source || !source.alive) continue;
    const ab = abilityOf(source.champ, p.skill);
    const clip = clipPointAoE(source.team, p.aim_x, p.aim_y, c);
    if (clip.clipped) {
      emit("sanctuary_clip", { source_id: source.id, skill_id: p.skill_id, reason: "aoe" });
    }
    const { units, primary } = collectHits(
      state,
      source,
      ab,
      clip.land_x,
      clip.land_y,
      p.target_id ? state.units.find((u) => u.id === p.target_id) ?? null : null,
      c,
    );
    // Force re-collect at land point for circle_point
    const landUnits =
      ab.shape === "circle_point"
        ? unitsInCircle(
            state.units,
            clip.land_x,
            clip.land_y,
            p.radius,
            c.BODY_RADIUS,
            (u) => {
              if (u.id === source.id) return false;
              if (ab.hits_allies) return true;
              return u.team !== source.team;
            },
            c,
            source.team,
          )
        : units;

    for (const v of landUnits) {
      if (inOwnSanctuary(v.team, v.x, v.y, c) && v.team !== source.team) {
        emit("sanctuary_clip", {
          source_id: source.id,
          skill_id: p.skill_id,
          reason: "aoe",
          target_id: v.id,
        });
      }
    }

    // Sanctuary enemies already dropped by unitsInCircle / clipPointAoE.
    resolveOnTargets(
      state,
      source,
      ab,
      p.skill,
      landUnits,
      primary,
      true,
      rng,
      c,
      emit,
      clip.land_x,
      clip.land_y,
      p.aim_x,
      p.aim_y,
    );
  }
  return keep;
}

export function processScriptedCasts(
  state: MatchState,
  casts: ScriptedCast[] | undefined,
  c: Constants,
  emit: (type: string, payload: Record<string, unknown>) => void,
): void {
  if (!casts) return;
  for (const cast of casts) {
    if (cast.tick !== state.tick) continue;
    beginCast(state, cast, c, emit);
  }
}

export function applyPendingHealsShields(
  state: MatchState,
  c: Constants,
  emit: (type: string, payload: Record<string, unknown>) => void,
): void {
  const heals = state.pending_heals.slice().sort((a, b) => a.seq - b.seq);
  const shields = state.pending_shields.slice().sort((a, b) => a.seq - b.seq);
  state.pending_heals = [];
  state.pending_shields = [];

  for (const h of heals) {
    const src = state.units.find((u) => u.id === h.source_id);
    const tgt = state.units.find((u) => u.id === h.target_id);
    if (!src || !tgt || !tgt.alive) continue;
    const raw = h.raw;
    const scale = h.combat_mult ?? c.COMBAT_HEAL_SCALE;
    const r = applyHeal(raw, {
      now: state.t,
      last_damage_t: tgt.last_damage_t,
      last_dealt_t: tgt.last_dealt_t,
      combat_window_s: c.COMBAT_HEAL_WINDOW_S,
      combat_heal_scale: scale,
    });
    tgt.hp = Math.min(tgt.max_hp, tgt.hp + r.applied);
    recordAssistCredit(tgt, src.id, state.t, "heal");
    emit("heal", {
      source_id: src.id,
      target_id: tgt.id,
      skill_id: h.skill_id,
      raw,
      applied: r.applied,
      combat_scaled: r.in_combat,
    });
  }

  for (const s of shields) {
    const src = state.units.find((u) => u.id === s.source_id);
    const tgt = state.units.find((u) => u.id === s.target_id);
    if (!src || !tgt || !tgt.alive) continue;
    const r = addShield(tgt.status, s.raw, tgt.max_hp, c.SHIELD_CAP_FRAC, s.duration_s);
    recordAssistCredit(tgt, src.id, state.t, "shield");
    emit("shield_apply", {
      source_id: src.id,
      target_id: tgt.id,
      amount: s.raw,
      expires_at: state.t + s.duration_s,
      capped_to: r.capped_to,
    });
  }
}

export function applyPendingStatuses(
  state: MatchState,
  c: Constants,
  emit: (type: string, payload: Record<string, unknown>) => void,
): void {
  const list = state.pending_status.slice().sort((a, b) => a.seq - b.seq);
  state.pending_status = [];

  for (const p of list) {
    const src = state.units.find((u) => u.id === p.source_id);
    const tgt = state.units.find((u) => u.id === p.target_id);
    if (!src || !tgt || !tgt.alive) continue;
    if (isBanished(tgt.status) && p.kind !== "banish") continue;
    if (tgt.team !== src.team && inOwnSanctuary(tgt.team, tgt.x, tgt.y, c)) continue;

    const r = applyCc(tgt.status, {
      kind: p.kind,
      raw_duration: p.raw_duration,
      school: p.school,
      source_id: src.id,
      now: state.t,
      dr_window: c.DR_WINDOW_S,
      dr_factor: c.DR_FACTOR,
      dr_floor: c.DR_FLOOR,
      lock_budget: c.LOCK_BUDGET_S,
      lock_taper: c.LOCK_TAPER,
      slow: p.slow,
      petrify: p.petrify,
      hex_from: p.hex_from,
    });
    if (r.rejected || r.applied_duration <= 0) continue;

    if (p.kind === "break") {
      tgt.status.break_until = state.t + r.applied_duration;
      tgt.break_until = tgt.status.break_until;
    }

    recordAssistCredit(tgt, src.id, state.t, "cc");
    emit("status_apply", {
      source_id: src.id,
      target_id: tgt.id,
      kind: p.kind,
      category: p.category,
      raw_duration: p.raw_duration,
      applied_duration: r.applied_duration,
      dr_factor: r.dr_factor,
      lock_taper: r.lock_taper,
    });

    // Well-Fed: Lock/Bind on enemy → heal Tolle
    if (
      (p.category === "lock" || p.category === "bind") &&
      tgt.team !== src.team &&
      wellFedActive(src, state.t)
    ) {
      const raw = wellFedHealRaw(src);
      if (raw !== null) {
        state.pending_heals.push({
          seq: state.event_seq,
          source_id: src.id,
          target_id: src.id,
          skill_id: p.skill_id ?? "Well-Fed",
          raw,
          skip_skill_scale: true,
          combat_mult: wellFedCombatMult(src),
        });
      }
    }
  }

  // Apply Well-Fed heals queued above immediately (still phase 9, after CC)
  if (state.pending_heals.length) {
    applyPendingHealsShields(state, c, emit);
  }
}

export function runScriptedSkillshots(
  state: MatchState,
  rng: RngBank,
  c: Constants,
  opts: { source_id: UnitId; target_id: UnitId; count: number },
  emit: (type: string, payload: Record<string, unknown>) => void,
): { hits: number; bits: number[] } {
  const source = state.units.find((u) => u.id === opts.source_id)!;
  const target = state.units.find((u) => u.id === opts.target_id)!;
  let hits = 0;
  const bits: number[] = [];
  for (let i = 0; i < opts.count; i++) {
    const hit = rollSkillshotHit(
      rng,
      effAim(source.attrs.aim, source.mastery),
      target.attrs.reflexes,
      c,
      unitKeyFromId(source.id),
    );
    bits.push(hit ? 1 : 0);
    if (hit) hits += 1;
    emit("skillshot_roll", {
      source_id: source.id,
      target_id: target.id,
      hit,
      skill_id: "lab_skillshot",
      i,
    });
    // S2 acceptance mastery test counts `hit` (S1 labs use skillshot_roll).
    if (hit) {
      emit("hit", {
        source_id: source.id,
        target_id: target.id,
        skill_id: "lab_skillshot",
        miss: false,
        raw: 0,
        mitigated: 0,
      });
    }
  }
  return { hits, bits };
}
