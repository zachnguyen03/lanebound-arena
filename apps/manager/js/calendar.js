// Dated calendar, competitions, series, games, awards and the season rollover. No DOM.
// Match simulation is injected (`run(payloads) -> Promise<summaries>`) so the browser can use a worker
// and Node tests can run inline.
import { ROLES, ATTRS, REGIONS, REGION_INFO, EVENTS, clamp } from './data.js';
import { autoDraft, effProf } from './draft.js';
import {
  START_YEAR, dayOfDate, weekday, fmtDate, team, userTeam, teamPlayers, allPlayers, leagueTeams, overall, mail, ordinal, tierName, TRAITS, autoStarters,
} from './world.js';
import { newPatch } from './meta.js';
import { newsSeries, newsChampion, newsIntlStart, newsAward } from './news.js';
import { chemBonus, chemAfterGame, has, isRivalry, addRivalry, coolRivalries, pruneChem } from './people.js';
import { initManager, boardSeries, boardSplit, boardWeekly, boardReview, setGoals } from './board.js';
import { dailyCondition, matchFatigue, weekly, scoutingTick, expireOffers, money, offseasonPlayers, aiMarket, fillAndStart, boardTarget } from './club.js';

// Settings the UI sets (global, not per save).
export const CFG = { simDetail: 'fast' }; // simDetail: fast | top (top-league AI games on the full engine)

const PRIZES = {
  playoffs: [200, 100, 60, 60, 30, 30],
  vernal: [500, 250, 120, 120, 50, 50, 25, 25, 25, 25],
  convergence: [1500, 700, 300, 300, 150, 150, 150, 150, 60, 60, 60, 60, 60, 60, 60],
}; // $k by placement
const LEAGUE_WEEKS = 9;
const daysInYear = y => dayOfDate(y, 12, 1); // month 12 = Jan 1 of next year
export const D = (W, m, d) => dayOfDate(W.year, m, d);
export const SPLIT_START = { spring: [0, 5], summer: [6, 6] };
export const QUOTA = { 'Eastern Crown': 4, 'Jade Delta': 4, Westmark: 3, Frontier: 2, Sunward: 2 };

// ---------------- Round robins ----------------
export function roundRobin(ids, double = true) {
  const t = [...ids]; if (t.length % 2) t.push(null);
  const n = t.length, rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) { const a = t[i], b = t[n - 1 - i]; if (a && b) pairs.push(r % 2 ? [b, a] : [a, b]); }
    rounds.push(pairs); t.splice(1, 0, t.pop());
  }
  return double ? [...rounds, ...rounds.map(r => r.map(([a, b]) => [b, a]))] : rounds;
}
const tableFor = ids => Object.fromEntries(ids.map(id => [id, { w: 0, l: 0, gw: 0, gl: 0, k: 0, d: 0 }]));
export const sortedTable = table => Object.entries(table).sort(([, a], [, b]) => b.w - a.w || (b.gw - b.gl) - (a.gw - a.gl) || (b.k - b.d) - (a.k - a.d)).map(([id, r]) => ({ id, ...r }));

// ---------------- Series ----------------
function newSeries(W, comp, a, b, bestOf, day, label, match = null) {
  W.nextSeries ??= 1;
  const s = { id: `s${W.nextSeries++}`, comp: comp.key, a, b, bestOf, day, label, match, games: [], wins: { [a]: 0, [b]: 0 }, winner: null };
  W.series[s.id] = s;
  comp.left = (comp.left ?? 0) + 1;
  (W.fixtures[day] ??= []).push(s.id);
  return s;
}
export const involvesUser = (W, s) => s.a === W.userTeamId || s.b === W.userTeamId;

// ---------------- Season setup ----------------
export function newSeason(W) {
  W.fixtures = {}; W.events = [];
  for (const t of W.teams) boardTarget(W, t);
  const ev = (day, kind, label) => W.events.push({ day, kind, label });
  newPatch(W);
  ev(D(W, 0, 5), 'split', 'Spring Split begins');
  startLeagues(W, 'spring');
  ev(D(W, 4, 6), 'vernal', `${EVENTS.vernal} begins`);
  ev(D(W, 6, 6), 'summer', 'Summer Split begins');
  ev(D(W, 6, 6), 'patch', 'Mid-season patch');
  ev(D(W, 8, 24), 'patch', 'Worlds patch');
  ev(D(W, 6, 6) + 85, 'promo', 'Promotion play-ins');
  ev(D(W, 9, 1), 'convergence', `${EVENTS.convergence} begins`);
  ev(D(W, 10, 15), 'rollover', 'Season review');
}

