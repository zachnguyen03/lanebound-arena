import { digestEvents } from "@sim/canonical";
import { statsAtLevel } from "@sim/stats";
import type { SimEvent as CoreSimEvent } from "@sim/types";
import {
  isStatusIconKind,
  skillMetaByName,
} from "./skill-meta";
import { autoProjectileKey, skillVfxRecipe } from "./skill-vfx";
import { DUMMY_MAX_HP, spawnPose, unitId } from "./spawn";
import { ULT_AFTER_HIT_S, ULT_PRE_HIT_MAX_S, ULT_RULES } from "./ult-vfx";
import type {
  HitFlashFx,
  KillBurstFx,
  MatchEffects,
  MatchViewState,
  ProjectileFx,
  SimEvent,
  SkillTagFx,
  Slot,
  StatusIconFx,
  Team,
  TelegraphFx,
  UltFx,
  UltPulseFx,
  UnitId,
  UnitView,
} from "./types";
import { CHAMP_ART, SLOTS } from "./types";

const SKILL_TAG_DUR = 0.8;
const HIT_FLASH_DUR = 0.22;
const ULT_PULSE_DUR = 0.28;
const CASTER_FLASH_DUR = 0.22;

/**
 * Pure replay: derive MatchViewState at tick T from the event log only.
 * Never invokes the sim core and never mutates the source events array.
 */
export class ReplayEngine {
  readonly events: readonly SimEvent[];
  readonly digest: string;
  readonly maxTick: number;
  readonly eventsByTick: ReadonlyMap<number, readonly SimEvent[]>;
  readonly indexBySeq: ReadonlyMap<number, number>;

  /** Slugs that have a body sheet. Everyone else stays a labelled circle. */
  readonly knownArt: ReadonlySet<string>;

  constructor(events: SimEvent[], knownArt: ReadonlySet<string> = CHAMP_ART) {
    this.knownArt = knownArt;
    this.events = Object.freeze(events.slice());
    this.digest = digestEvents(this.events as CoreSimEvent[]);
    let maxTick = 0;
    const byTick = new Map<number, SimEvent[]>();
    const bySeq = new Map<number, number>();
    for (let i = 0; i < this.events.length; i++) {
      const ev = this.events[i]!;
      maxTick = Math.max(maxTick, ev.tick);
      const list = byTick.get(ev.tick);
      if (list) list.push(ev);
      else byTick.set(ev.tick, [ev]);
      bySeq.set(ev.seq, i);
    }
    this.maxTick = maxTick;
    this.eventsByTick = byTick;
    this.indexBySeq = bySeq;
  }

  /** Recompute digest from a fresh parse of the same events — must match. */
  verifyDigestUnchanged(): { before: string; after: string; ok: boolean } {
    const after = digestEvents(this.events as CoreSimEvent[]);
    return { before: this.digest, after, ok: this.digest === after };
  }

  /** Cache for forward playback; invalidated on backward scrub. */
  private cache: { tick: number; state: MatchViewState; cursor: number } | null =
    null;

  stateAt(tick: number): MatchViewState {
    const t = Math.max(0, Math.min(tick, this.maxTick));
    if (this.cache && this.cache.tick === t) {
      return cloneState(this.cache.state);
    }
    let state: MatchViewState;
    let cursor: number;
    if (this.cache && this.cache.tick < t) {
      state = cloneState(this.cache.state);
      cursor = this.cache.cursor;
    } else {
      state = emptyState();
      cursor = 0;
    }
    while (cursor < this.events.length) {
      const ev = this.events[cursor]!;
      if (ev.tick > t) break;
      applyEvent(state, ev, this.knownArt);
      cursor += 1;
    }
    state.tick = t;
    state.t = t / 10;
    this.cache = { tick: t, state: cloneState(state), cursor };
    return state;
  }

  eventsUpTo(tick: number): SimEvent[] {
    return this.events.filter((e) => e.tick <= tick);
  }

  tickForSeq(seq: number): number | null {
    const idx = this.indexBySeq.get(seq);
    if (idx === undefined) return null;
    return this.events[idx]!.tick;
  }
}

