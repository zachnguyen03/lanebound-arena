// Run: node test/sim.test.mjs
import assert from 'node:assert/strict';
import { CHAMP_IDS, ROLES, ATTRS } from '../js/data.js';
import { autoDraft, DRAFT_ORDER } from '../js/draft.js';
import { runMatch, summarize, MAX_TIME } from '../js/sim.js';
import { rngFrom } from '../js/sim.js';

const player = (name, v, rng) => ({
  id: name, name, ...Object.fromEntries(ATTRS.map(a => [a, v])),
  prof: Object.fromEntries(CHAMP_IDS.map(id => [id, 0.8 + rng() * 0.3])),
});
const roster = (tag, v, rng) => ROLES.map(r => player(tag + r, v, rng));
const team = (name, players, picks) => ({
  name, ai: true,
  lineup: players.map((p, i) => ({ ...p, champ: picks[i], prof: p.prof[picks[i]] })),
});

// Draft: 20 steps, 10 unique bans, 10 unique picks filling every role slot.
const rng = rngFrom(7);
const A = roster('A', 60, rng), B = roster('B', 60, rng);
const d = autoDraft(A, B, rng);
assert.equal(d.i, DRAFT_ORDER.length);
const all = [...d.bans.flat(), ...d.picks.flat()];
assert.equal(all.length, 20);
assert.equal(new Set(all).size, 20);
assert.ok(d.picks.flat().every(Boolean));

// Fearless: Red may not pick its locked champions.
const fd = autoDraft(A, B, rng, { fearless: true, locks: [[], d.picks[1]] });
assert.equal(fd.i, DRAFT_ORDER.length);
assert.ok(fd.picks[1].every(id => id && !d.picks[1].includes(id)));

// Determinism + bookkeeping.
const m1 = runMatch(team('A', A, d.picks[0]), team('B', B, d.picks[1]), 42);
const m2 = runMatch(team('A', A, d.picks[0]), team('B', B, d.picks[1]), 42);
assert.deepEqual(summarize(m1), summarize(m2));
assert.ok(m1.over && m1.t <= MAX_TIME && (m1.winner === 0 || m1.winner === 1));
const sum = summarize(m1);
for (const side of [0, 1]) assert.equal(sum.players.filter(p => p.side === side).reduce((n, p) => n + p.k, 0), sum.kills[side]);
assert.ok(sum.players.every(p => p.rating >= 3 && p.rating <= 10));
assert.ok(sum.timeline.length > 50 && sum.frames.length > 50 && sum.events.some(e => e.type === 'kill'));
assert.ok(sum.players.some(p => p.items.length > 0), 'champions buy items');

// Skill matters: 70-rated roster beats 45-rated most of the time.
let wins = 0, cores = 0;
const N = 24;
for (let i = 0; i < N; i++) {
  const r = rngFrom(100 + i), S = roster('S', 70, r), W = roster('W', 45, r);
  const dd = autoDraft(S, W, r);
  const m = runMatch(team('S', S, dd.picks[0]), team('W', W, dd.picks[1]), i + 1);
  if (m.winner === 0) wins++;
  if (m.endReason === 'core') cores++;
}
console.log(`strong vs weak: ${wins}/${N} wins, ${cores} ended on a Core kill`);
assert.ok(wins >= N * 0.75, 'stats should matter');
console.log('ok');
