// Run: node test/fastsim.test.mjs  — fast engine vs full engine win rates by strength gap.
import assert from 'node:assert/strict';
import { CHAMP_IDS, ROLES, ATTRS } from '../js/data.js';
import { autoDraft } from '../js/draft.js';
import { runMatch, summarize, rngFrom } from '../js/sim.js';
import { fastMatch } from '../js/fastsim.js';

const player = (name, v, rng) => ({ id: name, name, ...Object.fromEntries(ATTRS.map(a => [a, Math.round(v + (rng() - 0.5) * 16)])), prof: Object.fromEntries(CHAMP_IDS.map(id => [id, 0.85 + rng() * 0.25])) });
const roster = (tag, v, rng) => ROLES.map(r => player(tag + r, v, rng));
const team = (name, ps, picks) => ({ name, ai: true, lineup: ps.map((p, i) => ({ ...p, champ: picks[i], prof: p.prof[picks[i]] })) });
const N = +process.argv[2] || 30;
for (const gap of [0, 8, 16]) {
  let full = 0, fast = 0;
  for (let i = 0; i < N; i++) {
    const r = rngFrom(gap * 1000 + i), A = roster('A', 55 + gap / 2, r), B = roster('B', 55 - gap / 2, r), d = autoDraft(A, B, r);
    const a = team('A', A, d.picks[0]), b = team('B', B, d.picks[1]);
    if (summarize(runMatch(a, b, i + 1)).winner === 0) full++;
    for (let j = 0; j < 5; j++) if (fastMatch(a, b, i * 10 + j).winner === 0) fast++;
  }
  const pf = full / N, pq = fast / (N * 5);
  console.log(`gap ${gap}: full ${(pf * 100).toFixed(0)}%  fast ${(pq * 100).toFixed(0)}%`);
  assert.ok(Math.abs(pf - pq) < 0.2, `fast engine off by more than 20 points at gap ${gap}`);
}
const s = fastMatch(team('A', roster('A', 60, rngFrom(1)), ['bulwark', 'stalker', 'hexer', 'ranger', 'mender']), team('B', roster('B', 60, rngFrom(2)), ['vanguard', 'ravager', 'stormcaller', 'longbow', 'warden']), 5);
assert.equal(s.players.filter(p => p.side === 0).reduce((n, p) => n + p.k, 0), s.kills[0]);
assert.ok(s.players.every(p => p.rating >= 3 && p.rating <= 10));
console.log('ok');
