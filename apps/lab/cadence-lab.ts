#!/usr/bin/env node
/**
 * Orb/buff cadence lab (branch exp/orb-buff-cadence). Report only.
 *
 *   npx tsx apps/lab/cadence-lab.ts [--n 40] [--arms baseline,step1,step2,step3] [--out lab/cadence]
 *
 * Each arm runs n seeds × {hold_the_pit, hunt, starve} × {original, side-swapped kits}.
 */
import fs from "node:fs";
import path from "node:path";
import { simulate } from "../../sim/index.js";
import { evenOvrConfig, type TacticPreset } from "../../sim/match_config.js";
import { CADENCE_EXPERIMENT } from "../../sim/cadence.js";
import { DEFAULT_CONSTANTS } from "../../sim/constants.js";
import type { MatchConfig } from "../../sim/types.js";

const STEP1 = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, "../../lab/presets/cadence-step1.json"), "utf8"),
).overrides as Record<string, number>;

export const ARMS: Record<string, (cfg: MatchConfig) => MatchConfig> = {
  baseline: (cfg) => cfg,
  step1: (cfg) => ({ ...cfg, constants: { ...STEP1 } }),
  step2: (cfg) => ({ ...cfg, constants: { ...STEP1 }, cadence: { rovers: true } }),
  step3: (cfg) => ({ ...cfg, ...CADENCE_EXPERIMENT }),
  // exp/teamfight-dynamics arms
  combo: (cfg) => ({ ...cfg, teamfight: { combo: true } }),
  roles: (cfg) => ({ ...cfg, teamfight: { roles: true } }),
  chase: (cfg) => ({ ...cfg, teamfight: { chase: true } }),
  tf: (cfg) => ({ ...cfg, teamfight: { combo: true, roles: true, chase: true } }),
  tf_cadence: (cfg) => ({ ...cfg, ...CADENCE_EXPERIMENT, teamfight: { combo: true, roles: true, chase: true } }),
};

type Ev = Record<string, any>;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const ORB_PADS = [[2.5, 4.5], [2.5, 11.5], [21.5, 4.5], [21.5, 11.5], [8.5, 1.5], [15.5, 1.5], [8.5, 14.5], [15.5, 14.5]];
const near = (p: { x: number; y: number }, pads: number[][], r: number) => pads.some(([x, y]) => dist(p, { x: x!, y: y! }) <= r);