function startLeagues(W, split) {
  const start = D(W, ...SPLIT_START[split]);
  REGIONS.forEach((region, r) => {
    for (const tier of [0, 1, 2]) {
      const ids = leagueTeams(W, region, tier).map(t => t.id);
      const key = `${W.year}-${split}-${r}-${tier}`;
      const c = W.comps[key] = { key, name: `${tierName(region, tier)} ${split === 'spring' ? 'Spring' : 'Summer'}`, kind: 'league', region, tier, year: W.year, split, teams: ids, table: tableFor(ids), done: false };
      const rounds = roundRobin(ids), k = Math.ceil(rounds.length / LEAGUE_WEEKS);
      const offs = [[5], [4, 5], [3, 4, 5], [2, 3, 4, 5]][k - 1];
      rounds.forEach((pairs, i) => {
        const day = start + 7 * Math.floor(i / k) + offs[i % k];
        for (const [a, b] of pairs) newSeries(W, c, a, b, 1, day, `Week ${Math.floor(i / k) + 1}`);
      });
    }
  });
}

// ---------------- Brackets ----------------
// Match defs: { id, a, b, bo, day, label } where a/b are 'S3' (seed 3), 'W:M1' (winner of M1) or 'L:M1'.
const DOUBLE_ELIM = [
  ['M1', 'S3', 'S6', 3, 0, 'Upper round 1'], ['M2', 'S4', 'S5', 3, 0, 'Upper round 1'],
  ['M3', 'S1', 'W:M2', 3, 1, 'Upper semifinal'], ['M4', 'S2', 'W:M1', 3, 1, 'Upper semifinal'], ['M5', 'L:M1', 'L:M2', 3, 1, 'Lower round 1'],
  ['M6', 'W:M3', 'W:M4', 5, 2, 'Upper final'], ['M7', 'L:M3', 'W:M5', 3, 2, 'Lower round 2'],
  ['M8', 'W:M7', 'L:M4', 3, 3, 'Lower round 3'], ['M9', 'W:M8', 'L:M6', 5, 4, 'Lower final'], ['GF', 'W:M6', 'W:M9', 5, 5, 'Grand final'],
];
const defs = (rows, days) => rows.map(([id, a, b, bo, r, label]) => ({ id, a, b, bo, day: days[r], label, sid: null }));

function resolveSrc(W, c, src) {
  if (src[0] === 'S') return c.seeds[+src.slice(1) - 1] ?? null;
  const m = c.matches.find(x => x.id === src.slice(2)), s = m?.sid && W.series[m.sid];
  if (!s?.winner) return null;
  return src[0] === 'W' ? s.winner : (s.winner === s.a ? s.b : s.a);
}
function advanceBracket(W, c) {
  for (const m of c.matches) {
    if (m.sid) continue;
    const a = resolveSrc(W, c, m.a), b = resolveSrc(W, c, m.b);
    if (a && b) m.sid = newSeries(W, c, a, b, m.bo, Math.max(m.day, W.day + 1), m.label, m.id).id;
  }
  const final = c.matches.at(-1), fs = final.sid && W.series[final.sid];
  if (fs?.winner) finishCup(W, c, fs);
}
// Placement: bracket teams by the last match they played (later = better), then everyone else by seed.
function placements(W, c, final) {
  const last = {};
  c.matches.forEach((m, i) => { const s = m.sid && W.series[m.sid]; if (s) { last[s.a] = i; last[s.b] = i; } });
  const inBracket = Object.keys(last).sort((x, y) => last[y] - last[x] || (x === final.winner ? -1 : y === final.winner ? 1 : 0));
  return [...inBracket, ...c.seeds.filter(id => !(id in last))];
}

function finishCup(W, c, final) {
  if (c.done) return;
  c.done = true; c.champion = final.winner; c.placements = placements(W, c, final);
  const prizes = PRIZES[c.kind === 'playoffs' ? 'playoffs' : c.event] ?? [];
  c.placements.forEach((id, i) => { if (prizes[i]) money(W, team(W, id), prizes[i] * 1000, 'prizes'); });
  const champ = team(W, final.winner);
  champ.trophies.push(`${c.name} ${W.year}`);
  champ.rep = clamp(champ.rep + (c.kind === 'playoffs' ? 3 : c.kind === 'promo' ? 0 : c.event === 'convergence' ? 10 : 6), 1, 100);
  if (c.kind !== 'promo') W.champions.push({ year: W.year, comp: c.name, team: champ.name, teamId: champ.id });
  const loser = final.winner === final.a ? final.b : final.a;
  c.final = { loser, score: [final.wins[final.winner], final.wins[loser]], roster: [...champ.starters] };
  finalsMvp(W, c, final);
  if (c.kind === 'intl') c.awards = awardTable(W, c, 3); // event MVP and All-Event team (not added to player honours)
  if (c.placements.includes(W.userTeamId) && c.kind !== 'promo') {
    const place = c.placements.indexOf(W.userTeamId) + 1;
    mail(W, `${c.name}: ${place === 1 ? 'Champions!' : `finished ${ordinal(place)}`}`, place === 1 ? `${champ.name} lift the trophy and $${prizes[0] ?? 0}k in prize money.` : `Prize money: $${prizes[place - 1] ?? 0}k. ${champ.name} won the title.`, 'news');
  }
  if (c.kind !== 'promo' && (c.kind === 'intl' || c.tier === 0)) newsChampion(W, c, champ, team(W, loser), c.final.score.join('-'));
}

