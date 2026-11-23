/**
 * Scripted ability casts (S1). No AI — MatchConfig.scripted_casts drives casts.
 * Kit numbers come only from kits.ts via formula parser.
 */
import { KITS, type AbilityDef } from "../data/champions/kits.js";
import type { Constants } from "./constants.js";
import { cancelAutoWindup, recordAssistCredit } from "./combat.js";
import { evalL7Base } from "./formula.js";
import { dist } from "./math.js";
import { inOwnSanctuary } from "./map.js";
import { applyMark, consumeMark, hasMark } from "./marks.js";
import { computePacket } from "./packet.js";
import type { RngBank } from "./rng.js";
import { unitKeyFromId } from "./rng.js";
import { clipPointAoE } from "./sanctuary_clip.js";
import {
  applyCc,
  hasPetrify,
  isBanished,
  isTimeStopped,
  strongDispel,
  basicDispel,
  underBreak,
  type CcKind,
} from "./status.js";
import { hitChance, skillScale } from "./stats.js";
import type { MatchState, ScriptedCast, UnitId, UnitState } from "./types.js";

export interface PendingSkillLand {
  land_t: number;
  spawn_seq: number;
  source_id: UnitId;
  skill: "Q" | "W" | "R";
  skill_id: string;
  aim_x: number;
  aim_y: number;
  radius: number;
  target_id: UnitId | null;
  champ: string;
}

function abilityOf(champ: string, skill: "Q" | "W" | "R"): AbilityDef {
  const kit = KITS[champ];
  if (!kit) throw new Error(`no kit for ${champ}`);
  return kit[skill];
}

function ccOpts(c: Constants, source_id: string, now: number, school: "physical" | "magic") {
  return {
    school,
    source_id,
    now,
    dr_window: c.DR_WINDOW_S,
    dr_factor: c.DR_FACTOR,
    dr_floor: c.DR_FLOOR,
    lock_budget: c.LOCK_BUDGET_S,
    lock_taper: c.LOCK_TAPER,
  };
}

function applyKitCc(
  state: MatchState,
  c: Constants,
  source: UnitState,
  target: UnitState,
  ab: AbilityDef,
  emit: (type: string, payload: Record<string, unknown>) => void,
  extras?: { petrify?: boolean; slow?: number; hex_from?: string },
): void {
  if (!ab.cc) return;
  for (const cc of ab.cc) {
    const effectLower = cc.effect.toLowerCase();
    let kind: CcKind = effectLower.split(/\s+/)[0]! as CcKind;
    if (effectLower.startsWith("time-stop") || effectLower.startsWith("timestop")) kind = "timestop";
    if (effectLower.startsWith("slow")) kind = "slow";
    if (cc.notes?.includes("petrify") || extras?.petrify) kind = "petrify";

    let slow = extras?.slow;
    if (kind === "slow" || cc.effect.includes("%")) {
      const m = cc.effect.match(/(\d+(?:\.\d+)?)\s*%/);
      if (m) slow = parseFloat(m[1]!) / 100;
    }
    if (cc.notes?.includes("slows 35%") || cc.notes?.includes("slow 35%")) slow = 0.35;

    const school = (cc.school ?? ab.school ?? "magic") as "physical" | "magic";
    const r = applyCc(target.status, {
      kind,
      raw_duration: cc.duration_s,
      ...ccOpts(c, source.id, state.t, school),
      slow,
      petrify: extras?.petrify || kind === "petrify",
      hex_from: extras?.hex_from,
    });
    if (!r.rejected && r.applied_duration > 0) {
      recordAssistCredit(target, source.id, state.t, "cc");
      emit("cc_apply", {
        source_id: source.id,
        target_id: target.id,
        kind,
        applied: r.applied_duration,
        skill_id: ab.name,
      });
    }
  }
}

/** Aim roll using HIT_* constants (§8 / glossary). */
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

