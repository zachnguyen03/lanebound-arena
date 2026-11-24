/**
 * M2-23 investigation tracer — AI on, forced_clock_end false.
 * Prints means (small N for smoke) and detailed timelines for sample games.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { defaultEvenConfig, simulate } from "../../../sim/index.ts";

const PRESETS = ["hold_the_pit", "hunt", "starve"];
const ZONE = { x: 12, y: 8, r: 3 };

function evenCfg(seed, preset) {
  const base = defaultEvenConfig(seed);
  return {
    ...base,
    ai_enabled: true,
    forced_clock_end: false,
    blue: { ...base.blue, tactics: { ...base.blue.tactics, preset } },
    red: { ...base.red, tactics: { ...base.red.tactics, preset } },
  };
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function inZone(u) {
  return u.alive && dist(u.x, u.y, ZONE.x, ZONE.y) <= ZONE.r + 1e-9;
}

function summarize(r) {
  const z = r.state.zone;
  const control = z?.control_time ?? { blue: 0, red: 0 };
  const zoneTicks = r.events.filter((e) => e.type === "zone_tick").length;
  const zoneTicksBlue = r.events.filter((e) => e.type === "zone_tick" && e.team === "blue").length;
  const captures = r.events.filter((e) => e.type === "zone_capture");
  const orbsBlue = r.events.filter((e) => e.type === "orb_pickup" && String(e.unit_id).startsWith("blue")).length;
  const orbsRed = r.events.filter((e) => e.type === "orb_pickup" && String(e.unit_id).startsWith("red")).length;
  const orbsAll = r.events.filter((e) => e.type === "orb_pickup").length;
  const fightCalls = r.events.filter((e) => e.type === "fight_call").length;
  // deny-time proxy: contested ticks aren't evented; use 0 placeholder + note
  // control_time is owned-exclusive seconds only (S3-R5-13).
  return {
    control_blue: control.blue,
    control_red: control.red,
    zone_tick_blue: zoneTicksBlue,
    zone_tick: zoneTicks,
    captures: captures.map((e) => ({ t: e.t, team: e.team })),
    orbs_blue: orbsBlue,
    orbs_red: orbsRed,
    orbs: orbsAll,
    fight_calls: fightCalls,
    end: r.state.end_reason,
    winner: r.state.winner,
    score: [r.state.score_blue, r.state.score_red],
  };
}

function timeline(r, sampleEvery = 50) {
  // Reconstruct from pos if present; else final only. We need debug_pos.
  const pos = r.events.filter((e) => e.type === "pos");
  const byTick = new Map();
  for (const e of pos) {
    if (!byTick.has(e.tick)) byTick.set(e.tick, []);
    byTick.get(e.tick).push(e);
  }
  const intents = r.events.filter((e) => e.type === "intent");
  const rows = [];
  const ticks = [...byTick.keys()].sort((a, b) => a - b);
  for (const tick of ticks) {
    if (tick % sampleEvery !== 0 && tick !== 1 && tick !== ticks[ticks.length - 1]) continue;
    const units = byTick.get(tick);
    const blueIn = units.filter((u) => String(u.unit_id).startsWith("blue") && dist(u.x, u.y, ZONE.x, ZONE.y) <= ZONE.r).length;
    const redIn = units.filter((u) => String(u.unit_id).startsWith("red") && dist(u.x, u.y, ZONE.x, ZONE.y) <= ZONE.r).length;
    const sample = units
      .filter((u) => ["blue:top", "blue:jungle", "blue:mid", "blue:adc", "red:top", "red:jungle"].includes(u.unit_id))
      .map((u) => `${u.unit_id}@(${Number(u.x).toFixed(1)},${Number(u.y).toFixed(1)})`);
    rows.push({ tick, t: tick * 0.1, blueIn, redIn, sample });
  }
  // Intent summary: first 30 intent changes for blue units
  const intentSample = intents
    .filter((e) => String(e.unit_id).startsWith("blue"))
    .slice(0, 40)
    .map((e) => `t=${e.t} ${e.unit_id}→${e.intent}${e.x != null ? ` @(${e.x?.toFixed?.(1) ?? e.x},${e.y?.toFixed?.(1) ?? e.y})` : ""}`);
  return { rows, intentSample, captures: r.events.filter((e) => e.type === "zone_capture"), zoneTicks: r.events.filter((e) => e.type === "zone_tick"), orbs: r.events.filter((e) => e.type === "orb_pickup") };
}

function meanStd(xs) {
  const n = xs.length;
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const v = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1);
  return { mean, se: Math.sqrt(v / n), n };
}

const outDir = "lab/s3/m2-23-trace";
mkdirSync(outDir, { recursive: true });

// --- Sample games (detailed) ---
const samples = [];
for (const preset of PRESETS) {
  for (const seed of [20261122, 20261123, 20261130]) {
    const r = simulate({ ...evenCfg(seed, preset), debug_pos: true });
    const sum = summarize(r);
    const tl = timeline(r, 100);
    // Final unit positions
    const finals = r.state.units.map((u) => ({
      id: u.id,
      x: +u.x.toFixed(2),
      y: +u.y.toFixed(2),
      alive: u.alive,
      intent: u.intent,
      inZone: inZone(u),
    }));
    samples.push({ preset, seed, sum, timeline: tl.rows.slice(0, 30), intents: tl.intentSample, finals, captures: tl.captures, zoneTicks: tl.zoneTicks, orbs: tl.orbs.slice(0, 15) });
    console.log(preset, seed, JSON.stringify(sum));
  }
}
writeFileSync(`${outDir}/samples.json`, JSON.stringify(samples, null, 2));

// --- Means over N=40 quick, then note full 200 for lab script ---
const N = 40;
const batch = {};
for (const preset of PRESETS) {
  const control = [];
  const orbs = [];
  const ticks = [];
  for (let i = 0; i < N; i++) {
    const r = simulate(evenCfg(20261122 + i, preset));
    const s = summarize(r);
    control.push(s.control_blue);
    orbs.push(s.orbs_blue);
    ticks.push(s.zone_tick_blue);
  }
  batch[preset] = {
    control: meanStd(control),
    orbs: meanStd(orbs),
    zone_tick: meanStd(ticks),
    control_zeros: control.filter((x) => x === 0).length,
    orb_zeros: orbs.filter((x) => x === 0).length,
  };
  console.log("batch", preset, JSON.stringify(batch[preset]));
}
writeFileSync(`${outDir}/batch-n40.json`, JSON.stringify(batch, null, 2));
console.log("done");
