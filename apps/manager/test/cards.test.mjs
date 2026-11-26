// Run: npx tsx test/cards.test.mjs — Tactic Cards: ownership, loadout rules, Fearless cards, AI loadouts, Classic mode,
// the fast engine's card edge and events, and a full-engine game that fires a card.
import assert from 'node:assert/strict';
import { createWorld, newSeason, setUserTeam, simTo, team, cardPool, aiLoadout, gameJob, overall } from '../js/career.js';
import { CARDS, CARD_IDS, playerCards, loadoutError, costOf, cardView, cardSpec, LOADOUT } from '../js/cards.js';
import { runPayload, fastMatch } from '../js/fastsim.js';
import { runFull } from '../js/engine.ts';
import { game } from './fit.mjs';

const fast = async payloads => payloads.map(p => runPayload({ ...p, fast: true }));
const W = createWorld();
newSeason(W);

// Ownership: 2-3 cards, a role card first, rarity from overall, at most one Signature; text renders.
for (const t of W.teams) for (const id of t.starters) {
  const p = W.players[id], cs = playerCards(p), ov = overall(p);
  assert.ok(cs.length === (ov >= 70 ? 3 : 2), `${p.name} ${ov}: ${cs.length} cards`);
  assert.equal(CARDS[cs[0].id].role, p.role);
  assert.ok(cs.filter(c => c.rarity === 'signature').length <= 1);
  if (ov < 60) assert.ok(cs.every(c => c.rarity === 'common'));
  for (const c of cs) { const v = cardView(c); assert.ok(v.when && v.then && !/undefined|NaN/.test(v.when + v.then), `${c.id}: ${v.when} / ${v.then}`); }
}
for (const id of CARD_IDS) for (const rarity of ['common', 'rare', 'epic']) assert.doesNotMatch(cardView({ id, rarity }).then, /undefined|NaN/);

// Loadout rules.
const u = W.teams.find(t => t.tier === 0 && cardPool(W, t).length >= 12);
setUserTeam(W, u.id);
const pool = cardPool(W, u), cheap = pool.filter(c => costOf(c) === 1);
const three = W.teams.flatMap(t => cardPool(W, t)).filter((c, i, all) => all.filter(x => x.pid === c.pid).length === 3 && costOf(c) <= 2);
const trio = three.filter(c => c.pid === three[0].pid);
if (trio.length === 3) assert.match(loadoutError(trio), /one player/);
assert.equal(loadoutError(cheap.filter((c, i) => cheap.findIndex(x => x.pid === c.pid) === i).slice(0, 3)), null);
assert.match(loadoutError(pool.slice(0, 4)), /At most 3/);
const pricey = [...pool].sort((a, b) => costOf(b) - costOf(a));
if (costOf(pricey[0]) + costOf(pricey[1]) + costOf(pricey[2]) > LOADOUT.budget) assert.ok(loadoutError(pricey.slice(0, 3)));
assert.match(loadoutError([pool[0]], [pool[0].key]), /this series/);

// AI loadouts are legal, and a Bo5 never loads a card twice (Fearless cards).
const s = { id: 'x', comp: Object.keys(W.comps)[0], a: u.id, b: W.teams.find(t => t.id !== u.id && t.tier === 0).id, bestOf: 5, games: [], wins: {}, cards: {} };
s.wins = { [s.a]: 0, [s.b]: 0 };
for (const tid of [s.a, s.b]) {
  const seen = new Set();
  for (let g = 0; g < 5; g++) {
    const l = aiLoadout(W, s, team(W, tid));
    assert.equal(loadoutError(l, s.cards[tid] ?? []), null);
    for (const c of l) { assert.ok(!seen.has(c.key), 'card loaded twice in a series'); seen.add(c.key); }
    (s.cards[tid] ??= []).push(...l.map(c => c.key));
  }
}
const s2 = { ...s, cards: {}, games: [], wins: { [s.a]: 0, [s.b]: 0 }, winner: null };
W.series.x = s2;
const job = gameJob(W, s2);
assert.equal(job.payload.teamA.cards.length, 3);
assert.equal(s2.cards[s.a].length + s2.cards[s.b].length, job.payload.teamA.cards.length + job.payload.teamB.cards.length);
// Resting: the cards a team just loaded can't be loaded in its next game, even in a new series.
const rest = team(W, s.a).rest, rested = Object.keys(rest), s3 = { ...s2, cards: {} };
assert.equal(rested.length, 3);
const want = { common: 1, rare: 2, epic: 3, signature: 3 };
for (const c of job.payload.teamA.cards) assert.equal(rest[`${c.pid}:${c.id}`], want[CARDS[c.id].signature ? 'signature' : c.rarity]);
assert.ok(aiLoadout(W, s3, team(W, s.a)).every(c => !rested.includes(c.key)), 'resting cards reloaded');
delete W.series.x;

// Fast engine: card events and a positive edge for a loaded side.
const [a, b] = game(0, 7), pa = cardPool(W, u).slice(0, 3).map(c => cardSpec({ ...c, slot: c.slot }));
let withCards = 0, without = 0, evs = 0;
for (let i = 0; i < 4000; i++) {
  const r = fastMatch({ ...a, cards: pa }, b, i);
  withCards += r.winner === 0; evs += r.events.filter(e => e.type === 'card' && e.side === 0).length;
  without += fastMatch(a, b, i).winner === 0;
}
assert.ok(evs > 2000, `card events ${evs}`);
assert.ok(withCards > without, `cards help in the fast engine: ${withCards} vs ${without}`);

// Full engine: a loaded card fires and shows in the summary; the config replays it.
const t1 = { ...a, cards: [cardSpec({ id: 'franchise', rarity: 'signature', slot: 3, pid: a.lineup[3].id })] };
const full = runFull(t1, b, 3), fired = full.events.filter(e => e.type === 'card');
assert.equal(fired.length, 1);
assert.deepEqual([fired[0].id, fired[0].pid, fired[0].side], ['franchise', a.lineup[3].id, 0]);
assert.equal(full.config.cards.blue.length, 1);
assert.equal(runFull(a, b, 3).config.cards, undefined, 'no cards: no MatchConfig.cards');

// A season on the fast engine with cards, then Classic mode has none.
assert.equal(await simTo(W, fast, { until: 'match' }), 'match');
const C = createWorld(); newSeason(C); C.classic = true;
assert.deepEqual(aiLoadout(C, s, C.teams[0]), []);
await simTo(C, fast, { until: { year: C.year, day: 40 }, autoUser: true });
assert.ok(Object.values(C.series).every(x => !x.cards || Object.values(x.cards).every(l => !l.length)));
assert.ok(Object.values(W.series).some(x => x.cards && Object.values(x.cards).some(l => l.length === 3)));
console.log('ok');
