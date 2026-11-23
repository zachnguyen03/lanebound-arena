/**
 * S1 mutation probe — each single edit must turn ≥1 test red.
 * Writes results to stdout as markdown table rows.
 *
 * Anchors track current kits.ts / combat.ts / cast.ts / simulate.ts shapes
 * (AbilityDef uses shape/kind/damage.base — not the old type/effect/l7_formula fields).
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Kit-number asserts live in one authored test; sim behavior uses its own -t names. */
const KIT_AUTHORED = "Huntress Q formula and Kerrig R cast 0.7 authored";

const probes: Array<{ id: string; file: string; find: string; replace: string; testFilter: string }> = [
  {
    id: "Huntress Q CD 8→9",
    file: "data/champions/kits.ts",
    find: `name: "Keen Bolt",
      unlock: "L1",
      shape: "line",
      range: 8,
      length: 8,
      width: 0.5,
      pierce: "all",
      school: "physical",
      damage: { base: 110, atk: 0.8 },
      CD_s: 8,`,
    replace: `name: "Keen Bolt",
      unlock: "L1",
      shape: "line",
      range: 8,
      length: 8,
      width: 0.5,
      pierce: "all",
      school: "physical",
      damage: { base: 110, atk: 0.8 },
      CD_s: 9,`,
    testFilter: KIT_AUTHORED,
  },
  {
    id: "Tolle W banish duration 1.8→1.5",
    file: "data/champions/kits.ts",
    find: `cc: [{ kind: "banish", category: "Lock", duration_s: 1.8, school: "magic" }],`,
    replace: `cc: [{ kind: "banish", category: "Lock", duration_s: 1.5, school: "magic" }],`,
    testFilter: KIT_AUTHORED,
  },
  {
    id: "Saelo R radius 2.4→2.0",
    file: "data/champions/kits.ts",
    find: `name: "Still Hour",
      unlock: "L5",
      shape: "circle_point",
      range: 8,
      radius: 2.4,`,
    replace: `name: "Still Hour",
      unlock: "L5",
      shape: "circle_point",
      range: 8,
      radius: 2.0,`,
    testFilter: KIT_AUTHORED,
  },
  {
    id: "Maelis R base 350→340",
    file: "data/champions/kits.ts",
    find: `damage: { base: 350, pow: 1.7 },`,
    replace: `damage: { base: 340, pow: 1.7 },`,
    testFilter: KIT_AUTHORED,
  },
  {
    id: "Huntress R base 230→220",
    file: "data/champions/kits.ts",
    find: `damage: { base: 230, atk: 1.05 },`,
    replace: `damage: { base: 220, atk: 1.05 },`,
    testFilter: KIT_AUTHORED,
  },
  {
    id: "Kerrig R base 330→320",
    file: "data/champions/kits.ts",
    find: `damage: { base: 330, atk: 1.4, pow: 0.15 },`,
    replace: `damage: { base: 320, atk: 1.4, pow: 0.15 },`,
    testFilter: KIT_AUTHORED,
  },
  {
    id: "banish skip removed (invuln)",
    file: "sim/combat.ts",
    find: `    if (isBanished(target.status)) continue;

    if (state.t < target.spawn_shield_until || state.t < target.status.spawn_shield_until) {`,
    replace: `    if (false && isBanished(target.status)) continue;

    if (state.t < target.spawn_shield_until || state.t < target.status.spawn_shield_until) {`,
    testFilter: "Tolle W banish",
  },
  {
    id: "CC assist credit removed",
    file: "sim/cast.ts",
    find: `    recordAssistCredit(tgt, src.id, state.t, "cc");
    emit("status_apply", {`,
    replace: `    // recordAssistCredit(tgt, src.id, state.t, "cc");
    emit("status_apply", {`,
    testFilter: "CC and heal assists grant XP",
  },
  {
    id: "heal assist credit removed",
    file: "sim/simulate.ts",
    find: `        tgt.hp = Math.min(tgt.max_hp, tgt.hp + h.amount);
        recordAssistCredit(tgt, src.id, state.t, "heal");`,
    replace: `        tgt.hp = Math.min(tgt.max_hp, tgt.hp + h.amount);
        // recordAssistCredit(tgt, src.id, state.t, "heal");`,
    testFilter: "CC and heal assists grant XP",
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
    id: "Mirren W slow 35→25",
    file: "data/champions/kits.ts",
    find: `      cc: [{ kind: "hex", category: "Lock", duration_s: 1.6, school: "magic" }],
      slow: { pct: 0.35, duration_s: 1.6, school: "magic" },
      hex_from_caster: true,`,
    replace: `      cc: [{ kind: "hex", category: "Lock", duration_s: 1.6, school: "magic" }],
      slow: { pct: 0.25, duration_s: 1.6, school: "magic" },
      hex_from_caster: true,`,
    testFilter: KIT_AUTHORED,
  },
];

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
const pass = rows.every((r) => r.failed);
console.log(`mutation_probe_pass=${pass}`);
process.exit(pass ? 0 : 1);
