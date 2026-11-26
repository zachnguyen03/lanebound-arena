// Run: node test/stats.test.mjs
// Stat bookkeeping invariants on ~6 weeks of a career, both engines (every 25th background game on the full engine).
import assert from 'node:assert/strict';
import { createWorld, newSeason, setUserTeam, simTo, compKeys, playerRows, teamRows, champRows, gameRows, involvesUser } from '../js/career.js';
import { runPayload } from '../js/fastsim.js';

const W = createWorld(); newSeason(W);
setUserTeam(W, W.teams.find(t => t.tier === 0 && t.region === 'Westmark').id);
const sums = [];
let n = 0;
const run = async ps => ps.map(p => { const s = runPayload({ ...p, fast: p.fast && n++ % 25 !== 0 }); sums.push(s); return s; });
await simTo(W, run, { until: { year: W.year, day: 50 }, autoUser: true });
const engines = { full: sums.filter(s => !s.fast), fast: sums.filter(s => s.fast) };
assert.ok(engines.full.length >= 10 && engines.fast.length >= 300, `${engines.full.length} full, ${engines.fast.length} fast`);

// 1. Every summary is internally consistent.
for (const [name, list] of Object.entries(engines)) for (const s of list) {
  const execs = s.events.filter(e => e.type === 'death');
  assert.ok(s.endReason === 'score' ? s.score[s.winner] >= 28 : s.duration >= 240, `${name}: first to 28, else the 4:00 clock`);
  for (const side of [0, 1]) {
    const mine = s.players.filter(p => p.side === side), sum = k => mine.reduce((t, p) => t + p[k], 0);
    assert.equal(sum('k'), s.kills[side], `${name}: team kills = player kills`);
    assert.equal(sum('d'), s.kills[1 - side] + execs.filter(e => e.side === side).length, `${name}: deaths = enemy kills + deaths with no killer`);
    assert.ok(s.split[side].kills <= s.kills[side] + sum('sd'), `${name}: one point per kill plus shutdown bounties (a kill on the final tick may score nothing)`);
    assert.equal(s.split[side].kills + s.split[side].obj, s.score[side], `${name}: score = kill points + objective points`);
    assert.equal(s.events.filter(e => e.type === 'capture' && e.side === side).length, s.caps[side], `${name}: capture events`);
    for (const p of mine) assert.ok(p.a <= s.kills[side] && p.obj <= s.duration, `${name}: assists <= team kills, point time <= game time`);
  }
  assert.deepEqual(s.timeline.at(-1).s, s.score, `${name}: score graph ends at the final score`);
  assert.equal(new Set(s.players.map(p => p.pid)).size, 10);
}

// 2. Aggregates match the game records.
const keys = compKeys(W, { scope: 'season' });
const games = W.games.filter(g => keys.includes(g.comp));
const tally = (f) => { const o = {}; for (const g of games) f(g, (id, v = 1) => { o[id] = (o[id] ?? 0) + v; }); return o; };
const gp = tally((g, add) => { add(g.blue); add(g.red); }), wins = tally((g, add) => add(g.winner));
const deaths = tally((g, add) => g.pl && [g.blue, g.red].forEach((t, side) => add(t, g.pl.slice(side * 5, side * 5 + 5).reduce((n, r) => n + r[3], 0))));
for (const r of teamRows(W, keys)) {
  assert.equal(r.gp, gp[r.id], `${r.tag} games`);
  assert.equal(r.w, wins[r.id] ?? 0, `${r.tag} wins`);
  if (deaths[r.id] !== undefined && W.teams.find(t => t.id === r.id).tier === 0) assert.equal(Math.round(r.dpg * r.gp), deaths[r.id], `${r.tag} deaths include executions`);
}
const isTop = k => W.comps[k].tier === 0 || W.comps[k].kind === 'intl';
const plGp = tally((g, add) => isTop(g.comp) && g.pl.forEach(([pid]) => add(pid)));
const rows = playerRows(W, keys);
for (const [pid, n] of Object.entries(plGp)) assert.equal(Object.entries(W.players[pid].stats).filter(([k]) => isTop(k)).reduce((t, [, a]) => t + a.gp, 0), n, `${pid} games`);
const totalK = rows.reduce((t, r) => t + r.k, 0), gameK = games.reduce((t, g) => t + g.kills[0] + g.kills[1], 0);
assert.equal(totalK, gameK, 'player kills add up to game kills');
for (const s of Object.values(W.series)) for (const tid of Object.keys(s.wins)) assert.equal(s.wins[tid], s.games.filter(id => W.games.find(g => g.id === id)?.winner === tid).length, `series ${s.id} score`);
// Role as played: everyone in a row played that role in at least one game.
for (const r of rows.slice(0, 200)) assert.ok(W.players[r.id].stats && Object.values(W.players[r.id].stats).some(a => a.rc?.[['Top', 'Jungle', 'Mid', 'Carry', 'Support'].indexOf(r.role)] > 0), `${r.name} played ${r.role}`);

// 3. Champions: totals add up; KDA only where player lines exist.
const ch = champRows(W, keys);
assert.equal(ch.reduce((t, r) => t + r.picks, 0), games.length * 10);
assert.equal(ch.reduce((t, r) => t + r.wins, 0), games.length * 5);
const t2 = champRows(W, compKeys(W, { scope: 'season', tier: '2' }));
assert.ok(t2.every(r => r.kda === null || r.kdaGames > 0), 'lower tiers: KDA blank unless the user played there');

// 4. "This series" covers exactly one series.
const mine = Object.values(W.series).filter(s => involvesUser(W, s) && s.games.length).at(-1);
const sk = compKeys(W, { scope: 'series', sid: mine.id });
assert.equal(gameRows(W, sk).length, mine.games.length);
const sp = playerRows(W, sk);
assert.equal(sp.length, 10);
assert.ok(sp.every(r => r.gp === mine.games.length));
assert.deepEqual(teamRows(W, sk).map(r => r.id).sort(), [...new Set([mine.a, mine.b])].sort());
assert.ok(champRows(W, sk).reduce((t, r) => t + r.picks, 0) === mine.games.length * 10);

console.log(`stats ok: ${games.length} games (${engines.full.length} full engine), ${rows.length} player rows`);
process.exit(0);
