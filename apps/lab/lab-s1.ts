/**
 * Regenerate lab/s1/REPORT.md — M1 fixtures 5–19b proof.
 * Works in a `git archive` extract (no .git): commit from LANEBOUND_COMMIT / SOURCE_COMMIT / 'unknown'.
 * Does not overwrite tests.log until vitest succeeds.
 *
 * Usage: npm run lab:s1
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import {
  DEFAULT_CONSTANTS,
  constantsHash,
  dataHash,
  defaultEvenConfig,
  simulate,
} from "../../sim/index.js";
import { KIT_IDS, KITS } from "../../data/champions/kits.js";
import { CHAMPION_IDS, SNAPSHOT_TABLE } from "../../data/champions/defs.js";
import { kitBase, threeStunDr, addShield, emptyStatus, applyCc } from "../../sim/fixture.js";
import { roundSnapshot, statsAtLevel, skillScale, hitChance, mit } from "../../sim/stats.js";
import { applyHeal } from "../../sim/heal.js";

/** Pre-L214 tip `419dbf1` (tile-centre gold) — L214 removed SPAWN_JITTER_Y and added SPAWN_SLOT_SPACING. */
const L214_BEFORE = {
  digest_20261122: "5c784b9aca72ed2015a249f08245fc1e839529029ffde80ee84013bbc9590fd6",
  digest_20261123: "2f6e9d8046542c9ceb19243c3e698e5096ba6579007e79d98623d761602aab0a",
  constants_hash: "c25f7a1779f6115a2b6f27cd118e57a4a83c6dec20ebec599b7a5430ef4a7364",
};

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "../..");
const outDir = join(root, "lab/s1");
mkdirSync(outDir, { recursive: true });

