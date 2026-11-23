import {
  FAKE_CONSTANTS_HASH,
  SLOTS,
  fakeDigest,
  type CardMatchLog,
  type EndReason,
  type MatchConfig,
  type MatchResult,
  type PlayerMatchStats,
  type ScoreParts,
  type SeriesContext,
  type Side,
  type Slot,
} from "@lanebound/match-contract";
import { compArchetype } from "./archetype.js";
import { SplitMix32 } from "./rng.js";
import { teamStrength, winProbabilityBlue } from "./strength.js";

/**
 * §14.5 fake MatchResult.
 *
 * Assumptions frozen here (also OPEN-QUESTIONS.md), because the GDD leaves
 * the knots and several weights incomplete and the engineering plan says to
 * freeze them in the C0 report:
 * - first_to_10 inverse-CDF knots (0,90), (0.10,132), (0.25,165.5),
 *   (0.50,200), (0.75,220), (0.90,235), (1,239.5), piecewise linear.
 * - sudden_death scores are 8-7, 9-8, or 10-9, equal weights (C-R2-4).
 *   The old "reached 10" coin and the first_to_10 loser table are not used.
 * - zone/takedown scores: equal weights on 8-7, 9-8, 10-9.
 * - coin_flip is stored 10-9, reason stays coin_flip.
 * - score_parts noise: shares 0.40/0.35/0.25 times (0.85 + 0.30*u), then
 *   largest-remainder integers.
 * - role weights below are fixed, not drawn.
 * - z is 0.35 times a Box-Muller standard normal (Math.log / Math.cos / Math.sqrt).
 * - claim_denied and claim_paid are integers in 0..4; opened = denied + paid.
 * - peel_eligible equals the sum of player peels. sanctuary_violations is 0.
 * - t_first_R = 0.3 * duration, t_L7 = 0.7 * duration.
 */

const Z_SHRINK = 0.35;

/** C-R2-4. Winner in {8, 9, 10}, loser one behind, equal weights. */
export const SUDDEN_DEATH_SCORES: readonly (readonly [number, number])[] = [
  [8, 7],
  [9, 8],
  [10, 9],
];

const KILL_W: Record<Slot, number> = { top: 0.16, jungle: 0.18, mid: 0.24, adc: 0.26, support: 0.16 };
const ASSIST_W: Record<Slot, number> = { top: 0.22, jungle: 0.18, mid: 0.18, adc: 0.16, support: 0.26 };
const DEATH_W: Record<Slot, number> = { top: 0.16, jungle: 0.18, mid: 0.24, adc: 0.26, support: 0.16 };
const DENY_W: Record<Slot, number> = { top: 0.3, jungle: 0.15, mid: 0.1, adc: 0.1, support: 0.35 };

const DMG: Record<Slot, [number, number]> = {
  top: [4000, 8000],
  jungle: [5000, 9000],
  mid: [7000, 11000],
  adc: [8000, 12000],
  support: [2000, 5000],
};
const HEALS: Record<Slot, [number, number]> = {
  top: [200, 1500],
  jungle: [200, 1200],
  mid: [200, 1500],
  adc: [100, 800],
  support: [3000, 6000],
};
const ZONE: Record<Slot, [number, number]> = {
  top: [20, 80],
  jungle: [5, 40],
  mid: [5, 30],
  adc: [5, 25],
  support: [20, 70],
};

const FIRST_TO_10_KNOTS: ReadonlyArray<readonly [number, number]> = [
  [0, 90],
  [0.1, 132],
  [0.25, 165.5],
  [0.5, 200],
  [0.75, 220],
  [0.9, 235],
  [1, 239.5],
];

function inverseFirstTo10(u: number): number {
  const x = Math.min(1, Math.max(0, u));
  for (let i = 1; i < FIRST_TO_10_KNOTS.length; i++) {
    const left = FIRST_TO_10_KNOTS[i - 1]!;
    const right = FIRST_TO_10_KNOTS[i]!;
    if (x <= right[0]) {
      const span = right[0] - left[0];
      const w = span === 0 ? 0 : (x - left[0]) / span;
      return left[1] + w * (right[1] - left[1]);
    }
  }
  return 239.5;
}

function drawReason(u: number): EndReason {
  if (u < 0.55) return "first_to_10";
  if (u < 0.85) return "clock";
  if (u < 0.97) return "sudden_death";
  if (u < 0.985) return "zone_time";
  if (u < 0.9955) return "takedowns";
  return "coin_flip";
}

function weighted(rng: SplitMix32, rows: ReadonlyArray<readonly [number, number]>): number {
  let total = 0;
  for (const row of rows) total += row[1];
  let x = rng.nextUnit() * total;
  for (const row of rows) {
    x -= row[1];
    if (x < 0) return row[0];
  }
  return rows[rows.length - 1]![0];
}

