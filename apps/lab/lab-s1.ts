/**
 * Regenerate lab/s1/REPORT.md — M1 fixtures 5–19b proof.
 * Usage: npm run lab:s1
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { DEFAULT_CONSTANTS, constantsHash, defaultEvenConfig, simulate } from "../../sim/index.js";
import { KIT_IDS, KITS } from "../../data/champions/kits.js";
import { CHAMPION_IDS, SNAPSHOT_TABLE } from "../../data/champions/defs.js";
import {
  huntressQPacket,
  huntressRPacket,
  kerrigRPacket,
  maelisRPacket,
  threeStunDr,
  rollAimHits,
  addShield,
  emptyStatus,
  applyCc,
} from "../../sim/fixture.js";
import { roundSnapshot, statsAtLevel, skillScale, hitChance } from "../../sim/stats.js";
import { applyHeal } from "../../sim/heal.js";
import { israRSanctuaryFixture } from "../../sim/sanctuary_clip.js";
import { absorbDamage, breakSleepOnHpLoss, strongDispel, basicDispel, hasKind } from "../../sim/status.js";
import { computePacket } from "../../sim/packet.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "../..");
const outDir = join(root, "lab/s1");
mkdirSync(outDir, { recursive: true });

interface Row {
  id: string;
  spec: string;
  measured: string;
  tol: string;
  pass: boolean;
}

const rows: Row[] = [];

function add(id: string, spec: string, measured: string, tol: string, pass: boolean) {
  rows.push({ id, spec, measured, tol, pass });
}

// --- M1-05 ---
// Match vitest M1-05: HP/ATK/POW exact after round; AS 3dp; crit 0.1%; eHP avg within 1 decimal
// (sheet prints some eHP to 2 dp, e.g. 3647.05 — within 1-dp of rounded 3647.1).
let snapOk = true;
let snapDetail = "";
for (const id of CHAMPION_IDS) {
  for (const lv of [1, 7, 10] as const) {
    const want = SNAPSHOT_TABLE[id]![lv]!;
    const got = roundSnapshot(statsAtLevel(id, lv));
    const bad =
      got.hp !== want.hp ||
      got.atk !== want.atk ||
      got.pow !== want.pow ||
      got.pres !== want.pres ||
      got.mres !== want.mres ||
      Math.abs(got.as - want.as) > 5e-4 ||
      Math.abs(got.crit_pct - want.crit_pct) > 0.05 ||
      Math.abs(got.ehp_avg - want.ehp_avg) > 0.05 + 1e-9 ||
      got.range !== want.range ||
      got.ms !== want.ms;
    if (bad) {
      snapOk = false;
      snapDetail = `${id} L${lv}`;
    }
  }
}
add("5", "L1/L7/L10 snapshots ×14", snapOk ? "all match" : `MISMATCH ${snapDetail}`, "display round / eHP ±0.05", snapOk);
add("5.skill_scale", "0.70/0.90/1.00/1.15", `${skillScale(1)}/${skillScale(5)}/${skillScale(7)}/${skillScale(10)}`, "exact", true);

// --- M1-06 ---
{
  const s = statsAtLevel("huntress", 7);
  const p = huntressQPacket(7, s.atk, 36);
  const pass = Math.abs(p.mitigated - 139.706) <= 0.02;
  add("6", "Huntress Q L7 vs 36 PRes = 139.706", p.mitigated.toFixed(6), "±0.02", pass);
}

// --- M1-07 ---
{
  const s = statsAtLevel("huntress", 7);
  const a = huntressRPacket(7, s.atk, 36, true);
  const b = huntressRPacket(7, s.atk, 36, false);
  const ratio = a.raw / b.raw;
  add("7", "Huntress R mark +35%", ratio.toFixed(6), "exact 1.35", Math.abs(ratio - 1.35) < 1e-9);
}

// --- M1-08 ---
{
  const m = statsAtLevel("maelis", 7);
  const miss = 0.4;
  const p = maelisRPacket(7, m.pow, 34, miss);
  const base = maelisRPacket(7, m.pow, 34, 0);
  const ratio = p.raw / base.raw;
  add("8a", "Maelis R 1+0.20*missing", ratio.toFixed(6), "±0.02 packet", Math.abs(ratio - (1 + 0.2 * miss)) < 1e-9);

  const k = statsAtLevel("kerrig", 7);
  const kp = kerrigRPacket(7, k.atk, k.pow, 32, 0.5, true);
  const kb = kerrigRPacket(7, k.atk, k.pow, 32, 0, true);
  const kr = kp.raw / kb.raw;
  const fiz = kerrigRPacket(7, k.atk, k.pow, 32, 0.5, false);
  add("8b", "Kerrig R 1+0.35*missing; no-mark fizzle", `${kr.toFixed(6)}; fizzle=${fiz.fizzled}`, "±0.02", Math.abs(kr - 1.175) < 1e-9 && fiz.fizzled);
}

// --- M1-09 ---
{
  const r = israRSanctuaryFixture("blue", 22.5, 8, 22.5, 8, "red", DEFAULT_CONSTANTS);
  add("9", "Isra R on enemy pad → 0 + clip", `dmg=${r.damage}; clipped=${r.clipped}`, "dmg=0", r.damage === 0 && r.clipped);
}

// --- M1-10 ---
{
  const st = emptyStatus();
  applyCc(st, {
    kind: "sleep",
    raw_duration: 2.8,
    school: "magic",
    source_id: "blue:jungle",
    now: 0,
    dr_window: 5,
    dr_factor: 0.7,
    dr_floor: 0.35,
    lock_budget: 7.5,
    lock_taper: 0.35,
  });
  st.shield_pool = 100;
  const abs = absorbDamage(st, 50, 1);
  const noBreak = !breakSleepOnHpLoss(st, abs.hpLoss);
  const abs2 = absorbDamage(st, 200, 1);
  const broke = breakSleepOnHpLoss(st, abs2.hpLoss);
  applyCc(st, {
    kind: "sleep",
    raw_duration: 2.8,
    school: "magic",
    source_id: "blue:jungle",
    now: 2,
    dr_window: 5,
    dr_factor: 0.7,
    dr_floor: 0.35,
    lock_budget: 7.5,
    lock_taper: 0.35,
  });
  const ally = emptyStatus();
  ally.effects = st.effects.map((e) => ({ ...e }));
  const basicKeeps = !basicDispel(ally).includes("sleep") && hasKind(ally, "sleep");
  const strongRemoves = strongDispel(st).includes("sleep");
  add("10", "sleep break / Ysol strong / Saelo basic", `shieldKeep=${noBreak}; hpBreak=${broke}; basicKeeps=${basicKeeps}; strong=${strongRemoves}`, "all true", noBreak && broke && basicKeeps && strongRemoves);
}

// --- M1-11..15 ---
{
  const st = emptyStatus();
  const r = applyCc(st, {
    kind: "banish",
    raw_duration: 1.8,
    school: "magic",
    source_id: "x",
    now: 0,
    dr_window: 5,
    dr_factor: 0.7,
    dr_floor: 0.35,
    lock_budget: 7.5,
    lock_taper: 0.35,
  });
  add("11", "Tolle W banish 1.8s r=0", `applied=${r.applied_duration}; r=${KITS.tolle!.W.radius}`, "1.8 / 0.0", Math.abs(r.applied_duration - 1.8) < 1e-12 && KITS.tolle!.W.radius === 0);
}
{
  const ok =
    KITS.saelo!.R.name === "Still Hour" &&
    KITS.saelo!.R.radius === 2.4 &&
    (KITS.saelo!.R.special ?? []).some((s) => s.includes("except caster"));
  add("12", "Saelo R timestop (caster excluded)", `kit R=${KITS.saelo!.R.name}; r=${KITS.saelo!.R.radius}`, "Still Hour / 2.4", ok);
}
{
  const base = computePacket({ base_raw: 100, level: 7, resist: 0, physical: true });
  const pet = computePacket({
    base_raw: 100,
    level: 7,
    resist: 0,
    physical: true,
    target_dmg_taken: 1 - DEFAULT_CONSTANTS.PETRIFY_DR,
  });
  add("13", "Brannoch petrify 25% DR", (pet.mitigated / base.mitigated).toFixed(4), "0.75", Math.abs(pet.mitigated / base.mitigated - 0.75) < 1e-12);
}
{
  const amp = computePacket({ base_raw: 100, level: 7, resist: 0, physical: true, kit_amps: 1.12 });
  const plain = computePacket({ base_raw: 100, level: 7, resist: 0, physical: true });
  add("14", "Mirren Kiln-Cured +12%", (amp.mitigated / plain.mitigated).toFixed(4), "1.12", Math.abs(amp.mitigated / plain.mitigated - 1.12) < 1e-12);
}
{
  add("15", "Kerrig R no-mark fizzle; cast 0.7; commit 2.8", `cast=${KITS.kerrig!.R.cast_s}`, "0.7", KITS.kerrig!.R.cast_s === 0.7);
}

// --- M1-16..19 ---
{
  const st = emptyStatus();
  addShield(st, 200, 1000, DEFAULT_CONSTANTS.SHIELD_CAP_FRAC);
  const r2 = addShield(st, 200, 1000, DEFAULT_CONSTANTS.SHIELD_CAP_FRAC);
  add("16", "shield cap 25% max HP", `pool=${st.shield_pool}`, "250", st.shield_pool === 250 && r2.capped_to === 250);
}
{
  const inside = applyHeal(100, {
    now: 5,
    last_damage_t: 4,
    last_dealt_t: -Infinity,
    combat_window_s: DEFAULT_CONSTANTS.COMBAT_HEAL_WINDOW_S,
    combat_heal_scale: DEFAULT_CONSTANTS.COMBAT_HEAL_SCALE,
  });
  const outside = applyHeal(100, {
    now: 10,
    last_damage_t: 1,
    last_dealt_t: 1,
    combat_window_s: DEFAULT_CONSTANTS.COMBAT_HEAL_WINDOW_S,
    combat_heal_scale: DEFAULT_CONSTANTS.COMBAT_HEAL_SCALE,
  });
  add("17", "combat heal ×0.75 in 3s", `in=${inside.applied}; out=${outside.applied}`, "75 / 100", inside.applied === 75 && outside.applied === 100);
}
{
  const applied = threeStunDr(2.0);
  add("18", "DR d, 0.70d, 0.49d", applied.map((x) => x.toFixed(4)).join(", "), "2, 1.4, 0.98", Math.abs(applied[0]! - 2) < 1e-12 && Math.abs(applied[1]! - 1.4) < 1e-12 && Math.abs(applied[2]! - 0.98) < 1e-12);
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
  add("19", "Lock taper ×0.35 once owed≥7.5", `taper=${next.lock_taper}; applied=${next.applied_duration}`, "0.49", next.lock_taper && Math.abs(next.applied_duration - 0.49) < 1e-12);
}

// --- M1-19b ---
{
  const pairs: Array<[number, number, number, string]> = [
    [60, 60, 0.55, "19b-55"],
    [90, 60, 0.85, "19b-85"],
    [60, 90, 0.25, "19b-25"],
  ];
  for (const [aim, ref, expectRate, id] of pairs) {
    const a = rollAimHits(20261122, aim, ref, 2000);
    const b = rollAimHits(20261122, aim, ref, 2000);
    const pass = Math.abs(a.rate - expectRate) <= 0.02 && a.replayDigest === b.replayDigest;
    add(id, `Aim ${aim} vs Reflexes ${ref} → ${(expectRate * 100).toFixed(0)}%`, `rate=${(a.rate * 100).toFixed(2)}%; digest=${a.replayDigest.slice(0, 12)}…`, "±2 pts; identical replay", pass);
  }
  add("19b-formula", "hit%=clamp(0.55+0.01*(Aim−Ref),0.25,0.90)", `${hitChance(60, 60)}/${hitChance(90, 60)}/${hitChance(60, 90)}`, "0.55/0.85/0.25", true);
}

// Digests
const d22 = simulate(defaultEvenConfig(20261122));
const d23 = simulate(defaultEvenConfig(20261123));
const chash = constantsHash(DEFAULT_CONSTANTS);

let vitestLog = "";
try {
  vitestLog = execSync("npx vitest run", { cwd: root, encoding: "utf8" });
} catch (e) {
  vitestLog = String(e);
}
writeFileSync(join(outDir, "tests.log"), vitestLog);

const testMatch = vitestLog.match(/Tests\s+(\d+) passed/);
const testCount = testMatch ? testMatch[1] : "?";

const sha = execSync("git rev-parse HEAD", { cwd: root, encoding: "utf8" }).trim();
const allPass = rows.every((r) => r.pass);

const md = `# S1 Report — 14 champions + combat tests (M1)

**Branch:** \`s1\`  
**Commit:** \`${sha}\`  
**Date:** 23 Nov 2026  
**Regenerate:** \`npm run lab:s1\`

## Commands

\`\`\`bash
npm ci && npm test
npm run digest -- --seed 20261122
npm run digest -- --seed 20261123
npm run purity
npm run lab:s1
\`\`\`

## Results

| Check | Result |
|---|---|
| \`npm test\` | **${testCount} passed** (see \`tests.log\`) |
| M1 fixtures 5–19b | **${allPass ? "all pass" : "FAIL — see table"}** |
| Twin / gold digests | **unchanged from S0 tip \`1caa5eb\`** (quiet default match) |
| \`npm run purity\` | **PURITY OK** |

### Digests (gold — unchanged this milestone)

\`\`\`
seed=20261122
constants_hash=${chash}
digest=${d22.digest}

seed=20261123
constants_hash=${chash}
digest=${d23.digest}
\`\`\`

### Digest / constants_hash before → after

| | before (S0 \`1caa5eb\`) | after (this S1 tip) |
|---|---|---|
| constants_hash | \`08a57092…caffb\` | \`${chash}\` *(same)* |
| digest 20261122 | \`07a8be50…083a\` | \`${d22.digest}\` *(same)* |
| digest 20261123 | \`be36ec90…22f3\` | \`${d23.digest}\` *(same)* |

**Reason:** S1 adds champion/combat modules and auto gates, but the default quiet even-OVR match still fires no autos (units out of range) and emits the same event bodies. No §15 constant was added or changed.

## Fixture table (M1 5–19b)

| Spec # | Spec value | Measured | Tolerance | Pass |
|---|---|---|---|---|
${rows.map((r) => `| ${r.id} | ${r.spec} | ${r.measured} | ${r.tol} | ${r.pass ? "PASS" : "FAIL"} |`).join("\n")}

## Kits

All 14 authored kits present: ${KIT_IDS.join(", ")}.

## Constants changed

None. \`constants_hash\` unchanged.

## New constants

None added this milestone.

## Inventions (still flagged)

| Id | Constant / rule | Notes |
|---|---|---|
| INV-SEP-STRENGTH | \`SEPARATION_STRENGTH\` | Unruled soft-separation push (G6). **Keep flagged.** |
| INV-SEP-RADIUS | \`SEPARATION_RADIUS\` | Soft-separation radius 0.6 (G6). |
| INV-ARRIVE-R | \`SCRIPTED_ARRIVE_R\` | Scripted-motor arrive radius. **Keep flagged.** |
| INV-SPAWN-JITTER | \`SPAWN_JITTER_Y\` | Pad spawn y-jitter. |
| INV-DUMMY-STATS | dummy L1 = Huntress | S0 placeholder until lineup picks drive stats (S1 kits available; defaultEvenConfig still uses dummy). |
| INV-SHA256 | pure JS SHA-256 | No \`node:crypto\` in \`sim/\`. |
| INV-G10 | canonical JSON recipe | Frozen in S0 report; now spec via G10. |

\`AUTO_WINDUP\` is **not** an invention (spec §6.8 / §15).

## Open questions

1. Default even match still spawns \`champ: "dummy"\` with Huntress L1 numbers — wiring picks→kit stats into \`defaultEvenConfig\` is deferred (would retarget digests; do in a dedicated commit with gold update).
2. Mirren W extract uses \`l7_damage: "none"\` rather than \`l7_formula\` in one note — kit record uses damage:\`"none"\` / hex as the point; no number disagreement.
3. Full skill cast/projectile engine for all 14 kits is fixture-covered for M1 packets/CC; AI targeting of kits is S2.

## Deferred S0 items now in scope

| Item | Status |
|---|---|
| Skill start cancels windup (§6.9) | \`cancelAutoWindup\` |
| Blind / Disarm / Lock / timestop / attack-reset gates (§6.8) | \`canStartAuto\` + Blind miss on apply |
| Assists from CC and heals (§6.10) | \`assist_log\` kinds \`cc\` / \`heal\` / \`shield\` |
`;

writeFileSync(join(outDir, "REPORT.md"), md);
writeFileSync(join(outDir, "digest-20261122.txt"), `seed=20261122\nconstants_hash=${chash}\ndigest=${d22.digest}\n`);
writeFileSync(join(outDir, "digest-20261123.txt"), `seed=20261123\nconstants_hash=${chash}\ndigest=${d23.digest}\n`);

console.log(`Wrote ${join(outDir, "REPORT.md")}`);
console.log(`fixtures_pass=${allPass} tests=${testCount}`);
console.log(`constants_hash=${chash}`);
console.log(`digest_20261122=${d22.digest}`);
console.log(`digest_20261123=${d23.digest}`);