export function measure(ev: Ev[]) {
  const end = ev.find((e) => e.type === "match_end")!;
  const pos: Record<string, { x: number; y: number }> = {};
  let sb = 0, sr = 0, lead = 0, leadChanges = 0, winnerTrailed = false;
  let lastAction = 0, maxGap = 0, quiet = 0;
  const deaths: Ev[] = [];
  let skirmish = 0, nearBuff = 0, nearOrb = 0, nearPit = 0;
  const buffPads = (DEFAULT_CONSTANTS.BUFF_PADS as number[][]);
  let orbs = 0, buffs = 0, buffShares = 0, rs = 0, buffedDeaths = 0;
  const buffUntil: Record<string, number> = {};
  // Teamfight metrics: locks by target, follow-up hits from a different ally, R slot map.
  const lockOn: Record<string, { t: number; src: string }> = {};
  let followups = 0, rIntoLock = 0;
  const rSkills = new Set<string>(ev.filter((e) => e.type === "cast_end" && e.skill === "R").map((e) => e.skill_id));
  for (const e of ev) {
    if (e.type === "pos") { pos[e.unit_id] = { x: e.x, y: e.y }; continue; }
    if (e.type === "hit" || e.type === "death") {
      const g = e.t - lastAction; if (g > maxGap) maxGap = g; if (g > 3) quiet += g; lastAction = e.t;
    }
    if (e.score_after !== undefined && (e.team === "blue" || e.team === "red")) {
      if (e.team === "blue") sb = e.score_after; else sr = e.score_after;
      const l = Math.sign(sb - sr);
      if (l && lead && l !== lead) leadChanges++;
      if (l) lead = l;
      if ((end.winner === "blue" && sr > sb) || (end.winner === "red" && sb > sr)) winnerTrailed = true;
    }
    if (e.type === "orb_pickup") orbs++;
    if (e.type === "buff_pickup") { buffs++; buffUntil[e.unit_id] = e.expires_at; }
    if (e.type === "buff_share") { buffShares += e.unit_ids.length; for (const u of e.unit_ids) buffUntil[u] = e.expires_at; }
    if (e.type === "cast_end" && e.skill === "R") rs++;
    if (e.type === "status_apply" && (e.category === "lock" || e.category === "bind")) lockOn[e.target_id] = { t: e.t, src: e.source_id };
    if (e.type === "hit") {
      const l = lockOn[e.target_id];
      if (l && e.t - l.t <= 1.5 && e.source_id !== l.src && e.source_id.split(":")[0] === l.src.split(":")[0]) followups++;
    }
    if (e.type === "cast_start" && rSkills.has(e.skill_id) && e.target_id) {
      const l = lockOn[e.target_id];
      if (l && e.t - l.t <= 1.5 && e.unit_id.split(":")[0] === l.src.split(":")[0]) rIntoLock++;
    }
    if (e.type === "death") {
      deaths.push(e);
      const p = pos[e.unit_id];
      if ((buffUntil[e.unit_id] ?? 0) > e.t) buffedDeaths++;
      if (!p) continue;
      const local = Object.entries(pos).filter(([, q]) => dist(p, q) <= 6).length;
      if (local <= 4) skirmish++;
      // Buff pads sit 4.5 tiles from the pit centre, so test pit first with a tight radius.
      if (dist(p, { x: 12, y: 8 }) <= 3.5) nearPit++;
      else if (near(p, buffPads, 2)) nearBuff++;
      else if (p.y < 4.5 || p.y > 11.5 || near(p, ORB_PADS, 3)) nearOrb++;
    }
  }
  const tail = end.t - lastAction; if (tail > maxGap) maxGap = tail; if (tail > 3) quiet += tail;
  const killCount: Record<string, number> = {};
  for (const d of deaths) killCount[d.killer_id] = (killCount[d.killer_id] ?? 0) + 1;
  const gang = deaths.filter((d) => (d.assists?.length ?? 0) >= 3).length;
  const backline = deaths.filter((d) => /:(adc|mid)$/.test(d.unit_id)).length;
  let solo = 0, multi = 0;
  const byKiller: Record<string, number[]> = {};
  for (const d of deaths) { if (!d.assists?.length) solo++; (byKiller[d.killer_id] ??= []).push(d.t); }
  for (const ts of Object.values(byKiller)) for (let i = 1; i < ts.length; i++) if (ts[i]! - ts[i - 1]! <= 10) multi++;
  return {
    len: end.t, reason: end.reason as string, margin: Math.abs(end.score_blue - end.score_red),
    leadChanges, comeback: winnerTrailed ? 1 : 0, kills: deaths.length, maxGap, quietPct: quiet / end.t,
    skirmishPct: deaths.length ? skirmish / deaths.length : 0, solo, multi,
    buffDeathPct: deaths.length ? nearBuff / deaths.length : 0,
    orbDeathPct: deaths.length ? nearOrb / deaths.length : 0,
    pitDeathPct: deaths.length ? nearPit / deaths.length : 0,
    orbs, buffs, buffShares, buffedDeaths, rs,
    gangPct: deaths.length ? gang / deaths.length : 0,
    distinctKillers: Object.keys(killCount).length,
    topKillerShare: deaths.length ? Math.max(...Object.values(killCount)) / deaths.length : 0,
    backlinePct: deaths.length ? backline / deaths.length : 0,
    followups, rIntoLock,
  };
}

type Row = ReturnType<typeof measure>;
const median = (xs: number[]) => { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)]! : 0; };
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

