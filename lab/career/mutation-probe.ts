/**
 * Career mutation probe. Each edit is applied to a temp copy of one file,
 * the targeted test is run, and the working tree file is restored from that copy.
 * The list is the mutation table in career-PM-PACKAGE.md (16 rows). The request
 * said 18; that package has no 17th or 18th row.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

interface Edit {
  find: string;
  replace: string;
  all?: boolean;
}

interface Probe {
  id: string;
  file: string;
  edits: Edit[];
  testFilter: string;
}

const probes: Probe[] = [
  {
    id: "Flip last two standing keys (maps won before map diff)",
    file: "packages/career/src/standings.ts",
    edits: [
      {
        find: `    if (a.map_diff !== b.map_diff) return b.map_diff - a.map_diff;
    if (a.maps_won !== b.maps_won) return b.maps_won - a.maps_won;`,
        replace: `    if (a.maps_won !== b.maps_won) return b.maps_won - a.maps_won;
    if (a.map_diff !== b.map_diff) return b.map_diff - a.map_diff;`,
      },
    ],
    testFilter: "ranks a better map differential above more maps won",
  },
  {
    id: "No-op assertAcceptableSimReplay (drop fake: check)",
    file: "packages/match-contract/src/digest.ts",
    edits: [
      {
        find: `export function assertAcceptableSimReplay(digest: string): void {
  if (isFakeDigest(digest)) {
    throw new Error("rejected fake digest as sim replay");
  }
}`,
        replace: `export function assertAcceptableSimReplay(_digest: string): void {
  return;
}`,
      },
    ],
    testFilter: "fake: digest",
  },
  {
    id: "GLICKO_TAU 0.5 → 1.0",
    file: "packages/career/src/glicko.ts",
    edits: [{ find: "export const GLICKO_TAU = 0.5;", replace: "export const GLICKO_TAU = 1.0;" }],
    testFilter: "Glickman's published worked example",
  },
  {
    id: "Swap sides parity",
    file: "packages/career/src/calendar.ts",
    edits: [
      {
        find: "if ((i + j) % 2 === 1) return [lower, higher];\n  return [higher, lower];",
        replace: "if ((i + j) % 2 === 1) return [higher, lower];\n  return [lower, higher];",
      },
    ],
    testFilter: "matches the published circle",
  },
  {
    id: "Drop the award minimum of 4 series",
    file: "packages/career/src/awards.ts",
    edits: [{ find: "row.series >= 4", replace: "row.series >= 1" }],
    testFilter: "requires four series",
  },
  {
    id: "Zonekeeper coefficient 20 → 21",
    file: "packages/career/src/awards.ts",
    edits: [{ find: "return zoneSeconds + 20 * claimDenies;", replace: "return zoneSeconds + 21 * claimDenies;" }],
    testFilter: "requires four series",
  },
  {
    id: "STRENGTH_K 0.1 → 0.2",
    file: "packages/career/src/strength.ts",
    edits: [{ find: "export const STRENGTH_K = 0.1;", replace: "export const STRENGTH_K = 0.2;" }],
    testFilter: "C-R-3 strength formula",
  },
  {
    id: "Reverse every last-key opening_index comparison",
    file: "packages/career/src/standings.ts",
    edits: [
      {
        find: "a.row.opening_index - b.row.opening_index",
        replace: "b.row.opening_index - a.row.opening_index",
      },
      {
        find: "a.opening_index - b.opening_index",
        replace: "b.opening_index - a.opening_index",
        all: true,
      },
    ],
    testFilter: "lower opening index, never OVR",
  },
  {
    id: "Flip one tactic entry (Iron Lotus Hold → Hunt)",
    file: "packages/career/src/lineup.ts",
    edits: [
      {
        find: `export const AI_PRESETS = ["hold", "hunt", "starve", "hold", "hunt", "starve", "hold", "hunt"]`,
        replace: `export const AI_PRESETS = ["hunt", "hunt", "starve", "hold", "hunt", "starve", "hold", "hunt"]`,
      },
    ],
    testFilter: "assigns AI tactics by opening index",
  },
  {
    id: "Sudden death is a fair coin again",
    file: "packages/career/src/fake.ts",
    edits: [
      {
        find: `  } else if (reason === "sudden_death") {
    const index = weighted(
      rng,
      SUDDEN_DEATH_SCORES.map((pair) => [pair[0], 1] as const),
    );
    const pair = SUDDEN_DEATH_SCORES.find((row) => row[0] === index);
    if (!pair) throw new Error("sudden-death score missing");
    winScore = pair[0];
    loseScore = pair[1];
  }`,
        replace: `  } else if (reason === "sudden_death") {
    const coin = rng.nextUnit() < 0.5;
    winScore = coin ? 10 : 9;
    loseScore = coin ? 9 : 8;
  }`,
      },
    ],
    testFilter: "draws every sudden death",
  },
  {
    id: "Mastery projection 60 → 61",
    file: "packages/career/src/world.ts",
    edits: [{ find: "i === 0 ? main : 60", replace: "i === 0 ? main : 61" }],
    testFilter: "frozen paper opening world",
  },
  {
    id: "Change one world field (pid 1 wage 138 → 139)",
    file: "packages/career/data/opening-world-20261123.json",
    edits: [
      {
        find: `"pid":1,"name":"P1736","role":"top","age":28,"attrs":[75,79,74,74,79,76],"ovr":76,"potential":77,"attr_pot":[77,80,79,75,82,79],"mastery_main":80.0,"contract_years":4,"wage":138`,
        replace: `"pid":1,"name":"P1736","role":"top","age":28,"attrs":[75,79,74,74,79,76],"ovr":76,"potential":77,"attr_pot":[77,80,79,75,82,79],"mastery_main":80.0,"contract_years":4,"wage":139`,
      },
    ],
    testFilter: "frozen paper opening world",
  },
  {
    id: "Reorder the signature grant",
    file: "packages/career/src/awards.ts",
    edits: [
      {
        find: `  const grants: SignatureGrant[] = [
    { player_id: split.player_id, signature: "pillar-of-the-split", reason: "split_mvp" },
  ];
  for (const playerId of championshipStarters(finalSeries)) {
    grants.push({ player_id: playerId, signature: "convergence-crown", reason: "championship_starter" });
  }
  grants.push({ player_id: finalsId, signature: "finals-poise", reason: "finals_mvp" });`,
        replace: `  const grants: SignatureGrant[] = [];
  grants.push({ player_id: finalsId, signature: "finals-poise", reason: "finals_mvp" });
  for (const playerId of championshipStarters(finalSeries)) {
    grants.push({ player_id: playerId, signature: "convergence-crown", reason: "championship_starter" });
  }
  grants.push({ player_id: split.player_id, signature: "pillar-of-the-split", reason: "split_mvp" });`,
      },
    ],
    testFilter: "grants Pillar, then Crown",
  },
  {
    id: "seriesMvp: swap mean rating ↔ maps",
    file: "packages/career/src/series.ts",
    edits: [
      {
        find: `    if (am !== bm) return bm - am;
    if (a[1].maps !== b[1].maps) return b[1].maps - a[1].maps;`,
        replace: `    if (a[1].maps !== b[1].maps) return b[1].maps - a[1].maps;
    if (am !== bm) return bm - am;`,
      },
    ],
    testFilter: "orders series MVP",
  },
  {
    id: "seriesMvp: swap maps ↔ mean z",
    file: "packages/career/src/series.ts",
    edits: [
      {
        find: `    if (a[1].maps !== b[1].maps) return b[1].maps - a[1].maps;
    const az = meanMapRating(a[1].z, a[1].maps);
    const bz = meanMapRating(b[1].z, b[1].maps);
    if (az !== bz) return bz - az;`,
        replace: `    const az = meanMapRating(a[1].z, a[1].maps);
    const bz = meanMapRating(b[1].z, b[1].maps);
    if (az !== bz) return bz - az;
    if (a[1].maps !== b[1].maps) return b[1].maps - a[1].maps;`,
      },
    ],
    testFilter: "orders series MVP",
  },
  {
    id: "seriesMvp: swap mean z ↔ lower player_id",
    file: "packages/career/src/series.ts",
    edits: [
      {
        find: `    if (az !== bz) return bz - az;
    if (a[0] < b[0]) return -1;
    if (a[0] > b[0]) return 1;`,
        replace: `    if (a[0] < b[0]) return -1;
    if (a[0] > b[0]) return 1;
    if (az !== bz) return bz - az;`,
      },
    ],
    testFilter: "orders series MVP",
  },
];

function runVitest(filter: string): { ok: boolean; tail: string } {
  try {
    const out = execSync(`npx vitest run -t ${JSON.stringify(filter)}`, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, tail: out.split("\n").slice(-8).join("\n") };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string };
    const out = (err.stdout ?? "") + (err.stderr ?? "");
    return { ok: false, tail: out.split("\n").slice(-12).join("\n") };
  }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "career-mutation-"));
const rows: string[] = [];
let pass = true;

console.log(`claimed_in_request=18`);
console.log(`listed_in_pm_package=${probes.length}`);
console.log(`temp_copies=${tmp}`);

for (const [index, probe] of probes.entries()) {
  const file = path.join(root, probe.file);
  const backup = path.join(tmp, `${index}-${path.basename(probe.file)}`);
  const original = fs.readFileSync(file, "utf8");
  fs.writeFileSync(backup, original);
  let turnedRed = false;
  let note = "";
  try {
    let text = original;
    for (const edit of probe.edits) {
      if (!text.includes(edit.find)) {
        note = "FIND STRING MISSING";
        break;
      }
      const next = edit.all ? text.replaceAll(edit.find, edit.replace) : text.replace(edit.find, edit.replace);
      if (next === text) {
        note = "REPLACE DID NOT CHANGE THE FILE";
        break;
      }
      text = next;
    }
    if (!note) {
      fs.writeFileSync(file, text);
      const result = runVitest(probe.testFilter);
      turnedRed = !result.ok;
      note = turnedRed ? "killed" : "SURVIVED — tests stayed green";
    }
  } finally {
    fs.copyFileSync(backup, file);
    if (fs.readFileSync(file, "utf8") !== original) {
      note = "RESTORE FAILED";
      turnedRed = false;
    }
  }
  if (!turnedRed) pass = false;
  const row = `| ${index + 1} | ${probe.id} | ${turnedRed ? "YES" : "NO"} | ${note} |`;
  rows.push(row);
  console.log(row);
}

const header = `# Career mutation kill log

The request named 18 mutations. \`career-PM-PACKAGE.md\` lists 16, and this probe runs those 16. There is no 17th or 18th row in that table.

Each edit was written over the working file only after a byte copy in \`${tmp}\`, then restored from that copy.

| # | Mutation | Turned red? | Note |
|---|---|---|---|
${rows.join("\n")}

mutation_probe_pass=${pass}
listed=16
claimed=18
`;

const logPath = path.join(root, "lab/career/mutation-kill.md");
fs.writeFileSync(logPath, header);
console.log(`mutation_probe_pass=${pass}`);
process.exit(pass ? 0 : 1);
