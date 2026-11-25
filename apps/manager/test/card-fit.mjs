// Tactic Card measurements on the full engine (CARD_STATS in js/cards.js). Not a test (not *.test.mjs).
//   tsx test/card-fit.mjs probe <card|base> <rarity> <n> <offset>  -> one JSON line { card, rarity, games: [[i, cardSideWon, fired]] }
//   tsx test/card-fit.mjs table < lines                          -> fire rate and paired win-chance gain per card and rarity
// Even teams (fit.mjs game(0, i)); the card sits on Blue for even i and Red for odd i. "base" plays the same games
// with no cards, so the gain is paired: mean(card side won with the card − card side won without).
import { createInterface } from 'node:readline';
import { game } from './fit.mjs';
import { runFull } from '../js/engine.ts';
import { CARDS, CARD_IDS, cardSpec } from '../js/cards.js';

const SLOT = { Top: 0, Jungle: 1, Mid: 2, Carry: 3, Support: 4 };
const holder = id => (CARDS[id].role ? SLOT[CARDS[id].role] : CARDS[id].signature ? 3 : 2);

if (process.argv[2] === 'probe') {
  const [card, rarity] = process.argv.slice(3, 5), [n, off] = process.argv.slice(5).map(Number);
  const out = { card, rarity, games: [] };
  for (let i = off; i < off + n; i++) {
    const [a, b] = game(0, i), side = i % 2, t = side ? b : a;
    if (card !== 'base') { const slot = holder(card); t.cards = [cardSpec({ id: card, rarity, slot, pid: t.lineup[slot].id, champ: t.lineup[slot].champ })]; }
    const s = runFull(a, b, i + 1);
    out.games.push([i, s.winner === side ? 1 : 0, s.events.some(e => e.type === 'card') ? 1 : 0]);
  }
  console.log(JSON.stringify(out));
} else if (process.argv[2] === 'table') {
  const runs = {}; for await (const l of createInterface({ input: process.stdin })) if (l.trim()) { const x = JSON.parse(l); (runs[`${x.card}|${x.rarity}`] ??= []).push(...x.games); }
  const base = new Map(Object.entries(runs).filter(([k]) => k.startsWith('base|')).flatMap(([, g]) => g.map(([i, w]) => [i, w])));
  const rows = [];
  for (const id of CARD_IDS) for (const r of ['common', 'epic', 'signature']) {
    const g = runs[`${id}|${r}`]?.filter(([i]) => base.has(i)); if (!g?.length) continue;
    const d = g.map(([i, w]) => w - base.get(i)), m = d.reduce((a, b) => a + b, 0) / d.length, se = Math.sqrt(d.reduce((a, b) => a + (b - m) ** 2, 0) / d.length / d.length);
    rows.push({ id, r, n: g.length, fire: g.reduce((a, x) => a + x[2], 0) / g.length, gain: m, se });
  }
  for (const x of rows) console.log(`${x.id.padEnd(20)} ${x.r.padEnd(9)} n ${x.n} fire ${(x.fire * 100).toFixed(0).padStart(3)}% gain ${(x.gain * 100).toFixed(1).padStart(5)} ± ${(x.se * 196).toFixed(1)}`);
  console.log('CARD_STATS', JSON.stringify(Object.fromEntries(CARD_IDS.map(id => { const c = rows.find(x => x.id === id && x.r !== 'epic'), e = rows.find(x => x.id === id && x.r === 'epic') ?? c; return [id, c ? [+c.fire.toFixed(2), +c.gain.toFixed(3), +e.gain.toFixed(3)] : null]; }))));
}
