// Full match engine adapter: career lineups -> a points-mode Lanebound MatchConfig -> simulate() -> the
// career's match summary. Same seed and inputs give the same summary; summary.config replays the match.
import { simulate } from "@sim/simulate";
import { SANDBOX_KIT_PATCH, type KitPatch } from "@sim/balance";
import { SANDBOX_CONSTANTS, TEAMFIGHT_R3 } from "@sim/cadence";
import { CHAMPIONS } from "@data/champions/defs";
import { KITS } from "@data/champions/kits";
import type { MatchConfig, PlayerConfig, SideConfig, Tactics } from "@sim/types";

const ROLES = ["Top", "Jungle", "Mid", "Carry", "Support"];
const SLOTS = ["top", "jungle", "mid", "adc", "support"] as const;
export const SIM_ATTRS = ["aim", "reflexes", "execution", "decision", "positioning", "teamwork"] as const;
const FORM_ATTRS = new Set(["aim", "reflexes", "execution", "teamwork"]); // the day's form moves hands, not the head
const POSTURE: Record<string, number> = { aggressive: 1, balanced: 0, defensive: -1 };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Career player as calendar.enginePlayer builds it: 1-99 attributes, prof = effective mastery (~0.6-1.2). */
export interface EnginePlayer { id: string; name: string; champ: string; prof: number; [attr: string]: number | string }
export interface Plan { name?: string; preset?: Tactics["preset"]; posture?: string; focus?: string; protect?: boolean }
export interface EngineTeam { name: string; plan?: Plan; coach?: number; lineup: EnginePlayer[] }
export interface Opts { stakes?: number; attr_scaling?: MatchConfig["attr_scaling"]; patch?: Record<string, { hp?: number; atk?: number; cd?: number }> }

