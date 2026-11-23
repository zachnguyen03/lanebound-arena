/**
 * S3 side-neutrality gate (deferred).
 *
 * Anh deferred the side-fairness SIM FIX. This file is measurement scaffolding only:
 * keep `it.skip` until a tick-order / side-fairness fix is approved, then enable.
 *
 * See lab/s3/side-lean/REPORT.md and lab/s3/side-lean/TICK-ORDER.md.
 */
import { describe, expect, it } from "vitest";
import { evenOvrConfig } from "../sim/match_config.js";
import { simulate } from "../sim/simulate.js";

const DEFAULT_BLUE_PICKS = ["brannoch", "sedge", "kerrig", "huntress", "ysol"];
const DEFAULT_RED_PICKS = ["rhedan", "tolle", "helvar", "maelis", "saelo"];

/** Seeds used in lab/s3/side-lean/TICK-ORDER.md mirrored measurement (n=40 subset). */
const SEEDS = [
  20261122, 20261123, 5, 10, 18,
  ...Array.from({ length: 40 }, (_, i) => i + 1),
].filter((s, i, a) => a.indexOf(s) === i).slice(0, 40);

const N = SEEDS.length;

function mirroredConfig(seed: number, picks: string[]) {
  const cfg = evenOvrConfig(seed, "hold_the_pit");
  cfg.blue = { ...cfg.blue, picks: picks.slice() };
  cfg.red = { ...cfg.red, picks: picks.slice() };
  return cfg;
}

function winCounts(picks: string[]): { blue: number; red: number; draw: number } {
  let blue = 0;
  let red = 0;
  let draw = 0;
  for (const seed of SEEDS) {
    const r = simulate(mirroredConfig(seed, picks));
    const w = r.state.winner;
    if (w === "blue") blue += 1;
    else if (w === "red") red += 1;
    else draw += 1;
  }
  return { blue, red, draw };
}

describe("S3 side-neutral mirrored matches (deferred sim fix)", () => {
  it.skip(
    `fully mirrored match is side-neutral over ${N} seeds (both default lineups; enable after side-fairness fix approved)`,
    () => {
      // With identical kits, blue and red win rates should be statistically even.
      // Threshold: neither side may take ≥ 65% of decisive games (draws ignored).
      for (const [label, picks] of [
        ["default blue picks mirrored", DEFAULT_BLUE_PICKS],
        ["default red picks mirrored", DEFAULT_RED_PICKS],
      ] as const) {
        const { blue, red, draw } = winCounts(picks.slice());
        const decisive = blue + red;
        expect(decisive, `${label}: expected decisive ends`).toBeGreaterThan(0);
        expect(draw, `${label}: unexpected draws`).toBe(0);
        const blueShare = blue / decisive;
        const redShare = red / decisive;
        expect(
          blueShare,
          `${label}: blue share ${blue}/${decisive} — residual side lean (see lab/s3/side-lean/TICK-ORDER.md)`,
        ).toBeLessThan(0.65);
        expect(
          redShare,
          `${label}: red share ${red}/${decisive} — residual side lean (see lab/s3/side-lean/TICK-ORDER.md)`,
        ).toBeLessThan(0.65);
      }
    },
  );
});