function cloneEffects(e: MatchEffects): MatchEffects {
  return {
    telegraphs: e.telegraphs.map((x) => ({ ...x })),
    projectiles: e.projectiles.map((x) => ({ ...x })),
    hitFlashes: e.hitFlashes.map((x) => ({ ...x })),
    statuses: e.statuses.map((x) => ({ ...x })),
    skillTags: e.skillTags.map((x) => ({ ...x })),
    ultPulses: e.ultPulses.map((x) => ({ ...x })),
    casterFlashes: e.casterFlashes.map((x) => ({ ...x })),
    ults: e.ults.map((x) => ({ ...x })),
    killBursts: e.killBursts.map((x) => ({ ...x })),
  };
}

function emptyEffects(): MatchEffects {
  return {
    telegraphs: [],
    projectiles: [],
    hitFlashes: [],
    statuses: [],
    skillTags: [],
    ultPulses: [],
    casterFlashes: [],
    ults: [],
    killBursts: [],
  };
}

function cloneState(s: MatchViewState): MatchViewState {
  const units = {} as Record<UnitId, UnitView>;
  for (const id of Object.keys(s.units) as UnitId[]) {
    units[id] = { ...s.units[id]! };
  }
  return {
    ...s,
    units,
    blueLineup: s.blueLineup.slice(),
    redLineup: s.redLineup.slice(),
    fallbackChamps: s.fallbackChamps.slice(),
    orbs: s.orbs.map((o) => ({ ...o })),
    buffs: s.buffs.map((o) => ({ ...o })),
    fightBlue: s.fightBlue ? { ...s.fightBlue } : null,
    fightRed: s.fightRed ? { ...s.fightRed } : null,
    effects: cloneEffects(s.effects),
    streaks: { ...s.streaks },
    lastKillT: { ...s.lastKillT },
  };
}

/** Active VFX intervals at sim time `t` (inclusive start, exclusive end). */
export function activeEffectsAt(
  effects: MatchEffects,
  t: number,
): {
  telegraphs: TelegraphFx[];
  projectiles: ProjectileFx[];
  hitFlashes: HitFlashFx[];
  statuses: StatusIconFx[];
  skillTags: SkillTagFx[];
  ultPulses: UltPulseFx[];
  casterFlashes: import("./types").CasterFlashFx[];
  ults: UltFx[];
  killBursts: KillBurstFx[];
} {
  const live = <T extends { startedAt: number; endsAt: number }>(list: T[]) =>
    list.filter((x) => x.startedAt <= t && t < x.endsAt);
  return {
    telegraphs: live(effects.telegraphs),
    projectiles: effects.projectiles.filter(
      (p) => p.spawnT <= t && t < p.endedAt,
    ),
    hitFlashes: live(effects.hitFlashes),
    statuses: live(effects.statuses),
    skillTags: live(effects.skillTags),
    ultPulses: live(effects.ultPulses),
    casterFlashes: live(effects.casterFlashes),
    ults: live(effects.ults),
    killBursts: live(effects.killBursts),
  };
}

function emptyState(): MatchViewState {
  const units = {} as Record<UnitId, UnitView>;
  for (const team of ["blue", "red"] as Team[]) {
    for (const slot of SLOTS) {
      const id = unitId(team, slot);
      const pose = spawnPose(team, slot);
      units[id] = {
        id,
        team,
        slot,
        champ: "unknown",
        x: pose.x,
        y: pose.y,
        vx: 0,
        vy: 0,
        hp: DUMMY_MAX_HP,
        maxHp: DUMMY_MAX_HP,
        xp: 0,
        level: 1,
        alive: true,
        respawnAt: null,
        facing: team === "blue" ? "right" : "left",
        hitStartedAt: null,
        attackStartedAt: null,
        castStartedAt: null,
        castDur: 0,
        castSkill: null,
        deathStartedAt: null,
        fallback: true,
        intent: null,
        targetId: null,
      };
    }
  }
  return {
    tick: 0,
    t: 0,
    seed: null,
    constantsHash: null,
    scoreBlue: 0,
    scoreRed: 0,
    ended: false,
    endReason: null,
    winner: null,
    units,
    blueLineup: [],
    redLineup: [],
    fallbackChamps: [],
    zoneOwner: null,
    orbs: [],
    buffs: [],
    fightBlue: null,
    fightRed: null,
    effects: emptyEffects(),
    streaks: {},
    lastKillT: {},
  };
}

