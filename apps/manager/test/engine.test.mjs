// Run: npx tsx test/engine.test.mjs   (champion table, draft, full-engine adapter: determinism, replay, bookkeeping)
import assert from 'node:assert/strict';
import { CHAMPS, CHAMP_IDS, ROLES, ATTRS } from '../js/data.js';
import { autoDraft, DRAFT_ORDER } from '../js/draft.js';
import { runFull, rngFrom, kitPatch } from '../js/engine.ts';
import { simulate } from '../../../sim/simulate.ts';
import { CHAMPIONS } from '../../../data/champions/defs.ts';

// The career's champion table mirrors the sim's.
const SLOT = { top: 'Top', jungle: 'Jungle', mid: 'Mid', adc: 'Carry', support: 'Support' };
assert.deepEqual(CHAMP_IDS.slice().sort(), Object.keys(CHAMPIONS).sort());
for (const id of CHAMP_IDS) assert.deepEqual([CHAMPS[id].roles, CHAMPS[id].cls], [[SLOT[CHAMPIONS[id].default_slot]], CHAMPIONS[id].class], id);

const player = (name, v, rng) => ({ id: name, name, ...Object.fromEntries(ATTRS.map(a => [a, v])), prof: Object.fromEntries(CHAMP_IDS.map(id => [id, 0.8 + rng() * 0.3])) });
const roster = (tag, v, rng) => ROLES.map(r => player(tag + r, v, rng));
const team = (name, players, picks) => ({ name, coach: 10, plan: {}, lineup: players.map((p, i) => ({ ...p, champ: picks[i], prof: p.prof[picks[i]] })) });

// Draft: 12 steps, 2 unique bans, 10 unique picks filling every role slot.
const rng = rngFrom(7);
const A = roster('A', 60, rng), B = roster('B', 60, rng);
const d = autoDraft(A, B, rng);
assert.equal(d.i, DRAFT_ORDER.length);
const all = [...d.bans.flat(), ...d.picks.flat()];
assert.equal(all.length, 12);
assert.equal(new Set(all).size, 12);
assert.ok(d.picks.flat().every(Boolean));

// Determinism, replay from the stored config, bookkeeping.
const ta = team('A', A, d.picks[0]), tb = team('B', B, d.picks[1]);
const sum = runFull(ta, tb, 42, { stakes: 0.5, patch: { kerrig: { hp: 0.1, cd: -0.08 } } });
assert.deepEqual(runFull(ta, tb, 42, { stakes: 0.5, patch: { kerrig: { hp: 0.1, cd: -0.08 } } }), sum);
const replay = simulate(JSON.parse(JSON.stringify(sum.config))).state;
assert.deepEqual([replay.score_blue, replay.score_red], sum.score, 'config replays the game');
assert.ok(sum.config.kit_patch.kerrig.l1.hp > CHAMPIONS.kerrig.l1.hp && kitPatch().kerrig.R.CD_s > sum.config.kit_patch.kerrig.R.CD_s, 'patch layered on the sandbox kit patch');
assert.equal(sum.score[sum.winner], 28);
for (const side of [0, 1]) {
  const mine = sum.players.filter(p => p.side === side);
  assert.equal(mine.reduce((n, p) => n + p.k, 0), sum.kills[side]);
  assert.equal(sum.split[side].kills + sum.split[side].obj, sum.score[side]);
}
assert.deepEqual(sum.timeline.at(-1).s, sum.score);
assert.ok(sum.players.every(p => p.rating >= 1 && p.rating <= 10 && p.obj <= sum.duration));
assert.ok(sum.events.some(e => e.type === 'kill') && sum.events.some(e => e.type === 'capture') && sum.events.some(e => e.type === 'majority'));
assert.ok(sum.players.find(p => p.pid === sum.mvp).side === sum.winner);

// Skill matters: an 85-rated roster beats a 35-rated one most of the time.
let wins = 0;
const N = 24;
for (let i = 0; i < N; i++) {
  const r = rngFrom(100 + i), S = roster('S', 85, r), W = roster('W', 35, r), dd = autoDraft(S, W, r);
  if (runFull(team('S', S, dd.picks[0]), team('W', W, dd.picks[1]), i + 1).winner === 0) wins++;
}
console.log(`strong vs weak: ${wins}/${N} wins`);
assert.ok(wins >= N * 0.6, 'stats should matter');
console.log('ok');