export function summarize(rows: Row[]) {
  const pct = (x: number) => Math.round(x * 1000) / 10;
  const r1 = (x: number) => Math.round(x * 10) / 10;
  return {
    games: rows.length,
    len_median_s: r1(median(rows.map((r) => r.len))),
    first_to_10_pct: pct(mean(rows.map((r) => (r.reason === "first_to_10" ? 1 : 0)))),
    lead_changes_mean: r1(mean(rows.map((r) => r.leadChanges))),
    comeback_pct: pct(mean(rows.map((r) => r.comeback))),
    margin_mean: r1(mean(rows.map((r) => r.margin))),
    kills_mean: r1(mean(rows.map((r) => r.kills))),
    max_gap_median_s: r1(median(rows.map((r) => r.maxGap))),
    quiet_pct_median: pct(median(rows.map((r) => r.quietPct))),
    skirmish_death_pct: pct(mean(rows.map((r) => r.skirmishPct))),
    solo_kills_mean: r1(mean(rows.map((r) => r.solo))),
    multikills_mean: r1(mean(rows.map((r) => r.multi))),
    deaths_near_buff_pct: pct(mean(rows.map((r) => r.buffDeathPct))),
    deaths_in_lanes_or_orbs_pct: pct(mean(rows.map((r) => r.orbDeathPct))),
    deaths_near_pit_pct: pct(mean(rows.map((r) => r.pitDeathPct))),
    orb_pickups_mean: r1(mean(rows.map((r) => r.orbs))),
    buff_pickups_mean: r1(mean(rows.map((r) => r.buffs))),
    buff_shares_mean: r1(mean(rows.map((r) => r.buffShares))),
    buffed_deaths_mean: r1(mean(rows.map((r) => r.buffedDeaths))),
    r_casts_mean: r1(mean(rows.map((r) => r.rs))),
    gang_death_pct: pct(mean(rows.map((r) => r.gangPct))),
    distinct_killers_mean: r1(mean(rows.map((r) => r.distinctKillers))),
    top_killer_share_pct: pct(mean(rows.map((r) => r.topKillerShare))),
    backline_death_pct: pct(mean(rows.map((r) => r.backlinePct))),
    combo_followup_hits_mean: r1(mean(rows.map((r) => r.followups))),
    r_into_cc_mean: r1(mean(rows.map((r) => r.rIntoLock))),
  };
}

export function runArm(arm: string, n: number, tactic: TacticPreset): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < n; i++) {
    for (const swap of [false, true]) {
      let cfg: MatchConfig = evenOvrConfig(20261122 + i, tactic);
      if (swap) cfg = { ...cfg, blue: { ...cfg.red, tactics: cfg.blue.tactics }, red: { ...cfg.blue, tactics: cfg.red.tactics } };
      cfg = ARMS[arm]!({ ...cfg, debug_pos: true });
      rows.push(measure(simulate(cfg).events as Ev[]));
    }
  }
  return rows;
}

if (process.argv[1]?.includes("cadence-lab")) {
  const argv = process.argv.slice(2);
  const arg = (k: string, d: string) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1]! : d; };
  const n = Number(arg("--n", "40"));
  const arms = arg("--arms", "baseline,step1,step2,step3").split(",");
  const out = arg("--out", "lab/cadence");
  fs.mkdirSync(out, { recursive: true });
  const all: Record<string, Record<string, ReturnType<typeof summarize>>> = {};
  for (const arm of arms) {
    all[arm] = {};
    for (const tactic of ["hold_the_pit", "hunt", "starve"] as const) {
      const t0 = Date.now();
      all[arm]![tactic] = summarize(runArm(arm, n, tactic));
      console.error(`${arm} ${tactic} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  }
  fs.writeFileSync(path.join(out, `results-${arms.join("_")}.json`), JSON.stringify(all, null, 2) + "\n");
  for (const tactic of ["hold_the_pit", "hunt", "starve"]) {
    console.log(`\n## ${tactic} (n=${n * 2}/arm)`);
    const keys = Object.keys(all[arms[0]!]![tactic]!);
    console.log(["metric", ...arms].join(" | "));
    for (const k of keys) console.log([k, ...arms.map((a) => (all[a]![tactic] as any)[k])].join(" | "));
  }
}