function applyEvent(
  state: MatchViewState,
  ev: SimEvent,
  knownArt: ReadonlySet<string>,
): void {
  switch (ev.type) {
    case "match_start": {
      state.seed = typeof ev.seed === "number" ? ev.seed : null;
      state.constantsHash =
        typeof ev.constants_hash === "string" ? ev.constants_hash : null;
      const blue = Array.isArray(ev.blue_lineup)
        ? (ev.blue_lineup as string[])
        : [];
      const red = Array.isArray(ev.red_lineup) ? (ev.red_lineup as string[]) : [];
      state.blueLineup = blue;
      state.redLineup = red;
      applyLineup(state, "blue", blue, knownArt);
      applyLineup(state, "red", red, knownArt);
      break;
    }
    case "pos":
    case "move": {
      const u = getUnit(state, ev.unit_id);
      if (!u) break;
      if (typeof ev.x === "number") u.x = ev.x;
      if (typeof ev.y === "number") u.y = ev.y;
      if (typeof ev.vx === "number") u.vx = ev.vx;
      if (typeof ev.vy === "number") u.vy = ev.vy;
      // Facing from movement; hold last while idle.
      if (typeof ev.vx === "number" && Math.abs(ev.vx) > 1e-6) {
        u.facing = ev.vx > 0 ? "right" : "left";
      }
      break;
    }
    case "xp_gain": {
      const u = getUnit(state, ev.unit_id);
      if (!u) break;
      if (typeof ev.amount === "number") u.xp += ev.amount;
      break;
    }
    case "level_up": {
      const u = getUnit(state, ev.unit_id);
      if (!u) break;
      if (typeof ev.new_level === "number") {
        u.level = ev.new_level;
        try {
          const s = statsAtLevel(u.champ, u.level);
          const gained = s.hp - u.maxHp;
          u.maxHp = s.hp;
          u.hp = Math.min(s.hp, u.hp + Math.max(0, gained));
        } catch {
          /* unknown champ keeps the previous bar */
        }
      }
      break;
    }
    case "hit": {
      const u = getUnit(state, ev.target_id);
      if (u) {
        if (typeof ev.hp_after === "number") u.hp = ev.hp_after;
        if (u.alive) u.hitStartedAt = ev.t;
      }
      const src = getUnit(state, ev.source_id);
      if (src?.alive && (ev.skill_id === "auto" || ev.skill_id === "attack")) {
        src.attackStartedAt = ev.t;
      }
      applyHitFx(state, ev);
      break;
    }
    case "cast_start": {
      const u = getUnit(state, ev.unit_id);
      if (!u) break;
      u.castStartedAt = ev.t;
      u.castSkill = typeof ev.skill_id === "string" ? ev.skill_id : "";
      u.castDur = typeof ev.cast_time === "number" ? ev.cast_time : 0.4;
      applyCastStartFx(state, u, ev);
      applyUltCastStart(state, u, ev);
      break;
    }
    case "cast_cancel": {
      const u = getUnit(state, ev.unit_id);
      if (!u) break;
      u.castStartedAt = null;
      u.castSkill = null;
      u.castDur = 0;
      applyCastCancelFx(state, u.id, ev.t);
      cancelPendingUlt(state, u.id, ev.t);
      break;
    }
    case "cast_end": {
      applyUltCastEnd(state, ev);
      applyCastEndFx(state, ev);
      break;
    }
    case "projectile_spawn": {
      applyUltLand(state, ev);
      applyProjectileSpawnFx(state, ev);
      break;
    }
    case "status_apply": {
      applyStatusApplyFx(state, ev);
      break;
    }
    case "status_expire": {
      applyStatusExpireFx(state, ev);
      break;
    }
    case "shield_apply": {
      applyShieldFx(state, ev);
      break;
    }
    case "death": {
      const u = getUnit(state, ev.unit_id);
      if (!u) break;
      u.alive = false;
      u.hp = 0;
      u.vx = 0;
      u.vy = 0;
      u.respawnAt = typeof ev.respawn_at === "number" ? ev.respawn_at : null;
      u.deathStartedAt = ev.t;
      u.hitStartedAt = null;
      endStatusesOnUnit(state, u.id, ev.t);
      applyCastCancelFx(state, u.id, ev.t);
      cancelPendingUlt(state, u.id, ev.t);
      applyKillBurst(state, u, ev);
      break;
    }
    case "respawn": {
      const u = getUnit(state, ev.unit_id);
      if (!u) break;
      u.alive = true;
      u.hp = u.maxHp;
      u.respawnAt = null;
      u.hitStartedAt = null;
      u.attackStartedAt = null;
      u.castStartedAt = null;
      u.castSkill = null;
      u.castDur = 0;
      u.deathStartedAt = null;
      u.vx = 0;
      u.vy = 0;
      if (typeof ev.x === "number") u.x = ev.x;
      if (typeof ev.y === "number") u.y = ev.y;
      break;
    }
    case "takedown_score": {
      if (ev.team === "blue" && typeof ev.score_after === "number") {
        state.scoreBlue = ev.score_after;
      }
      if (ev.team === "red" && typeof ev.score_after === "number") {
        state.scoreRed = ev.score_after;
      }
      break;
    }
    case "zone_tick":
    case "claim_award": {
      if (ev.team === "blue" && typeof ev.score_after === "number") {
        state.scoreBlue = ev.score_after;
      }
      if (ev.team === "red" && typeof ev.score_after === "number") {
        state.scoreRed = ev.score_after;
      }
      break;
    }
    case "zone_capture": {
      if (ev.team === "blue" || ev.team === "red") state.zoneOwner = ev.team;
      break;
    }
    case "orb_spawn": {
      if (typeof ev.orb_id === "string" && typeof ev.x === "number") {
        state.orbs = state.orbs.filter((o) => o.id !== ev.orb_id);
        state.orbs.push({
          id: ev.orb_id,
          x: ev.x,
          y: typeof ev.y === "number" ? ev.y : 0,
          up: true,
        });
      }
      break;
    }
    case "orb_pickup": {
      const id = ev.orb_id;
      if (typeof id === "string") {
        const o = state.orbs.find((x) => x.id === id);
        if (o) o.up = false;
      }
      break;
    }
    case "buff_spawn": {
      if (typeof ev.buff_id === "string" && typeof ev.x === "number") {
        state.buffs = state.buffs.filter((o) => o.id !== ev.buff_id);
        state.buffs.push({
          id: ev.buff_id,
          x: ev.x,
          y: typeof ev.y === "number" ? ev.y : 0,
          up: true,
        });
      }
      break;
    }
    case "buff_pickup": {
      const id = ev.buff_id;
      if (typeof id === "string") {
        const o = state.buffs.find((x) => x.id === id);
        if (o) o.up = false;
      }
      break;
    }
    case "intent": {
      const u = getUnit(state, ev.unit_id);
      if (!u) break;
      if (typeof ev.intent === "string") u.intent = ev.intent;
      u.targetId = typeof ev.target_id === "string" ? ev.target_id : null;
      break;
    }
    case "fight_call": {
      const view = {
        commit: typeof ev.commit === "string" ? ev.commit : "",
        focusId: typeof ev.focus_id === "string" ? ev.focus_id : null,
        aTrue: typeof ev.a_true === "number" ? ev.a_true : null,
      };
      if (ev.team === "blue") state.fightBlue = view;
      if (ev.team === "red") state.fightRed = view;
      break;
    }
    case "match_end": {
      state.ended = true;
      state.endReason = typeof ev.reason === "string" ? ev.reason : null;
      state.winner =
        ev.winner === "blue" || ev.winner === "red" || ev.winner === "draw"
          ? ev.winner
          : null;
      if (typeof ev.score_blue === "number") state.scoreBlue = ev.score_blue;
      if (typeof ev.score_red === "number") state.scoreRed = ev.score_red;
      break;
    }
    default:
      break;
  }
}

