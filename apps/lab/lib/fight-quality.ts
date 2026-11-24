/**
 * Fight-quality metrics F1–F4 — Appendix R #6 / S5-R6-8 (build-spec ~L2241).
 * Computed from the event log only. Lab layer — no sim/ edits.
 *
 * "Hard CC" (R6-8): stun, root, knockup, sleep, fear, taunt, hex, leash,
 * petrify, time-stop. Slows are not hard CC.
 */
import type { SimEvent } from "../../../sim/types.js";
import { statsAtLevel } from "../../../sim/stats.js";
import { CHAMPIONS } from "../../../data/champions/defs.js";
import type { FightQualityMetrics } from "./types.js";

export type { FightQualityMetrics };

const HARD_CC = new Set([
  "stun",
  "root",
  "knockup",
  "sleep",
  "fear",
  "taunt",
  "hex",
  "leash",
  "petrify",
  "time-stop",
  "timestop",
  "time_stop",
]);

/** F1: engagement gap (R6-8). */
export const ENGAGEMENT_GAP_S = 3.0;
/** F1: min teamfight duration (R6-8). */
export const TEAMFIGHT_MIN_S = 3.0;
/** F3: low-HP threshold (R6-8). */
export const CLUTCH_HP_FRAC = 0.15;
/** F3: escape survive window (R6-8). */
export const CLUTCH_SURVIVE_S = 5.0;
/** F3: dedupe window per unit (R6-8). */
export const CLUTCH_DEDUPE_S = 5.0;
/** F4: multikill windows (R6-8). */
export const DOUBLE_KILL_S = 6.0;
export const TRIPLE_KILL_S = 10.0;

export const FIGHT_QUALITY_DEFINITIONS: Record<
  keyof FightQualityMetrics,
  string
> = {
  f1_teamfights:
    "F1 (S5-R6-8): engagement = maximal run of cross-team hit/status_apply with gap ≤ 3.0 s; teamfight = engagement lasting ≥ 3.0 s with ≥ 3 distinct units per side (dealt or took damage). Count per game.",
  f2_combo_chains:
    "F2 (S5-R6-8): hard-CC status_apply by A on enemy X, then within min(CC duration+0.5 s, 2.0 s) damage on X from ≥ 2 distinct units of A's team (A counts), ≥ 1 skill hit (skill_id ≠ auto).",
  f3_clutch_moments:
    "F3 (S5-R6-8): (a) low-HP escape — hit to ≤ 15% max HP during a teamfight, alive 5.0 s later, once per unit per 5 s; plus (b) outnumbered win — at a teamfight's first death, the side with fewer living involved ends that fight with more takedowns.",
  f4_close_finish:
    "F4 (S5-R6-8): close = 1 if final margin ≤ 2 or end_reason is sudden_death, else 0.",
  lead_changes:
    "Companion: sign(score_blue−score_red) changes on takedown_score/zone_tick/claim_award.",
  contested_pit_share:
    "R6-5 pit contest proxy from the event log: share of fight_call events whose centroid is within ZONE_RADIUS of ZONE_CENTER. True “owned time that is contested” needs occupancy ticks (not exported); this is the lab stand-in.",
  f4_comeback:
    "F4 companion: 1 if winner trailed by ≥ 3 at some score point.",
  f4_shutout:
    "F4 companion: 1 if loser score is 0.",
  f4_multikills:
    "F4 companion: count of double-kill windows (same killer ≥ 2 deaths within 6.0 s).",
};

export function emptyFightQuality(): FightQualityMetrics {
  return {
    f1_teamfights: 0,
    f2_combo_chains: 0,
    f3_clutch_moments: 0,
    f4_close_finish: 0,
    lead_changes: 0,
    contested_pit_share: 0,
    f4_comeback: 0,
    f4_shutout: 0,
    f4_multikills: 0,
  };
}

function teamOf(unitId: string): "blue" | "red" | null {
  if (unitId.startsWith("blue:")) return "blue";
  if (unitId.startsWith("red:")) return "red";
  return null;
}

function slotChamp(
  unitId: string,
  blue: string[],
  red: string[],
): string | null {
  const slots = ["top", "jungle", "mid", "adc", "support"];
  const [side, slot] = unitId.split(":") as [string, string];
  const si = slots.indexOf(slot);
  if (si < 0) return null;
  return (side === "red" ? red : blue)[si] ?? null;
}

