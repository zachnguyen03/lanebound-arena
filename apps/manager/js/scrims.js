// Scrims (a weekly practice partner) and the opponent scouting report shown before and during a draft.
import { CHAMPS, ROLES } from './data.js';
import { team, userTeam, mail, clamp, overall } from './world.js';
import { comfortPool } from './meta.js';
import { chemAfterGame, teamChem } from './people.js';

const today = W => W.year * 400 + W.day;
// Partners: clubs within 15 reputation of yours (bigger clubs won't scrim a minnow).
export const scrimPartners = (W, u) => W.teams.filter(t => t.id !== u.id && t.rep <= u.rep + 15 && t.rep >= u.rep - 25).sort((a, b) => b.rep - a.rep);
// Weekly (Mondays): starters practise their best champions, the five grow closer, and the partner's comfort picks are revealed for 60 days.
export function scrimWeekly(W) {
  const u = userTeam(W);
  if (!u?.scrim) return;
  const o = team(W, u.scrim);
  if (!o || !scrimPartners(W, u).includes(o)) { u.scrim = null; return mail(W, 'Scrims cancelled', 'Your scrim partner no longer wants to practise with you. Pick another on the Tactics screen.', 'squad'); }
  const gain = 0.006 * clamp(1 + (o.rep - u.rep) / 60, 0.6, 1.5); // stronger partners teach more
  for (const id of u.starters) {
    const p = W.players[id];
    const top = Object.keys(CHAMPS).filter(c => CHAMPS[c].roles.includes(p.role)).sort((a, b) => p.prof[b] - p.prof[a]).slice(0, 3);
    for (const c of top) p.prof[c] = Math.min(1.2, +(p.prof[c] + gain).toFixed(3));
    p.condition = clamp((p.condition ?? 100) - 3, 0, 100);
  }
  chemAfterGame(W, u, u.starters, false);
  (W.intel ??= {})[o.id] = today(W) + 60;
  mail(W, `Scrims vs ${o.name}`, `Your starters practised their best champions (+${(gain * 100).toFixed(1)} mastery each). You now know ${o.name}'s comfort picks for 60 days.`, 'squad');
}
const known = (W, t) => (W.intel?.[t.id] ?? 0) >= today(W) || (userTeam(W)?.facilities.analytics ?? 0) >= 4;
// What the analysts know about a club: form, plan, recent picks, and comfort picks if scrimmed (or a level-4 analytics room).
export function scoutReport(W, t) {
  const games = W.games.filter(g => g.blue === t.id || g.red === t.id).slice(-8);
  const counts = {};
  for (const g of games) for (const c of g.picks[g.blue === t.id ? 0 : 1]) counts[c] = (counts[c] ?? 0) + 1;
  const series = Object.values(W.series).filter(s => s.winner && (s.a === t.id || s.b === t.id)).slice(-5);
  return {
    form: series.map(s => (s.winner === t.id ? 'W' : 'L')).join(''),
    plan: t.draftPref ?? 'auto', chem: Math.round(teamChem(t)),
    recent: Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => ({ id, n })),
    known: known(W, t),
    players: t.starters.map((id, i) => { const p = W.players[id]; return { name: p.name, role: ROLES[i], ovr: overall(p), comfort: known(W, t) ? comfortPool(p).filter(c => CHAMPS[c].roles.includes(ROLES[i])).sort((a, b) => p.prof[b] - p.prof[a]).slice(0, 3) : null }; }),
  };
}