function startPlayoffs(W, league) {
  const r = REGIONS.indexOf(league.region), key = `${W.year}-${league.split}-po-${r}`;
  const base = D(W, ...SPLIT_START[league.split]) + 7 * (LEAGUE_WEEKS + 1) + 4; // Saturday of week 10
  const c = W.comps[key] = {
    key, name: `${REGION_INFO[league.region].league} ${league.split === 'spring' ? 'Spring' : 'Summer'} Playoffs`, kind: 'playoffs', region: league.region, tier: 0, year: W.year, split: league.split,
    seeds: sortedTable(league.table).slice(0, 6).map(x => x.id), done: false,
    matches: defs(DOUBLE_ELIM, [base, base + 1, base + 7, base + 8, base + 14, base + 15]),
  };
  c.teams = [...c.seeds];
  advanceBracket(W, c);
  if (c.seeds.includes(W.userTeamId)) mail(W, 'Playoffs!', `You finished ${ordinal(c.seeds.indexOf(W.userTeamId) + 1)} and enter the double-elimination playoffs.`, 'news');
}

// ---------------- Internationals ----------------
function startInternational(W, event) {
  const split = event === 'vernal' ? 'spring' : 'summer';
  const qualified = [];
  REGIONS.forEach((region, r) => {
    const po = W.comps[`${W.year}-${split}-po-${r}`], lg = W.comps[`${W.year}-${split}-${r}-0`];
    const order = [...(po?.placements ?? []), ...sortedTable(lg.table).map(x => x.id)].filter((id, i, a) => a.indexOf(id) === i);
    order.slice(0, event === 'vernal' ? 2 : QUOTA[region]).forEach((id, seed) => qualified.push({ id, seed }));
  });
  qualified.sort((a, b) => a.seed - b.seed || team(W, b.id).rep - team(W, a.id).rep);
  const nGroups = event === 'vernal' ? 2 : 3;
  const groups = Array.from({ length: nGroups }, (_, g) => ({ name: `Group ${'ABC'[g]}`, teams: [] }));
  qualified.forEach((q, i) => { const row = Math.floor(i / nGroups), g = row % 2 ? nGroups - 1 - (i % nGroups) : i % nGroups; groups[g].teams.push(q.id); }); // snake
  const key = `${W.year}-${event}`, start = W.day;
  const c = W.comps[key] = { key, name: EVENTS[event], kind: 'intl', event, year: W.year, teams: qualified.map(q => q.id), groups, matches: null, seeds: null, done: false };
  for (const g of groups) {
    g.table = tableFor(g.teams);
    roundRobin(g.teams, false).forEach((pairs, i) => { for (const [a, b] of pairs) newSeries(W, c, a, b, 1, start + 1 + i, `Group stage day ${i + 1}`); });
  }
  c.koStart = start + 9;
  if (c.teams.includes(W.userTeamId)) mail(W, `Qualified for the ${c.name}!`, `${groups.find(g => g.teams.includes(W.userTeamId)).name}. The group stage starts tomorrow; the top teams reach the Bo5 knockouts.`, 'news');
  newsIntlStart(W, c, team(W, qualified[0].id));
}
function startIntlKnockouts(W, c) {
  const ranked = c.groups.map(g => sortedTable(g.table));
  const cmp = (x, y) => y.w - x.w || (y.k - y.d) - (x.k - x.d);
  const byPos = pos => ranked.map(r => r[pos]).filter(Boolean).sort(cmp).map(x => x.id);
  const b = c.koStart;
  if (c.event === 'vernal') {
    c.seeds = [...byPos(0), ...byPos(1), ...byPos(2), ...byPos(3), ...byPos(4)];
    c.matches = defs([['SF1', 'S1', 'S4', 5, 0, 'Semifinal'], ['SF2', 'S2', 'S3', 5, 0, 'Semifinal'], ['F', 'W:SF1', 'W:SF2', 5, 1, 'Final']], [b, b + 6]);
  } else {
    c.seeds = [...byPos(0), ...byPos(1), ...byPos(2), ...byPos(3), ...byPos(4)];
    c.matches = defs([
      ['QF1', 'S1', 'S8', 5, 0, 'Quarterfinal'], ['QF2', 'S4', 'S5', 5, 0, 'Quarterfinal'], ['QF3', 'S2', 'S7', 5, 1, 'Quarterfinal'], ['QF4', 'S3', 'S6', 5, 1, 'Quarterfinal'],
      ['SF1', 'W:QF1', 'W:QF2', 5, 2, 'Semifinal'], ['SF2', 'W:QF3', 'W:QF4', 5, 2, 'Semifinal'], ['F', 'W:SF1', 'W:SF2', 5, 3, 'Final'],
    ], [b, b + 1, b + 7, b + 14]);
  }
  advanceBracket(W, c);
}

