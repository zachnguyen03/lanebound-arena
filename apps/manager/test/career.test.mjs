// Run: node test/career.test.mjs [years]   (default 2 seasons, fast engine for every game)
import assert from 'node:assert/strict';
import {
  createWorld, newSeason, setUserTeam, simTo, userTeam, team, compsThisYear, sortedTable, payroll, wageCap, overall, FIRST_TEAM_MAX, ACADEMY_MAX, ROSTER_MIN,
  playerRows, champRows, teamRows, compKeys, toCSV, renew, scout, knowledge, clubResponse, offerTerms, askingPrice, promote, upgradeFacility, START_YEAR, REGIONS, CFG, takeJob,
} from '../js/career.js';
import { runPayload } from '../js/fastsim.js';
import { CHAMP_IDS } from '../js/data.js';

const YEARS = +(process.argv[2] ?? 2);
const fast = async payloads => payloads.map(p => runPayload({ ...p, fast: true }));

const W = createWorld();
newSeason(W);
assert.equal(W.teams.filter(t => t.tier === 0).length, 50);
assert.equal(W.teams.length, 50 + 5 * 8 + 5 * 6);
assert.ok(W.teams.every(t => t.starters.length === 5 && new Set(t.starters).size === 5));
const u0 = W.teams.find(t => t.tier === 0 && t.region === 'Westmark');
setUserTeam(W, u0.id);
CFG.fearless = true;

// Club actions on day 0.
const u = userTeam(W);
const mine = W.players[u.players[0]];
assert.ok(renew(W, mine.id, { wage: mine.wage * 3, years: 2, bonus: 0 }).likelihood > 0.5);
const target = W.teams.find(t => t.id !== u.id && t.tier === 0).players.map(id => W.players[id]).find(p => !t0Starter(p));
function t0Starter(p) { return team(W, p.teamId).starters.includes(p.id); }
assert.equal(scout(W, target.id), null);
assert.ok(knowledge(W, target).ability[1] - knowledge(W, target).ability[0] > 5, 'unscouted range is wide');
const lowball = clubResponse(W, target.id, { fee: Math.round(askingPrice(W, target) * 0.3) });
assert.equal(lowball.result, 'reject');
const ok = clubResponse(W, target.id, { fee: askingPrice(W, target) });
assert.equal(ok.result, 'accept');
assert.equal(upgradeFacility(W, 'training'), null);
assert.match(upgradeFacility(W, 'media'), /One build/);

const t0 = performance.now();
for (let y = 0; y < YEARS; y++) {
  const year = W.year;
  let res, sackings = 0;
  while ((res = await simTo(W, fast, { until: 'season', autoUser: true })) === 'sacked') { sackings++; assert.ok(W.manager.offers.length > 0, 'offers after a sacking'); takeJob(W, W.manager.offers[0].teamId, setUserTeam); assert.equal(W.board.conf, 60); }
  if (sackings) console.log(`  sacked ${sackings}x, now at ${userTeam(W).name}`);
  assert.equal(res, 'rollover', `year ${year} reached the review`);
  const comps = Object.values(W.comps).filter(c => c.year === year);
  const vernal = comps.find(c => c.event === 'vernal'), conv = comps.find(c => c.event === 'convergence');
  assert.equal(vernal.teams.length, 10); assert.equal(conv.teams.length, 15);
  assert.ok(vernal.done && conv.done && vernal.champion && conv.champion);
  assert.equal(conv.placements.length, 15);
  const po = comps.filter(c => c.kind === 'playoffs');
  assert.equal(po.length, 10); assert.ok(po.every(c => c.done && c.placements.length === 6 && c.finalsMvp));
  const leagues = comps.filter(c => c.kind === 'league');
  assert.equal(leagues.length, 30); assert.ok(leagues.every(c => c.done));
  assert.ok(comps.filter(c => c.kind === 'league' && c.tier === 0).every(c => c.awards?.mvp && c.awards.allPro1.length === 5));
  assert.ok(W.rollover.moves.length >= 20, 'promotion and relegation moves');
  for (const r of REGIONS) {
    assert.equal(W.teams.filter(t => t.region === r && t.tier === 1).length, 8, `${r} tier 2 size`);
    assert.equal(W.teams.filter(t => t.region === r && t.tier === 2).length, 6, `${r} amateur size`);
  }
  console.log(`${year}: ${comps.length} comps, ${W.games.filter(g => g.year === year).length} games. Convergence: ${team(W, conv.champion).name}. Moves ${W.rollover.moves.length}, newgens ${W.rollover.newgens}. ${Math.round(performance.now() - t0)} ms`);
  W.rollover.seen = true;
  await simTo(W, fast, { until: { year: year + 1, day: 1 }, autoUser: true });
  assert.equal(W.year, year + 1);
}

