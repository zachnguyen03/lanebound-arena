// Fast-engine calibration on the full engine. Not a test (not *.test.mjs).
//   tsx test/fit.mjs run <gap> <n> <offset>   -> one JSON line of tallies
//   tsx test/fit.mjs merge < lines              -> per-role means, score shape, logistic fit, fast vs full win rates
// Lineups: career-scale players at 60 ± gap/2 per attribute (±8 noise), random mastery, AI draft. Blue = A = stronger.
import { createInterface } from 'node:readline';
import { CHAMP_IDS, ROLES, ATTRS } from '../js/data.js';
import { autoDraft } from '../js/draft.js';
import { runFull, rngFrom } from '../js/engine.ts';
import { fastMatch, strength } from '../js/fastsim.js';

const player = (name, v, rng) => ({ id: name, name, ...Object.fromEntries(ATTRS.map(a => [a, Math.round(v + (rng() - 0.5) * 16)])), prof: Object.fromEntries(CHAMP_IDS.map(id => [id, 0.85 + rng() * 0.25])) });
const roster = (tag, v, rng) => ROLES.map(r => player(tag + r, v, rng));
const team = (name, ps, picks) => ({ name, plan: {}, coach: 10, lineup: ps.map((p, i) => ({ ...p, champ: picks[i], prof: p.prof[picks[i]] })) });
export function game(gap, i) {
  const r = rngFrom(gap * 100000 + i), A = roster('A', 60 + gap / 2, r), B = roster('B', 60 - gap / 2, r), d = autoDraft(A, B, r);
  return [team('A', A, d.picks[0]), team('B', B, d.picks[1])];
}
const F = ['k', 'd', 'a', 'dmg', 'taken', 'heal', 'obj'];

if (process.argv[2] === 'run') {
  const [gap, n, off] = process.argv.slice(3).map(Number);
  const out = { gap, games: [], role: Object.fromEntries(ROLES.map(r => [r, Object.fromEntries([...F, 'mins'].map(f => [f, 0]))])) };
  for (let i = off; i < off + n; i++) {
    const [a, b] = game(gap, i), s = runFull(a, b, i + 1);
    const w = s.winner, l = 1 - w;
    out.games.push({ d: strength(a) - strength(b), w, dur: s.duration, ls: s.score[l], wk: s.split[w].kills, lk: s.split[l].kills, caps: s.caps, execs: s.events.filter(e => e.type === 'death').length, rt: s.players.map(p => p.rating) });
    for (const p of s.players) { const x = out.role[p.role]; for (const f of F) x[f] += p[f]; x.mins += s.duration / 60; }
  }
  console.log(JSON.stringify(out));
} else if (process.argv[2] === 'merge') {
  const lines = []; for await (const l of createInterface({ input: process.stdin })) if (l.trim()) lines.push(JSON.parse(l));
  const games = lines.flatMap(x => x.games.map(g => ({ ...g, gap: x.gap })));
  const role = {}; for (const x of lines) for (const r of ROLES) { role[r] ??= {}; for (const [f, v] of Object.entries(x.role[r])) role[r][f] = (role[r][f] ?? 0) + v; }
  const mean = a => a.reduce((n, v) => n + v, 0) / a.length, sd = a => Math.sqrt(mean(a.map(v => (v - mean(a)) ** 2)));
  console.log('per-role per-minute:'); for (const r of ROLES) console.log(' ', r, F.map(f => `${f} ${(role[r][f] / role[r].mins).toFixed(f === 'k' || f === 'd' || f === 'a' ? 3 : 1)}`).join(', '));
  const durs = games.map(g => g.dur), ls = games.map(g => g.ls);
  console.log(`games ${games.length}; duration ${mean(durs).toFixed(1)} ± ${sd(durs).toFixed(1)} s; loser score ${mean(ls).toFixed(2)} ± ${sd(ls).toFixed(2)}; points/s ${(mean(games.map(g => (28 + g.ls) / g.dur))).toFixed(4)}`);
  console.log(`kill share of points: winner ${(mean(games.map(g => g.wk / 28))).toFixed(3)}, loser ${(mean(games.filter(g => g.ls).map(g => g.lk / g.ls))).toFixed(3)}; caps/min ${(mean(games.map(g => (g.caps[0] + g.caps[1]) / g.dur * 60))).toFixed(3)} winner share ${mean(games.map(g => g.caps[g.w] / Math.max(1, g.caps[0] + g.caps[1]))).toFixed(3)}; deaths without a killer per game ${mean(games.map(g => g.execs)).toFixed(2)}`);
  const rts = games.flatMap(g => g.rt.map((v, i) => [v, (i < 5 ? 0 : 1) === g.w]));
  console.log(`ratings: winners ${mean(rts.filter(x => x[1]).map(x => x[0])).toFixed(2)}, losers ${mean(rts.filter(x => !x[1]).map(x => x[0])).toFixed(2)}, share at 10 ${(rts.filter(x => x[0] >= 10).length / rts.length * 100).toFixed(1)}%, at 1 ${(rts.filter(x => x[0] <= 1).length / rts.length * 100).toFixed(1)}%`);
  // Logistic fit p(A wins) = 1 / (1 + exp(-(c + k d))) by Newton's method on the per-game strength gap.
  let c = 0, k = 0;
  for (let it = 0; it < 50; it++) {
    let g0 = 0, g1 = 0, h00 = 0, h01 = 0, h11 = 0;
    for (const g of games) { const p = 1 / (1 + Math.exp(-(c + k * g.d))), y = g.w === 0 ? 1 : 0, wgt = p * (1 - p); g0 += y - p; g1 += (y - p) * g.d; h00 += wgt; h01 += wgt * g.d; h11 += wgt * g.d * g.d; }
    const det = h00 * h11 - h01 * h01; c += (h11 * g0 - h01 * g1) / det; k += (h00 * g1 - h01 * g0) / det;
  }
  console.log(`fit: c ${c.toFixed(4)}, k ${k.toFixed(4)}`);
  for (const gap of [...new Set(games.map(g => g.gap))].sort((a, b) => a - b)) {
    const gs = games.filter(g => g.gap === gap), n = gs.length;
    let fast = 0; for (let i = 0; i < n * 4; i++) { const [a, b] = game(gap, 1e6 + i); if (fastMatch(a, b, i + 1).winner === 0) fast++; }
    console.log(`gap ${gap}: n ${n}, mean d ${mean(gs.map(g => g.d)).toFixed(2)}, full ${(mean(gs.map(g => g.w === 0 ? 1 : 0)) * 100).toFixed(1)}%, logistic ${(mean(gs.map(g => 1 / (1 + Math.exp(-(c + k * g.d))))) * 100).toFixed(1)}%, fast ${(fast / (n * 4) * 100).toFixed(1)}%`);
  }
}