function allocate(total: number, weights: readonly number[]): number[] {
  if (weights.length === 0) return [];
  const sum = weights.reduce((acc, w) => acc + w, 0);
  const exact = weights.map((w) => (sum === 0 ? 0 : (total * w) / sum));
  const floors = exact.map((x) => Math.floor(x));
  let left = total - floors.reduce((acc, n) => acc + n, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; k < left; k++) {
    const slot = order[k];
    if (!slot) break;
    floors[slot.i] = (floors[slot.i] ?? 0) + 1;
  }
  return floors;
}

function splitScore(total: number, rng: SplitMix32): ScoreParts {
  const weights = [0.4, 0.35, 0.25].map((share) => share * (0.85 + 0.3 * rng.nextUnit()));
  const [kills, ticks, claims] = allocate(total, weights);
  return { kills: kills ?? 0, ticks: ticks ?? 0, claims: claims ?? 0 };
}

function randInt(rng: SplitMix32, lo: number, hi: number): number {
  const span = hi - lo + 1;
  return lo + (rng.nextU32() % span);
}

function normal(rng: SplitMix32): number {
  const u1 = rng.nextUnit();
  const u2 = rng.nextUnit();
  const mag = Math.sqrt(-2 * Math.log(u1));
  return mag * Math.cos(2 * Math.PI * u2);
}

function clampRating(z: number, won: boolean): number {
  const raw = 6 + z + 0.3 * (won ? 1 : 0);
  return Math.min(10, Math.max(3, raw));
}

function sideWeights(table: Record<Slot, number>): number[] {
  return SLOTS.map((slot) => table[slot]);
}

export function mapMvp(players: readonly PlayerMatchStats[]): string {
  const ranked = [...players].sort((a, b) => {
    if (a.rating !== b.rating) return b.rating - a.rating;
    if (a.z !== b.z) return b.z - a.z;
    if (a.player_id < b.player_id) return -1;
    if (a.player_id > b.player_id) return 1;
    return 0;
  });
  const top = ranked[0];
  if (!top) throw new Error("mapMvp requires players");
  return top.player_id;
}

