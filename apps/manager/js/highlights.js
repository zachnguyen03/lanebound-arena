// Highlights: notable moments in a kept match report, each with a one-line title (multi-kills, solo outplays,
// game-turning ultimates, aces, shutdowns, comebacks), the weekly Top 5 digest, and short game recaps for result mails.
import { CHAMPS } from './data.js';
import { mail, team } from './world.js';
import { fmt } from './sim.js';
import { makeStructures } from './map.js';

const TOWERS = makeStructures().filter(t => t.kind === 'tower' || t.kind === 'base');

const MULTI = ['', '', 'Double kill', 'Triple kill', 'Quadra kill', 'Pentakill'];
const cn = id => CHAMPS[id]?.name ?? '?';
const pName = (r, pid) => r.players.find(p => p.pid === pid)?.name ?? '?';
const pChamp = (r, pid) => r.players.find(p => p.pid === pid)?.champ;
// r = W.reports[gid]; sides = ['TAG', 'TAG']. Returns [{ gid, t, score, title, pid, champ, text }] best first.
export function highlights(r, gid, sides = ['Blue', 'Red']) {
  const out = [], ev = r.events ?? [];
  const add = (t, score, title, pid = null) => out.push({ gid, t, score, title, text: title, pid, champ: pid ? pChamp(r, pid) : null });
  const kills = ev.filter(e => e.type === 'kill');
  const killsAfter = (side, t0, secs) => kills.filter(k => k.side === side && k.t >= t0 && k.t <= t0 + secs).length;
  const core = ev.find(e => e.type === 'core');
  for (let i = 0; i < kills.length; i++) { // streaks: same killer, each kill within 10 s of the previous
    let j = i; while (j + 1 < kills.length && kills[j + 1].k === kills[i].k && kills[j + 1].t - kills[j].t <= 10) j++;
    const n = j - i + 1, run = kills.slice(i, j + 1), k0 = kills[i];
    if (n >= 2) {
      const solo = run.every(k => !k.a?.length), shut = run.some(k => k.shutdown);
      const ace = ev.some(e => e.type === 'ace' && e.side === k0.side && e.t >= k0.t && e.t <= kills[j].t + 15);
      // Context: a dive under the victims' tower, the laning phase, a Titan taken right after.
      const dive = run.some(k => TOWERS.some(t => t.side !== k.side && Math.hypot(t.x - k.x, t.y - k.y) < 7));
      const titan = ev.some(e => e.type === 'titan' && e.side === k0.side && e.t >= k0.t && e.t <= kills[j].t + 20);
      const ctx = shut ? ', including a shutdown' : ace ? ' to force an ace' : dive ? ' under the enemy tower' : titan ? ' to open up the Titan' : k0.t < 180 ? ' in the laning phase' : '';
      const title = solo ? `1v${n} outplay: solo ${MULTI[Math.min(5, n)].toLowerCase()} with ${cn(k0.kc)}${dive ? ' under the enemy tower' : ''}` : `${MULTI[Math.min(5, n)]} with ${cn(k0.kc)}${ctx}`;
      add(k0.t, [0, 0, 3, 6, 10, 15][Math.min(5, n)] + (solo ? 3 : 0) + (shut || ace || dive || titan ? 1 : 0), title, k0.k);
    } else if (k0.shutdown) add(k0.t, 3, `${pName(r, k0.k)} shuts down ${pName(r, k0.v)}'s streak`, k0.k);
    else if (k0.fb && !k0.a?.length) add(k0.t, 1.5, `Solo first blood with ${cn(k0.kc)} at ${fmt(k0.t)}`, k0.k);
    i = j;
  }
  for (const e of ev) {
    if (e.type === 'ult' && e.hits >= 3) { const f = killsAfter(e.side, e.t, 6); add(e.t, e.hits * 2 + f, `${cn(e.champ)}'s ${e.name} catches ${e.hits}${f ? `, ${f === 1 ? '1 kill follows' : `${f} kills follow`}` : ''}`, e.pid); }
    if (e.type === 'ace') add(e.t, core && core.side === e.side && core.t - e.t <= 40 ? 7 : 5, core && core.side === e.side && core.t - e.t <= 40 ? `Ace to close the game for ${sides[e.side]}` : `${sides[e.side]} ace ${sides[1 - e.side]}`);
    if (e.type === 'titan' && e.pid) add(e.t, 2, `Titan secured by ${pName(r, e.pid)}`, e.pid);
  }
  // Comeback: the winner's biggest gold deficit.
  const w = r.winner ?? (core?.side ?? null), low = w == null ? null : (r.timeline ?? []).reduce((m, x) => { const d = x.g[w] - x.g[1 - w]; return d < m.d ? { d, t: x.t } : m; }, { d: 0, t: 0 });
  if (low && low.d <= -2500) add(low.t, 6 + -low.d / 1000, `Comeback from ${(-low.d / 1000).toFixed(1)}k gold down for ${sides[w]}`);
  return out.sort((a, b) => b.score - a.score);
}
const tags = (W, r) => [team(W, r.blue)?.tag ?? 'Blue', team(W, r.red)?.tag ?? 'Red'];
// One-paragraph recap of a kept game, for result mails and the report.
export function gameSummary(W, gid) {
  const r = W.reports[gid];
  if (!r) return null;
  const w = r.winner, names = [team(W, r.blue)?.name ?? 'Blue', team(W, r.red)?.name ?? 'Red'];
  const lead = (r.timeline ?? []).reduce((m, x) => Math.max(m, x.g[w] - x.g[1 - w]), 0);
  const top = highlights(r, gid, tags(W, r))[0], mvp = r.players.find(p => p.pid === r.mvp);
  const fb = (r.events ?? []).find(e => e.type === 'kill' && e.fb);
  return [
    `${names[w]} beat ${names[1 - w]} ${r.kills[w]}–${r.kills[1 - w]} in ${fmt(r.duration)}${lead >= 1000 ? `, peaking at a ${(lead / 1000).toFixed(1)}k gold lead` : ''}.`,
    fb ? `First blood to ${fb.side === w ? names[w] : names[1 - w]} at ${fmt(fb.t)}.` : '',
    top ? `Key moment: ${top.title} (${fmt(top.t)}).` : '',
    mvp ? `MVP ${mvp.name} (${cn(mvp.champ)}, ${mvp.k}/${mvp.d}/${mvp.a}).` : '',
  ].filter(Boolean).join(' ');
}
// Weekly (Mondays): the best play of each kept game of the past week (your games and finals), top five.
export function weeklyDigest(W) {
  const from = W.year * 400 + W.day - 7;
  const plays = W.games.filter(g => W.reports[g.id] && g.year * 400 + g.day >= from)
    .flatMap(g => { const r = W.reports[g.id], tg = tags(W, r); return highlights(r, g.id, tg).slice(0, 1).map(h => ({ ...h, match: `${tg[0]} vs ${tg[1]}`, who: h.pid ? pName(r, h.pid) : null })); })
    .sort((a, b) => b.score - a.score).slice(0, 5);
  if (!plays.length) return;
  mail(W, 'Top 5 plays of the week', `${plays[0].title} leads the week.`, 'highlights', { plays: plays.map(({ gid, t, title, pid, champ, match, who }) => ({ gid, t, text: title, title, pid, champ, match, who })) });
}
