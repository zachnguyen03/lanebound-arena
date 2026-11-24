#!/usr/bin/env node
/**
 * S5 follow-up labs orchestrator (report-only).
 *
 * Random-draft (auto-only baseline, side-swap pairs):
 *   npm run batch -- --n 1200 --seed 20261122 --scheme random_draft --side-swap-pairs --out lab/s5-labs/random-draft
 *
 * Isolation (pair_swap + teamwork floor 40; mastery_one; aim/reflexes blocked):
 *   npm run isolation -- --n 400 --seed 20261122 --teamwork-floor 40 --pairing pair_swap --out lab/s5-labs/isolation-tw40
 */
import fs from "node:fs";
import path from "node:path";
import { evenOvrConfig } from "../../sim/match_config.js";
import { quickDraftPicks } from "./lib/batch-runner.js";
import {
  FIGHT_QUALITY_DEFINITIONS,
  CLUTCH_HP_FRAC,
  CLUTCH_SURVIVE_S,
  ENGAGEMENT_GAP_S,
  TEAMFIGHT_MIN_S,
} from "./lib/fight-quality.js";

const outRoot = path.resolve("lab/s5-labs");
fs.mkdirSync(outRoot, { recursive: true });

const SEED_START = 20261122;
/** 600 pair-seeds × 2 = 1200 games; uniform deal → ~857 appearances/champ (10/14). */
const RANDOM_DRAFT_N = 1200;
const ISOLATION_N = 400;

const config = {
  branch: "s5-labs",
  base_sha: "d691445df27ab35b80afb9fc89333e1df9039b30",
  label: "auto-only baseline (no AI casts)",
  blocked_skillshot:
    "chooseExecutionCast in sim/ai/brain.ts returns null unless champ is kerrig|huntress (gated R only; never Q/W). No skillshot isolation preset without sim edits.",
  random_draft: {
    n: RANDOM_DRAFT_N,
    seed_start: SEED_START,
    pair_seeds: RANDOM_DRAFT_N / 2,
    scheme: "random_draft",
    side_swap_pairs: true,
    base: "evenOvrConfig(seed, hold_the_pit)",
    draft: "quickDraftPicks(seed) — lab Mulberry32 hash stream, Fisher–Yates, deal 5+5",
    inventions: [
      "lab-local Mulberry32 stream mixed from seed⊕domain (not sim RNG stream `draft`)",
      "Fisher–Yates then blue=first5 / red=next5 (no role-preference fill — that forced both tops+supports every game)",
      "side_swap_pairs: each seed runs twice with blue/red picks swapped",
    ],
    command: `npm run batch -- --n ${RANDOM_DRAFT_N} --seed ${SEED_START} --scheme random_draft --side-swap-pairs --out lab/s5-labs/random-draft`,
  },
  isolation: {
    n_per_arm: ISOLATION_N,
    seed_start: SEED_START,
    attrs_all: 60,
    teamwork_floor: 40,
    pairing: "pair_swap",
    justification:
      "callFollowSlack(T)=1+0.01*max(0,50−T) is 1.0 for T≥50. Floor T=40 so +30 moves slack 1.10→1.00. Side-swapped pairs + mirror control target ~50% base WR (§8.5 / GD).",
    mastery: "mastery_one on blue ADC pick only (§8.5) — not mastery_all",
    command: `npm run isolation -- --n ${ISOLATION_N} --seed ${SEED_START} --teamwork-floor 40 --pairing pair_swap --out lab/s5-labs/isolation-tw40`,
  },
  fight_quality: {
    source: "Appendix R #6 / S5-R6-8 (build-spec)",
    engagement_gap_s: ENGAGEMENT_GAP_S,
    teamfight_min_s: TEAMFIGHT_MIN_S,
    clutch_hp_frac: CLUTCH_HP_FRAC,
    clutch_survive_s: CLUTCH_SURVIVE_S,
    definitions: FIGHT_QUALITY_DEFINITIONS,
  },
};

fs.writeFileSync(
  path.join(outRoot, "config.json"),
  `${JSON.stringify(config, null, 2)}\n`,
);

const seedLines = ["seed,blue_picks,red_picks,twin"];
for (let i = 0; i < RANDOM_DRAFT_N / 2; i++) {
  const seed = SEED_START + i;
  const picks = quickDraftPicks(seed);
  seedLines.push(
    `${seed},${picks.blue.join("|")},${picks.red.join("|")},normal`,
  );
  seedLines.push(
    `${seed},${picks.red.join("|")},${picks.blue.join("|")},swapped`,
  );
}
fs.writeFileSync(
  path.join(outRoot, "random-draft-seeds.csv"),
  `${seedLines.join("\n")}\n`,
);

const sample = evenOvrConfig(SEED_START, "hold_the_pit");
fs.writeFileSync(
  path.join(outRoot, "sample-even-hold-config.json"),
  `${JSON.stringify(
    {
      seed: sample.seed,
      draft_mode: sample.draft_mode,
      ai_enabled: sample.ai_enabled,
      forced_clock_end: sample.forced_clock_end,
      blue_picks: sample.blue.picks,
      red_picks: sample.red.picks,
      blue_tactic: sample.blue.tactics.preset,
      red_tactic: sample.red.tactics.preset,
      label: "auto-only baseline (no AI casts)",
    },
    null,
    2,
  )}\n`,
);

console.log(
  JSON.stringify(
    {
      wrote: [
        "lab/s5-labs/config.json",
        "lab/s5-labs/random-draft-seeds.csv",
        "lab/s5-labs/sample-even-hold-config.json",
      ],
      next: [config.random_draft.command, config.isolation.command],
    },
    null,
    2,
  ),
);