export function generateFakeMatch(context: SeriesContext, config: MatchConfig): MatchResult {
  if (context.source !== "fake") throw new Error("generateFakeMatch requires source fake");
  const rng = new SplitMix32(config.seed >>> 0);
  const strengthBlue = teamStrength({
    players: config.blue.players,
    picks: config.blue.picks,
    preset: config.blue.tactics.primary,
    opponentPreset: config.red.tactics.primary,
    side: "blue",
  });
  const strengthRed = teamStrength({
    players: config.red.players,
    picks: config.red.picks,
    preset: config.red.tactics.primary,
    opponentPreset: config.blue.tactics.primary,
    side: "red",
  });
  const pBlue = winProbabilityBlue(strengthBlue, strengthRed);
  const blueWins = rng.nextUnit() < pBlue;
  const winner: Side = blueWins ? "blue" : "red";
  const reason = drawReason(rng.nextUnit());

  let duration = 240;
  if (reason === "first_to_10") duration = inverseFirstTo10(rng.nextUnit());
  else if (reason === "clock") duration = 240;
  else if (reason === "sudden_death") duration = 240 + rng.nextUnit() * 30;
  else duration = 270;

  let winScore = 10;
  let loseScore = 8;
  if (reason === "first_to_10") {
    winScore = 10;
    loseScore = weighted(rng, [
      [3, 1],
      [4, 2],
      [5, 3],
      [6, 3],
      [7, 2],
      [8, 1],
    ]);
  } else if (reason === "clock") {
    const pair = weighted(rng, [
      [7, 2],
      [8, 3],
      [9, 2],
    ]);
    winScore = pair;
    loseScore = pair - 1;
  } else if (reason === "coin_flip") {
    winScore = 10;
    loseScore = 9;
  } else if (reason === "sudden_death") {
    const index = weighted(
      rng,
      SUDDEN_DEATH_SCORES.map((pair) => [pair[0], 1] as const),
    );
    const pair = SUDDEN_DEATH_SCORES.find((row) => row[0] === index);
    if (!pair) throw new Error("sudden-death score missing");
    winScore = pair[0];
    loseScore = pair[1];
  } else {
    winScore = weighted(rng, [
      [8, 1],
      [9, 1],
      [10, 1],
    ]);
    loseScore = winScore - 1;
  }

  const scoreBlue = blueWins ? winScore : loseScore;
  const scoreRed = blueWins ? loseScore : winScore;
  const partsBlue = splitScore(scoreBlue, rng);
  const partsRed = splitScore(scoreRed, rng);

  const claimDeniedBlue = rng.nextU32() % 5;
  const claimPaidBlue = rng.nextU32() % 5;
  const claimDeniedRed = rng.nextU32() % 5;
  const claimPaidRed = rng.nextU32() % 5;

  const killsBlue = allocate(partsBlue.kills, sideWeights(KILL_W));
  const killsRed = allocate(partsRed.kills, sideWeights(KILL_W));
  const deathsBlue = allocate(partsRed.kills, sideWeights(DEATH_W));
  const deathsRed = allocate(partsBlue.kills, sideWeights(DEATH_W));
  const assistsBlue = allocate(Math.round(1.4 * partsBlue.kills), sideWeights(ASSIST_W));
  const assistsRed = allocate(Math.round(1.4 * partsRed.kills), sideWeights(ASSIST_W));
  const deniesBlue = allocate(claimDeniedBlue, sideWeights(DENY_W));
  const deniesRed = allocate(claimDeniedRed, sideWeights(DENY_W));

  const players: PlayerMatchStats[] = [];
  const fill = (side: Side, won: boolean, kills: number[], deaths: number[], assists: number[], denies: number[]) => {
    const sideConfig = side === "blue" ? config.blue : config.red;
    for (let i = 0; i < 5; i++) {
      const player = sideConfig.players[i]!;
      const slot = SLOTS[i]!;
      const dmg = randInt(rng, DMG[slot][0], DMG[slot][1]);
      const heals = randInt(rng, HEALS[slot][0], HEALS[slot][1]);
      const zone = randInt(rng, ZONE[slot][0], ZONE[slot][1]);
      const orbs = randInt(rng, 0, 8);
      const peels = randInt(rng, slot === "support" ? 2 : slot === "top" ? 1 : 0, slot === "support" ? 8 : slot === "top" ? 5 : 3);
      const z = Z_SHRINK * normal(rng);
      players.push({
        player_id: player.id,
        slot,
        champ_id: sideConfig.picks[i]!,
        side,
        k: kills[i] ?? 0,
        d: deaths[i] ?? 0,
        a: assists[i] ?? 0,
        dmg,
        heals,
        zone_seconds: zone,
        orbs,
        peels,
        claim_denies: denies[i] ?? 0,
        rating: clampRating(z, won),
        z,
      });
    }
  };
  fill("blue", blueWins, killsBlue, deathsBlue, assistsBlue, deniesBlue);
  fill("red", !blueWins, killsRed, deathsRed, assistsRed, deniesRed);

  const cards: CardMatchLog[] = [];
  const logCards = (side: Side) => {
    const loadout = side === "blue" ? config.blue.card_loadout : config.red.card_loadout;
    for (const card of loadout) {
      const fired = rng.nextUnit() < 0.5;
      if (fired) {
        cards.push({
          card_id: card.id,
          holder_id: card.holder_id,
          side,
          outcome: "fired",
          t_fired: rng.nextUnit() * duration,
        });
      } else {
        cards.push({
          card_id: card.id,
          holder_id: card.holder_id,
          side,
          outcome: "expired_unmet",
        });
      }
    }
  };
  logCards("blue");
  logCards("red");

  const peelFired = players.reduce((sum, player) => sum + player.peels, 0);
  const built: MatchResult = {
    contract_version: "career-match/1",
    source: "fake",
    competition_id: context.competition_id,
    season_id: context.season_id,
    series_id: context.series_id,
    game_index: context.game_index,
    seed: config.seed >>> 0,
    digest: "fake:pending",
    winner,
    reason,
    duration_s: duration,
    score_blue: scoreBlue,
    score_red: scoreRed,
    score_parts: [partsBlue, partsRed],
    archetypes: { blue: compArchetype(config.blue.picks), red: compArchetype(config.red.picks) },
    tactics: { blue: config.blue.tactics.primary, red: config.red.tactics.primary },
    champ_ids: [...config.blue.picks, ...config.red.picks],
    peel_fired: peelFired,
    peel_eligible: peelFired,
    sanctuary_violations: 0,
    claim_opened: claimDeniedBlue + claimPaidBlue + claimDeniedRed + claimPaidRed,
    claim_denied: claimDeniedBlue + claimDeniedRed,
    claim_paid: claimPaidBlue + claimPaidRed,
    t_first_R: duration * 0.3,
    t_L7: duration * 0.7,
    kda: players.map((player) => ({ k: player.k, d: player.d, a: player.a, dmg: player.dmg })),
    constants_hash: FAKE_CONSTANTS_HASH,
    players,
    cards,
    mvp_player_id: mapMvp(players),
  };
  built.digest = fakeDigest(built);
  return built;
}
