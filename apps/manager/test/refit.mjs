// One-command fast-engine calibration (npm run manager:refit): plays full-engine games in parallel with the career
// config (milestones, attribute scaling, career balance) and prints test/fit.mjs merge, ending with a constants
// block for js/fastsim.js and ROLE_MEANS for js/engine.ts. Run it after any change to the sim or career balance.
//   node apps/manager/test/refit.mjs [games per case = 600]
import { execFile } from 'node:child_process';
import { cpus } from 'node:os';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const n = +(process.argv[2] ?? 600), chunk = 100, fit = fileURLToPath(new URL('./fit.mjs', import.meta.url));
const jobs = [];
for (const [gap, mode] of [[0, ''], [4, ''], [8, ''], [16, ''], [0, 'patch']]) for (let off = 0; off < n; off += chunk) jobs.push(['run', gap, Math.min(chunk, n - off), off, mode].filter(x => x !== '').map(String));
const lines = [];
const worker = async () => { for (let j; (j = jobs.shift());) lines.push(await new Promise((ok, fail) => execFile('npx', ['tsx', fit, ...j], { maxBuffer: 1 << 26 }, (e, out) => (e ? fail(e) : ok(out.trim()))))); };
const t0 = Date.now(), total = jobs.length;
await Promise.all(Array.from({ length: Math.max(1, cpus().length - 2) }, worker));
if (process.env.REFIT_OUT) writeFileSync(process.env.REFIT_OUT, lines.join('\n') + '\n'); // raw lines, to re-merge after pasting
console.error(`${total} jobs, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
const merge = execFile('npx', ['tsx', fit, 'merge'], { maxBuffer: 1 << 26 }, (e, out, err) => { process.stdout.write(out); if (e) { process.stderr.write(err); process.exit(1); } });
merge.stdin.end(lines.join('\n') + '\n');