// ---------------- Promotion and relegation ----------------
// Per region, decided on the summer tables: Top league last <-> Tier 2 first (direct); Top league 2nd-last v
// Tier 2 second (Bo5 play-in); Tier 2 last <-> Open Circuit first (direct).
function startPromotion(W) {
  W.promo = [];
  REGIONS.forEach((region, r) => {
    const t0 = sortedTable(W.comps[`${W.year}-summer-${r}-0`].table), t1 = sortedTable(W.comps[`${W.year}-summer-${r}-1`].table), t2 = sortedTable(W.comps[`${W.year}-summer-${r}-2`].table);
    W.promo.push({ id: t0.at(-1).id, to: 1 }, { id: t1[0].id, to: 0 }, { id: t1.at(-1).id, to: 2 }, { id: t2[0].id, to: 1 });
    const key = `${W.year}-promo-${r}`;
    const c = W.comps[key] = { key, name: `${region} promotion play-in`, kind: 'promo', region, tier: 0, year: W.year, seeds: [t0.at(-2).id, t1[1].id], done: false, matches: defs([['P', 'S1', 'S2', 5, 0, 'Promotion play-in']], [W.day + 3]) };
    c.teams = [...c.seeds];
    advanceBracket(W, c);
    for (const m of W.promo.slice(-4)) if (m.id === W.userTeamId) mail(W, m.to < team(W, m.id).tier ? 'Promoted!' : 'Relegated', m.to < team(W, m.id).tier ? `You move up to the ${tierName(region, m.to)} next season.` : `You drop to the ${tierName(region, m.to)} next season. The wage cap falls to match.`, 'board');
    if (c.seeds.includes(W.userTeamId)) mail(W, 'Promotion play-in', `A Bo5 decides who plays in the ${REGION_INFO[region].league} next season.`, 'board');
  });
}
function applyPromotion(W) {
  const moves = [...(W.promo ?? [])];
  for (const c of Object.values(W.comps)) if (c.kind === 'promo' && c.year === W.year && c.done) {
    const [top, chall] = c.seeds;
    if (c.champion === chall) moves.push({ id: chall, to: 0 }, { id: top, to: 1 });
  }
  for (const m of moves) team(W, m.id).tier = m.to;
  W.promo = null;
  return moves;
}

// ---------------- Games ----------------
export const nextGameSides = s => (s.games.length % 2 === 0 ? [s.a, s.b] : [s.b, s.a]);
export const starterPlayers = (W, t) => t.starters.map(id => W.players[id]);
// Traits, morale, condition and playing out of position scale a player's attributes for the engine.
export function enginePlayer(p, slot, champ, t) {
  const pos = p.role === ROLES[slot] ? 1 : p.role2 === ROLES[slot] ? 0.95 : 0.88;
  const m = (0.94 + p.morale * 0.0012) * (0.9 + (p.condition ?? 100) * 0.001) * pos;
  const out = { id: p.id, name: p.name, champ, prof: effProf(p, slot, champ) };
  const chem = t ? chemBonus(t) : {};
  for (const k of ATTRS) {
    const v = p[k] + p.traits.reduce((n, tr) => n + (TRAITS[tr]?.[k] ?? 0), 0) + (chem[k] ?? 0);
    out[k] = clamp(k === 'resilience' || k === 'clutch' ? v : v * m, 1, 99);
  }
  return out;
}
export const coachRating = t => Math.round(((t.staff.head?.rating ?? 6) * 2 + (t.staff.strategy?.rating ?? 6)) / 3);
export function engineTeam(W, t, picks, plan = t.plan) {
  return { name: t.name, color: t.color, ai: t.id !== W.userTeamId, plan, coach: coachRating(t), lineup: starterPlayers(W, t).map((p, i) => enginePlayer(p, i, picks[i], t)) };
}
export function stakesOf(W, s) {
  const c = W.comps[s.comp];
  const rival = isRivalry(W, s.a, s.b) ? 0.3 : 0;
  if (c.kind === 'league') return rival;
  const decider = Object.values(s.wins).every(w => w === Math.floor(s.bestOf / 2));
  return Math.min(1, (s.match === 'GF' || s.match === 'F' ? 0.7 : 0.4) + (decider ? 0.3 : 0) + rival);
}
// Draft preferences of a club: the current patch's meta.
export const draftPrefs = W => ({ meta: W.patch?.meta ?? {} });
// A background game: AI draft both sides, return a serializable engine job.
export function gameJob(W, s) {
  const [blue, red] = nextGameSides(s).map(id => team(W, id));
  const c = W.comps[s.comp];
  const d = autoDraft(starterPlayers(W, blue), starterPlayers(W, red), Math.random, { prefs: [draftPrefs(W), draftPrefs(W)] });
  const full = involvesUser(W, s) || (CFG.simDetail === 'top' && (c.tier === 0 || c.kind === 'intl'));
  return { s, blue: blue.id, red: red.id, draft: { picks: d.picks, bans: d.bans }, payload: { teamA: engineTeam(W, blue, d.picks[0]), teamB: engineTeam(W, red, d.picks[1]), seed: Math.floor(Math.random() * 2 ** 31), fast: !full, opts: { stakes: stakesOf(W, s), patch: W.patch?.mods } } };
}

