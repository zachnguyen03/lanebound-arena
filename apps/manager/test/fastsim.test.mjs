// Run: npx tsx test/fastsim.test.mjs [n]  — fast engine vs full engine win rates by attribute gap, and the fast summary shape.
// The fit itself (hundreds of games per gap) is test/fit.mjs.
import assert from 'node:assert/strict';
import { game } from './fit.mjs';
import { runFull } from '../js/engine.ts';
import { fastMatch } from '../js/fastsim.js';

const N = +process.argv[2] || 30;
for (const gap of [0, 16]) {
  let full = 0, fast = 0;
  for (let i = 0; i < N; i++) {
    const [a, b] = game(gap, 5000 + i);
    if (runFull(a, b, i + 1).winner === 0) full++;
    for (let j = 0; j < 5; j++) if (fastMatch(a, b, i * 10 + j).winner === 0) fast++;
  }
  const pf = full / N, pq = fast / (N * 5);
  console.log(`gap ${gap}: full ${(pf * 100).toFixed(0)}%  fast ${(pq * 100).toFixed(0)}%`);
  assert.ok(Math.abs(pf - pq) < 0.2, `fast engine off by more than 20 points at gap ${gap}`);
}
const [a, b] = game(8, 1), s = fastMatch(a, b, 5), f = runFull(a, b, 5);
assert.deepEqual(Object.keys(s).filter(k => k !== 'fast').sort(), Object.keys(f).sort(), 'same summary shape');
assert.deepEqual(Object.keys(s.players[0]).sort(), Object.keys(f.players[0]).sort());
assert.equal(s.players.filter(p => p.side === 0).reduce((n, p) => n + p.k, 0), s.kills[0]);
assert.ok(s.players.every(p => p.rating >= 1 && p.rating <= 10));
console.log('ok');
