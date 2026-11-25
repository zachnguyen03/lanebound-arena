#!/usr/bin/env node
/**
 * Sandbox sweep (exp): diverse-settings games on the Watch sandbox setup
 * (three capture points + round-3 teamfight AI). Report only.
 *
 *   npx tsx apps/lab/sandbox-sweep.ts --from 0 --to 1000 --out lab/sandbox-sweep/rows-0.jsonl [--constants '{"SCORE_TO_WIN":20}']
 *
 * Seed index i → seed 20270000 + i, run twice (picks as drafted, then picks
 * swapped between sides). Per seed, deterministic from the seed:
 *   - quick draft picks (role-filled, batch-runner quickDraftPicks)
 *   - tactic presets: all 9 blue × red pairings (i % 9)
 *   - aggression −1/0/+1 per side, protect_the_carry, combo_style
 *   - every player attribute jittered ±12 around the even-OVR default
 * One JSON row per game.
 */
import fs from "node:fs";
import path from "node:path";
import { simulate } from "../../sim/index.js";
import { evenOvrConfig, type TacticPreset } from "../../sim/match_config.js";
import { SANDBOX_CONSTANTS, TEAMFIGHT_R3 } from "../../sim/cadence.js";
import type { MatchConfig, PlayerAttrs, SideConfig } from "../../sim/types.js";
import { quickDraftPicks } from "./lib/batch-runner.js";
import { summarizeMatch } from "./lib/summary.js";
import { measure } from "./cadence-lab.js";

const PRESETS: TacticPreset[] = ["hold_the_pit", "hunt", "starve"];

function rng(seed: number) {
  let s = (Math.imul(seed >>> 0 || 1, 0x9e3779b1) ^ 0x27d4eb2f) >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17; s >>>= 0;
    s ^= s << 5; s >>>= 0;
    return s / 0x100000000;
  };
}

function settings(i: number, seed: number) {
  const r = rng(seed);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;
  const side = (preset: TacticPreset) => ({
    preset,
    aggression: pick([-1, 0, 1] as const),
    protect_the_carry: r() < 0.5,
    combo_style: pick(["auto", "hold_R"] as const),
  });
  return {
    blue: side(PRESETS[i % 3]!),
    red: side(PRESETS[Math.floor(i / 3) % 3]!),
    jitter: () => Math.round((r() * 2 - 1) * 12),
  };
}

export function sweepConfig(i: number, swapped: boolean, constants?: Record<string, unknown>): MatchConfig {
  const seed = 20270000 + i;
  const base = evenOvrConfig(seed);
  const s = settings(i, seed);
  const picks = quickDraftPicks(seed);
  const jitterSide = (sc: SideConfig): SideConfig => ({
    ...sc,
    players: sc.players.map((p) => {
      const attrs = { ...p.attrs };
      for (const k of Object.keys(attrs) as (keyof PlayerAttrs)[]) {
        attrs[k] = Math.min(99, Math.max(1, attrs[k] + s.jitter()));
      }
      return { ...p, attrs };
    }),
  });
  const blue = jitterSide({ ...base.blue, tactics: { ...base.blue.tactics, ...s.blue } });
  const red = jitterSide({ ...base.red, tactics: { ...base.red.tactics, ...s.red } });
  blue.picks = swapped ? picks.red : picks.blue;
  red.picks = swapped ? picks.blue : picks.red;
  return {
    ...base,
    blue,
    red,
    draft_mode: "quick",
    constants: { ...(base.constants ?? {}), ...SANDBOX_CONSTANTS, ...(constants ?? {}) },
    objectives: { mode: "points" },
    teamfight: { ...TEAMFIGHT_R3 },
    debug_pos: true,
  };
}

if (process.argv[1]?.includes("sandbox-sweep")) {
  const argv = process.argv.slice(2);
  const arg = (k: string, d: string) => {
    const j = argv.indexOf(k);
    return j >= 0 && argv[j + 1] ? argv[j + 1]! : d;
  };
  const from = Number(arg("--from", "0"));
  const to = Number(arg("--to", "1000"));
  const out = arg("--out", "lab/sandbox-sweep/rows.jsonl");
  /** Constant overrides as JSON, e.g. '{"SCORE_TO_WIN":20}'. */
  const constants = argv.includes("--constants") ? JSON.parse(arg("--constants", "{}")) : undefined;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const fd = fs.openSync(out, "w");
  for (let i = from; i < to; i++) {
    for (const swapped of [false, true]) {
      const cfg = sweepConfig(i, swapped, constants);
      const res = simulate(cfg);
      const sum = summarizeMatch(cfg.seed, res);
      const m = measure(res.events as Record<string, unknown>[]);
      const row = {
        i,
        swapped,
        winner: sum.winner,
        reason: sum.reason,
        len: sum.duration_s,
        score: { blue: sum.score_blue, red: sum.score_red },
        parts: sum.score_parts,
        arch: sum.archetypes,
        champs: sum.champ_ids,
        kda: sum.kda,
        tactics: { blue: cfg.blue.tactics, red: cfg.red.tactics },
        attrs: {
          blue: cfg.blue.players.map((p) => p.attrs),
          red: cfg.red.players.map((p) => p.attrs),
        },
        t_first_R: sum.t_first_R,
        t_L7: sum.t_L7,
        m: {
          kills: m.kills, quiet: m.quietPct, gang: m.gangPct, solo: m.solo, multi: m.multi,
          lead_changes: m.leadChanges, comeback: m.comeback, split: m.splitPct, spread: m.allySpread,
        },
      };
      fs.writeSync(fd, JSON.stringify(row) + "\n");
    }
    if ((i - from) % 25 === 0) console.error(`sweep ${i - from}/${to - from}`);
  }
  fs.closeSync(fd);
}