// Every club stays legal.
for (const t of W.teams) {
  assert.ok(t.players.length >= ROSTER_MIN && t.players.length <= FIRST_TEAM_MAX, `${t.name} first team ${t.players.length}`);
  assert.ok(t.academy.length <= ACADEMY_MAX);
  assert.equal(new Set(t.starters).size, 5);
  assert.ok(t.starters.every(id => W.players[id]?.teamId === t.id));
}
const over = W.teams.filter(t => t.id !== W.userTeamId && payroll(W, t) > wageCap(t) * 1.15);
console.log(`clubs over the cap by >15%: ${over.length}`);

// Stats centre.
const keys = compKeys(W, { scope: 'archive', year: START_YEAR });
const rows = playerRows(W, keys, { minGp: 10 });
assert.ok(rows.length > 100);
const champs = champRows(W, compKeys(W, { scope: 'season' }));
assert.ok(champs.length === CHAMP_IDS.length);
assert.ok(teamRows(W, keys).length > 100);
assert.ok(toCSV(rows.slice(0, 3), [{ key: 'name', label: 'Player' }, { key: 'kda', label: 'KDA' }]).split('\n').length === 4);
process.exitCode = 0;
console.log(`save size ~${Math.round(JSON.stringify(W).length / 1024)} KB, total ${Math.round(performance.now() - t0)} ms`);
console.log('career ok');
if (process.env.SIZES) for (const k of Object.keys(W)) console.log(k, Math.round(JSON.stringify(W[k] ?? null).length / 1024), 'KB');
if (process.env.SIZES) { const ps = Object.values(W.players); console.log('players', ps.length, 'retired', ps.filter(p => p.retired).length, 'stats KB', Math.round(JSON.stringify(ps.map(p => p.stats)).length / 1024), 'history KB', Math.round(JSON.stringify(ps.map(p => p.history)).length / 1024), 'prof KB', Math.round(JSON.stringify(ps.map(p => p.prof)).length / 1024)); }
// Board: forced sacking gives offers; taking a job resets confidence; budget request needs confidence.
{
  const { sack, requestBudget, boardDelta } = await import('../js/board.js');
  W.board.conf = 40; assert.equal(requestBudget(W).ok, false);
  W.board.conf = 70; const before = wageCap(userTeam(W)); assert.equal(requestBudget(W).ok, true); assert.ok(wageCap(userTeam(W)) > before);
  boardDelta(W, -80, 'test'); assert.equal(W.userTeamId, null, 'confidence under 5 sacks');
  assert.ok(W.manager.offers.length >= 1 && W.manager.history.at(-1).how === 'sacked');
  takeJob(W, W.manager.offers[0].teamId, setUserTeam); assert.ok(userTeam(W) && W.board.conf === 60 && userTeam(W).goals.length === 2);
  const res = await simTo(W, fast, { until: { year: W.year, day: W.day + 10 }, autoUser: true }); assert.ok(['date', 'rollover'].includes(res));
  console.log('board ok');
}