function telegraphKindFromRecipe(
  style: string,
): TelegraphFx["kind"] {
  switch (style) {
    case "aoe":
    case "cone":
    case "self":
    case "dash":
    case "dotted-leash":
    case "double-ring":
      return style;
    default:
      return "line";
  }
}

function applyCastStartFx(
  state: MatchViewState,
  u: UnitView,
  ev: SimEvent,
): void {
  const skillId = typeof ev.skill_id === "string" ? ev.skill_id : "";
  const meta = skillMetaByName(skillId);
  const recipe = skillVfxRecipe(u.champ, skillId);
  const castTime =
    typeof ev.cast_time === "number" ? ev.cast_time : meta?.cast_s ?? 0.4;
  const aimX =
    typeof ev.x === "number"
      ? ev.x
      : typeof ev.target_id === "string"
        ? (getUnit(state, ev.target_id)?.x ?? u.x)
        : u.x;
  const aimY =
    typeof ev.y === "number"
      ? ev.y
      : typeof ev.target_id === "string"
        ? (getUnit(state, ev.target_id)?.y ?? u.y)
        : u.y;
  const targetId = typeof ev.target_id === "string" ? ev.target_id : null;
  const id = `cast:${u.id}:${ev.seq}`;
  // Close any open telegraph for this caster.
  applyCastCancelFx(state, u.id, ev.t);
  state.effects.telegraphs.push({
    id,
    unitId: u.id,
    champ: u.champ,
    team: u.team,
    skillId,
    skillKey: meta?.key ?? "?",
    kind: telegraphKindFromRecipe(recipe.telegraph),
    isUlt: !!recipe.ultEmphasis || meta?.key === "R",
    startedAt: ev.t,
    endsAt: ev.t + Math.max(castTime, 0.05),
    aimX,
    aimY,
    targetId,
    radius: meta?.radius ?? 0,
    width: meta?.width ?? 0.6,
    groundFx: recipe.groundFx,
  });
  // At most one floating skill tag per caster.
  for (const tag of state.effects.skillTags) {
    if (tag.unitId === u.id && tag.endsAt > ev.t && tag.startedAt <= ev.t) {
      tag.endsAt = ev.t;
    }
  }
  state.effects.skillTags.push({
    id: `tag:${id}`,
    unitId: u.id,
    team: u.team,
    skillKey: meta?.key ?? "?",
    skillName: skillId || meta?.name || "?",
    startedAt: ev.t,
    endsAt: ev.t + SKILL_TAG_DUR,
  });
  state.effects.casterFlashes.push({
    id: `flash:${id}`,
    unitId: u.id,
    team: u.team,
    isUlt: !!recipe.ultEmphasis || meta?.key === "R",
    startedAt: ev.t,
    endsAt: ev.t + CASTER_FLASH_DUR,
  });
  if (recipe.ultEmphasis || meta?.key === "R") {
    state.effects.ultPulses.push({
      id: `ult:${id}`,
      unitId: u.id,
      team: u.team,
      x: u.x,
      y: u.y,
      startedAt: ev.t,
      endsAt: ev.t + ULT_PULSE_DUR,
    });
  }
}

