// Highlights: notable moments in a kept match report, each with a one-line title (multi-kills, solo outplays,
// aces, shutdowns, comebacks), the weekly Top 5 digest, and short game recaps for result mails.
import { CHAMPS, fmt } from './data.js';
import { mail, team } from './world.js';

const MULTI = ['', '', 'Double kill', 'Triple kill', 'Quadra kill', 'Pentakill'];
const cn = id => CHAMPS[id]?.name ?? '?';
const pName = (r, pid) => r.players.find(p => p.pid === pid)?.name ?? '?';
const pChamp = (r, pid) => r.players.find(p => p.pid === pid)?.champ;
// r = W.reports[gid]; sides = ['TAG', 'TAG']. Returns [{ gid, t, score, title, pid, champ, text }] best first.
export function highlights(r, gid, sides = ['Blue', 'Red']) {
  const out = [], ev = r.events ?? [];
  const add = (t, score, title, pid = null) => out.push({ gid, t, score, title, text: title, pid, champ: pid ? pChamp(r, pid) : null });
  const kills = ev.filter(e => e.type === 'kill');
  const end = r.duration ?? Infinity;
  for (let i = 0; i < kills.length; i++) { // streaks: same killer, each kill within 10 s of the previous
    let j = i; while (j + 1 < kills.length && kills[j + 1].k === kills[i].k && kills[j + 1].t - kills[j].t <= 10) j++;
    const n = j - i + 1, run = kills.slice(i, j + 1), k0 = kills[i];
    if (n >= 2) {
      const solo = run.every(k => !k.a?.length), shut = run.some(k => k.shutdown);
      const ace = ev.some(e => e.type === 'ace' && e.side === k0.side && e.t >= k0.t && e.t <= kills[j].t + 15);
      // Context: a point captured right after, or the opening minute.
      const cap = ev.some(e => e.type === 'capture' && e.side === k0.side && e.t >= k0.t && e.t <= kills[j].t + 15);
      const ctx = shut ? ', including a shutdown' : ace ? ' to force an ace' : cap ? ' to take a point' : k0.t < 60 ? ' in the opening minute' : '';
      const title = solo ? `1v${n} outplay: solo ${MULTI[Math.min(5, n)].toLowerCase()} with ${cn(k0.kc)}` : `${MULTI[Math.min(5, n)]} with ${cn(k0.kc)}${ctx}`;
      add(k0.t, [0, 0, 3, 6, 10, 15][Math.min(5, n)] + (solo ? 3 : 0) + (shut || ace || cap ? 1 : 0), title, k0.k);
    } else if (k0.shutdown) add(k0.t, 3, `${pName(r, k0.k)} shuts down ${pName(r, k0.v)}'s streak`, k0.k);
    else if (k0.fb && !k0.a?.length) add(k0.t, 1.5, `Solo first blood with ${cn(k0.kc)} at ${fmt(k0.t)}`, k0.k);
    i = j;
  }
  for (const e of ev) {
    const closes = e.side === r.winner && end - e.t <= 20;
    if (e.type === 'ace') add(e.t, closes ? 7 : 5, closes ? `Ace to close the game for ${sides[e.side]}` : `${sides[e.side]} ace ${sides[1 - e.side]}`);
  }
  // Comeback: the winner's biggest score deficit.
  const w = r.winner, low = (r.timeline ?? []).reduce((m, x) => { const d = x.s[w] - x.s[1 - w]; return d < m.d ? { d, t: x.t } : m; }, { d: 0, t: 0 });
  if (low.d <= -6) add(low.t, 6 + -low.d / 3, `Comeback from ${-low.d} points down for ${sides[w]}`);
  return out.sort((a, b) => b.score - a.score);
}
const tags = (W, r) => [team(W, r.blue)?.tag ?? 'Blue', team(W, r.red)?.tag ?? 'Red'];
// One-paragraph recap of a kept game, for result mails and the report.
export function gameSummary(W, gid) {
  const r = W.reports[gid];
  if (!r) return null;
  const w = r.winner, names = [team(W, r.blue)?.name ?? 'Blue', team(W, r.red)?.name ?? 'Red'];
  const lead = (r.timeline ?? []).reduce((m, x) => Math.max(m, x.s[w] - x.s[1 - w]), 0);
  const top = highlights(r, gid, tags(W, r))[0], mvp = r.players.find(p => p.pid === r.mvp);
  const fb = (r.events ?? []).find(e => e.type === 'kill' && e.fb);
  return [
    `${names[w]} beat ${names[1 - w]} ${r.score[w]}–${r.score[1 - w]} in ${fmt(r.duration)}${lead >= 8 ? `, peaking at a ${lead}-point lead` : ''}.`,
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