// obj = seconds on capture points.
const emptyAgg = () => ({ gp: 0, w: 0, k: 0, d: 0, a: 0, obj: 0, dmg: 0, taken: 0, heal: 0, rating: 0, mins: 0, mvp: 0 });
export const emptyTeam = () => ({ gp: 0, w: 0, kills: 0, deaths: 0, score: 0, scoreAgainst: 0, caps: 0, mins: 0, fb: 0 });
export { emptyAgg };
const REPORT_KEEP = 40;

export function recordGame(W, s, sum, blue, red, draft) {
  const winner = sum.winner === 0 ? blue : red, c = W.comps[s.comp];
  const g = {
    id: W.nextGame++, comp: s.comp, sid: s.id, year: W.year, day: W.day, n: s.games.length + 1, blue, red, winner, dur: Math.round(sum.duration),
    kills: sum.kills, score: sum.score, caps: sum.caps, fb: sum.fbSide, mvp: sum.mvp, picks: draft.picks, bans: draft.bans,
    pl: c.tier === 0 || c.kind === 'intl' || involvesUser(W, s) ? sum.players.map(p => [p.pid, p.champ, p.k, p.d, p.a, p.obj, p.dmg, p.rating]) : null, // lower tiers: result only (save size)
    fast: !!sum.fast, pt: W.patch?.id,
  };
  W.games.push(g);
  s.games.push(g.id); s.wins[winner]++;
  if (involvesUser(W, s) || s.match === 'GF' || s.match === 'F') {
    W.reports[g.id] = { ...sum, blue, red, comp: s.comp, picks: draft.picks, bans: draft.bans };
    const ids = Object.keys(W.reports).map(Number).sort((a, b) => a - b);
    for (const id of ids.slice(0, Math.max(0, ids.length - REPORT_KEEP))) delete W.reports[id];
  }
  for (const pl of sum.players) {
    const p = W.players[pl.pid];
    if (!p) continue;
    const won = (pl.side === 0 ? blue : red) === winner;
    p.firstYear ??= W.year;
    const agg = p.stats[s.comp] ??= emptyAgg();
    agg.gp++; if (won) agg.w++;
    agg.team = pl.side === 0 ? blue : red; // ponytail: club of the latest game in this competition; split rows per club if mid-split moves matter
    (agg.rc ??= [0, 0, 0, 0, 0])[ROLES.indexOf(pl.role)]++;
    for (const k of ['k', 'd', 'a', 'obj', 'dmg', 'taken', 'heal']) agg[k] += Math.round(pl[k]);
    agg.rating = Math.round((agg.rating + pl.rating) * 10) / 10;
    agg.mins = Math.round((agg.mins + sum.duration / 60) * 100) / 100;
    if (pl.pid === sum.mvp) agg.mvp++;
    const cs = p.champStats[pl.champ] ??= { gp: 0, w: 0, k: 0, d: 0, a: 0 };
    cs.gp++; if (won) cs.w++; cs.k += pl.k; cs.d += pl.d; cs.a += pl.a;
    p.history.unshift({ year: W.year, day: W.day, g: g.id, comp: s.comp, opp: pl.side === 0 ? red : blue, champ: pl.champ, k: pl.k, d: pl.d, a: pl.a, rating: pl.rating, win: won });
    p.history.length = Math.min(p.history.length, 5);
    p.form.push(pl.rating); if (p.form.length > 5) p.form.shift();
    p.prof[pl.champ] = Math.min(1.2, +((p.prof[pl.champ] ?? 0.7) + 0.004).toFixed(3));
  }
  matchFatigue(W, sum.players.map(p => p.pid));
  for (const side of [0, 1]) chemAfterGame(W, team(W, side === 0 ? blue : red), sum.players.filter(p => p.side === side).map(p => p.pid), (side === 0 ? blue : red) === winner);
  [blue, red].forEach((tid, side) => {
    const ts = team(W, tid).season[s.comp] ??= emptyTeam();
    ts.gp++; if (tid === winner) ts.w++;
    ts.kills += sum.kills[side]; ts.deaths += sum.players.reduce((n, p) => n + (p.side === side ? p.d : 0), 0); // includes deaths with no killer
    ts.score += sum.score[side]; ts.scoreAgainst += sum.score[1 - side]; ts.caps += sum.caps[side];
    ts.mins += sum.duration / 60; if (sum.fbSide === side) ts.fb++;
  });
  if (s.wins[winner] >= Math.ceil(s.bestOf / 2)) seriesDone(W, s, winner);
  return g;
}