/** Signature ult: open an instance at cast_start (handoff anchor rules). */
function applyUltCastStart(
  state: MatchViewState,
  u: UnitView,
  ev: SimEvent,
): void {
  const rule = ULT_RULES[u.champ];
  if (!rule) return;
  const skillId = typeof ev.skill_id === "string" ? ev.skill_id : "";
  if (skillMetaByName(skillId)?.key !== "R") return;
  const target = getUnit(state, ev.target_id);
  const aimX = typeof ev.x === "number" ? ev.x : (target?.x ?? u.x);
  const aimY = typeof ev.y === "number" ? ev.y : (target?.y ?? u.y);
  const anchor =
    rule.anchor === "caster"
      ? { x: u.x, y: u.y }
      : rule.anchor === "target" && target
        ? { x: target.x, y: target.y }
        : { x: aimX, y: aimY };
  const dirX = aimX - u.x;
  const dirY = aimY - u.y;
  state.effects.ults.push({
    id: `ultfx:${u.id}:${ev.seq}`,
    unitId: u.id,
    champ: u.champ,
    team: u.team,
    startedAt: ev.t,
    endsAt: ev.t + ULT_PRE_HIT_MAX_S + ULT_AFTER_HIT_S,
    hitT: null,
    anchorX: anchor.x,
    anchorY: anchor.y,
    dirX,
    dirY,
    facingLeft: Math.abs(dirX) > 0.05 ? dirX < 0 : u.facing === "left",
    targetId: target?.id ?? null,
  });
}

function pendingUlt(state: MatchViewState, unitId: unknown): UltFx | null {
  for (let i = state.effects.ults.length - 1; i >= 0; i--) {
    const fx = state.effects.ults[i]!;
    if (fx.unitId === unitId && fx.hitT == null) return fx;
  }
  return null;
}

