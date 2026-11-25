// Career stakes: board confidence (0-100), warnings and sacking, the manager's reputation and history,
// job offers (after a sacking, or approaches from bigger clubs), budget requests and long-term club goals.
// W.board = { conf, warned }  ·  W.manager = { rep, history: [...], offers: [...], unemployedSince }
import { REGIONS } from './data.js';
import { team, userTeam, mail, clamp, teamPlayers } from './world.js';
import { newsPressure } from './news.js';

const ordinal = n => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;
export const initManager = W => {
  W.manager ??= { rep: 35, history: [], offers: [], unemployedSince: null };
  W.board ??= { conf: 60, warned: 0 };
};
export const confLabel = c => (c >= 75 ? 'Delighted' : c >= 55 ? 'Pleased' : c >= 40 ? 'Content' : c >= 25 ? 'Concerned' : 'Losing patience');

// ---------- Confidence changes ----------
export function boardDelta(W, d, why) {
  const u = userTeam(W);
  if (!u || !W.board) return;
  W.board.conf = clamp(Math.round((W.board.conf + d) * 10) / 10, 0, 100);
  (W.board.log ??= []).unshift({ year: W.year, day: W.day, d: Math.round(d * 10) / 10, why });
  W.board.log.length = Math.min(W.board.log.length, 12);
  const c = W.board.conf;
  if (c < 40 && W.board.warned < 1) { W.board.warned = 1; newsPressure(W, u, c); mail(W, 'The board is concerned', `Board confidence has fallen to ${Math.round(c)}. Results need to improve.`, 'board'); }
  if (c < 25 && W.board.warned < 2) { W.board.warned = 2; mail(W, 'Final warning', `Board confidence is ${Math.round(c)}. Below 15 at the end of a split, or below 5 at any time, and you will be dismissed.`, 'board'); }
  if (c >= 50 && W.board.warned) W.board.warned = 0;
  if (c < 5) sack(W, 'Board confidence collapsed.');
}
// A finished series involving the user.
export function boardSeries(W, s, won, comp) {
  const u = userTeam(W), opp = team(W, s.a === u.id ? s.b : s.a);
  const big = comp.kind !== 'league', final = s.match === 'GF' || s.match === 'F';
  const upset = (opp.rep - u.rep) / 20; // beating a stronger club counts more, losing to a weaker one hurts more
  boardDelta(W, won ? (big ? 4 : 1.2) * (1 + Math.max(0, upset)) + (final ? 6 : 0) : -(big ? 3 : 1.2) * (1 + Math.max(0, -upset)), `${won ? 'Won' : 'Lost'} vs ${opp.name}`);
}
// End of a league split: placement against the target.
export function boardSplit(W, c) {
  const u = userTeam(W);
  if (!u || !c.placements?.includes(u.id)) return;
  const place = c.placements.indexOf(u.id) + 1, diff = u.targetPlace - place;
  boardDelta(W, clamp(diff * 4, -16, 12), `${ordinal(place)} in the ${c.name} (target: ${u.target})`);
  if (W.board && W.board.conf < 15) sack(W, `${ordinal(place)} in the ${c.name} left the board out of patience.`);
}
// Weekly: finances and the wage cap.
export function boardWeekly(W) {
  const u = userTeam(W);
  if (!u) { if (W.manager) jobMarket(W); return; }
  if (u.cash < 0) boardDelta(W, -2, 'Club finances in the red');
  if (!W.userTeamId) return; // sacked just now
  if (Math.random() < 0.04) approach(W);
  W.manager.offers = W.manager.offers.filter(o => o.until > W.day + W.year * 400);
}

