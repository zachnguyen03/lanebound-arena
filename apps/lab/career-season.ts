/**
 * Print the canonical save JSON for one fake Bound Circuit season.
 *   npx tsx apps/lab/career-season.ts --seed 20261123 --club juniper-rush
 *   npx tsx apps/lab/career-season.ts --sha
 */
import { sha256Hex } from "@lanebound/match-contract";
import { runSeason, saveJson } from "@lanebound/career";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

const seed = Number(arg("--seed") ?? "20261123");
const club = arg("--club") ?? "juniper-rush";
const json = saveJson(runSeason({ careerSeed: seed, playerClubId: club }));
if (process.argv.includes("--sha")) process.stdout.write(sha256Hex(json));
else process.stdout.write(json);