/** Instant ults hit on cast_end; anchors resolve to where bodies are now. */
function applyUltCastEnd(state: MatchViewState, ev: SimEvent): void {
  const fx = pendingUlt(state, ev.unit_id);
  if (!fx) return;
  const skillId = typeof ev.skill_id === "string" ? ev.skill_id : "";
  if (skillId && skillMetaByName(skillId)?.key !== "R") return;
  const rule = ULT_RULES[fx.champ];
  const caster = getUnit(state, fx.unitId);
  const target = getUnit(state, fx.targetId);
  if (rule?.anchor === "caster" && caster) {
    fx.anchorX = caster.x;
    fx.anchorY = caster.y;
  } else if (rule?.anchor === "target" && target) {
    fx.anchorX = target.x;
    fx.anchorY = target.y;
  }
  // Delayed lands (Isra, Tolle) take their hit time from projectile_spawn.
  if (fx.champ === "isra" || fx.champ === "tolle") return;
  fx.hitT = ev.t;
  fx.endsAt = ev.t + ULT_AFTER_HIT_S;
}

function applyUltLand(state: MatchViewState, ev: SimEvent): void {
  if (typeof ev.land_t !== "number") return;
  const fx = pendingUlt(state, ev.unit_id);
  if (!fx || (fx.champ !== "isra" && fx.champ !== "tolle")) return;
  if (typeof ev.x === "number") fx.anchorX = ev.x;
  if (typeof ev.y === "number") fx.anchorY = ev.y;
  fx.hitT = ev.land_t;
  fx.endsAt = ev.land_t + ULT_AFTER_HIT_S;
}

function cancelPendingUlt(state: MatchViewState, unitId: UnitId, t: number): void {
  const fx = pendingUlt(state, unitId);
  if (fx) fx.endsAt = t;
}

/** Shared kill burst. Shutdown: victim on a 3+ streak, or killer's 2nd kill in 4 s. */
const SHUTDOWN_STREAK = 3;
const MULTI_KILL_S = 4;
const KILL_BURST_S = 0.7;

function applyKillBurst(state: MatchViewState, victim: UnitView, ev: SimEvent): void {
  const killer = getUnit(state, ev.killer_id);
  const victimStreak = state.streaks[victim.id] ?? 0;
  const last = killer ? state.lastKillT[killer.id] : undefined;
  const shutdown =
    victimStreak >= SHUTDOWN_STREAK ||
    (last !== undefined && ev.t - last <= MULTI_KILL_S);
  state.streaks[victim.id] = 0;
  if (killer) {
    state.streaks[killer.id] = (state.streaks[killer.id] ?? 0) + 1;
    state.lastKillT[killer.id] = ev.t;
  }
  state.effects.killBursts.push({
    id: `kill:${ev.seq}`,
    victimId: victim.id,
    team: killer?.team ?? (victim.team === "blue" ? "red" : "blue"),
    shutdown,
    x: victim.x,
    y: victim.y,
    startedAt: ev.t,
    endsAt: ev.t + KILL_BURST_S,
  });
}

function applyCastCancelFx(
  state: MatchViewState,
  unitId: UnitId,
  t: number,
): void {
  for (const tele of state.effects.telegraphs) {
    if (tele.unitId === unitId && tele.endsAt > t && tele.startedAt <= t) {
      tele.endsAt = t;
    }
  }
}

/**
 * Instant skillshots do not emit projectile_spawn. After cast_end, fly the
 * atlas projectile toward aim / target until a matching hit or a short cap.
 */
function applyCastEndFx(state: MatchViewState, ev: SimEvent): void {
  const unit = getUnit(state, ev.unit_id);
  if (!unit) return;
  const skillId =
    typeof ev.skill_id === "string"
      ? ev.skill_id
      : unit.castSkill ?? "";
  if (!skillId || skillId === "auto") return;
  const recipe = skillVfxRecipe(unit.champ, skillId);
  const artKey =
    recipe.projectile ??
    (recipe.huntressProjectile
      ? `projectile-${recipe.huntressProjectile}`
      : null);
  if (!artKey && !recipe.smear) return;
  // Delayed lands already emitted projectile_spawn on this cast.
  const recentSpawn = state.effects.projectiles.some(
    (p) =>
      p.unitId === unit.id &&
      p.skillId === skillId &&
      Math.abs(p.spawnT - ev.t) < 0.05,
  );
  if (recentSpawn) return;
  if (!artKey) return;

  const openTele = [...state.effects.telegraphs]
    .reverse()
    .find((t) => t.unitId === unit.id && t.skillId === skillId);
  const aimX = openTele?.aimX ?? unit.x;
  const aimY = openTele?.aimY ?? unit.y;
  const target = openTele?.targetId
    ? getUnit(state, openTele.targetId)
    : null;
  const toX = target?.x ?? aimX;
  const toY = target?.y ?? aimY;
  const dx = toX - unit.x;
  const dy = toY - unit.y;
  const dist = Math.hypot(dx, dy);
  // Viewer flight only — sim resolved instantly. 18 tiles/s matches auto missiles.
  const travel = Math.min(0.45, Math.max(0.08, dist / 18));
  // Close telegraph at release.
  applyCastCancelFx(state, unit.id, ev.t);
  state.effects.projectiles.push({
    projId: `castend:${unit.id}:${ev.seq}`,
    unitId: unit.id,
    champ: unit.champ,
    team: unit.team,
    skillId,
    isAuto: false,
    artKey,
    trail: recipe.trail,
    spawnT: ev.t,
    landT: ev.t + travel,
    fromX: unit.x,
    fromY: unit.y,
    toX,
    toY,
    endedAt: ev.t + travel,
  });
}