// ---------- Sacking and the job market ----------
export function sack(W, why) {
  const u = userTeam(W);
  if (!u) return;
  closeSpell(W, u, 'sacked');
  W.manager.rep = clamp(W.manager.rep - 8, 1, 100);
  mail(W, `Dismissed by ${u.name}`, `${why} The board has ended your contract. Offers from other clubs will arrive in the Jobs screen.`, 'board');
  W.userTeamId = null; W.board = null; W.manager.unemployedSince = { year: W.year, day: W.day };
  W.manager.offers = [];
  jobMarket(W, true);
}
// Clubs whose reputation fits the manager's (and a couple below, so there is always an option).
export function jobMarket(W, fresh = false) {
  const m = W.manager, key = W.year * 400 + W.day;
  m.offers = m.offers.filter(o => o.until > key);
  if (!fresh && m.offers.length >= 3 && Math.random() < 0.6) return;
  const taken = new Set(m.offers.map(o => o.teamId));
  const cands = W.teams.filter(t => !taken.has(t.id) && Math.abs(t.rep - m.rep) < 15 + (m.unemployedSince ? 5 : 0)).sort(() => Math.random() - 0.5);
  const fallback = W.teams.filter(t => t.tier > 0 && !taken.has(t.id)).sort((a, b) => a.rep - b.rep);
  for (const t of [...cands.slice(0, 2), fallback[Math.floor(Math.random() * Math.min(10, fallback.length))]].filter(Boolean)) {
    if (m.offers.some(o => o.teamId === t.id)) continue;
    m.offers.push({ teamId: t.id, until: key + 21, kind: 'vacancy' });
  }
  mail(W, 'New job offers', `${m.offers.length} clubs want to talk. See the Jobs screen.`, 'board');
}
// While employed: a bigger club comes calling when the manager's reputation outgrows the club.
function approach(W) {
  const u = userTeam(W), m = W.manager;
  if (m.rep < u.rep + 8 || W.board.conf < 55) return;
  const t = W.teams.filter(x => x.id !== u.id && x.rep > u.rep + 5 && x.rep <= m.rep + 10).sort(() => Math.random() - 0.5)[0];
  if (!t || m.offers.some(o => o.teamId === t.id)) return;
  m.offers.push({ teamId: t.id, until: W.year * 400 + W.day + 14, kind: 'approach' });
  mail(W, `${t.name} want you as manager`, `${t.name} (${REGIONS.includes(t.region) ? t.region : ''}, reputation ${t.rep}) have approached you. Accept or ignore it on the Club screen within 14 days.`, 'board');
}
// Take a job (setUserTeam comes from calendar to avoid an import cycle).
export function takeJob(W, teamId, setUserTeam) {
  const u = userTeam(W);
  if (u) closeSpell(W, u, 'left');
  W.manager.offers = []; W.manager.unemployedSince = null;
  W.board = { conf: 60, warned: 0 };
  setUserTeam(W, teamId);
}
function closeSpell(W, u, how) {
  const games = Object.values(W.series).filter(s => s.winner && (s.a === u.id || s.b === u.id));
  W.manager.history.push({ club: u.name, teamId: u.id, from: W.manager.since ?? W.year, to: W.year, how, w: games.filter(s => s.winner === u.id).length, l: games.filter(s => s.winner !== u.id).length, trophies: u.trophies.filter(t => +t.slice(-4) >= (W.manager.since ?? 0)).length });
}

// ---------- Budget ----------
// The board can approve extra wage room for this season at a confidence cost.
export function requestBudget(W) {
  const u = userTeam(W);
  if (u.capBonus) return { ok: false, msg: 'The board already raised the budget this season.' };
  if (W.board.conf < 50) return { ok: false, msg: `The board refuses: confidence is ${Math.round(W.board.conf)} (needs 50).` };
  u.capBonus = 0.1;
  boardDelta(W, -10, 'Budget increase approved');
  return { ok: true, msg: 'Approved: +10% wage cap until the season review.' };
}

// ---------- Long-term goals ----------
export function setGoals(W, u) {
  const by = W.year + (u.tier === 0 ? 3 : 2);
  u.goals = [
    u.tier === 0 ? { kind: 'intl', text: 'Reach the Grand Convergence', by } : { kind: 'top', text: 'Reach the top league', by },
    { kind: 'academy', text: 'Develop two academy players into starters', by: W.year + 2, start: u.academy.length ? [...u.academy] : [] },
  ];
}
// Season review: goals met or expired; the manager's reputation follows the season.
export function boardReview(W, review) {
  const u = userTeam(W);
  if (!u) return [];
  const m = W.manager, out = [];
  m.rep = clamp(m.rep + (review.met ? 3 : -3) + u.trophies.filter(t => t.endsWith(String(W.year))).length * 5, 1, 100);
  for (const g of u.goals ?? []) {
    if (g.done) continue;
    const ok = g.kind === 'intl' ? Object.values(W.comps).some(c => c.year === W.year && c.event === 'convergence' && c.teams?.includes(u.id))
      : g.kind === 'top' ? u.tier === 0
        : (g.start ?? []).filter(id => u.starters.includes(id)).length + teamPlayers(W, u).filter(p => p.fromAcademy && u.starters.includes(p.id)).length >= 2;
    if (ok) { g.done = W.year; boardDelta(W, 10, `Goal met: ${g.text}`); m.rep = clamp(m.rep + 3, 1, 100); out.push(`Met: ${g.text}`); }
    else if (W.year >= g.by) { g.done = -W.year; boardDelta(W, -10, `Goal missed: ${g.text}`); out.push(`Missed: ${g.text}`); }
  }
  if ((u.goals ?? []).every(g => g.done)) setGoals(W, u);
  boardDelta(W, review.met ? 8 : -14, `Season target ${review.met ? 'met' : 'missed'}: ${review.target}`);
  if (W.board && W.board.conf < 15) sack(W, 'The board reviewed the season and decided to make a change.');
  u.capBonus = 0;
  return out;
}
