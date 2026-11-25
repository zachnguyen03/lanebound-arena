// Competitions (League pyramid 19, Bracket 06, International 20, Schedule 12, Awards 07) and the Stats centre (14, 14b, 14c, Teams, Games, Economy).
import { ROLES, CHAMPS, REGIONS, REGION_INFO, TIERS, EVENTS, PASSIVES, kitText } from '../data.js';
import {
  userTeam, team, sortedTable, currentSplit, fmtDate, dayOfDate, weekday, involvesUser, tierName, QUOTA,
  compKeys, archiveYears, playerRows, teamRows, champRows, gameRows, ledger, toCSV, tierList,
} from '../career.js';
import { state } from './state.js';
import { esc, $, on, money, num, crest, sprite, empty, card, table, wireTables, download, select, seg } from './dom.js';
import { champSprite, pLink, tLink } from './screens.js';

const rr = () => state.rerender();
const ui = { region: null, split: null, event: null, month: null, scope: 'season', year: null, sregion: '', tier: '0', role: '', minGp: 3, awardYear: null, award: null };
const regionPick = () => select('region', REGIONS.map(r => [r, REGION_INFO[r].league]), ui.region);
const splitPick = () => seg('split', [['spring', 'Spring'], ['summer', 'Summer']], ui.split);
function wirePickers(el) {
  $('select[data-region]', el)?.addEventListener('change', e => { ui.region = e.target.value; rr(); });
  on(el, '[data-split]', 'click', b => { ui.split = b.dataset.split; rr(); });
}

export function competitions(el, args, sub) {
  const W = state.W, u = userTeam(W);
  ui.region ??= u.region; ui.split ??= currentSplit(W);
  ({ league, bracket, international, schedule, awards, meta })[sub](el, W, u);
  wirePickers(el);
}

// ---------- Meta: patch notes, tier list, champion kits ----------
const pctS = v => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
function meta(el, W, u) {
  const tl = tierList(W), p = W.patch, role = ui.metaRole ?? '';
  const rows = tl.filter(r => !role || CHAMPS[r.id].roles.includes(role));
  const modTxt = m => (m ? Object.entries(m).map(([k, v]) => `<span class="${(k === 'cd' ? -v : v) > 0 ? 'good' : 'bad'}">${{ hp: 'HP', atk: 'ATK', cd: 'CD' }[k]} ${pctS(v)}</span>`).join(' ') : '');
  el.innerHTML = `<div class="pad split-wide">
    ${card(`Patch ${esc(p?.id ?? '—')}`, `${(W.patches ?? []).length} patches tracked`, `<div class="pad-s">${(W.patches ?? []).slice().reverse().slice(0, 4).map(x => `<div class="mb"><b>${esc(x.id)}</b> <span class="dim small">${fmtDate(x.year, x.day)} ${x.year}</span><ul class="small">${x.notes.map(n => `<li class="${n.dir > 0 ? 'good' : 'bad'}">${n.dir > 0 ? '▲' : '▼'} ${esc(n.text)}</li>`).join('')}</ul></div>`).join('') || '<p class="dim">No patches yet.</p>'}
      <p class="dim small">Patches land at the season start, the summer split and before the Grand Convergence. They nerf the most dominant champions and buff the weakest; older changes fade by 30% each patch.</p></div>`)}
    ${card('Tier list', `${tl[0]?.games ?? 0} top-league games on this patch ${select('metarole', [['', 'All roles'], ...ROLES.map(r => [r, r])], role)}`, `<div class="scroll"><table><thead><tr><th>Tier</th><th>Champion</th><th>Traits</th><th>Comp</th><th class="n">Presence</th><th class="n">Win%</th><th>Patch</th></tr></thead><tbody>
      ${rows.map(r => { const k = kitText(r.id); return `<tr title="${esc(`${k.skill}\nUlt — ${k.ult}\n${k.passive}`)}"><td><b class="${r.tier === 'S' ? 'gold' : ''}">${r.tier}</b></td><td><span class="tm">${champSprite(r.id, 22)} ${esc(CHAMPS[r.id].name)}</span> <span class="dim small">${CHAMPS[r.id].roles.map(x => x.slice(0, 3)).join('/')}</span></td><td class="small">${k.traits.join(', ')}</td><td class="small">${k.tag}</td><td class="n">${r.games ? `${Math.round(r.presence * 100)}%` : '–'}</td><td class="n">${r.picks ? num(r.win * 100, 0) : '–'}</td><td class="small">${modTxt(r.mod)}</td></tr>`; }).join('')}</tbody></table></div>
      <p class="pad-s dim small">Hover a champion for its kit. Tiers rank presence plus win rate on this patch.</p>`)}</div>`;
  $('select[data-metarole]', el).onchange = e => { ui.metaRole = e.target.value; rr(); };
}