function isCrossTeamCombat(e: SimEvent): boolean {
  if (e.type === "hit") {
    if (Number(e.mitigated ?? 0) <= 0) return false;
    if (typeof e.source_id !== "string" || typeof e.target_id !== "string")
      return false;
    const a = teamOf(e.source_id);
    const b = teamOf(e.target_id);
    return a !== null && b !== null && a !== b;
  }
  if (e.type === "status_apply") {
    if (typeof e.source_id !== "string" || typeof e.target_id !== "string")
      return false;
    const a = teamOf(e.source_id);
    const b = teamOf(e.target_id);
    return a !== null && b !== null && a !== b;
  }
  return false;
}

interface Engagement {
  start: number;
  end: number;
  units: Set<string>;
  blue: Set<string>;
  red: Set<string>;
  events: SimEvent[];
}

function buildEngagements(events: SimEvent[]): Engagement[] {
  const combat = events
    .filter(isCrossTeamCombat)
    .sort((a, b) => a.t - b.t || a.seq - b.seq);
  const out: Engagement[] = [];
  let cur: Engagement | null = null;
  const addUnit = (eng: Engagement, id: string) => {
    eng.units.add(id);
    const tm = teamOf(id);
    if (tm === "blue") eng.blue.add(id);
    if (tm === "red") eng.red.add(id);
  };
  for (const e of combat) {
    if (!cur || e.t - cur.end > ENGAGEMENT_GAP_S) {
      if (cur) out.push(cur);
      cur = {
        start: e.t,
        end: e.t,
        units: new Set(),
        blue: new Set(),
        red: new Set(),
        events: [],
      };
    }
    cur.end = e.t;
    cur.events.push(e);
    if (typeof e.source_id === "string") addUnit(cur, e.source_id);
    if (typeof e.target_id === "string") addUnit(cur, e.target_id);
  }
  if (cur) out.push(cur);
  return out;
}

function isTeamfight(eng: Engagement): boolean {
  return (
    eng.end - eng.start >= TEAMFIGHT_MIN_S - 1e-9 &&
    eng.blue.size >= 3 &&
    eng.red.size >= 3
  );
}

