// Fast-engine calibration on the full engine. Not a test (not *.test.mjs).
//   tsx test/fit.mjs run <gap> <n> <offset> [patch]  -> one JSON line of tallies ('patch': a random balance patch per game)
//   tsx test/fit.mjs merge < lines              -> per-role means, score shape, logistic fit, fast vs full win rates, constants block
//   node test/refit.mjs                         -> runs it all in parallel (npm run manager:refit)
// Lineups: career-scale players at 60 ± gap/2 per attribute (±8 noise), random mastery, AI draft. Blue = A = stronger.
import { createInterface } from 'node:readline';
import { CHAMP_IDS, ROLES, ATTRS } from '../js/data.js';
import { autoDraft } from '../js/draft.js';
import { runFull, rngFrom } from '../js/engine.ts';
import { fastMatch, strength, patchValue } from '../js/fastsim.js';

const player = (name, v, rng) => ({ id: name, name, ...Object.fromEntries(ATTRS.map(a => [a, Math.round(v + (rng() - 0.5) * 16)])), prof: Object.fromEntries(CHAMP_IDS.map(id => [id, 0.85 + rng() * 0.25])) });
const roster = (tag, v, rng) => ROLES.map(r => player(tag + r, v, rng));
const team = (name, ps, picks) => ({ name, plan: {}, coach: 10, lineup: ps.map((p, i) => ({ ...p, champ: picks[i], prof: p.prof[picks[i]] })) });
export function game(gap, i) {
  const r = rngFrom(gap * 100000 + i), A = roster('A', 60 + gap / 2, r), B = roster('B', 60 - gap / 2, r), d = autoDraft(A, B, r);
  return [team('A', A, d.picks[0]), team('B', B, d.picks[1])];
}
const F = ['k', 'd', 'a', 'dmg', 'taken', 'heal', 'obj', 'anc'];
/** A random patch: 4 champions, each +-10% to HP, attack or cooldowns. */
export function randomPatch(r) {
  const out = {};
  for (const id of [...CHAMP_IDS].sort(() => r() - 0.5).slice(0, 4)) out[id] = { [['hp', 'atk', 'cd'][Math.floor(r() * 3)]]: r() < 0.5 ? 0.1 : -0.1 };
  return out;
}