// ---------- League pyramid (19) ----------
function league(el, W, u) {
  const r = REGIONS.indexOf(ui.region);
  const tbl = tier => {
    const c = W.comps[`${W.year}-${ui.split}-${r}-${tier}`];
    if (!c) return card(esc(tierName(ui.region, tier)), '', `<div class="pad-s">${empty('Not started', `The ${ui.split} split hasn't begun.`)}</div>`);
    const rows = sortedTable(c.table), n = rows.length;
    const mark = i => tier === 0 ? (i < 6 ? 'po' : i === n - 1 ? 'down' : i === n - 2 ? 'playin' : '') : tier === 1 ? (i === 0 ? 'up' : i === 1 ? 'playin' : i === n - 1 ? 'down' : '') : (i === 0 ? 'up' : '');
    return card(esc(tierName(ui.region, tier)), c.done ? 'Final' : `${Object.values(W.series).filter(s => s.comp === c.key && s.winner).length} of ${(n * (n - 1))} played`, `<table><thead><tr><th>#</th><th>Team</th><th class="n">W-L</th><th class="n">Games</th><th class="n">K-D</th></tr></thead><tbody>${rows.map((x, i) => `<tr class="${x.id === u.id ? 'me' : ''} ${mark(i)}"><td>${i + 1}</td><td>${tLink(team(W, x.id))}</td><td class="n">${x.w}-${x.l}</td><td class="n">${x.gw}-${x.gl}</td><td class="n">${x.k - x.d >= 0 ? '+' : ''}${x.k - x.d}</td></tr>`).join('')}</tbody></table>`);
  };
  el.innerHTML = `<div class="pad"><div class="filters">${regionPick()}${splitPick()}<span class="sp"></span><span class="legend"><i class="po"></i>Playoffs <i class="up"></i>Promotion <i class="playin"></i>Play-in <i class="down"></i>Relegation</span></div>
    <div class="g3">${[0, 1, 2].map(tbl).join('')}</div><p class="dim small mt">Promotion and relegation use the Summer tables: Top league last ↔ ${TIERS[1]} first, Top league 2nd-last v ${TIERS[1]} 2nd in a Bo5 play-in, ${TIERS[1]} last ↔ ${TIERS[2]} first.</p></div>`;
}

// ---------- Bracket (06) ----------
// Positioned match cards with elbow connectors (winners' paths). Double elimination uses the design's fixed layout;
// single-elimination knockouts lay out as a tree (leaves evenly spaced, each match centred on its feeders).
const BW = 220, BH = 60, PITCH = 252;
const DOUBLE_LAYOUT = {
  sections: [{ title: 'Upper bracket', y: 0, cols: ['Round 1', 'Semifinals', 'Upper final'] }, { title: 'Lower bracket', y: 330, cols: ['Round 1', 'Round 2', 'Round 3', 'Lower final'] }],
  pos: { M2: [0, 108], M1: [0, 248], M3: [1, 78], M4: [1, 218], M6: [2, 148], M5: [0, 420], M7: [1, 420], M8: [2, 480], M9: [3, 480], GF: [4, 236] },
  height: 560,
};
function treeLayout(c) {
  const labels = [...new Set(c.matches.map(m => m.label))], pos = {};
  const col = m => labels.indexOf(m.label);
  c.matches.filter(m => col(m) === 0).forEach((m, i) => { pos[m.id] = [0, 64 + i * 110]; });
  for (let k = 1; k < labels.length; k++) for (const m of c.matches.filter(x => col(x) === k)) {
    const ys = [m.a, m.b].map(src => pos[src.slice(2)]?.[1]).filter(y => y != null);
    pos[m.id] = [k, ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : 64];
  }
  const h = Math.max(...Object.values(pos).map(p => p[1])) + BH + 20;
  return { sections: [{ title: c.kind === 'intl' ? 'Knockouts' : 'Bracket', y: 0, cols: labels }], pos, height: h };
}
function bracketView(W, c, u, L) {
  const P = L.pos, mm = id => c.matches.find(m => m.id === id);
  const teamsOf = m => { const s = m?.sid && W.series[m.sid]; return s ? [s.a, s.b] : [null, null]; };
  const tagOf = id => team(W, id)?.tag;
  const holder = (src, target) => {
    if (src[0] === 'S') return `Seed ${src.slice(1)}`;
    const m = mm(src.slice(2)), ts = teamsOf(m).map(tagOf), wl = src[0] === 'W' ? 'Winner' : 'Loser';
    if (ts[0] && ts[1]) return `${wl} of ${ts[0]} / ${ts[1]}`;
    if (src[0] === 'W' && P[m.id] && P[target.id] && P[m.id][0] === P[target.id][0] - 1 && target.id !== 'GF') return 'Winner above';
    return `${m?.label ?? src.slice(2)} ${wl.toLowerCase()}`;
  };
  const resolved = src => { if (src[0] === 'S') return c.seeds[+src.slice(1) - 1] ?? null; const s = mm(src.slice(2))?.sid && W.series[mm(src.slice(2)).sid]; return s?.winner ? (src[0] === 'W' ? s.winner : (s.winner === s.a ? s.b : s.a)) : null; };
  const box = m => {
    const [cx, y] = P[m.id], x = cx * PITCH, s = m.sid && W.series[m.sid];
    const ids = s ? [s.a, s.b] : [resolved(m.a), resolved(m.b)];
    const live = s && !s.winner && s.games.length, mine = ids.includes(u.id);
    const lab = `${m.id === 'GF' ? 'Grand final · ' : m.id === 'F' ? 'Final · ' : ''}${s?.winner ? 'Final' : live ? `Live · Game ${s.games.length + 1}` : fmtDate(W.year, s?.day ?? m.day, { weekday: 'short', day: 'numeric', month: 'short' })} · Bo${m.bo}`;
    const row = (src, id) => { const t = id && team(W, id), seed = id ? c.seeds.indexOf(id) + 1 : 0, won = s?.winner === id, lost = s?.winner && !won;
      return `<div class="bx-row ${won ? 'win' : ''} ${lost ? 'lost' : ''}"><span class="num dim">${seed || ''}</span>${t ? crest(t, 16) : '<span class="crest-ph"></span>'}<span class="bx-name">${t ? esc(t.name) : `<span class="dim">${esc(holder(src, m))}</span>`}</span><b class="num">${s ? s.wins[id] : ''}</b></div>`; };
    const inner = `<span class="bx-lab ${live ? 'gold' : ''}">${lab}</span><div class="bx ${mine ? 'mine' : ''} ${live ? 'live' : ''}">${row(m.a, ids[0])}${row(m.b, ids[1])}</div>`;
    return `<${s?.games.length ? `a href="#/report/${s.games.at(-1)}"` : 'div'} class="bx-wrap" style="left:${x}px;top:${y}px">${inner}</${s?.games.length ? 'a' : 'div'}>`;
  };
  const lines = c.matches.flatMap(m => [m.a, m.b].map((src, slot) => {
    if (src[0] !== 'W' || !P[src.slice(2)] || !P[m.id]) return '';
    const [sc, sy] = P[src.slice(2)], [tc, ty] = P[m.id];
    const x1 = sc * PITCH + BW, y1 = sy + BH / 2, x2 = tc * PITCH, y2 = ty + (slot ? BH * 0.75 : BH / 4), mx = x2 - 16;
    const gold = resolved(src) === u.id || (resolved(src) == null && teamsOf(mm(src.slice(2))).includes(u.id));
    return `<path d="M${x1} ${y1} H${mx} V${y2} H${x2}" class="${gold ? 'gold-line' : ''}"/>`;
  })).join('');
  const width = Math.max(...Object.values(P).map(p => p[0])) * PITCH + BW;
  const heads = L.sections.map(sec => `<div class="bx-sec" style="top:${sec.y}px"><h3>${esc(sec.title)}</h3></div>${sec.cols.map((l, i) => `<span class="bx-col caps dim" style="left:${i * PITCH}px;top:${sec.y + 34}px">${esc(l)}</span>`).join('')}`).join('');
  return `<div class="bx-scroll"><div class="bx-canvas" style="width:${width}px;height:${L.height}px">${heads}<svg class="bx-lines" width="${width}" height="${L.height}">${lines}</svg>${c.matches.filter(m => P[m.id]).map(box).join('')}</div></div>`;
}
function bracket(el, W, u) {
  const r = REGIONS.indexOf(ui.region), c = W.comps[`${W.year}-${ui.split}-po-${r}`];
  el.innerHTML = `<div class="pad"><div class="filters">${regionPick()}${splitPick()}<span class="sp"></span><span class="dim">${c ? `${esc(c.name)} · double elimination${c.done ? ` · champion <b>${esc(team(W, c.champion).name)}</b>` : ''}` : ''}</span></div>
    ${c ? bracketView(W, c, u, DOUBLE_LAYOUT) : card('Playoffs', '', `<div class="pad">${empty('Playoffs not set yet', 'The top six of the regular season enter a double-elimination bracket after week 9.')}</div>`)}</div>`;
}

// ---------- International (20) ----------
function international(el, W, u) {
  ui.event ??= W.comps[`${W.year}-convergence`] ? 'convergence' : 'vernal';
  const c = W.comps[`${W.year}-${ui.event}`];
  const info = ui.event === 'vernal' ? 'May · 10 clubs (spring champion and runner-up from each region) · 2 groups of 5 (Bo1) · Bo5 semifinals and final'
    : `October · 15 clubs (${REGIONS.map(r => `${REGION_INFO[r].tag} ${QUOTA[r]}`).join(', ')}) · 3 groups of 5 (Bo1) · top 8 to Bo5 knockouts`;
  el.innerHTML = `<div class="pad"><div class="filters">${seg('event', [['vernal', EVENTS.vernal], ['convergence', EVENTS.convergence]], ui.event)}<span class="dim">${info}</span></div>
    ${!c ? card(EVENTS[ui.event], '', `<div class="pad">${empty('Not started yet', ui.event === 'vernal' ? 'Qualification follows the spring playoffs. The event starts on 6 May.' : 'Qualification follows the summer playoffs. The event starts on 1 October.')}</div>`)
    : `<div class="g3">${c.groups.map(g => card(g.name, '', `<table><thead><tr><th>Team</th><th class="n">W-L</th><th class="n">K-D</th></tr></thead><tbody>${sortedTable(g.table).map(x => `<tr class="${x.id === u.id ? 'me' : ''}"><td>${tLink(team(W, x.id))} <span class="dim small">${esc(team(W, x.id).region)}</span></td><td class="n">${x.w}-${x.l}</td><td class="n">${x.k - x.d}</td></tr>`).join('')}</tbody></table>`)).join('')}</div>
      ${c.matches ? `<div class="mt">${bracketView(W, c, u, treeLayout(c))}</div>` : `<p class="dim mt">Knockouts start when the group stage ends.</p>`}`}</div>`;
  on(el, '[data-event]', 'click', b => { ui.event = b.dataset.event; rr(); });
}

// ---------- Schedule (12) ----------
function schedule(el, W, u) {
  const month = ui.month ?? new Date(Date.UTC(W.year, 0, 1 + W.day)).getUTCMonth();
  const first = dayOfDate(W.year, month, 1), days = dayOfDate(W.year, month + 1, 1) - first, lead = (weekday(W.year, first) + 6) % 7;
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<div class="cal-cell off"></div>');
  for (let d = first; d < first + days; d++) {
    const mine = (W.fixtures[d] ?? []).map(id => W.series[id]).filter(s => involvesUser(W, s));
    const evs = (W.events ?? []).filter(e => e.day === d);
    const total = (W.fixtures[d] ?? []).length;
    cells.push(`<div class="cal-cell ${d === W.day ? 'today' : ''} ${d < W.day ? 'past' : ''}"><span class="small dim">${d - first + 1}</span>
      ${mine.map(s => { const opp = team(W, s.a === u.id ? s.b : s.a); return `<a class="cal-match ${s.winner ? (s.winner === u.id ? 'w' : 'l') : ''}" href="${s.games.length ? `#/report/${s.games.at(-1)}` : '#/home'}">vs ${esc(opp.tag)}${s.winner ? ` ${s.wins[u.id]}-${s.wins[opp.id]}` : ` · Bo${s.bestOf}`}</a>`; }).join('')}
      ${evs.map(e => `<span class="cal-ev">${esc(e.label)}</span>`).join('')}${!mine.length && total ? `<span class="dim small">${total} series</span>` : ''}</div>`);
  }
  const upcoming = Object.keys(W.fixtures).map(Number).filter(d => d >= W.day).sort((a, b) => a - b).flatMap(d => W.fixtures[d].map(id => W.series[id]).filter(s => involvesUser(W, s) && !s.winner)).slice(0, 10);
  el.innerHTML = `<div class="pad split-wide">
    ${card(new Date(Date.UTC(W.year, month, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }), `<button class="btn btn-ghost" id="prev" ${month <= 0 ? 'disabled' : ''}>◂</button><button class="btn btn-ghost" id="next" ${month >= 11 ? 'disabled' : ''}>▸</button>`,
      `<div class="cal"><div class="cal-head">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<span class="caps">${d}</span>`).join('')}</div><div class="cal-grid">${cells.join('')}</div></div><p class="dim small pad-s">Weekdays are training days (see Training); weekends restore condition.</p>`)}
    ${card('Your upcoming fixtures', '', upcoming.length ? `<table><tbody>${upcoming.map(s => { const opp = team(W, s.a === u.id ? s.b : s.a); return `<tr><td class="dim">${fmtDate(W.year, s.day)}</td><td>${tLink(opp)}</td><td class="dim small">${esc(W.comps[s.comp].name)} · Bo${s.bestOf}</td></tr>`; }).join('')}</tbody></table>` : `<div class="pad-s">${empty('No fixtures scheduled', 'Playoff and international fixtures appear once you qualify.')}</div>`)}</div>`;
  $('#prev', el).onclick = () => { ui.month = month - 1; rr(); };
  $('#next', el).onclick = () => { ui.month = month + 1; rr(); };
}

// ---------- Awards (07) ----------
// Awards (07): one event at a time — champions, Finals MVP, Season MVP, All-Pro first team, stat leaders.
// Before the final: the MVP race (state-empty-awards). Roll of honour and older honours under their own chip.
const SPLIT_NAME = { spring: 'Spring', summer: 'Summer' };
function awards(el, W, u) {
  const years = [...new Set(Object.values(W.comps).map(c => c.year))].sort((a, b) => b - a);
  const year = ui.awardYear ?? years[0];
  const myR = REGIONS.indexOf(u.region);
  const opts = [...REGIONS.flatMap((r, i) => ['spring', 'summer'].map(sp => [`${sp}-${i}`, `${REGION_INFO[r].league.replace(/ (League|Series)$/, '')} ${SPLIT_NAME[sp]}`])), ...Object.entries(EVENTS).map(([k, n]) => [`intl-${k}`, n]), ['honour', 'Roll of honour']];
  const started = k => k === 'honour' || (k.startsWith('intl-') ? Object.values(W.comps).some(c => c.year === year && c.kind === 'intl' && c.event === k.slice(5)) : !!W.comps[`${year}-${k.split('-')[0]}-${k.split('-')[1]}-0`]);
  const pick = ui.award && started(ui.award) ? ui.award : (year === W.year ? `${currentSplit(W)}-${myR}` : `summer-${myR}`);
  const bar = `<div class="filters">${select('ayear', years.map(y => [y, y]), year)}${select('aev', opts.filter(([k]) => started(k)), pick)}</div>`;
  const P = id => W.players[id];
  const tOf = (a, id) => team(W, a?.teams?.[id] ?? P(id)?.teamId);
  const who = (id, a, size = 44) => { const p = P(id), t = tOf(a, id); return p ? `${sprite(p.id, t?.color, size)}` : ''; };
  const plink = id => (P(id) ? `<a href="#/player/${id}">${esc(P(id).name)}</a>` : '—');
  const mini = t => (t ? `<span class="tm small dim">${crest(t, 14)} ${esc(t.name)}</span>` : '');

  if (pick === 'honour') {
    const finals = Object.values(W.comps).filter(c => c.year === year && c.finalsMvp);
    const roy = W.rollover?.year === year ? W.rollover.roy : {};
    el.innerHTML = `<div class="pad">${bar}<div class="g2">${card('Roll of honour', '', `<table><tbody>${W.champions.slice().reverse().slice(0, 40).map(c => `<tr class="${c.teamId === u.id ? 'me' : ''}"><td class="dim">${c.year}</td><td>${esc(c.comp)}</td><td>${tLink(team(W, c.teamId))}</td></tr>`).join('') || '<tr><td class="dim">No champions yet</td></tr>'}</tbody></table>`)}
      <div class="stack">${card(`Finals MVPs ${year}`, '', finals.length ? `<table><tbody>${finals.map(c => `<tr><td>${esc(c.name)}</td><td>${plink(c.finalsMvp)}</td></tr>`).join('')}</tbody></table>` : `<div class="pad-s">${empty('No finals played yet')}</div>`)}
      ${card(`Rookies of the Year ${year}`, '', Object.keys(roy).length ? `<table><tbody>${Object.entries(roy).map(([r, id]) => `<tr><td>${esc(REGION_INFO[r].league)}</td><td>${plink(id)}</td></tr>`).join('')}</tbody></table>` : `<div class="pad-s">${empty('Named at the season review')}</div>`)}</div></div></div>`;
    return wireAwards(el);
  }
  // Resolve the event: league + playoffs for a split, one comp for an international.
  const intl = pick.startsWith('intl-');
  const [sp, ri] = pick.split('-');
  const league = intl ? null : W.comps[`${year}-${sp}-${ri}-0`];
  const cup = intl ? Object.values(W.comps).find(c => c.year === year && c.kind === 'intl' && c.event === pick.slice(5)) : W.comps[`${year}-${sp}-po-${ri}`];
  const a = intl ? cup?.awards : league?.awards;
  const label = intl ? EVENTS[pick.slice(5)] : `${SPLIT_NAME[sp]} Split ${year}`;

  if (!cup?.done) { // state-empty-awards: what's coming + the MVP race
    const src = intl ? cup : league;
    const race = src ? Object.values(W.players).filter(p => p.stats[src.key]?.gp).map(p => ({ p, r: p.stats[src.key].rating / p.stats[src.key].gp, t: team(W, p.stats[src.key].team) })).sort((x, y) => y.r - x.r).slice(0, 8) : [];
    el.innerHTML = `<div class="pad">${bar}<div class="aw-empty">
      <section class="aw-pending"><span class="caps dim">Not announced yet</span><h2 class="disp xl">Awards come after the ${intl ? esc(EVENTS[pick.slice(5)]) : `${SPLIT_NAME[sp].toLowerCase()}`} final</h2>
        <p class="dim">Champions, Finals MVP, ${intl ? 'Event MVP, All-Event team' : 'Season MVP, All-Pro teams'} and stat leaders are revealed when the final ends.</p>
        <div class="aw-ghosts">${['Champions', 'Finals MVP', intl ? 'Event MVP' : 'Season MVP', intl ? 'All-Event' : 'All-Pro'].map(x => `<span>${x}</span>`).join('')}</div></section>
      ${card('MVP race', `Average rating${src ? ` · ${race[0]?.p.stats[src.key].gp ?? 0} games` : ''}`, race.length ? `<table class="aw-race"><tbody>${race.map((x, i) => `<tr class="${x.t?.id === u.id ? 'me' : ''}"><td class="dim num">${i + 1}</td><td><span class="tm">${sprite(x.p.id, x.t?.color, 32)}<span><a href="#/player/${x.p.id}"><b>${esc(x.p.name)}</b></a><br><span class="dim small">${esc(x.t?.name ?? '')}</span></span></span></td><td class="n num">${x.r.toFixed(1)}</td></tr>`).join('')}</tbody></table>` : `<div class="pad-s">${empty('No games played yet')}</div>`)}</div></div>`;
    return wireAwards(el);
  }
  const champ = team(W, cup.champion), opp = cup.final && team(W, cup.final.loser);
  const roster = cup.final?.roster ?? champ.starters;
  const mvpCard = (title, id, why) => card(title, '', id && P(id) ? `<div class="pad-s"><div class="row aw-mvp">${who(id, a, 64)}<div><h2 class="disp xl">${plink(id)}</h2><span class="dim">${P(id).role} · ${esc(tOf(a, id)?.name ?? '')}</span></div></div><p class="small">${esc(why ?? '')}</p></div>` : `<div class="pad-s">${empty('Not awarded')}</div>`);
  const sig = id => a?.sig?.[id] ?? Object.entries(P(id)?.champStats ?? {}).sort((x, y) => y[1].gp - x[1].gp)[0]?.[0];
  const L = a?.leaders ?? {};
  const lead = (k, title, fmt) => { const x = L[k]; return `<div class="aw-lead card">${x ? `${who(x.pid, { teams: { [x.pid]: x.team } }, 40)}<div><span class="caps dim">${title}</span><b>${plink(x.pid)}</b><span class="dim small">${esc(team(W, x.team)?.name ?? '')}</span></div><b class="disp xl">${fmt ? fmt(x.v) : ''}</b>` : `<div><span class="caps dim">${title}</span><span class="dim">—</span></div>`}</div>`; };
  el.innerHTML = `<div class="pad aw">${bar}
    <div class="aw-top">
      <section class="card aw-hero">${crest(champ, 128)}<div><span class="caps gold">${intl ? 'Champions' : `${SPLIT_NAME[sp]} champions`}</span><h1 class="disp xxl">${esc(champ.name)}</h1>
        <span class="dim">${opp ? `Beat ${esc(opp.name)} ${cup.final.score[0]}–${cup.final.score[1]} in the ${intl ? 'final' : 'grand final'}` : esc(cup.name)}</span>
        <div class="row aw-roster">${roster.map(id => (P(id) ? `<a href="#/player/${id}" title="${esc(P(id).name)}">${sprite(id, champ.color, 40)}</a>` : '')).join('')}</div></div></section>
      ${mvpCard('Finals MVP', cup.finalsMvp, cup.finalsWhy)}
      ${mvpCard(intl ? 'Event MVP' : 'Season MVP', a?.mvp, a?.why)}</div>
    ${a ? card(intl ? 'All-Event team' : 'All-Pro first team', 'Best average rating per role · signature champion', `<div class="aw-team">${ROLES.map((r, i) => { const id = a.allPro1[i]; return `<div class="aw-slot">${id ? `${who(id, a)}<div><span class="caps dim">${r}</span><b>${plink(id)}${id === a.mvp ? ' <span class="aw-tag">MVP</span>' : ''}</b>${mini(tOf(a, id))}</div><span class="sp"></span>${sig(id) ? `<span title="${esc(CHAMPS[sig(id)]?.name ?? '')}">${champSprite(sig(id), 36)}</span>` : ''}` : `<span class="caps dim">${r}</span><span class="dim">—</span>`}</div>`; }).join('')}</div>`, 'mt') : ''}
    ${a ? `<div class="aw-leads mt">${lead('kda', 'KDA', v => v.toFixed(1))}${lead('share', 'DMG share', v => `${Math.round(v * 100)}%`)}${lead('csm', 'CS / min', v => v.toFixed(1))}${lead('pool', 'Champ pool', v => v)}${lead('rookie', 'Rookie', null)}</div>` : ''}</div>`;
  wireAwards(el);
}
function wireAwards(el) {
  $('select[data-ayear]', el).onchange = e => { ui.awardYear = +e.target.value; rr(); };
  $('select[data-aev]', el).onchange = e => { ui.award = e.target.value; rr(); };
}

// ================= Stats centre =================
const PLAYER_COLS = [
  { key: 'name', label: 'Player', fmt: r => `<a href="#/player/${r.id}">${esc(r.name)}</a>` }, { key: 'team', label: 'Team' }, { key: 'role', label: 'Role' },
  { key: 'gp', label: 'GP', n: 1 }, { key: 'winPct', label: 'Win%', n: 1, fmt: r => num(r.winPct, 0) }, { key: 'k', label: 'K', n: 1 }, { key: 'd', label: 'D', n: 1 }, { key: 'a', label: 'A', n: 1 },
  { key: 'kda', label: 'KDA', n: 1, fmt: r => num(r.kda, 2) }, { key: 'csm', label: 'CS/m', n: 1, fmt: r => num(r.csm) }, { key: 'gpm', label: 'Gold/m', n: 1, fmt: r => Math.round(r.gpm) },
  { key: 'dpm', label: 'DMG/m', n: 1, fmt: r => Math.round(r.dpm) }, { key: 'vpm', label: 'Vis/m', n: 1, fmt: r => num(r.vpm, 2) }, { key: 'rating', label: 'Rating', n: 1, fmt: r => num(r.rating, 2) }, { key: 'mvp', label: 'MVP', n: 1 },
];
const CHAMP_COLS = [
  { key: 'name', label: 'Champion', fmt: r => `<span class="tm">${champSprite(r.id, 22)} ${esc(r.name)}</span>` }, { key: 'cls', label: 'Class' },
  { key: 'picks', label: 'Picks', n: 1 }, { key: 'bans', label: 'Bans', n: 1 }, { key: 'presence', label: 'Presence', n: 1, fmt: r => `${num(r.presence, 0)}%` },
  { key: 'pickPct', label: 'Pick%', n: 1, fmt: r => num(r.pickPct, 0) }, { key: 'banPct', label: 'Ban%', n: 1, fmt: r => num(r.banPct, 0) }, { key: 'winPct', label: 'Win%', n: 1, fmt: r => (r.picks ? num(r.winPct, 1) : '–') }, { key: 'kda', label: 'KDA', n: 1, title: 'From games with player lines: top leagues, internationals and your games', fmt: r => (r.kda == null ? '–' : num(r.kda, 2)) },
];
const TEAM_COLS = [
  { key: 'name', label: 'Team', fmt: r => `<a href="#/team/${r.id}">${esc(r.name)}</a>` }, { key: 'region', label: 'Region' }, { key: 'gp', label: 'GP', n: 1 }, { key: 'winPct', label: 'Win%', n: 1, fmt: r => num(r.winPct, 0) },
  { key: 'kpg', label: 'Kills/g', n: 1, fmt: r => num(r.kpg) }, { key: 'dpg', label: 'Deaths/g', n: 1, fmt: r => num(r.dpg) }, { key: 'tpg', label: 'Towers/g', n: 1, fmt: r => num(r.tpg) },
  { key: 'fbPct', label: 'FB%', n: 1, fmt: r => num(r.fbPct, 0) }, { key: 'titans', label: 'Titans', n: 1 }, { key: 'shrines', label: 'Shrines', n: 1 }, { key: 'len', label: 'Length', n: 1, fmt: r => num(r.len) }, { key: 'gdpg', label: 'GD/g', n: 1, fmt: r => Math.round(r.gdpg) },
];
const GAME_COLS = [
  { key: 'day', label: 'Date', fmt: r => fmtDate(r.year, r.day) }, { key: 'comp', label: 'Competition' }, { key: 'blue', label: 'Blue' }, { key: 'red', label: 'Red' }, { key: 'winner', label: 'Winner' },
  { key: 'score', label: 'Kills' }, { key: 'len', label: 'Length', n: 1, fmt: r => num(r.len) }, { key: 'gd', label: 'Gold diff', n: 1, fmt: r => Math.round(r.gd) }, { key: 'report', label: '', fmt: r => (r.report ? `<a href="#/report/${r.id}">Report</a>` : '') },
];

export function stats(el, args, sub) {
  const W = state.W, u = userTeam(W);
  ui.year ??= archiveYears(W)[0] ?? W.year;
  const lastSeries = Object.values(W.series).filter(s => involvesUser(W, s) && s.games.length).at(-1);
  const scope = ui.scope;
  const keys = scope === 'exhibitions' ? [] : compKeys(W, { scope, year: ui.year, sid: lastSeries?.id, region: ui.sregion || undefined, tier: scope === 'series' ? '' : ui.tier });
  const bar = `<div class="scope"><span class="seg" role="group">${[['season', `Season ${W.year}`], ['career', 'Career'], ['archive', 'Archive'], ['exhibitions', 'Exhibitions'], ['series', 'This series']].map(([k, l]) => `<span role="button" tabindex="0" data-scope="${k}" class="${scope === k ? 'on' : ''}">${l}</span>`).join('')}</span>
    ${scope === 'archive' ? select('syear', (archiveYears(W).length ? archiveYears(W) : [W.year]).map(y => [y, y]), ui.year) : ''}
    ${scope !== 'series' ? `${select('sregion', [['', 'All regions'], ...REGIONS.map(r => [r, r])], ui.sregion)}${select('tier', [['', 'All tiers'], ['0', 'Top leagues'], ['1', TIERS[1]], ['2', TIERS[2]]], ui.tier)}` : `<span class="dim">${lastSeries ? `${esc(W.comps[lastSeries.comp].name)} · ${esc(lastSeries.label)}` : 'No series played yet'}</span>`}
    ${sub === 'champions' && scope !== 'series' ? select('pt', [['', 'All patches'], ...(W.patches ?? []).map(x => [x.id, `Patch ${x.id}`]).reverse()], ui.pt ?? '') : ''}
    ${sub === 'players' || sub === 'overview' ? `${select('role', [['', 'All roles'], ...ROLES.map(r => [r, r])], ui.role)}${select('mingp', [[1, 'Min 1 game'], [3, 'Min 3'], [10, 'Min 10'], [20, 'Min 20']], ui.minGp)}` : ''}
    <span class="sp"></span>${['players', 'champions', 'teams', 'games', 'economy'].includes(sub) ? '<button class="btn btn-secondary" id="csv">Export CSV</button>' : ''}</div>`;
  let body = '', csv = null;
  const nothing = scope === 'exhibitions' ? empty('No exhibition games', 'Exhibitions and scrims are not recorded yet.') : empty('No games in this scope', 'Play some games or widen the filters.');
  if (sub === 'overview') {
    const pr = playerRows(W, keys, { role: ui.role, minGp: scope === 'series' ? 1 : ui.minGp }), ch = champRows(W, keys), tr = teamRows(W, keys);
    const top = (rows, k, fmt, n = 5) => rows.slice().sort((a, b) => b[k] - a[k]).slice(0, n);
    const lead = (title, k, fmt) => card(title, '', `<table><tbody>${top(pr, k).map((r, i) => `<tr><td class="dim">${i + 1}</td><td><a href="#/player/${r.id}">${esc(r.name)}</a> <span class="dim small">${esc(r.team)} · ${r.role}</span></td><td class="n">${fmt(r[k])}</td></tr>`).join('')}</tbody></table>`);
    body = pr.length ? `<div class="g4">${lead('Rating', 'rating', v => num(v, 2))}${lead('KDA', 'kda', v => num(v, 2))}${lead('Damage / min', 'dpm', v => Math.round(v))}${lead('Vision / min', 'vpm', v => num(v, 2))}</div>
      <div class="g2 mt">${card('Most present champions', `${ch[0]?.games ?? 0} games`, `<table><tbody>${top(ch, 'presence').map(r => `<tr><td><span class="tm">${champSprite(r.id, 22)} ${esc(r.name)}</span></td><td class="n">${num(r.presence, 0)}%</td><td class="n dim">${r.picks}P ${r.bans}B</td><td class="n">${r.picks ? num(r.winPct, 0) + '% W' : ''}</td></tr>`).join('')}</tbody></table>`)}
      ${card('Best teams', '', `<table><tbody>${top(tr.filter(t => t.gp >= 3), 'winPct').map(r => `<tr class="${r.id === u.id ? 'me' : ''}"><td><a href="#/team/${r.id}">${esc(r.name)}</a></td><td class="n">${r.w}-${r.gp - r.w}</td><td class="n">${num(r.winPct, 0)}%</td><td class="n">${num(r.gdpg / 1000)}k GD</td></tr>`).join('')}</tbody></table>`)}</div>` : nothing;
  } else if (sub === 'players') {
    const pr = playerRows(W, keys, { role: ui.role, minGp: scope === 'series' ? 1 : ui.minGp });
    csv = () => toCSV(pr, PLAYER_COLS);
    body = pr.length ? card('Players', `${pr.length} players`, `<div class="scroll">${table('st-players', PLAYER_COLS, pr, { me: r => W.players[r.id]?.teamId === u.id, defaultSort: { key: 'rating', dir: -1 } })}</div>`) : nothing;
  } else if (sub === 'champions') {
    const ch = champRows(W, keys, { pt: ui.pt || undefined });
    csv = () => toCSV(ch, CHAMP_COLS);
    body = ch[0]?.games ? card('Champions', `${ch[0].games} games · presence = picked or banned`, `<div class="scroll">${table('st-champs', CHAMP_COLS, ch, { defaultSort: { key: 'presence', dir: -1 } })}</div>`) : (scope === 'career' ? empty('Champion data covers the current season', 'Per-game draft data is pruned at each season review.') : nothing);
  } else if (sub === 'teams') {
    const tr = teamRows(W, keys);
    csv = () => toCSV(tr, TEAM_COLS);
    body = tr.length ? card('Teams', `${tr.length} teams`, `<div class="scroll">${table('st-teams', TEAM_COLS, tr, { me: r => r.id === u.id, defaultSort: { key: 'winPct', dir: -1 } })}</div>`) : nothing;
  } else if (sub === 'games') {
    const gr = gameRows(W, keys);
    csv = () => toCSV(gr, GAME_COLS);
    body = gr.length ? card('Games', `${gr.length} games${gr.length > 400 ? ' · showing 400' : ''}`, `<div class="scroll">${table('st-games', GAME_COLS, gr)}</div>`) : nothing;
  } else if (sub === 'economy') {
    const led = ledger(u), cats = [...new Set(led.flatMap(m => Object.keys(m).filter(k => k !== 'month' && k !== 'net')))];
    const cols = [{ key: 'month', label: 'Month' }, ...cats.map(c => ({ key: c, label: c[0].toUpperCase() + c.slice(1), n: 1, fmt: r => (r[c] ? money(r[c]) : '') })), { key: 'net', label: 'Net', n: 1, fmt: r => `<b class="${r.net < 0 ? 'bad' : 'good'}">${money(r.net)}</b>` }];
    csv = () => toCSV(led, cols);
    body = led.length ? card(`${esc(u.name)} ledger`, `Cash ${money(u.cash)}`, `<div class="scroll">${table('st-econ', cols, led.slice().reverse())}</div>`) : empty('No transactions yet', 'Wages, sponsors, prizes and transfers show up here week by week.');
  }
  el.innerHTML = `${bar}<div class="pad">${body}</div>`;
  wireTables(el, rr);
  on(el, '[data-scope]', 'click', b => { ui.scope = b.dataset.scope; rr(); });
  const sel = (k, f) => $(`select[data-${k}]`, el)?.addEventListener('change', e => { f(e.target.value); rr(); });
  sel('syear', v => { ui.year = +v; }); sel('sregion', v => { ui.sregion = v; }); sel('tier', v => { ui.tier = v; }); sel('role', v => { ui.role = v; }); sel('mingp', v => { ui.minGp = +v; }); sel('pt', v => { ui.pt = v; });
  $('#csv', el)?.addEventListener('click', () => csv && download(`lanebreak-${sub}-${scope}.csv`, csv()));
}
