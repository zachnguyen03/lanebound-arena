// Attribute-scaling calibration on the full engine. Not a test (not *.test.mjs).
//   tsx test/attr-fit.mjs go   <case> <n> <offset> [coefs-json]   -> one JSON line: { case, n, wins, champ: {id: [wins, games]} }
//   tsx test/attr-fit.mjs sum < lines                              -> win rate per case, champion spread on gap0
// ('go'/'sum', not 'run'/'merge': importing fit.mjs runs its own branches.)
// Cases: gap<G> = fit.mjs lineups (A at 60+G/2, B at 60-G/2); <attr> = even 60 lineups, A +15 in that one attribute.
// A plays blue on even games, red on odd ones (cancels the side edge). Seeds are 7e6+ (fresh vs fit.mjs).
import { createInterface } from 'node:readline';
import { runFull } from '../js/engine.ts';
import { game } from './fit.mjs';

if (process.argv[2] === 'go') {
  const [kase, n, off, coefs] = [process.argv[3], +process.argv[4], +process.argv[5], process.argv[6]];
  const opts = coefs ? { attr_scaling: coefs === 'off' ? false : JSON.parse(coefs) } : {};
  const out = { case: kase, n, wins: 0, champ: {} };
  for (let i = 7e6 + off; i < 7e6 + off + n; i++) {
    const gap = kase.startsWith('gap') ? +kase.slice(3) : 0;
    const [a, b] = game(gap, i);
    if (!kase.startsWith('gap')) for (const p of a.lineup) p[kase] += 15;
    const swap = i % 2 === 1, s = runFull(swap ? b : a, swap ? a : b, i + 1, opts);
    const aWon = s.winner === (swap ? 1 : 0);
    out.wins += aWon;
    for (const p of s.players) { const c = (out.champ[p.champ] ??= [0, 0]); c[1]++; c[0] += s.winner === p.side; }
  }
  console.log(JSON.stringify(out));
} else if (process.argv[2] === 'sum') {
  const by = {};
  for await (const l of createInterface({ input: process.stdin })) {
    if (!l.trim()) continue;
    const x = JSON.parse(l), m = (by[x.case] ??= { n: 0, wins: 0, champ: {} });
    m.n += x.n; m.wins += x.wins;
    for (const [c, [w, g]] of Object.entries(x.champ)) { const t = (m.champ[c] ??= [0, 0]); t[0] += w; t[1] += g; }
  }
  for (const [k, m] of Object.entries(by)) {
    const p = m.wins / m.n;
    console.log(`${k.padEnd(12)} n ${m.n}  A wins ${(p * 100).toFixed(1)}% ± ${(Math.sqrt(p * (1 - p) / m.n) * 196).toFixed(1)}`);
  }
  if (by.gap0) console.log('gap0 champion win%:', Object.entries(by.gap0.champ).map(([c, [w, g]]) => [c, w / g]).sort((a, b) => a[1] - b[1]).map(([c, p]) => `${c} ${(p * 100).toFixed(0)}`).join(', '));
}