function seriesDone(W, s, winner) {
  s.winner = winner;
  const loser = winner === s.a ? s.b : s.a, c = W.comps[s.comp];
  c.left--;
  const table = c.kind === 'league' ? c.table : c.groups && !c.matches ? c.groups.find(g => g.teams.includes(s.a))?.table : null;
  if (table) {
    table[winner].w++; table[loser].l++;
    for (const gid of s.games) {
      const g = W.games.find(x => x.id === gid);
      for (const [tid, side] of [[g.blue, 0], [g.red, 1]]) { table[tid].k += g.kills[side]; table[tid].d += g.kills[1 - side]; if (g.winner === tid) table[tid].gw++; else table[tid].gl++; }
    }
  }
  const swing = isRivalry(W, s.a, s.b) ? 2 : 1; // rival games: double the morale swing
  for (const id of [winner, loser]) {
    const ps = teamPlayers(W, team(W, id)), lead = id === loser && ps.some(p => has(p, 'leader')) ? 0.5 : 1; // a leader softens a loss
    for (const p of ps) p.morale = clamp(p.morale + (id === winner ? 3 : -3 * lead) * swing * (has(p, 'volatile') ? 1.5 : 1), 20, 100);
  }
  newsSeries(W, s, winner, isRivalry(W, s.a, s.b));
  if (s.match === 'GF' || s.match === 'F') addRivalry(W, s.a, s.b, 2);
  if (involvesUser(W, s)) {
    const won = winner === W.userTeamId, opp = team(W, won ? loser : winner);
    mail(W, `${won ? 'Win' : 'Loss'} vs ${opp.name} (${s.wins[W.userTeamId]}-${s.wins[opp.id]})`, `${c.name}, ${s.label}. ${won ? 'Morale is up.' : 'The squad needs a response.'}`, 'news', { series: s.id });
    boardSeries(W, s, won, c);
  }
  // Stage transitions.
  if (c.kind === 'league') {
    if (!c.done && c.left === 0) {
      c.done = true; c.placements = sortedTable(c.table).map(x => x.id);
      addRivalry(W, c.placements[0], c.placements[1], 1);
      if (c.tier === 0) { splitAwards(W, c); startPlayoffs(W, c); }
      boardSplit(W, c);
    }
  } else if (c.groups && !c.matches) {
    if (c.left === 0) startIntlKnockouts(W, c);
  } else advanceBracket(W, c);
}
export const seriesOf = (W, c) => Object.values(W.series).filter(s => s.comp === c.key);

// ---------------- Awards ----------------
const avgRating = (p, key, minGp) => { const a = p.stats[key]; return a && a.gp >= minGp ? a.rating / a.gp : -1; };
// MVP, All-Pro teams and stat leaders of a competition, snapshotted (club, signature champion, reason) so they survive transfers and pruning.
export function awardTable(W, c, minGp) {
  const pool = Object.values(W.players).filter(p => p.stats[c.key]);
  const ranked = pool.filter(p => avgRating(p, c.key, minGp) > 0).sort((a, b) => avgRating(b, c.key, minGp) - avgRating(a, c.key, minGp));
  if (!ranked.length) return null;
  const byRole = role => ranked.filter(p => p.role === role);
  const mvp = ranked[0], agg = p => p.stats[c.key];
  const allPro1 = ROLES.map(r => byRole(r)[0]?.id ?? null), allPro2 = ROLES.map(r => byRole(r)[1]?.id ?? null);
  // Champions played per player in this competition (games with player lines).
  const played = {};
  for (const g of W.games) if (g.comp === c.key && g.pl) for (const [pid, champ] of g.pl) ((played[pid] ??= {})[champ] = (played[pid]?.[champ] ?? 0) + 1);
  const sig = id => { const m = played[id]; return m ? Object.entries(m).sort((a, b) => b[1] - a[1])[0][0] : null; };
  const teamDmg = {};
  for (const p of pool) teamDmg[agg(p).team] = (teamDmg[agg(p).team] ?? 0) + agg(p).dmg;
  const best = (fn, ps = ranked) => { const p = ps.slice().sort((a, b) => fn(b) - fn(a))[0]; return p ? { pid: p.id, team: agg(p).team, v: +fn(p).toFixed(2) } : null; };
  const rookies = ranked.filter(p => p.firstYear === c.year && p.age <= 21);
  const place = c.placements ? c.placements.indexOf(agg(mvp).team) + 1 : 0;
  const ids = [mvp.id, ...allPro1, ...allPro2, ...rookies.slice(0, 1).map(p => p.id)].filter(Boolean);
  return {
    mvp: mvp.id, allPro1, allPro2,
    why: `${place ? `${ordinal(place)} with ${team(W, agg(mvp).team).name} in the regular season. ` : ''}Average rating ${avgRating(mvp, c.key, minGp).toFixed(2)} over ${agg(mvp).gp} games, ${agg(mvp).mvp} game MVPs.`,
    teams: Object.fromEntries(ids.map(id => [id, agg(W.players[id]).team])),
    sig: Object.fromEntries(ids.map(id => [id, sig(id)])),
    leaders: {
      kda: best(p => (agg(p).k + agg(p).a) / Math.max(1, agg(p).d)),
      share: best(p => agg(p).dmg / Math.max(1, teamDmg[agg(p).team])),
      objm: best(p => agg(p).obj / Math.max(1, agg(p).mins)),
      pool: best(p => Object.keys(played[p.id] ?? {}).length),
      rookie: best(p => avgRating(p, c.key, minGp), rookies),
    },
  };
}
function splitAwards(W, c) {
  const minGp = Math.ceil((c.teams.length - 1) * 2 * 0.5);
  const a = awardTable(W, c, minGp);
  if (!a) return;
  c.awards = a;
  const mvp = W.players[a.mvp], { allPro1, allPro2 } = a;
  const tag = `${c.name} ${W.year}`;
  mvp.awards.push(`${tag} MVP`);
  allPro1.forEach(id => id && W.players[id].awards.push(`${tag} All-Pro 1st team`));
  allPro2.forEach(id => id && W.players[id].awards.push(`${tag} All-Pro 2nd team`));
  newsAward(W, c, mvp, avgRating(mvp, c.key, minGp));
}
function finalsMvp(W, c, final) {
  const games = final.games.map(id => W.games.find(g => g.id === id)).filter(g => g?.winner === final.winner);
  const n = {}; for (const g of games) n[g.mvp] = (n[g.mvp] ?? 0) + 1;
  const best = Object.entries(n).sort((a, b) => b[1] - a[1])[0];
  if (best && W.players[best[0]]) {
    c.finalsMvp = best[0]; W.players[best[0]].awards.push(`${c.name} ${W.year} Finals MVP`);
    const lines = final.games.map(id => W.games.find(g => g.id === id)?.pl?.find(l => l[0] === best[0])).filter(Boolean);
    const champs = new Set(lines.map(l => l[1])).size, [k, d, a] = [2, 3, 4].map(i => lines.reduce((n, l) => n + l[i], 0));
    c.finalsWhy = `Game MVP in ${best[1]} of ${games.length} wins in the final${lines.length ? `; ${k}/${d}/${a} on ${champs} champion${champs > 1 ? 's' : ''}` : ''}.`;
  }
}
function rookieAwards(W) {
  const out = {};
  REGIONS.forEach((region, r) => {
    const keys = ['spring', 'summer'].map(sp => `${W.year}-${sp}-${r}-0`);
    const rating = p => { let n = 0, gp = 0; for (const k of keys) { const a = p.stats[k]; if (a) { n += a.rating; gp += a.gp; } } return gp >= 10 ? n / gp : -1; };
    const roy = Object.values(W.players).filter(p => p.firstYear === W.year && p.age <= 21 && rating(p) > 0).sort((a, b) => rating(b) - rating(a))[0];
    if (roy) { out[region] = roy.id; roy.awards.push(`${REGION_INFO[region].league} ${W.year} Rookie of the Year`); }
  });
  return out;
}

