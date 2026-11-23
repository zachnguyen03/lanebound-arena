/**
 * S1 mutation probe — each single edit must turn ≥1 test red.
 * Writes results to stdout as markdown table rows.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

interface Mut {
  id: string;
  file: string;
  find: string;
  replace: string;
  expectFail: string; // vitest -t filter or file
}

const muts: Mut[] = [
  {
    id: "kit CD Huntress Q 8→9",
    file: "data/champions/kits.ts",
    find: 'name: "Keen Bolt"',
    replace: 'name: "Keen Bolt"', // handled specially
    expectFail: "kits-authored|M1-06|Huntress",
  },
];

// Concrete mutations with unique find/replace
const probes: Array<{ id: string; file: string; find: string; replace: string; testFilter: string }> = [
  {
    id: "Huntress Q CD 8→9",
    file: "data/champions/kits.ts",
    find: `name: "Keen Bolt",
      unlock: "L1",
      type: "line skillshot",
      range: 8,
      length: 8,
      width: 0.5,
      school: "physical",
      l7_formula: "110 + 80% ATK",
      CD_s: 8,`,
    replace: `name: "Keen Bolt",
      unlock: "L1",
      type: "line skillshot",
      range: 8,
      length: 8,
      width: 0.5,
      school: "physical",
      l7_formula: "110 + 80% ATK",
      CD_s: 9,`,
    testFilter: "Huntress Q formula",
  },
  {
    id: "Tolle W banish duration 1.8→1.5",
    file: "data/champions/kits.ts",
    find: `cc: [{ effect: "banish", duration_s: 1.8, category: "Lock", school: "magic" }],`,
    replace: `cc: [{ effect: "banish", duration_s: 1.5, category: "Lock", school: "magic" }],`,
    testFilter: "Huntress Q formula",
  },
  {
    id: "Saelo R radius 2.4→2.0",
    file: "data/champions/kits.ts",
    find: `name: "Still Hour",
      unlock: "L5",
      type: "circle point",
      range: 8,
      radius: 2.4,`,
    replace: `name: "Still Hour",
      unlock: "L5",
      type: "circle point",
      range: 8,
      radius: 2.0,`,
    testFilter: "Huntress Q formula",
  },
  {
    id: "Maelis R base 350→340",
    file: "data/champions/kits.ts",
    find: `l7_formula: "350 + 170% POW",`,
    replace: `l7_formula: "340 + 170% POW",`,
    testFilter: "Huntress Q formula",
  },
  {
    id: "Huntress R base 230→220",
    file: "data/champions/kits.ts",
    find: `l7_formula: "230 + 105% ATK",`,
    replace: `l7_formula: "220 + 105% ATK",`,
    testFilter: "Huntress Q formula",
  },
  {
    id: "Kerrig R base 330→320",
    file: "data/champions/kits.ts",
    find: `l7_formula: "330 + 140% ATK + 15% POW",`,
    replace: `l7_formula: "320 + 140% ATK + 15% POW",`,
    testFilter: "Huntress Q formula",
  },
  {
    id: "banish skip removed (invuln)",
    file: "sim/combat.ts",
    find: `    if (isBanished(target.status)) continue;

    if (state.t < target.spawn_shield_until) {`,
    replace: `    if (false && isBanished(target.status)) continue;

    if (state.t < target.spawn_shield_until) {`,
    testFilter: "Tolle W banish",
  },
  {
    id: "CC assist credit removed",
    file: "sim/cast.ts",
    find: `    if (!r.rejected && r.applied_duration > 0) {
      recordAssistCredit(target, source.id, state.t, "cc");`,
    replace: `    if (!r.rejected && r.applied_duration > 0) {
      // recordAssistCredit(target, source.id, state.t, "cc");`,
    testFilter: "CC and heal assists",
  },
  {
    id: "heal assist credit removed",
    file: "sim/simulate.ts",
    find: `        tgt.hp = Math.min(tgt.max_hp, tgt.hp + h.amount);
        recordAssistCredit(tgt, src.id, state.t, "heal");`,
    replace: `        tgt.hp = Math.min(tgt.max_hp, tgt.hp + h.amount);
        // recordAssistCredit(tgt, src.id, state.t, "heal");`,
    testFilter: "CC and heal assists",
  },
  {
    id: "Blind miss disabled",
    file: "sim/combat.ts",
    find: `      // Blind: autos miss (§6.5 / §6.8).
      if (isBlind(atk.status)) {`,
    replace: `      // Blind: autos miss (§6.5 / §6.8).
      if (false && isBlind(atk.status)) {`,
    testFilter: "Blind makes autos miss",
  },
  {
    id: "time-stop auto pause disabled",
    file: "sim/combat.ts",
    find: `    // Time-stop pauses windup countdown (§6.5).
    if (isTimeStopped(atk.status)) continue;`,
    replace: `    // Time-stop pauses windup countdown (§6.5).
    if (false && isTimeStopped(atk.status)) continue;`,
    testFilter: "time-stop pauses auto",
  },
  {
    id: "Mirren W slow 35→25 in notes+apply",
    file: "data/champions/kits.ts",
    find: `notes: "hex also slows 35%",`,
    replace: `notes: "hex also slows 25%",`,
    testFilter: "Huntress Q formula",
  },
];

void muts;

function runVitest(filter: string): { ok: boolean; out: string } {
  try {
    const out = execSync(`npx vitest run -t ${JSON.stringify(filter)}`, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, out };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string };
    return { ok: false, out: (err.stdout ?? "") + (err.stderr ?? "") };
  }
}

const rows: Array<{ id: string; failed: boolean; note: string }> = [];

for (const p of probes) {
  const fp = path.join(root, p.file);
  const orig = fs.readFileSync(fp, "utf8");
  if (!orig.includes(p.find)) {
    rows.push({ id: p.id, failed: false, note: "FIND STRING MISSING — probe skipped" });
    continue;
  }
  fs.writeFileSync(fp, orig.replace(p.find, p.replace));
  const r = runVitest(p.testFilter);
  fs.writeFileSync(fp, orig); // restore
  const turnedRed = !r.ok;
  rows.push({
    id: p.id,
    failed: turnedRed,
    note: turnedRed ? "≥1 test red" : "ALL STILL GREEN — gap",
  });
}

console.log("| Mutation | Turns red? | Note |");
console.log("|---|---|---|");
for (const row of rows) {
  console.log(`| ${row.id} | ${row.failed ? "YES" : "NO"} | ${row.note} |`);
}
const allGood = rows.every((r) => r.failed || r.note.includes("MISSING"));
console.log(`mutation_probe_pass=${rows.every((r) => r.failed)}`);
process.exit(rows.every((r) => r.failed) ? 0 : 1);