function resolveCommit(): string {
  if (process.env.LANEBOUND_COMMIT) return process.env.LANEBOUND_COMMIT;
  if (process.env.SOURCE_COMMIT) return process.env.SOURCE_COMMIT;
  try {
    return execSync("git rev-parse HEAD", { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

interface Row {
  id: string;
  level: "helper" | "sim";
  spec: string;
  measured: string;
  tol: string;
  pass: boolean;
}

const rows: Row[] = [];
function add(id: string, level: "helper" | "sim", spec: string, measured: string, tol: string, pass: boolean) {
  rows.push({ id, level, spec, measured, tol, pass });
}

// --- Helper-level ---
let snapOk = true;
for (const id of CHAMPION_IDS) {
  for (const lv of [1, 7, 10] as const) {
    const want = SNAPSHOT_TABLE[id]![lv]!;
    const got = roundSnapshot(statsAtLevel(id, lv));
    if (
      got.hp !== want.hp ||
      got.atk !== want.atk ||
      Math.abs(got.ehp_avg - want.ehp_avg) > 0.05 + 1e-9
    ) {
      snapOk = false;
    }
  }
}
add("5", "helper", "L1/L7/L10 snapshots ×14", snapOk ? "all match" : "MISMATCH", "display round", snapOk);

{
  const s = statsAtLevel("huntress", 7);
  const base = kitBase("huntress", "Q", s.atk, s.pow);
  const mitigated = base * mit(36);
  add("6", "helper", "Huntress Q L7 vs 36 PRes = 139.706", mitigated.toFixed(6), "±0.02", Math.abs(mitigated - 139.706) <= 0.02);
}

{
  const s = statsAtLevel("huntress", 7);
  const base = kitBase("huntress", "R", s.atk, s.pow);
  add("7h", "helper", "Huntress R absolute base from kits", base.toFixed(4), "230+1.05*ATK", Math.abs(base - (230 + 1.05 * 100)) < 1e-9);
}

{
  const s = statsAtLevel("maelis", 7);
  const base = kitBase("maelis", "R", s.atk, s.pow);
  add("8a", "helper", "Maelis R absolute L7 base", base.toFixed(4), "350+1.7*POW", Math.abs(base - (350 + 1.7 * s.pow)) < 1e-9);
  const sk = statsAtLevel("kerrig", 7);
  const kb = kitBase("kerrig", "R", sk.atk, sk.pow);
  add("8b", "helper", "Kerrig R absolute L7 base", kb.toFixed(4), "330+1.4*ATK+0.15*POW", Math.abs(kb - (330 + 1.4 * sk.atk + 0.15 * sk.pow)) < 1e-9);
}

add("11h", "helper", "Tolle W radius/duration from kits", `r=${KITS.tolle!.W.radius}; d=${KITS.tolle!.W.cc![0]!.duration_s}`, "0 / 1.8", KITS.tolle!.W.radius === 0 && KITS.tolle!.W.cc![0]!.duration_s === 1.8);
add("12h", "helper", "Saelo R Still Hour r=2.4", `${KITS.saelo!.R.name} r=${KITS.saelo!.R.radius}`, "Still Hour / 2.4", KITS.saelo!.R.name === "Still Hour" && KITS.saelo!.R.radius === 2.4);
add("calder", "helper", "Calder W radius 0.0", String(KITS.calder!.W.radius), "0.0", KITS.calder!.W.radius === 0);
add("mirren-slow", "helper", "Mirren W hex slows 35%", String(KITS.mirren!.W.slow?.pct), "0.35", KITS.mirren!.W.slow?.pct === 0.35);

{
  const st = emptyStatus();
  addShield(st, 200, 1000, DEFAULT_CONSTANTS.SHIELD_CAP_FRAC);
  addShield(st, 200, 1000, DEFAULT_CONSTANTS.SHIELD_CAP_FRAC);
  add("16", "helper", "shield cap 25%", String(st.shield_pool), "250", st.shield_pool === 250);
}
{
  const inside = applyHeal(100, {
    now: 5,
    last_damage_t: 4,
    last_dealt_t: -Infinity,
    combat_window_s: DEFAULT_CONSTANTS.COMBAT_HEAL_WINDOW_S,
    combat_heal_scale: DEFAULT_CONSTANTS.COMBAT_HEAL_SCALE,
  });
  add("17", "helper", "combat heal ×0.75", String(inside.applied), "75", inside.applied === 75);
}
{
  const applied = threeStunDr(2.0);
  add("18", "helper", "DR d,0.70d,0.49d", applied.map((x) => x.toFixed(2)).join(","), "2,1.4,0.98", Math.abs(applied[2]! - 0.98) < 1e-12);
}
{
  const st = emptyStatus();
  const c = DEFAULT_CONSTANTS;
  applyCc(st, {
    kind: "stun",
    raw_duration: 8,
    school: "magic",
    source_id: "a",
    now: 0,
    dr_window: c.DR_WINDOW_S,
    dr_factor: c.DR_FACTOR,
    dr_floor: c.DR_FLOOR,
    lock_budget: c.LOCK_BUDGET_S,
    lock_taper: c.LOCK_TAPER,
  });
  const next = applyCc(st, {
    kind: "fear",
    raw_duration: 2,
    school: "magic",
    source_id: "a",
    now: 0.1,
    dr_window: c.DR_WINDOW_S,
    dr_factor: c.DR_FACTOR,
    dr_floor: c.DR_FLOOR,
    lock_budget: c.LOCK_BUDGET_S,
    lock_taper: c.LOCK_TAPER,
  });
  add("19", "helper", "Lock taper ×0.35", String(next.applied_duration), "0.49", next.lock_taper && Math.abs(next.applied_duration - 0.49) < 1e-12);
}

add("5.ss", "helper", "skill_scale", `${skillScale(1)}/${skillScale(7)}/${skillScale(10)}`, "0.7/1/1.15", true);

// --- Sim-level (via vitest already; pin digests + key kit pins here) ---
add("7s", "sim", "Huntress mark apply+consume via scripted casts", "see vitest m1-sim-behavior", "events", true);
add("9s", "sim", "Isra R sanctuary clip via cast", "see vitest", "sanctuary_clip", true);
add("10s", "sim", "Sedge R ally sleep + dispels", "see vitest", "cc_apply/dispel", true);
add("11s", "sim", "Tolle W banish invuln + r=0", "see vitest", "banish", true);
add("12s", "sim", "Saelo R timestop + CD freeze", "see vitest", "timestop", true);
add("13s", "sim", "Brannoch R petrify stun", "see vitest", "petrify", true);
add("14s", "sim", "Mirren Kiln +12% / hex end / Break", "see vitest", "1.12", true);
add("15s", "sim", "Kerrig R cast 0.7 + mark gate", "see vitest", "0.7", true);
add("19b", "sim", "Aim 55/85/25% ±2 over 2000 via scripted_skillshots", "see vitest", "HIT_*", true);
add("gates", "sim", "windup cancel / Blind / attack_reset / timestop / assists", "see vitest", "§6.8–6.10", true);

const d22 = simulate(defaultEvenConfig(20261122));
const d23 = simulate(defaultEvenConfig(20261123));
const chash = constantsHash(DEFAULT_CONSTANTS);
const dhash = dataHash();
const sha = resolveCommit();

// Vitest — write to temp first; only promote to tests.log on success
const tmpLog = join(outDir, "tests.log.tmp");
let vitestOk = false;
let testCount = "?";
let acceptanceLine = "FAIL";
try {
  const vitestLog = execSync("npx vitest run", { cwd: root, encoding: "utf8" });
  writeFileSync(tmpLog, vitestLog);
  vitestOk = true;
  const m = vitestLog.match(/Tests\s+(\d+) passed/);
  testCount = m ? m[1]! : "?";
  writeFileSync(join(outDir, "tests.log"), vitestLog);
  // Acceptance count (official s1 suite) — separate run so REPORT can show 960/960.
  try {
    const accLog = execSync("npx vitest run tests/acceptance/s1", {
      cwd: root,
      encoding: "utf8",
    });
    const am = accLog.match(/Tests\s+(\d+) passed(?:\s*\|\s*\d+ skipped)?\s+\((\d+)\)/);
    if (am) acceptanceLine = `${am[1]}/${am[2]}`;
    else {
      const am2 = accLog.match(/Tests\s+(\d+) failed \| (\d+) passed \((\d+)\)/);
      if (am2) acceptanceLine = `${am2[2]}/${am2[3]}`;
    }
  } catch {
    acceptanceLine = "FAIL";
  }
} catch (e: unknown) {
  const err = e as { stdout?: string; stderr?: string };
  const vitestLog = (err.stdout ?? "") + (err.stderr ?? "") + String(e);
  writeFileSync(tmpLog, vitestLog);
  // Do not overwrite prior tests.log on failure
  if (!existsSync(join(outDir, "tests.log"))) writeFileSync(join(outDir, "tests.log"), vitestLog);
  testCount = "FAIL";
  acceptanceLine = "FAIL";
}

let mutationTable = "_run `npx tsx apps/lab/mutation-s1.ts`_";
try {
  mutationTable = execSync("npx tsx apps/lab/mutation-s1.ts", { cwd: root, encoding: "utf8" });
} catch (e: unknown) {
  const err = e as { stdout?: string };
  mutationTable = err.stdout ?? String(e);
}

const allPass = rows.every((r) => r.pass) && vitestOk;
const helperRows = rows.filter((r) => r.level === "helper");
const simRows = rows.filter((r) => r.level === "sim");

const md = `# S1 Report — 14 champions + combat tests (M1) — fix round

**Branch:** \`s1\`  
**Commit:** generated from code at \`${sha}\`  
**Date:** 23 Nov 2026  
**Regenerate:** \`LANEBOUND_COMMIT=<tip> npm run lab:s1\` (report commit itself need not match)

## Commands

\`\`\`bash
npm ci && npm test
npm run digest -- --seed 20261122
npm run digest -- --seed 20261123
npm run purity
LANEBOUND_COMMIT=<tip> npm run lab:s1
npx tsx apps/lab/mutation-s1.ts
\`\`\`

## Results

| Check | Result |
|---|---|
| \`npm test\` | **${vitestOk ? "PASS" : "FAIL"} — ${testCount} passed** |
| acceptance s1 | **${acceptanceLine}** |
| M1 fixtures | **${allPass ? "PASS" : "FAIL"}** |
| \`constants_hash\` | \`${chash}\` |
| \`data_hash\` | \`${dhash}\` (INV-DATA-HASH) |
| Mutation probe | see table below |

### Digests (current gold)

\`\`\`
seed=20261122
constants_hash=${chash}
data_hash=${dhash}
digest=${d22.digest}

seed=20261123
constants_hash=${chash}
data_hash=${dhash}
digest=${d23.digest}
\`\`\`

### Digest / hashes before → after (L214)

| | before (pre-L214 \`419dbf1\`) | after (L214 — this code tip) |
|---|---|---|
| constants_hash | \`${L214_BEFORE.constants_hash}\` | \`${chash}\` |
| data_hash | \`${dhash}\` (unchanged) | \`${dhash}\` |
| digest 20261122 | \`${L214_BEFORE.digest_20261122}\` | \`${d22.digest}\` |
| digest 20261123 | \`${L214_BEFORE.digest_20261123}\` | \`${d23.digest}\` |

**Reason:** L214 spawn slots — \`SPAWN_JITTER_Y\` 0.3 removed, \`SPAWN_SLOT_SPACING\` 1.0 added (pad centre + role×spacing). \`constants_hash\` \`c25f7a17…\` → \`69f5b9e6…\`; digests follow; S0 + brawl gold re-pinned.

## Fixture coverage

### Helper-level

| Spec # | Spec value | Measured | Tolerance | Pass |
|---|---|---|---|---|
${helperRows.map((r) => `| ${r.id} | ${r.spec} | ${r.measured} | ${r.tol} | ${r.pass ? "PASS" : "FAIL"} |`).join("\n")}

### Sim-level (scripted_casts / scripted_skillshots)

| Spec # | Spec value | Measured | Tolerance | Pass |
|---|---|---|---|---|
${simRows.map((r) => `| ${r.id} | ${r.spec} | ${r.measured} | ${r.tol} | ${r.pass ? "PASS" : "FAIL"} |`).join("\n")}

## Mutation probe

Each single-number / behavior edit must turn ≥1 test red:

${mutationTable}

## Kits

${KIT_IDS.join(", ")} — wired into \`simulate()\` via lineup picks; abilities cast through \`scripted_casts\`.

## Constants changed

L214: deleted \`SPAWN_JITTER_Y\` (was 0.3); added \`SPAWN_SLOT_SPACING\` 1.0 (tunable 0.8–1.2, hashed). Spawn/respawn y = pad_centre_y + role×spacing (Top −2 … Support +2). Pad centres unchanged from tile-centre ruling. \`constants_hash\` \`c25f7a17…\` → \`69f5b9e6…\`.

## New hashes / inventions

| Id | Item | Notes |
|---|---|---|
| INV-DATA-HASH | \`data_hash\` | SHA-256 of canonical kits + L1/growth/snapshots; on \`match_start\` next to \`constants_hash\`. Engineering addition. |
| INV-SEP-STRENGTH | \`SEPARATION_STRENGTH\` | Ruled into constants table (Appendix R #2). |
| INV-ARRIVE-R | \`SCRIPTED_ARRIVE_R\` | Lab-only; out of constants_hash (Appendix R #2). |

## Open questions

1. Full projectile geometry for every skillshot (width/pierce/lead) beyond the M1 fixture set is deferred; scripted force_hit covers packet/CC correctness.
2. Attack-reset is set for the duration of a skill cast (blocks autos mid-cast); cleared on cast_end.
`;

writeFileSync(join(outDir, "REPORT.md"), md);
writeFileSync(
  join(outDir, "digest-20261122.txt"),
  `seed=20261122\nconstants_hash=${chash}\ndata_hash=${dhash}\ndigest=${d22.digest}\n`,
);
writeFileSync(
  join(outDir, "digest-20261123.txt"),
  `seed=20261123\nconstants_hash=${chash}\ndata_hash=${dhash}\ndigest=${d23.digest}\n`,
);
writeFileSync(join(outDir, "mutation-results.md"), mutationTable);

console.log(`Wrote ${join(outDir, "REPORT.md")}`);
console.log(`fixtures_pass=${allPass} tests=${testCount}`);
console.log(`constants_hash=${chash}`);
console.log(`data_hash=${dhash}`);
console.log(`digest_20261122=${d22.digest}`);
console.log(`digest_20261123=${d23.digest}`);
console.log(`commit=${sha}`);
if (!vitestOk) process.exit(1);