// ---------------- Day loop ----------------
export const todaySeries = W => (W.fixtures[W.day] ?? []).map(id => W.series[id]);
export const userSeriesToday = W => todaySeries(W).find(s => !s.winner && involvesUser(W, s)) ?? null;
export function nextUserSeries(W) {
  const days = Object.keys(W.fixtures).map(Number).filter(d => d >= W.day).sort((a, b) => a - b);
  for (const d of days) for (const id of W.fixtures[d]) { const s = W.series[id]; if (!s.winner && involvesUser(W, s)) return s; }
  return null;
}

// Play every unfinished series today (the user's too when includeUser). Series run game by game in parallel.
export async function playDay(W, run, { includeUser = false } = {}) {
  let pending = todaySeries(W).filter(s => !s.winner && (includeUser || !involvesUser(W, s)));
  while (pending.length) {
    const jobs = pending.map(s => gameJob(W, s));
    const sums = await run(jobs.map(j => j.payload));
    sums.forEach((sum, i) => recordGame(W, jobs[i].s, sum, jobs[i].blue, jobs[i].red, jobs[i].draft));
    pending = pending.filter(s => !s.winner);
  }
}

// Close the day and move to the next: training, scouting, offers, weekly club tick on Mondays, dated events.
export function endDay(W) {
  const dow = weekday(W.year, W.day);
  for (const t of W.teams) dailyCondition(W, t, dow);
  scoutingTick(W); expireOffers(W);
  W.day++;
  if (W.day >= daysInYear(W.year)) { W.year++; W.day = 0; newSeason(W); }
  if (weekday(W.year, W.day) === 1) { weekly(W); boardWeekly(W); }
  for (const e of W.events.filter(x => x.day === W.day)) runEvent(W, e);
}
function runEvent(W, e) {
  switch (e.kind) {
    case 'summer': startLeagues(W, 'summer'); break;
    case 'vernal': startInternational(W, 'vernal'); break;
    case 'convergence': startInternational(W, 'convergence'); break;
    case 'promo': startPromotion(W); break;
    case 'patch': newPatch(W); break;
    case 'rollover': rollover(W); break;
    default: break;
  }
}