function applyProjectileSpawnFx(state: MatchViewState, ev: SimEvent): void {
  const unit = getUnit(state, ev.unit_id);
  if (!unit) return;
  const skillId = typeof ev.skill_id === "string" ? ev.skill_id : "auto";
  const isAuto = skillId === "auto" || skillId === "attack";
  const spawnT = ev.t;
  const landT =
    typeof ev.land_t === "number" ? ev.land_t : spawnT + 0.2;
  const fromX = typeof ev.x === "number" ? ev.x : unit.x;
  const fromY = typeof ev.y === "number" ? ev.y : unit.y;
  let toX = fromX;
  let toY = fromY;
  const recipe = isAuto
    ? null
    : skillVfxRecipe(unit.champ, skillId);
  if (isAuto) {
    const tgt =
      (unit.targetId ? getUnit(state, unit.targetId) : null) ?? null;
    if (tgt) {
      toX = tgt.x;
      toY = tgt.y;
    }
  } else if (typeof ev.x === "number" && typeof ev.y === "number") {
    // Delayed skill land: event x,y is the aim / land point.
    // Travel from caster at spawn toward that point.
    toX = ev.x;
    toY = ev.y;
    // from = caster feet at spawn
  }
  const fromCasterX = unit.x;
  const fromCasterY = unit.y;
  const artKey = isAuto
    ? autoProjectileKey(unit.champ)
    : recipe?.projectile ??
      (recipe?.huntressProjectile
        ? `projectile-${recipe.huntressProjectile}`
        : null);
  const projId =
    typeof ev.proj_id === "string"
      ? ev.proj_id
      : `proj:${unit.id}:${ev.seq}`;
  state.effects.projectiles.push({
    projId,
    unitId: unit.id,
    champ: unit.champ,
    team: unit.team,
    skillId,
    isAuto,
    artKey,
    trail: recipe?.trail,
    spawnT,
    landT,
    fromX: isAuto ? fromX : fromCasterX,
    fromY: isAuto ? fromY : fromCasterY,
    toX,
    toY,
    endedAt: landT,
  });
}

function applyHitFx(state: MatchViewState, ev: SimEvent): void {
  const skillId = typeof ev.skill_id === "string" ? ev.skill_id : "";
  const isAuto = skillId === "auto" || skillId === "attack";
  const target = getUnit(state, ev.target_id);
  const source = getUnit(state, ev.source_id);
  if (!target) return;

  // Retarget open projectiles from this source toward the hit.
  if (source) {
    for (const p of state.effects.projectiles) {
      if (
        p.unitId === source.id &&
        p.skillId === skillId &&
        p.spawnT <= ev.t &&
        p.endedAt >= ev.t - 1e-9
      ) {
        p.toX = target.x;
        p.toY = target.y;
        p.endedAt = Math.min(p.endedAt, ev.t);
      }
    }
  }

  if (isAuto) return;

  const recipe = source
    ? skillVfxRecipe(source.champ, skillId)
    : { impact: [] as string[] };
  const id = `hit:${ev.seq}`;
  state.effects.hitFlashes.push({
    id,
    targetId: target.id,
    sourceId: source?.id ?? null,
    champ: source?.champ ?? target.champ,
    skillId,
    impactKeys: recipe.impact ?? [],
    startedAt: ev.t,
    endsAt: ev.t + HIT_FLASH_DUR,
  });
}