function kilnAmp(target: UnitState, now: number): number {
  if (underBreak(target.status, now)) return 1;
  const hex = target.status.effects.find((e) => e.kind === "hex" && e.remaining > 0 && e.hex_from);
  if (!hex) return 1;
  // Mirren Kiln-Cured: hexed by Mirren → +12%
  return 1.12;
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
): { raw: number; mitigated: number } {
  if (isBanished(target.status)) {
    return { raw: 0, mitigated: 0 };
  }
  const resist = physical ? target.stats.pres : target.stats.mres;
  const taken = hasPetrify(target.status) ? 1 - c.PETRIFY_DR : 1;
  const kit = kilnAmp(target, state.t);
  const pkt = computePacket({
    base_raw,
    level: source.level,
    finisher_mult,
    kit_amps: kit,
    target_dmg_taken: taken,
    resist,
    physical,
  });
  state.pending_damage.push({
    seq: state.event_seq,
    source_id: source.id,
    target_id: target.id,
    skill_id,
    raw: pkt.raw,
    physical,
    crit: false,
    pre_mitigated: pkt.mitigated,
  });
  return { raw: pkt.raw, mitigated: pkt.mitigated };
}

function unitsInRadius(
  state: MatchState,
  x: number,
  y: number,
  radius: number,
  pred: (u: UnitState) => boolean,
): UnitState[] {
  const out: UnitState[] = [];
  for (const u of state.units) {
    if (!u.alive) continue;
    if (!pred(u)) continue;
    if (dist(u.x, u.y, x, y) <= radius) out.push(u);
  }
  return out;
}