if (process.argv[2] === 'run') {
  const [gap, n, off] = process.argv.slice(3, 6).map(Number), patched = process.argv[6] === 'patch';
  const out = { gap, patched, games: [], role: Object.fromEntries(ROLES.map(r => [r, Object.fromEntries([...F, 'mins'].map(f => [f, 0]))])) };
  for (let i = off; i < off + n; i++) {
    const [a, b] = game(gap, i), patch = patched ? randomPatch(rngFrom(9e6 + i)) : undefined, s = runFull(a, b, i + 1, { patch });
    const w = s.winner, l = 1 - w;
    out.games.push({ d: strength(a) - strength(b), x: patch ? patchValue(a.lineup, patch) - patchValue(b.lineup, patch) : 0, w, sw: s.sweeps, obj: [s.split[0].obj, s.split[1].obj], sd: s.players.reduce((n, p) => n + p.sd, 0), dur: s.duration, ls: s.score[l], wk: s.split[w].kills, lk: s.split[l].kills, caps: s.caps, execs: s.events.filter(e => e.type === 'death').length, rt: s.players.map(p => p.rating) });
    for (const p of s.players) { const x = out.role[p.role]; for (const f of F) x[f] += p[f]; x.mins += s.duration / 60; }
  }
  console.log(JSON.stringify(out));
} else if (process.argv[2] === 'merge') {
  const lines = []; for await (const l of createInterface({ input: process.stdin })) if (l.trim()) lines.push(JSON.parse(l));
  const games = lines.flatMap(x => x.games.map(g => ({ ...g, gap: x.gap, patched: x.patched })));
  const role = {}; for (const x of lines) for (const r of ROLES) { role[r] ??= {}; for (const [f, v] of Object.entries(x.role[r])) role[r][f] = (role[r][f] ?? 0) + v; }
  const mean = a => a.reduce((n, v) => n + v, 0) / a.length, sd = a => Math.sqrt(mean(a.map(v => (v - mean(a)) ** 2)));
  console.log('per-role per-minute:'); for (const r of ROLES) console.log(' ', r, F.map(f => `${f} ${(role[r][f] / role[r].mins).toFixed(f === 'k' || f === 'd' || f === 'a' ? 3 : 1)}`).join(', '));
  const sweepShare = side => mean(games.map(g => g.sw[side(g)] / Math.max(1, g.obj[side(g)])));
  const durs = games.map(g => g.dur), ls = games.map(g => g.ls);
  console.log(`games ${games.length}; duration ${mean(durs).toFixed(1)} ± ${sd(durs).toFixed(1)} s; loser score ${mean(ls).toFixed(2)} ± ${sd(ls).toFixed(2)}; points/s ${(mean(games.map(g => (28 + g.ls) / g.dur))).toFixed(4)}`);
  console.log(`kill share of points: winner ${(mean(games.map(g => g.wk / 28))).toFixed(3)}, loser ${(mean(games.filter(g => g.ls).map(g => g.lk / g.ls))).toFixed(3)}; caps/min ${(mean(games.map(g => (g.caps[0] + g.caps[1]) / g.dur * 60))).toFixed(3)} winner share ${mean(games.map(g => g.caps[g.w] / Math.max(1, g.caps[0] + g.caps[1]))).toFixed(3)}; deaths without a killer per game ${mean(games.map(g => g.execs)).toFixed(2)}`);
  const rts = games.flatMap(g => g.rt.map((v, i) => [v, (i < 5 ? 0 : 1) === g.w]));
  console.log(`ratings: winners ${mean(rts.filter(x => x[1]).map(x => x[0])).toFixed(2)}, losers ${mean(rts.filter(x => !x[1]).map(x => x[0])).toFixed(2)}, share at 10 ${(rts.filter(x => x[0] >= 10).length / rts.length * 100).toFixed(1)}%, at 1 ${(rts.filter(x => x[0] <= 1).length / rts.length * 100).toFixed(1)}%`);
  // Logistic fit p(A wins) = 1 / (1 + exp(-(c + k d + kp x))) by Newton's method (d = strength gap, x = patch value gap).
  const beta = [0, 0, 0], X = g => [1, g.d, g.x];
  for (let it = 0; it < 50; it++) {
    const G = [0, 0, 0], H = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const g of games) { const v = X(g), p = 1 / (1 + Math.exp(-v.reduce((n, xi, i) => n + xi * beta[i], 0))), y = g.w === 0 ? 1 : 0; for (let i = 0; i < 3; i++) { G[i] += (y - p) * v[i]; for (let j = 0; j < 3; j++) H[i][j] += p * (1 - p) * v[i] * v[j]; } }
    if (!games.some(g => g.x)) { H[2] = [0, 0, 1]; H[0][2] = H[1][2] = 0; G[2] = 0; }
    // Solve H step = G (3x3 Gaussian elimination).
    const A = H.map((row, i) => [...row, G[i]]);
    for (let i = 0; i < 3; i++) { const piv = A[i][i]; for (let j = i; j < 4; j++) A[i][j] /= piv; for (let r = 0; r < 3; r++) if (r !== i) { const f = A[r][i]; for (let j = i; j < 4; j++) A[r][j] -= f * A[i][j]; } }
    for (let i = 0; i < 3; i++) beta[i] += A[i][3];
  }
  const [c, k, kp] = beta;
  console.log(`fit: c ${c.toFixed(4)}, k ${k.toFixed(4)}, kp ${kp.toFixed(4)} (patch value)`);
  const plain = games.filter(g => !g.patched), w = g => g.w, l = g => 1 - g.w;
  const pm = (a, f) => mean(a.map(f));
  console.log('// ---- paste into js/fastsim.js (npm run manager:refit) ----');
  console.log(`const FIT = { c: ${c.toFixed(4)}, k: ${k.toFixed(4)}, kp: ${kp.toFixed(4)} };`);
  console.log(`const LOSER = { mean: ${pm(plain, g => g.ls).toFixed(1)}, sd: ${sd(plain.map(g => g.ls)).toFixed(1)} }, P_CLOCK = ${pm(plain, g => (g.dur >= 239.9 ? 1 : 0)).toFixed(3)}, CLOCK_S = 240, PTS_PER_S = ${pm(plain, g => (28 + g.ls) / g.dur).toFixed(4)}, KILL_SHARE = [${pm(plain, g => g.wk / 28).toFixed(3)}, ${pm(plain.filter(g => g.ls), g => g.lk / g.ls).toFixed(3)}], CAPS_PER_MIN = ${pm(plain, g => (g.caps[0] + g.caps[1]) / g.dur * 60).toFixed(3)}, CAP_WIN_SHARE = ${pm(plain, g => g.caps[g.w] / Math.max(1, g.caps[0] + g.caps[1])).toFixed(3)};`);
  console.log(`const SWEEP_SHARE = [${sweepShare(w).toFixed(3)}, ${sweepShare(l).toFixed(3)}]; // sweeps per objective point (winner, loser); shutdowns per game ${pm(plain, g => g.sd).toFixed(2)}`);
  console.log(`const ANC_PM = { ${ROLES.map(r => `${r}: ${(role[r].anc / role[r].mins).toFixed(2)}`).join(', ')} }; // anchor seconds per minute`);
  console.log(`export const ROLE_MEANS = { ${ROLES.map(r => `${r}: { ${F.filter(f => f !== 'anc').map(f => `${f}: ${+(role[r][f] / role[r].mins).toFixed(f === 'k' || f === 'd' || f === 'a' ? 3 : 1)}`).join(', ')} }`).join(', ')} }; // engine.ts`);
  for (const gap of [...new Set(games.map(g => g.gap))].sort((a, b) => a - b)) {
    const gs = games.filter(g => g.gap === gap), n = gs.length;
    let fast = 0; for (let i = 0; i < n * 4; i++) { const [a, b] = game(gap, 1e6 + i); if (fastMatch(a, b, i + 1).winner === 0) fast++; }
    if (gap === 0 && games.some(g => g.patched)) {
      // Patch check: buffed side of patched games, full vs fast.
      const pg = games.filter(g => g.patched && g.x), full = pm(pg, g => ((g.x > 0) === (g.w === 0) ? 1 : 0));
      let fb = 0, done = 0; for (let i = 0; done < pg.length * 4; i++) { const [a, b] = game(0, 2e6 + i), patch = randomPatch(rngFrom(8e6 + i)), x = patchValue(a.lineup, patch) - patchValue(b.lineup, patch); if (!x) continue; done++; fb += (x > 0) === (fastMatch(a, b, i + 1, { patch }).winner === 0) ? 1 : 0; }
      console.log(`patched games: buffed side wins full ${(full * 100).toFixed(1)}% (n ${pg.length}), fast ${(fb / (pg.length * 4) * 100).toFixed(1)}%`);
    }
    console.log(`gap ${gap}: n ${n}, mean d ${mean(gs.map(g => g.d)).toFixed(2)}, full ${(mean(gs.map(g => g.w === 0 ? 1 : 0)) * 100).toFixed(1)}%, logistic ${(mean(gs.map(g => 1 / (1 + Math.exp(-(c + k * g.d))))) * 100).toFixed(1)}%, fast ${(fast / (n * 4) * 100).toFixed(1)}%`);
  }
}