function applyStatusApplyFx(state: MatchViewState, ev: SimEvent): void {
  const kind = typeof ev.kind === "string" ? ev.kind : "";
  if (!kind) return;
  // Show designer plates for known kinds; shield handled separately.
  const show =
    isStatusIconKind(kind) ||
    [
      "sleep",
      "fear",
      "hex",
      "break",
      "banish",
      "timestop",
      "petrify",
      "knockup",
      "leash",
    ].includes(kind);
  if (!show) return;
  const target = getUnit(state, ev.target_id);
  if (!target) return;
  const dur =
    typeof ev.applied_duration === "number"
      ? ev.applied_duration
      : typeof ev.raw_duration === "number"
        ? ev.raw_duration
        : 0.5;
  const id = `status:${target.id}:${kind}:${ev.seq}`;
  // Refresh same kind on target.
  for (const s of state.effects.statuses) {
    if (
      s.targetId === target.id &&
      s.kind === kind &&
      s.endsAt > ev.t &&
      s.startedAt <= ev.t
    ) {
      s.endsAt = ev.t;
    }
  }
  const source = getUnit(state, ev.source_id);
  state.effects.statuses.push({
    id,
    targetId: target.id,
    sourceId: source?.id ?? null,
    kind,
    startedAt: ev.t,
    endsAt: ev.t + Math.max(dur, 0.05),
  });
}

function applyStatusExpireFx(state: MatchViewState, ev: SimEvent): void {
  const kind = typeof ev.kind === "string" ? ev.kind : "";
  const targetId = typeof ev.target_id === "string" ? ev.target_id : null;
  if (!targetId || !kind) return;
  for (const s of state.effects.statuses) {
    if (
      s.targetId === targetId &&
      s.kind === kind &&
      s.endsAt > ev.t &&
      s.startedAt <= ev.t
    ) {
      s.endsAt = ev.t;
    }
  }
}

function applyShieldFx(state: MatchViewState, ev: SimEvent): void {
  const target = getUnit(state, ev.target_id);
  if (!target) return;
  const endsAt =
    typeof ev.expires_at === "number" ? ev.expires_at : ev.t + 2.5;
  const id = `shield:${target.id}:${ev.seq}`;
  for (const s of state.effects.statuses) {
    if (
      s.targetId === target.id &&
      s.kind === "shield" &&
      s.endsAt > ev.t &&
      s.startedAt <= ev.t
    ) {
      s.endsAt = ev.t;
    }
  }
  state.effects.statuses.push({
    id,
    targetId: target.id,
    kind: "shield",
    startedAt: ev.t,
    endsAt,
  });
}

function endStatusesOnUnit(
  state: MatchViewState,
  unitId: UnitId,
  t: number,
): void {
  for (const s of state.effects.statuses) {
    if (s.targetId === unitId && s.endsAt > t) s.endsAt = t;
  }
}

function applyLineup(
  state: MatchViewState,
  team: Team,
  lineup: string[],
  knownArt: ReadonlySet<string>,
): void {
  const fallbacks = new Set(state.fallbackChamps);
  for (let i = 0; i < SLOTS.length; i++) {
    const slot = SLOTS[i]!;
    const champ = lineup[i] ?? "unknown";
    const id = unitId(team, slot);
    const u = state.units[id]!;
    u.champ = champ;
    u.attackStartedAt = null;
    u.castStartedAt = null;
    u.castSkill = null;
    u.castDur = 0;
    const hasArt = knownArt.has(champ);
    u.fallback = !hasArt;
    try {
      const s = statsAtLevel(champ, 1);
      u.maxHp = s.hp;
      u.hp = s.hp;
    } catch {
      u.maxHp = DUMMY_MAX_HP;
      u.hp = DUMMY_MAX_HP;
    }
    if (u.fallback) fallbacks.add(champ);
    else fallbacks.delete(champ);
    const pose = spawnPose(team, slot);
    u.x = pose.x;
    u.y = pose.y;
    u.vx = 0;
    u.vy = 0;
    u.level = 1;
    u.xp = 0;
    u.alive = true;
    u.facing = team === "blue" ? "right" : "left";
    u.hitStartedAt = null;
    u.deathStartedAt = null;
  }
  state.fallbackChamps = [...fallbacks].sort();
}

function getUnit(
  state: MatchViewState,
  id: unknown,
): UnitView | null {
  if (typeof id !== "string") return null;
  return state.units[id as UnitId] ?? null;
}

export function formatClock(tSeconds: number): string {
  const s = Math.max(0, Math.floor(tSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export type { Slot };