/** Begin a cast: cancel windup, set attack_reset, start cast timer / CD. */
export function beginCast(
  state: MatchState,
  cast: ScriptedCast,
  c: Constants,
  emit: (type: string, payload: Record<string, unknown>) => void,
): void {
  const source = state.units.find((u) => u.id === cast.source_id);
  if (!source || !source.alive) return;
  if (isTimeStopped(source.status) || isBanished(source.status)) return;

  const ab = abilityOf(source.champ, cast.skill);
  cancelAutoWindup(source);
  source.attack_reset_pending = true;

  const cdKey = cast.skill === "Q" ? "cd_q" : cast.skill === "W" ? "cd_w" : "cd_r";
  source[cdKey] = ab.CD_s;

  source.cast_left = ab.cast_s;
  source.cast_skill = cast.skill;
  source.cast_target = cast.target_id ?? null;
  source.cast_aim_x = cast.aim_x ?? (cast.target_id ? state.units.find((u) => u.id === cast.target_id)?.x ?? source.x : source.x);
  source.cast_aim_y = cast.aim_y ?? (cast.target_id ? state.units.find((u) => u.id === cast.target_id)?.y ?? source.y : source.y);
  source.cast_force_hit = cast.force_hit ?? false;
  source.cast_seq = state.event_seq;

  emit("cast_start", {
    unit_id: source.id,
    skill_id: ab.name,
    skill: cast.skill,
    cast_s: ab.cast_s,
    cd_s: ab.CD_s,
  });
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

  // --- Per-champ ability resolution (authored behavior) ---
  if (source.champ === "huntress" && skill === "Q") {
    // Mark primary target (does not consume); damage + aim
    if (target && target.alive && !isBanished(target.status)) {
      const hit = forceHit || rollSkillshotHit(rng, source.attrs.aim, target.attrs.reflexes, c, unitKeyFromId(source.id));
      emit("skillshot_roll", { source_id: source.id, target_id: target.id, hit, skill_id });
      if (hit) {
        const base = evalL7Base(ab.l7_formula, source.stats.atk, source.stats.pow);
        queueDamage(state, source, target, skill_id, base, true, 1, c);
        applyMark(target.marks, "huntress", source.id, state.t, 4.0);
        emit("mark_apply", { target_id: target.id, kind: "huntress", source_id: source.id, duration: 4.0 });
      }
    }
    return;
  }

  if (source.champ === "huntress" && skill === "R") {
    const radius = ab.radius ?? 0;
    const victims = unitsInRadius(state, aim_x, aim_y, radius, (u) => u.team !== source.team);
    for (const v of victims) {
      if (isBanished(v.status)) continue;
      const hit = forceHit || rollSkillshotHit(rng, source.attrs.aim, v.attrs.reflexes, c, unitKeyFromId(source.id));
      emit("skillshot_roll", { source_id: source.id, target_id: v.id, hit, skill_id });
      if (!hit) continue;
      const marked = hasMark(v.marks, "huntress", state.t);
      const fin = marked ? 1.35 : 1;
      if (marked) {
        consumeMark(v.marks, "huntress", state.t);
        emit("mark_consume", { target_id: v.id, kind: "huntress", source_id: source.id });
      }
      const base = evalL7Base(ab.l7_formula, source.stats.atk, source.stats.pow);
      queueDamage(state, source, v, skill_id, base, true, fin, c);
    }
    return;
  }

  if (source.champ === "maelis" && skill === "R") {
    const radius = ab.radius ?? 0;
    const victims = unitsInRadius(state, aim_x, aim_y, radius, (u) => u.team !== source.team);
    for (const v of victims) {
      if (isBanished(v.status)) continue;
      const hit = forceHit || rollSkillshotHit(rng, source.attrs.aim, v.attrs.reflexes, c, unitKeyFromId(source.id));
      emit("skillshot_roll", { source_id: source.id, target_id: v.id, hit, skill_id });
      if (!hit) continue;
      const missFrac = Math.max(0, 1 - v.hp / v.max_hp);
      const fin = 1 + 0.2 * missFrac;
      const base = evalL7Base(ab.l7_formula, source.stats.atk, source.stats.pow);
      queueDamage(state, source, v, skill_id, base, false, fin, c);
    }
    return;
  }

  if (source.champ === "kerrig" && skill === "Q") {
    if (target && target.alive && !isBanished(target.status)) {
      const hit = forceHit || rollSkillshotHit(rng, source.attrs.aim, target.attrs.reflexes, c, unitKeyFromId(source.id));
      emit("skillshot_roll", { source_id: source.id, target_id: target.id, hit, skill_id });
      if (hit) {
        const base = evalL7Base(ab.l7_formula, source.stats.atk, source.stats.pow);
        queueDamage(state, source, target, skill_id, base, true, 1, c);
        applyMark(target.marks, "kerrig", source.id, state.t, 2.8);
        applyKitCc(state, c, source, target, ab, emit);
        emit("mark_apply", { target_id: target.id, kind: "kerrig", source_id: source.id, duration: 2.8 });
      }
    }
    return;
  }

  if (source.champ === "kerrig" && skill === "R") {
    // CD already started on windup (beginCast). Requires mark; else fizzle, no dash.
    if (!target || !target.alive) {
      emit("skill_fizzle", { unit_id: source.id, skill_id, reason: "no_target" });
      return;
    }
    if (!hasMark(target.marks, "kerrig", state.t)) {
      emit("skill_fizzle", { unit_id: source.id, skill_id, reason: "no_mark" });
      return;
    }
    // Dash up to 5 tiles toward target (clipped later by motor if needed)
    const dash = 5;
    const d = dist(source.x, source.y, target.x, target.y);
    if (d > 1e-9) {
      const step = Math.min(dash, d) / d;
      source.x += (target.x - source.x) * step;
      source.y += (target.y - source.y) * step;
    }
    emit("dash", { unit_id: source.id, skill_id, x: source.x, y: source.y });
    const missFrac = Math.max(0, 1 - target.hp / target.max_hp);
    const fin = 1 + 0.35 * missFrac;
    const base = evalL7Base(ab.l7_formula, source.stats.atk, source.stats.pow);
    queueDamage(state, source, target, skill_id, base, true, fin, c);
    source.break_until = state.t + 2.8;
    source.status.break_until = state.t + 2.8;
    source.commit_until = state.t + 2.8;
    return;
  }

  if (source.champ === "isra" && skill === "R") {
    // Delayed land 1.2 s
    pendingLands.push({
      land_t: state.t + 1.2,
      spawn_seq: source.cast_seq,
      source_id: source.id,
      skill: "R",
      skill_id,
      aim_x,
      aim_y,
      radius: ab.radius ?? 3.4,
      target_id: null,
      champ: "isra",
    });
    emit("projectile_spawn", {
      proj_id: `israR:${source.id}:${state.tick}`,
      unit_id: source.id,
      skill_id,
      x: aim_x,
      y: aim_y,
      land_t: state.t + 1.2,
    });
    return;
  }

  if (source.champ === "tolle" && skill === "W") {
    // Single-target banish; radius 0 — only selected target
    if (!target || !target.alive) return;
    const radius = ab.radius ?? 0;
    if (radius === 0) {
      applyKitCc(state, c, source, target, ab, emit);
    } else {
      for (const v of unitsInRadius(state, target.x, target.y, radius, () => true)) {
        if (v.id === source.id) continue;
        applyKitCc(state, c, source, v, ab, emit);
      }
    }
    return;
  }

  if (source.champ === "sedge" && skill === "R") {
    const radius = ab.radius ?? 3.8;
    const victims = unitsInRadius(state, aim_x, aim_y, radius, (u) => u.id !== source.id);
    for (const v of victims) {
      if (isBanished(v.status)) continue;
      // Allies and enemies (except caster)
      applyKitCc(state, c, source, v, ab, emit);
      const base = evalL7Base(ab.l7_formula, source.stats.atk, source.stats.pow);
      if (v.team !== source.team) {
        queueDamage(state, source, v, skill_id, base, false, 1, c);
      }
    }
    return;
  }

  if (source.champ === "ysol" && skill === "W") {
    if (!target || !target.alive) return;
    const removed = strongDispel(target.status);
    emit("dispel", { source_id: source.id, target_id: target.id, kind: "strong", removed });
    // Heal
    const healBase = (65 + 0.35 * source.stats.pow) * skillScale(source.level);
    // applied via pending heal path — simplify: direct HP + assist
    const inCombat =
      state.t - target.last_damage_t <= c.COMBAT_HEAL_WINDOW_S ||
      state.t - target.last_dealt_t <= c.COMBAT_HEAL_WINDOW_S;
    const applied = inCombat ? healBase * c.COMBAT_HEAL_SCALE : healBase;
    target.hp = Math.min(target.max_hp, target.hp + applied);
    recordAssistCredit(target, source.id, state.t, "heal");
    emit("heal", { source_id: source.id, target_id: target.id, amount: applied });
    return;
  }

  if (source.champ === "saelo" && skill === "W") {
    if (!target || !target.alive) return;
    const removed = basicDispel(target.status);
    emit("dispel", { source_id: source.id, target_id: target.id, kind: "basic", removed });
    const healBase = (65 + 0.35 * source.stats.pow) * skillScale(source.level);
    const inCombat =
      state.t - target.last_damage_t <= c.COMBAT_HEAL_WINDOW_S ||
      state.t - target.last_dealt_t <= c.COMBAT_HEAL_WINDOW_S;
    const applied = inCombat ? healBase * c.COMBAT_HEAL_SCALE : healBase;
    target.hp = Math.min(target.max_hp, target.hp + applied);
    recordAssistCredit(target, source.id, state.t, "heal");
    emit("heal", { source_id: source.id, target_id: target.id, amount: applied });
    return;
  }

  if (source.champ === "saelo" && skill === "R") {
    const radius = ab.radius ?? 2.4;
    const victims = unitsInRadius(state, aim_x, aim_y, radius, (u) => u.id !== source.id);
    for (const v of victims) {
      applyKitCc(state, c, source, v, ab, emit);
      if (v.team !== source.team) {
        const base = evalL7Base(ab.l7_formula, source.stats.atk, source.stats.pow);
        queueDamage(state, source, v, skill_id, base, false, 1, c);
      }
    }
    return;
  }

  if (source.champ === "brannoch" && skill === "R") {
    const radius = ab.radius ?? 2.6;
    const cx = source.x;
    const cy = source.y;
    const victims = unitsInRadius(state, cx, cy, radius, (u) => u.team !== source.team);
    for (const v of victims) {
      applyKitCc(state, c, source, v, ab, emit, { petrify: true });
      const base = evalL7Base(ab.l7_formula, source.stats.atk, source.stats.pow);
      queueDamage(state, source, v, skill_id, base, false, 1, c);
    }
    return;
  }

  if (source.champ === "mirren" && skill === "W") {
    if (!target || !target.alive) return;
    const radius = ab.radius ?? 0;
    const applyOne = (v: UnitState) => {
      applyKitCc(state, c, source, v, ab, emit, { slow: 0.35, hex_from: source.id });
    };
    if (radius === 0) applyOne(target);
    else {
      for (const v of unitsInRadius(state, target.x, target.y, radius, (u) => u.team !== source.team)) {
        applyOne(v);
      }
    }
    return;
  }

  if (source.champ === "calder" && skill === "W") {
    // Self only, radius 0
    const radius = ab.radius ?? 0;
    emit("cast_resolve", { unit_id: source.id, skill_id, radius });
    return;
  }

  // Generic: if has formula + target/AoE, deal damage; apply cc
  if (ab.l7_formula && target) {
    const base = evalL7Base(ab.l7_formula, source.stats.atk, source.stats.pow);
    const physical = ab.school === "physical";
    queueDamage(state, source, target, skill_id, base, physical, 1, c);
    applyKitCc(state, c, source, target, ab, emit);
  } else if (ab.cc && target) {
    applyKitCc(state, c, source, target, ab, emit);
  }
}