export function rngFrom(seed: number): () => number { // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Today's form: Resilience narrows the roll, Clutch adds a bonus scaled by the stakes (0-1). */
export const formRoll = (p: EnginePlayer, rng: () => number, stakes = 0) =>
  (1 + (rng() * 2 - 1) * (0.13 - Number(p.resilience) * 0.0008)) * (1 + ((Number(p.clutch) - 50) / 400) * stakes);

/** Career scale -> sim scale: a 60-rated career player is the sim's even 70. Coach adds Decision. */
export function simPlayer(p: EnginePlayer, form: number, coach = 10): PlayerConfig {
  const attrs = Object.fromEntries(SIM_ATTRS.map((k) => {
    const v = Number(p[k]) + (k === "decision" ? (coach - 10) * 0.6 : 0);
    return [k, clamp(Math.round(v * (FORM_ATTRS.has(k) ? form : 1) + 10), 1, 99)];
  })) as unknown as PlayerConfig["attrs"];
  return { name: p.name, attrs, mastery: { [p.champ]: clamp(Math.round(50 + (p.prof - 0.85) * 200), 0, 100) } };
}

/** Career game plan -> sim tactics. Team mean Aggression nudges the posture by one step at most. */
export function simTactics(plan: Plan = {}, lineup: EnginePlayer[]): Tactics {
  const agg = lineup.reduce((n, p) => n + Number(p.aggression), 0) / lineup.length;
  const focus = plan.focus && plan.focus !== "auto" ? SLOTS[ROLES.indexOf(plan.focus)] : undefined;
  return {
    preset: plan.preset ?? "hold_the_pit",
    aggression: clamp(Math.round((POSTURE[plan.posture ?? "balanced"] ?? 0) + (agg - 60) / 20), -1, 1) as Tactics["aggression"],
    protect_the_carry: plan.protect ?? true,
    combo_style: "auto",
    focus: focus ?? "auto",
  };
}

/** Career patch mods (fractions of base HP, attack, cooldowns) layered on the sandbox kit patch. */
export function kitPatch(mods: Opts["patch"] = {}): KitPatch {
  const out: KitPatch = { ...SANDBOX_KIT_PATCH };
  for (const [id, m] of Object.entries(mods)) {
    const def = CHAMPIONS[id], kit = KITS[id], base = SANDBOX_KIT_PATCH[id] ?? {};
    if (!def || !kit) continue;
    const l1 = { ...def.l1, ...base.l1 }, p: KitPatch[string] = { ...base };
    if (m.hp || m.atk) p.l1 = { ...base.l1, hp: l1.hp * (1 + (m.hp ?? 0)), atk: l1.atk * (1 + (m.atk ?? 0)), pow: l1.pow * (1 + (m.atk ?? 0)) };
    if (m.cd) for (const s of ["Q", "W", "R"] as const) p[s] = { ...base[s], CD_s: (base[s]?.CD_s ?? kit[s].CD_s) * (1 + m.cd) };
    out[id] = p;
  }
  return out;
}

export function matchConfig(teamA: EngineTeam, teamB: EngineTeam, seed: number, opts: Opts = {}): MatchConfig {
  const rng = rngFrom(seed);
  const side = (t: EngineTeam): SideConfig => ({
    players: t.lineup.map((p) => simPlayer(p, formRoll(p, rng, opts.stakes), t.coach)),
    picks: t.lineup.map((p) => p.champ),
    tactics: simTactics(t.plan, t.lineup),
  });
  return {
    seed, blue: side(teamA), red: side(teamB), objectives: { mode: "points" }, teamfight: { ...TEAMFIGHT_R3 }, attr_scaling: opts.attr_scaling ?? true,
    constants: { ...SANDBOX_CONSTANTS }, kit_patch: kitPatch(opts.patch), ai_enabled: true, draft_mode: "fixed", forced_clock_end: false,
  };
}

export interface Line {
  pid: string; name: string; side: number; role: string; champ: string; level: number;
  k: number; d: number; a: number; obj: number; dmg: number; taken: number; heal: number; share: number; rating: number;
}
export type Ev = { t: number; type: string; side: number; [k: string]: unknown };

/** 1-10 rating from K/D/A, damage share, share of the game spent on points and the result.
 * Measured (test/fit.mjs games): winners 6.9, losers 5.4, carries 7.8, other roles 5.5-6.1, 0.3% at 10. */
export function rate(players: Line[], winner: number, duration: number) {
  const mins = Math.max(1, duration / 60);
  for (const x of players) {
    const team = players.filter((y) => y.side === x.side).reduce((n, y) => n + y.dmg, 0) || 1;
    x.share = +(x.dmg / team).toFixed(3);
    x.rating = +clamp(5 + x.k * 0.22 + x.a * 0.1 - x.d * 0.25 + (x.share - 0.2) * 5 + (x.obj / mins / 60) * 2 + (x.side === winner ? 0.5 : -0.3), 1, 10).toFixed(1);
  }
  return players.filter((x) => x.side === winner).reduce((a, b) => (b.rating > a.rating ? b : a)).pid;
}

/** Run one game on the Lanebound sim and convert it to the career summary. Blue = teamA = side 0. */
export function runFull(teamA: EngineTeam, teamB: EngineTeam, seed: number, opts: Opts = {}) {
  const config = matchConfig(teamA, teamB, seed, opts);
  const r = simulate(config), st = r.state;
  const idx = (uid: unknown) => { const [team, slot] = String(uid).split(":"); return (team === "red" ? 5 : 0) + SLOTS.indexOf(slot as (typeof SLOTS)[number]); };
  const sideOf = (team: unknown) => (team === "red" ? 1 : 0);
  const players: Line[] = [teamA, teamB].flatMap((t, side) => t.lineup.map((p, i) => ({
    pid: p.id, name: p.name, side, role: ROLES[i]!, champ: p.champ, level: st.units[side * 5 + i]?.level ?? 1,
    k: 0, d: 0, a: 0, obj: Math.round(r.player_stats?.[side * 5 + i]?.zone_seconds ?? 0), dmg: 0, taken: 0, heal: 0, share: 0, rating: 0,
  })));
  const kills = [0, 0], caps = [0, 0], split = [{ kills: 0, obj: 0 }, { kills: 0, obj: 0 }], score = [0, 0];
  const events: Ev[] = [], timeline = [{ t: 0, s: [0, 0] }], streak = Array(10).fill(0), dead = Array(10).fill(false);
  const point = (side: number, part: "kills" | "obj", t: number) => { split[side]![part]++; score[side]!++; timeline.push({ t, s: [...score] }); };
  for (const e of r.events) {
    const t = Math.round(e.t * 10) / 10;
    switch (e.type) {
      case "hit": { const dm = Number(e.mitigated) || 0; players[idx(e.source_id)]!.dmg += dm; players[idx(e.target_id)]!.taken += dm; break; }
      case "heal": players[idx(e.source_id)]!.heal += Number(e.applied) || 0; break;
      case "respawn": dead[idx(e.unit_id)] = false; break;
      case "death": {
        const v = idx(e.unit_id), vs = v < 5 ? 0 : 1;
        players[v]!.d++; dead[v] = true;
        if (!e.killer_id) { events.push({ t, type: "death", side: vs, v: players[v]!.pid }); streak[v] = 0; break; }
        const k = idx(e.killer_id), side = 1 - vs, as = ((e.assists as string[]) ?? []).map(idx).filter((i) => i !== k);
        players[k]!.k++; for (const i of as) players[i]!.a++;
        events.push({ t, type: "kill", side, k: players[k]!.pid, v: players[v]!.pid, a: as.map((i) => players[i]!.pid), kc: players[k]!.champ, vc: players[v]!.champ,
          fb: kills[0]! + kills[1]! === 0, shutdown: streak[v] >= 3, streak: ++streak[k] });
        kills[side]!++; streak[v] = 0;
        if (dead.slice(vs * 5, vs * 5 + 5).every(Boolean)) events.push({ t, type: "ace", side });
        break;
      }
      case "takedown_score": point(sideOf(e.team), "kills", t); break;
      case "zone_tick": point(sideOf(e.team), "obj", t); events.push({ t, type: "majority", side: sideOf(e.team) }); break;
      case "claim_award": point(sideOf(e.team), "obj", t); events.push({ t, type: "claim", side: sideOf(e.team) }); break;
      case "point_capture": caps[sideOf(e.team)]!++; events.push({ t, type: "capture", side: sideOf(e.team), point: e.point }); break;
    }
  }
  for (const x of players) for (const f of ["dmg", "taken", "heal"] as const) x[f] = Math.round(x[f]);
  const winner = st.winner === "red" ? 1 : st.winner === "blue" ? 0 : st.score_red > st.score_blue ? 1 : 0;
  const duration = Math.round(st.t * 10) / 10, mvp = rate(players, winner, duration);
  const at60 = timeline.filter((x) => x.t <= 60).at(-1)!.s;
  return {
    winner, duration, score: [st.score_blue, st.score_red], split, caps, kills, fbSide: events.find((e) => e.type === "kill")?.side ?? -1,
    endReason: st.end_reason === "first_to_10" ? "score" : st.end_reason ?? "", players, mvp, sd60: at60[0]! - at60[1]!, timeline, events, config,
  };
}