export function computeFightQuality(
  events: SimEvent[],
  opts: {
    score_blue: number;
    score_red: number;
    blue_picks: string[];
    red_picks: string[];
    end_reason?: string | null;
    duration_s?: number;
  },
): FightQualityMetrics {
  const out = emptyFightQuality();
  const engagements = buildEngagements(events);
  const teamfights = engagements.filter(isTeamfight);
  out.f1_teamfights = teamfights.length;

  // Contested-pit share proxy: pit-centred fight_calls / all fight_calls
  let pitCalls = 0;
  let allCalls = 0;
  for (const e of events) {
    if (e.type !== "fight_call") continue;
    allCalls += 1;
    const cx = Number(e.centroid_x);
    const cy = Number(e.centroid_y);
    if (Number.isFinite(cx) && Number.isFinite(cy)) {
      if (Math.hypot(cx - 12, cy - 8) <= 3.0 + 1e-9) pitCalls += 1;
    }
  }
  out.contested_pit_share = allCalls > 0 ? pitCalls / allCalls : 0;

  // --- F2 combo chains ---
  const level: Record<string, number> = {};
  const champOf: Record<string, string> = {};
  const alive = new Set<string>();
  for (const slot of ["top", "jungle", "mid", "adc", "support"]) {
    for (const side of ["blue", "red"] as const) {
      const id = `${side}:${slot}`;
      alive.add(id);
      level[id] = 1;
      const ch = slotChamp(id, opts.blue_picks, opts.red_picks);
      if (ch && CHAMPIONS[ch]) champOf[id] = ch;
    }
  }
  const maxHpOf = (uid: string): number => {
    const ch = champOf[uid];
    if (!ch) return 900;
    return statsAtLevel(ch, level[uid] ?? 1).hp;
  };

  let combos = 0;
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    if (e.type !== "status_apply") continue;
    const kind = String(e.kind ?? e.status ?? e.status_id ?? "").toLowerCase();
    if (!HARD_CC.has(kind)) continue;
    if (typeof e.source_id !== "string" || typeof e.target_id !== "string")
      continue;
    const a = e.source_id;
    const x = e.target_id;
    const tm = teamOf(a);
    if (!tm || teamOf(x) === tm) continue;
    const dur = Number(e.duration_s ?? e.duration ?? 1.0);
    const window = Math.min((Number.isFinite(dur) ? dur : 1) + 0.5, 2.0);
    const damagers = new Set<string>();
    let skillHit = false;
    for (let j = i + 1; j < events.length; j++) {
      const h = events[j]!;
      if (h.t - e.t > window + 1e-9) break;
      if (h.type !== "hit") continue;
      if (h.target_id !== x) continue;
      if (typeof h.source_id !== "string") continue;
      if (teamOf(h.source_id) !== tm) continue;
      if (Number(h.mitigated ?? 0) <= 0) continue;
      damagers.add(h.source_id);
      if (typeof h.skill_id === "string" && h.skill_id !== "auto") skillHit = true;
    }
    // A counts even if A only applied CC (R6-8: "A counts")
    damagers.add(a);
    if (damagers.size >= 2 && skillHit) combos += 1;
  }
  out.f2_combo_chains = combos;

  // --- F3 + score timeline / F4 companions ---
  let sb = 0;
  let sr = 0;
  let prevSign = 0;
  let leadChanges = 0;
  let maxBlueLead = 0; // score_blue - score_red peak for red perspective trail
  let maxRedLead = 0; // score_red - score_blue
  let clutches = 0;

  const onScore = () => {
    const sign = sb === sr ? 0 : sb > sr ? 1 : -1;
    if (sign !== prevSign) {
      leadChanges += 1;
      prevSign = sign;
    }
    maxBlueLead = Math.max(maxBlueLead, sb - sr);
    maxRedLead = Math.max(maxRedLead, sr - sb);
  };

  // Precompute teamfight intervals for F3(a)
  const tfIntervals = teamfights.map((t) => ({
    start: t.start,
    end: t.end,
    blue: t.blue,
    red: t.red,
  }));
  const inTeamfight = (t: number) =>
    tfIntervals.some((tf) => t >= tf.start - 1e-9 && t <= tf.end + 1e-9);

  const pendingEscape: Array<{ unit: string; until: number }> = [];
  const lastEscapeCountAt: Record<string, number> = {};

  const flushEscape = (t: number) => {
    const kept: typeof pendingEscape = [];
    for (const p of pendingEscape) {
      if (t + 1e-12 >= p.until) {
        if (alive.has(p.unit)) clutches += 1;
      } else kept.push(p);
    }
    pendingEscape.length = 0;
    pendingEscape.push(...kept);
  };

  // F3(b): track per teamfight first death + takedown counts after
  const tfState = tfIntervals.map((tf) => ({
    ...tf,
    firstDeathTeam: null as "blue" | "red" | null,
    firstDeathBlueLiving: 0,
    firstDeathRedLiving: 0,
    blueKills: 0,
    redKills: 0,
    closed: false,
  }));

  for (const e of events) {
    flushEscape(e.t);

    if (e.type === "level_up" && typeof e.unit_id === "string") {
      const lv = Number(e.new_level ?? e.level);
      if (Number.isFinite(lv)) level[e.unit_id] = lv;
    }
    if (e.type === "death" && typeof e.unit_id === "string") {
      const victim = e.unit_id;
      const vTeam = teamOf(victim);
      // F3(b) first death in each open teamfight
      for (const tf of tfState) {
        if (tf.closed) continue;
        if (e.t < tf.start - 1e-9 || e.t > tf.end + 1e-9) continue;
        if (tf.firstDeathTeam === null && vTeam) {
          // living involved before removing victim
          let bl = 0;
          let rl = 0;
          for (const id of tf.blue) if (alive.has(id)) bl += 1;
          for (const id of tf.red) if (alive.has(id)) rl += 1;
          tf.firstDeathTeam = vTeam;
          tf.firstDeathBlueLiving = bl;
          tf.firstDeathRedLiving = rl;
        }
      }
      alive.delete(victim);
      for (let i = pendingEscape.length - 1; i >= 0; i--) {
        if (pendingEscape[i]!.unit === victim) pendingEscape.splice(i, 1);
      }
    }
    if (e.type === "respawn" && typeof e.unit_id === "string") {
      alive.add(e.unit_id);
    }

    if (e.type === "hit" && typeof e.target_id === "string") {
      const tid = e.target_id;
      const hpAfter = Number(e.hp_after);
      if (
        Number.isFinite(hpAfter) &&
        Number(e.mitigated ?? 0) > 0 &&
        hpAfter > 0 &&
        inTeamfight(e.t)
      ) {
        const frac = hpAfter / Math.max(1, maxHpOf(tid));
        if (frac <= CLUTCH_HP_FRAC + 1e-12) {
          const last = lastEscapeCountAt[tid] ?? -Infinity;
          if (e.t - last >= CLUTCH_DEDUPE_S - 1e-9) {
            lastEscapeCountAt[tid] = e.t;
            if (!pendingEscape.some((p) => p.unit === tid)) {
              pendingEscape.push({ unit: tid, until: e.t + CLUTCH_SURVIVE_S });
            }
          }
        }
      }
    }

    if (e.type === "takedown_score" && (e.team === "blue" || e.team === "red")) {
      const team = e.team as "blue" | "red";
      for (const tf of tfState) {
        if (e.t < tf.start - 1e-9 || e.t > tf.end + 3.0) continue;
        if (team === "blue") tf.blueKills += 1;
        else tf.redKills += 1;
      }
      if (team === "blue") sb += 1;
      else sr += 1;
      onScore();
    }
    if (e.type === "zone_tick" || e.type === "claim_award") {
      if (e.team === "blue") sb += 1;
      else if (e.team === "red") sr += 1;
      onScore();
    }
  }
  flushEscape(Infinity);

  // Close teamfights for F3(b)
  for (const tf of tfState) {
    if (!tf.firstDeathTeam) continue;
    const underdog =
      tf.firstDeathBlueLiving < tf.firstDeathRedLiving
        ? "blue"
        : tf.firstDeathRedLiving < tf.firstDeathBlueLiving
          ? "red"
          : null;
    if (!underdog) continue;
    const underdogKills = underdog === "blue" ? tf.blueKills : tf.redKills;
    const favKills = underdog === "blue" ? tf.redKills : tf.blueKills;
    if (underdogKills > favKills) clutches += 1;
  }
  out.f3_clutch_moments = clutches;
  out.lead_changes = leadChanges;

  // --- F4 ---
  const margin = Math.abs(opts.score_blue - opts.score_red);
  const sudden = opts.end_reason === "sudden_death";
  out.f4_close_finish = margin <= 2 || sudden ? 1 : 0;

  const winner =
    opts.score_blue > opts.score_red
      ? "blue"
      : opts.score_red > opts.score_blue
        ? "red"
        : null;
  if (winner === "blue") out.f4_comeback = maxRedLead >= 3 ? 1 : 0;
  else if (winner === "red") out.f4_comeback = maxBlueLead >= 3 ? 1 : 0;

  const loserScore =
    winner === "blue"
      ? opts.score_red
      : winner === "red"
        ? opts.score_blue
        : Math.min(opts.score_blue, opts.score_red);
  out.f4_shutout = winner && loserScore === 0 ? 1 : 0;

  // Multikills: same killer ≥2 deaths within 6s
  const deaths = events
    .filter((e) => e.type === "death" && typeof e.killer_id === "string")
    .sort((a, b) => a.t - b.t || a.seq - b.seq);
  let doubles = 0;
  const byKiller = new Map<string, number[]>();
  for (const d of deaths) {
    const k = d.killer_id as string;
    const list = byKiller.get(k) ?? [];
    list.push(d.t);
    byKiller.set(k, list);
  }
  for (const times of byKiller.values()) {
    for (let i = 0; i < times.length; i++) {
      let j = i;
      while (
        j + 1 < times.length &&
        times[j + 1]! - times[i]! <= DOUBLE_KILL_S + 1e-9
      )
        j += 1;
      if (j > i) {
        doubles += 1;
        i = j; // non-overlapping windows
      }
    }
  }
  out.f4_multikills = doubles;

  return out;
}

/** Wilson score interval for a binomial proportion (95% by default). */
export function wilsonInterval(
  wins: number,
  n: number,
  z = 1.96,
): { lo: number; hi: number; p: number } {
  if (n <= 0) return { lo: NaN, hi: NaN, p: NaN };
  const p = wins / n;
  const z2 = z * z;
  const den = 1 + z2 / n;
  const center = p + z2 / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return {
    p,
    lo: (center - margin) / den,
    hi: (center + margin) / den,
  };
}