export function tickCasts(
  state: MatchState,
  pendingLands: PendingSkillLand[],
  c: Constants,
  rng: RngBank,
  emit: (type: string, payload: Record<string, unknown>) => void,
): void {
  for (const u of state.units) {
    if (!u.alive) continue;
    const paused = isTimeStopped(u.status);

    // CDs pause under time-stop
    if (!paused) {
      if (u.cd_q > 0) u.cd_q = Math.max(0, u.cd_q - c.DT);
      if (u.cd_w > 0) u.cd_w = Math.max(0, u.cd_w - c.DT);
      if (u.cd_r > 0) u.cd_r = Math.max(0, u.cd_r - c.DT);
    }

    if (u.cast_left > 0) {
      if (paused) continue; // cast windup pauses
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

    if (p.champ === "isra" && p.skill === "R") {
      const clip = clipPointAoE(source.team, p.aim_x, p.aim_y, c);
      if (clip.clipped) {
        emit("sanctuary_clip", {
          source_id: source.id,
          skill_id: p.skill_id,
          reason: "aoe",
        });
      }
      const victims = unitsInRadius(state, clip.land_x, clip.land_y, p.radius, (u) => u.team !== source.team);
      const ab = abilityOf("isra", "R");
      const base = evalL7Base(ab.l7_formula, source.stats.atk, source.stats.pow);
      for (const v of victims) {
        // No damage in own sanctuary from enemies
        if (inOwnSanctuary(v.team, v.x, v.y, c)) {
          emit("sanctuary_clip", {
            source_id: source.id,
            skill_id: p.skill_id,
            reason: "aoe",
            target_id: v.id,
          });
          continue;
        }
        if (isBanished(v.status)) continue;
        queueDamage(state, source, v, p.skill_id, base, true, 1, c);
      }
    }
  }
  return keep;
}

/** Process scripted_casts whose tick === state.tick. */
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

/** Lab: N skillshot rolls through sim RNG + HIT constants (M1-19b). */
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
    const hit = rollSkillshotHit(rng, source.attrs.aim, target.attrs.reflexes, c, unitKeyFromId(source.id));
    bits.push(hit ? 1 : 0);
    if (hit) hits += 1;
    emit("skillshot_roll", {
      source_id: source.id,
      target_id: target.id,
      hit,
      skill_id: "lab_skillshot",
      i,
    });
  }
  return { hits, bits };
}