// Sim controls. until: 'match' (stop before the user's next fixture), { year, day }, or 'season' (to the review).
// Stops on the user's fixture unless autoUser; shouldStop() lets the UI interrupt.
export async function simTo(W, run, { until = 'match', autoUser = false, shouldStop = () => false, onDay } = {}) {
  const employed = !!W.userTeamId;
  for (let guard = 0; guard < 800; guard++) {
    if (shouldStop()) return 'stopped';
    if (employed && !W.userTeamId) return 'sacked';
    if (until === 'match' && userSeriesToday(W) && guard > 0) return 'match';
    if (typeof until === 'object' && (W.year > until.year || (W.year === until.year && W.day >= until.day))) return 'date';
    if (W.rollover && !W.rollover.seen) return 'rollover';
    const mine = userSeriesToday(W);
    if (mine && !autoUser) return 'match';
    await playDay(W, run, { includeUser: autoUser });
    endDay(W);
    await onDay?.();
    if (until === 'match' && userSeriesToday(W)) return 'match';
  }
  return 'limit';
}

// ---------------- Rollover (Nov 15) ----------------
function rollover(W) {
  const u = userTeam(W);
  const roy = rookieAwards(W);
  let review = null;
  if (u) {
    const mine = Object.values(W.comps).filter(c => c.year === W.year && c.placements?.includes(u.id) && (c.kind === 'playoffs' || c.kind === 'league'));
    const best = mine.length ? Math.min(...mine.map(c => c.placements.indexOf(u.id) + 1)) : 99;
    const promoted = (W.promo ?? []).some(m => m.id === u.id && m.to < u.tier);
    const met = best <= u.targetPlace || promoted;
    u.rep = clamp(u.rep + (met ? 5 : -5), 1, 100);
    review = { target: u.target, best, met };
    u.history.push({ year: W.year, best, target: u.target, met, tier: u.tier });
    mail(W, `Board review: target ${met ? 'met' : 'missed'}`, `Target: ${u.target}. Best finish: ${best < 99 ? ordinal(best) : 'none'}. Reputation is now ${u.rep}.`, 'board');
    for (const p of teamPlayers(W, u)) for (const pr of p.promises ?? []) if (pr.kind === 'title' && pr.year === W.year && !pr.broken && best > 2) {
      pr.broken = true; p.morale = clamp(p.morale - 10, 20, 100); p.wantsOut = true;
      mail(W, `${p.name} is unhappy`, `You promised ${p.name} a title challenge. A best finish of ${best < 99 ? ordinal(best) : 'none'} was not that.`, 'squad');
    }
    review.goals = boardReview(W, review);
    review.conf = W.board?.conf ?? null; review.sacked = !W.userTeamId;
  }
  coolRivalries(W);
  for (const t of W.teams) pruneChem(t);
  const moves = applyPromotion(W);
  const people = offseasonPlayers(W);
  aiMarket(W, true);
  for (const t of W.teams) fillAndStart(W, t);
  for (const t of W.teams) if (t.id !== W.userTeamId) t.history.push({ year: W.year, tier: t.tier });
  // Prune for save size: games and series detail of earlier years (results stay on the comps), retired players without awards.
  W.games = W.games.filter(g => g.year >= W.year);
  for (const [id, s] of Object.entries(W.series)) if (+s.comp.slice(0, 4) < W.year) delete W.series[id];
  for (const p of Object.values(W.players)) if (p.retired && !p.awards.length) delete W.players[p.id];
  W.rollover = {
    year: W.year, seen: false, review, moves: moves.map(m => ({ ...m, name: team(W, m.id).name, region: team(W, m.id).region })), roy,
    champions: W.champions.filter(c => c.year === W.year), retired: people.retired, left: people.left, newgens: people.newgens.length,
  };
  mail(W, `${W.year} season review`, `The season is over. Contracts that ended have expired, ${people.newgens.length} newgens entered the free-agent pool, and the ${W.year + 1} schedule starts on ${fmtDate(W.year + 1, dayOfDate(W.year + 1, 0, 5))}.`, 'board');
}

// ---------------- Career start ----------------
export function setUserTeam(W, id) {
  W.userTeamId = id;
  const u = userTeam(W);
  initManager(W); W.manager.since = W.year; W.manager.sinceKey = W.year * 400 + W.day;
  boardTarget(W, u);
  if (!u.goals?.some(g => !g.done)) setGoals(W, u);
  for (const p of allPlayers(W, u)) p.morale = 72;
  autoStarters(W, u);
  mail(W, `Welcome to ${u.name}`, `The board expects you to ${u.target}. The Spring Split starts on ${fmtDate(W.year, D(W, 0, 5))}. Set your lineup and training, then press Continue.`, 'board');
}
export const compsThisYear = W => Object.values(W.comps).filter(c => c.year === W.year);
export const userLeague = (W, split) => {
  const u = userTeam(W), r = REGIONS.indexOf(u.region);
  return W.comps[`${W.year}-${split ?? currentSplit(W)}-${r}-${u.tier}`];
};
export const currentSplit = W => (W.day >= D(W, 6, 6) ? 'summer' : 'spring');
export { START_YEAR };
