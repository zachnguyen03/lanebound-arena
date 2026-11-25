// Match day: draft (04), live view (05), post-game (05b) and the match report (15).
import { ROLES, CHAMPS, CHAMP_IDS, TF_DEFAULT, TRAITS, COMP_TEXT, COMP_BEATS, kitText, compOf } from '../data.js';
import { newDraft, turn, draftDone, applyDraft, aiChoice, isTaken, isLocked, effProf } from '../draft.js';
import { createMatch, step, summarize, fmt, TICK, queuePlan, clonePlan, phaseAt, MAX_TIME } from '../sim.js';
import { team, userTeam, starterPlayers, engineTeam, nextGameSides, recordGame, fearlessLocks, stakesOf, draftPrefs, MASTERY, CFG, TALKS, teamTalk, isRivalry, scoutReport, highlights, gameSummary } from '../career.js';
import { state, go, save } from './state.js';
import { esc, $, on, crest, sprite, kfmt, empty, toast, seg, ROLE_SHORT } from './dom.js';
import { drawMatch, drawFrame, mapHeight, SIDE } from './render.js';
import { champSprite } from './screens.js';

let md = null; // the game in progress (survives re-renders, not reloads)
const CLOCK = 30;

function newGame(W, s) {
  const [blue, red] = nextGameSides(s);
  const userSide = blue === W.userTeamId ? 0 : 1;
  const fearless = CFG.fearless && s.bestOf >= 3;
  md = { sid: s.id, blue, red, userSide, phase: 'draft', draft: newDraft({ fearless, locks: fearlessLocks(W, s) }), sel: null, role: '', q: '', hide: false, swap: null, clock: CLOCK, players: [blue, red].map(id => starterPlayers(W, team(W, id))) };
}

export function match(app, sid) {
  const W = state.W, s = W.series[sid];
  if (!s) return go('#/home');
  if (!md || md.sid !== sid || (md.phase !== 'post' && s.winner)) {
    if (s.winner) return go('#/home');
    newGame(W, s);
  }
  ({ draft: renderDraft, live: renderLive, post: renderPost })[md.phase](app);
}

const sideName = side => (side ? 'Red' : 'Blue');
function seriesHeader(W, s) {
  const c = W.comps[s.comp];
  return `${esc(c.name)} · ${esc(s.label)} · Game ${s.games.length + 1} of ${s.bestOf}`;
}

// ================= Draft (04) =================
function lockReason(W, d, side, id) {
  for (const sd of [0, 1]) if (d.bans[sd].includes(id)) return `Banned by ${sideName(sd)}`;
  for (const sd of [0, 1]) if (d.picks[sd].includes(id)) return `Picked by ${sideName(sd)}`;
  if (isLocked(d, side, id)) return 'Fearless: your team played it last game';
  return null;
}
function renderDraft(app) {
  const W = state.W, s = W.series[md.sid], d = md.draft, us = md.userSide, cur = turn(d), done = draftDone(d);
  const myTurn = cur && cur[0] === us, mine = md.players[us], theirs = md.players[1 - us];
  if (!done && !myTurn) setTimeout(() => aiStep(app), 500);
  const prefs = side => draftPrefs(W, team(W, side ? md.red : md.blue)), steady = () => 0.5; // steady rng: the suggestion doesn't flicker between renders
  const suggestion = myTurn ? aiChoice(d, us, mine, theirs, steady, prefs(us)) : null;
  if (myTurn && cur[1] === 'pick' && (md.slot == null || d.picks[us][md.slot])) md.slot = suggestion?.slot ?? d.picks[us].indexOf(null);
  const teams = [team(W, md.blue), team(W, md.red)];
  const used = side => s.games.map(gid => W.games.find(g => g.id === gid)).filter(Boolean).map((g, i) => { const tid = side ? md.red : md.blue, sd = g.blue === tid ? 0 : 1; return `<div class="used"><span class="caps">G${i + 1}</span>${g.picks[sd].map(id => champSprite(id, 28)).join('')}<span class="f ${g.winner === tid ? 'w' : 'l'}">${g.winner === tid ? 'W' : 'L'}</span></div>`; }).join('');
  const bans = side => { const n = d.order.filter(x => x[0] === side && x[1] === 'ban').length; return Array.from({ length: n }, (_, i) => d.bans[side][i] ? `<span class="ban">${champSprite(d.bans[side][i], 30)}</span>` : '<span class="ban empty"></span>').join(''); };
  const col = side => `<aside class="d-col ${side ? 'rside' : ''}">${ROLES.map((role, i) => { const p = md.players[side][i], id = d.picks[side][i], me = side === us; const active = me && ((myTurn && cur[1] === 'pick' && md.slot === i) || md.swap === i); return `<div class="d-slot ${active ? 'active' : ''} ${cur && cur[0] === side && cur[1] === 'pick' && !id ? 'turn' : ''}" ${me ? `data-slot="${i}" role="button" tabindex="0"` : ''}>${id ? champSprite(id, 56) : `<span class="d-empty">${active ? '?' : ''}</span>`}<div><span class="caps">${role}${id ? ` · ${esc(p.name)}` : ''}</span><b class="${id ? 'disp lg' : ''}">${id ? esc(CHAMPS[id].name) : esc(p.name)}</b>${id && me ? `<span class="small dim">Mastery ${MASTERY(effProf(p, i, id))}</span>` : ''}</div></div>`; }).join('')}
    ${compBox(d, side)}${side !== us ? intel(W, team(W, side ? md.red : md.blue)) : ''}<div class="d-used"><span class="caps">Used this series${d.fearless ? ' · locked' : ''}</span>${used(side) || '<span class="dim small">First game</span>'}</div></aside>`;
  const list = CHAMP_IDS.filter(id => (!md.role || CHAMPS[id].roles.includes(md.role)) && (!md.q || CHAMPS[id].name.toLowerCase().includes(md.q.toLowerCase())) && (!md.hide || !lockReason(W, d, us, id)));
  const unavailable = CHAMP_IDS.filter(id => lockReason(W, d, us, id)).length;
  const selId = md.sel && !lockReason(W, d, us, md.sel) ? md.sel : suggestion?.id;
  const selC = selId && CHAMPS[selId], slotP = md.slot != null ? mine[md.slot] : null;
  const diff = s.wins[W.userTeamId] - s.wins[md.userSide ? md.blue : md.red];
  const talk = md.talk ? `<div class="small">${md.talk.map(r => `${esc(r.name)} <b class="${r.d > 0 ? 'good' : r.d < 0 ? 'bad' : ''}">${r.mood}</b>`).join(' · ')}</div>`
    : `<div class="row wrap"><span class="caps">Team talk</span>${Object.entries(TALKS).map(([k, l]) => `<button class="btn btn-ghost" data-talk="${k}">${l}</button>`).join('')}</div>`;
  const analyst = done ? `Draft complete. Click two of your slots to trade champions between players, then start.${isRivalry(W, s.a, s.b) ? ' <b class="bad">Rivalry game</b>: higher stakes, bigger mood swings.' : ''}${talk}` : !myTurn ? `${sideName(cur[0])} is ${cur[1] === 'ban' ? 'banning' : 'picking'}…`
    : esc(suggestion.why);
  const kit = selId && kitText(selId);
  app.innerHTML = `<div class="draft">
    <header class="d-head"><div class="d-team">${crest(teams[0], 40)}<div><h2 class="disp xl">${esc(teams[0].name)}</h2><span class="blue caps">Blue side</span></div><div class="bans">${bans(0)}</div></div>
      <div class="d-mid"><span class="dim small">${seriesHeader(W, s)}</span><b class="disp score">${s.wins[md.blue]} – ${s.wins[md.red]}</b><span class="caps ${cur ? (cur[0] ? 'red' : 'blue') : ''}">${cur ? `${sideName(cur[0])} ${cur[1]}s` : 'Draft complete'}${d.fearless ? ' · Fearless' : ''}</span>${myTurn ? `<b class="disp clock" id="clock">0:${String(md.clock).padStart(2, '0')}</b>` : ''}</div>
      <div class="d-team right"><div class="bans">${bans(1)}</div><div><h2 class="disp xl">${esc(teams[1].name)}</h2><span class="red caps">Red side</span></div>${crest(teams[1], 40)}</div></header>
    <div class="d-body">${col(0)}
      <section class="d-center">
        <div class="d-filters">${[['', 'All'], ...ROLES.map(r => [r, ROLE_SHORT[r]])].map(([r, l]) => `<button class="chip ${md.role === r ? 'on' : ''}" data-role="${r}">${l}</button>`).join('')}<button class="chip ${md.hide ? 'on' : ''}" id="hide">Hide unavailable · ${unavailable}</button><input type="search" id="q" placeholder="Search champions" value="${esc(md.q)}" aria-label="Search champions"></div>
        <div class="d-legend small"><span class="gold">◆</span> Analyst pick ${d.fearless ? '· <b>G1</b> Fearless: played last game, locked for that team' : ''}<span class="sp"></span><span class="tag-ph">Placeholder pixel art</span></div>
        <div class="d-grid">${list.map(id => { const why = lockReason(W, d, us, id), by = [0, 1].find(sd => d.picks[sd].includes(id)); return `<button class="d-tile ${why ? 'locked' : ''} ${id === selId ? 'sel' : ''} ${d.bans.flat().includes(id) ? 'banned' : ''}" data-champ="${id}" ${why ? `title="${esc(why)}" aria-disabled="true"` : `title="${esc(CHAMPS[id].name)} · ${CHAMPS[id].cls}"`}>${champSprite(id, 56)}${by != null ? `<span class="d-by ${by ? 'red' : 'blue'}">${by ? 'RED' : 'BLUE'}</span>` : ''}${isLocked(d, us, id) && !isTaken(d, id) ? '<span class="d-by">G</span>' : ''}${suggestion?.id === id ? '<span class="d-ana">◆</span>' : ''}<span class="small">${esc(CHAMPS[id].name)}</span></button>`; }).join('') || empty('No champions match')}</div>
        <div class="d-analyst"><b class="gold">Analyst:</b> ${analyst}</div>
        <div class="d-detail">${selC ? `${champSprite(selId, 72)}<div><h2 class="disp xl">${esc(selC.name)}</h2><span class="dim">${selC.cls} · ${selC.roles.join('/')}${slotP && cur?.[1] === 'pick' ? ` · for ${esc(slotP.name)}` : ''}</span>
          <div class="row"><span><span class="caps">Mastery</span><b>${slotP ? MASTERY(effProf(slotP, md.slot, selId)) : '–'}</b></span><span class="pill">${esc(kit.tag)}</span>${kit.traits.map(t => `<span class="pill">${t}</span>`).join('')}</div>
          <div class="kit small"><div><b>Skill</b> ${esc(kit.skill)}</div><div><b>Ultimate</b> ${esc(kit.ult)} <span class="dim">(level 6)</span></div><div><b>Passive</b> ${esc(kit.passive)}</div></div></div>` : ''}
          <span class="sp"></span>${done ? '<button class="btn btn-blue btn-lg" id="start">Start game ▸</button>' : myTurn ? `<button class="btn btn-blue btn-lg" id="lock" ${selId ? '' : 'disabled'}>${cur[1] === 'ban' ? 'Ban' : 'Lock in'}</button>` : ''}</div>
      </section>${col(1)}</div></div>`;
  on(app, '[data-role]', 'click', b => { md.role = b.dataset.role; renderDraft(app); });
  $('#hide', app).onclick = () => { md.hide = !md.hide; renderDraft(app); };
  $('#q', app).oninput = e => { md.q = e.target.value; const pos = e.target.selectionStart; renderDraft(app); const q = $('#q', app); q.focus(); q.setSelectionRange(pos, pos); };
  on(app, '[data-champ]', 'click', b => { if (b.getAttribute('aria-disabled')) return toast(b.title, true); md.sel = b.dataset.champ; renderDraft(app); });
  on(app, '[data-slot]', 'click', el => {
    const i = +el.dataset.slot;
    if (done) { if (md.swap == null) md.swap = i; else { const p = d.picks[us]; [p[md.swap], p[i]] = [p[i], p[md.swap]]; md.swap = null; } }
    else if (myTurn && cur[1] === 'pick' && !d.picks[us][i]) md.slot = i;
    renderDraft(app);
  });
  $('#lock', app)?.addEventListener('click', () => lockIn(app, selId));
  $('#start', app)?.addEventListener('click', () => startLive(app));
  on(app, '[data-talk]', 'click', b => { md.talk = teamTalk(W, userTeam(W), b.dataset.talk, diff); renderDraft(app); });
  clearInterval(md.timer);
  if (myTurn) {
    md.timer = setInterval(() => {
      if (!$('#clock', app)) return clearInterval(md.timer);
      md.clock--;
      $('#clock', app).textContent = `0:${String(Math.max(0, md.clock)).padStart(2, '0')}`;
      if (md.clock <= 0) { clearInterval(md.timer); toast('Time! The analyst locked in their pick.'); lockIn(app, suggestion.id, suggestion.slot); }
    }, 1000);
  }
}
function lockIn(app, id, slot = md.slot) {
  clearInterval(md.timer);
  applyDraft(md.draft, id, slot); md.sel = null; md.clock = CLOCK;
  renderDraft(app);
}
function aiStep(app) {
  if (!md || md.phase !== 'draft' || !location.hash.startsWith('#/match')) return;
  const d = md.draft, cur = turn(d);
  if (!cur || cur[0] === md.userSide) return;
  const c = aiChoice(d, cur[0], md.players[cur[0]], md.players[1 - cur[0]], Math.random, draftPrefs(state.W, team(state.W, cur[0] ? md.red : md.blue)));
  applyDraft(d, c.id, c.slot); md.clock = CLOCK;
  renderDraft(app);
}

// ================= Live (05) =================
function startLive(app) {
  const W = state.W, s = W.series[md.sid], u = userTeam(W);
  const [b, r] = [md.blue, md.red].map(id => team(W, id));
  md.s = createMatch(engineTeam(W, b, md.draft.picks[0]), engineTeam(W, r, md.draft.picks[1]), Math.floor(Math.random() * 2 ** 31), { stakes: stakesOf(W, s), patch: W.patch?.mods });
  md.phase = 'live'; md.speed = state.settings.speed; md.paused = false; md.hl = null;
  md.queued = null;
  renderLive(app);
}
let gid = 0;
export const goldGraph = (tl, w = 340, h = 110, marker = null) => {
  if (tl.length < 2) return `<svg width="${w}" height="${h}"></svg>`;
  const diffs = tl.map(x => x.g[0] - x.g[1]), m = Math.max(3000, ...diffs.map(Math.abs)), T = Math.max(MAX_TIME, tl.at(-1).t);
  const X = t => (t / T) * w, Y = v => h / 2 - (v / m) * (h / 2 - 6);
  const pts = tl.map((x, i) => `${X(x.t).toFixed(1)},${Y(diffs[i]).toFixed(1)}`).join(' ');
  return `<svg width="100%" viewBox="0 0 ${w} ${h + 14}" preserveAspectRatio="none" class="gold-graph" role="img" aria-label="Gold lead over time"><line x1="0" x2="${w}" y1="${h / 2}" y2="${h / 2}" stroke="var(--c-line-2)"/>
    <clipPath id="gtop${++gid}"><rect x="0" y="0" width="${w}" height="${h / 2}"/></clipPath><clipPath id="gbot${gid}"><rect x="0" y="${h / 2}" width="${w}" height="${h / 2}"/></clipPath>
    <polygon points="0,${h / 2} ${pts} ${X(tl.at(-1).t)},${h / 2}" fill="var(--c-blue)" opacity=".25" clip-path="url(#gtop${gid})"/><polygon points="0,${h / 2} ${pts} ${X(tl.at(-1).t)},${h / 2}" fill="var(--c-red)" opacity=".25" clip-path="url(#gbot${gid})"/>
    <polyline points="${pts}" fill="none" stroke="var(--c-text)" stroke-width="1.5"/>${marker != null ? `<line x1="${X(marker)}" x2="${X(marker)}" y1="0" y2="${h}" stroke="var(--c-action)" stroke-width="1.5"/>` : ''}
    <text x="2" y="10" fill="var(--c-faint)" font-size="9">+${(m / 1000).toFixed(0)}k</text><text x="2" y="${h - 2}" fill="var(--c-faint)" font-size="9">−${(m / 1000).toFixed(0)}k</text>${[0, 2, 4, 6, 8, 10].filter(t => t * 60 <= T).map(t => `<text x="${X(t * 60)}" y="${h + 12}" fill="var(--c-faint)" font-size="9">${t}m</text>`).join('')}</svg>`;
};
// Composition so far: tag, counter status, active traits.
function intel(W, t) {
  const r = scoutReport(W, t);
  return `<div class="d-comp small"><span class="caps">Scouting</span><div>Form <b>${r.form || '–'}</b> · plan <b>${esc(r.plan)}</b> · chemistry <b>${r.chem}</b></div>
    ${r.recent.length ? `<div>Recent picks ${r.recent.map(x => `${esc(CHAMPS[x.id].name)}×${x.n}`).join(', ')}</div>` : ''}
    ${r.known ? r.players.map(p => `<div>${ROLE_SHORT[p.role]} ${esc(p.name)}: ${p.comfort.map(c => esc(CHAMPS[c].name)).join(', ') || '–'}</div>`).join('') : '<div class="dim">Comfort picks unknown. Scrim them, or build a level-4 analytics room.</div>'}</div>`;
}
function compBox(d, side) {
  const me = compOf(d.picks[side]), them = compOf(d.picks[1 - side]);
  const edge = COMP_BEATS[me.tag] === them.tag ? '<span class="good">counters them</span>' : COMP_BEATS[them.tag] === me.tag ? '<span class="bad">countered</span>' : '';
  const traits = Object.entries(me.traits).sort((a, b) => b[1] - a[1]).map(([t, n]) => `<span class="pill ${n >= 2 ? 'hi' : ''}" title="${TRAITS[t].label} ${n >= 2 ? `+${Math.round(TRAITS[t].v[Math.min(3, n) - 2] * 100)}%` : '(needs 2)'}">${t} ${n}</span>`).join('');
  return `<div class="d-comp"><span class="caps">Composition</span><div><b>${esc(COMP_TEXT[me.tag])}</b> ${edge}</div><div class="row wrap">${traits || '<span class="dim small">No picks yet</span>'}</div></div>`;
}
function feedLine(W, s, e) {
  const nm = pid => s.champs.find(c => c.pid === pid);
  if (e.type === 'kill') { const k = nm(e.k), v = nm(e.v); return `<div class="feed-row"><span class="num dim">${fmt(e.t)}</span><b class="${e.side ? 'red' : 'blue'}">${esc(k?.name)}</b>${champSprite(e.kc, 20)}<span class="dim">›</span>${champSprite(e.vc, 20)}<span>${esc(v?.name)}</span>${e.fb ? '<span class="pill">First blood</span>' : ''}${e.shutdown ? '<span class="pill hi">Shutdown</span>' : ''}${e.streak >= 3 ? `<span class="pill">${e.streak} streak</span>` : ''}</div>`; }
  const team = esc(s.teams[e.side]?.name ?? '');
  if (e.type === 'ult') { const c = nm(e.pid); return `<div class="feed-row"><span class="num dim">${fmt(e.t)}</span>${champSprite(e.champ, 20)}<b class="${e.side ? 'red' : 'blue'}">${esc(c?.name)}</b><span>${esc(e.name)}${e.hits > 1 ? ` · ${e.hits} hit` : ''}</span></div>`; }
  const txt = { tower: `${team} destroyed a ${e.lane ?? 'base'} tower`, titan: `${team} slew the Titan`, shrine: `${team} took the Shrine`, ace: `ACE for ${team}`, core: `${team} destroyed the Core`, death: 'Execution' }[e.type];
  return txt ? `<div class="feed-row"><span class="num dim">${fmt(e.t)}</span><span class="${e.side ? 'red' : 'blue'}">◆</span><span>${txt}</span></div>` : '';
}
function rail(s, side) {
  return s.champs.filter(c => c.side === side).map(c => `<div class="rail-p ${md.hl === c.pid ? 'hl' : ''} ${c.alive ? '' : 'dead'}" data-hl="${c.pid}">${champSprite(c.champ, 44)}<div class="rail-main"><div class="row between"><b>${esc(c.name)}</b><span class="num">${c.st.k}/${c.st.d}/${c.st.a}</span></div>
    <div class="row between small dim"><span>${esc(c.c.name)} · Lv ${c.level}</span><span class="num">${c.st.cs} cs</span></div>
    ${c.alive ? `<div class="row"><span class="pill">${c.tfRole}</span>${`<span class="bar"><i style="width:${(c.hp / c.maxHp) * 100}%;background:${c.hp / c.maxHp > 0.5 ? 'var(--c-good)' : c.hp / c.maxHp > 0.25 ? 'var(--c-warn)' : 'var(--c-bad)'}"></i></span>`}<span class="pill ${c.level >= 6 && c.ultCd <= 0 ? 'ult' : ''}" title="${esc(c.c.ult.name)}">ULT</span></div>` : `<div class="small">Respawn in <b class="num">${fmt(Math.max(0, c.respawnAt - s.t))}</b></div>`}</div></div>`).join('');
}
const objectives = (s, side) => `<div class="objs"><span class="caps">Objectives</span><div class="row">${[['Towers', s.towers[side]], ['Shrines', s.shrines[side]], ['Titans', s.titans[side]]].map(([l, v]) => `<div class="obj"><b class="disp lg">${v}</b><span class="small dim">${l}</span></div>`).join('')}</div></div>`;

function renderLive(app) {
  const W = state.W, ser = W.series[md.sid], s = md.s, us = md.userSide;
  const teams = [team(W, md.blue), team(W, md.red)];
  app.innerHTML = `<div class="live">
    <header class="l-head"><div class="tm">${crest(teams[0], 32)}<b class="disp lg">${esc(teams[0].name)}</b></div><div class="l-score"><div><b class="disp k blue" id="k0"></b><span class="dim small" id="g0"></span></div><div><b class="disp clock" id="clock"></b><span class="dim small">Game ${ser.games.length + 1} · Series ${ser.wins[md.blue]} – ${ser.wins[md.red]}</span></div><div><b class="disp k red" id="k1"></b><span class="dim small" id="g1"></span></div></div><div class="tm right"><b class="disp lg">${esc(teams[1].name)}</b>${crest(teams[1], 32)}</div></header>
    <div class="l-body"><aside class="l-rail" id="r0"></aside>
      <section class="l-center"><div class="l-map"><canvas id="map" width="700" height="${mapHeight(700)}" aria-label="Arena map. Click a champion to highlight."></canvas></div>
        <div class="l-low"><div class="l-gold"><div class="row between"><h3 class="disp">Gold lead</h3><span class="small dim"><span class="blue">■</span> ${esc(teams[0].tag)} ahead · <span class="red">■</span> ${esc(teams[1].tag)} ahead</span></div><div id="gold"></div></div><div class="l-feed"><h3 class="disp">Feed</h3><div id="feed"></div></div></div>
        <div class="l-bar"><span class="dim nowrap">Plan</span>${seg('style', [['teamfight', 'Teamfight'], ['split', 'Split push'], ['macro', 'Macro']], md.queued ?? s.teams[us].plan.phases[phaseAt(s.t)].style)}${seg('posture', [['aggressive', 'Aggro'], ['balanced', 'Even'], ['defensive', 'Safe']], md.queuedP ?? s.teams[us].plan.phases[phaseAt(s.t)].posture)}<span class="dim small nowrap" id="pending">${s.pending[us] ? 'Applies at next reset' : ''}</span><span class="sp"></span>
          <span class="seg">${[[0, '❚❚'], [1, '1×'], [2, '2×'], [4, '4×']].map(([v, l]) => `<span role="button" tabindex="0" data-speed="${v}" class="${(md.paused ? 0 : md.speed) === v ? 'on' : ''}" aria-label="${v ? `Speed ${l}` : 'Pause'}">${l}</span>`).join('')}</span><button class="btn btn-ghost" id="skip">Skip to end</button></div></section>
      <aside class="l-rail rside" id="r1"></aside></div></div>`;
  const ctx = $('#map', app).getContext('2d');
  const colors = SIDE;
  const queue = (k, v) => {
    const plan = clonePlan(s.teams[us].plan), ph = phaseAt(s.t);
    for (const p of ['early', 'mid', 'late'].slice(['early', 'mid', 'late'].indexOf(ph))) plan.phases[p][k] = v;
    queuePlan(s, us, plan);
    if (k === 'style') md.queued = v; else md.queuedP = v;
    on(app, `[data-${k}]`, 'click', () => {});
    app.querySelectorAll(`[data-${k}]`).forEach(x => x.classList.toggle('on', x.dataset[k] === v));
    $('#pending', app).textContent = 'Applies at next reset';
  };
  on(app, '[data-style]', 'click', b => queue('style', b.dataset.style));
  on(app, '[data-posture]', 'click', b => queue('posture', b.dataset.posture));
  on(app, '[data-speed]', 'click', b => { const v = +b.dataset.speed; md.paused = v === 0; if (v) md.speed = v; app.querySelectorAll('[data-speed]').forEach(x => x.classList.toggle('on', x === b)); });
  $('#skip', app).onclick = () => { while (!s.over) step(s); };
  $('#map', app).onclick = e => {
    const r = e.target.getBoundingClientRect(), S = e.target.width / 108, x = (e.clientX - r.left) * (e.target.width / r.width) / S, y = (e.clientY - r.top) * (e.target.height / r.height) / S;
    const c = s.champs.filter(c => c.alive).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
    md.hl = c && Math.hypot(c.x - x, c.y - y) < 4 ? (md.hl === c.pid ? null : c.pid) : null;
  };
  let last = performance.now(), acc = 0, lastPanel = 0;
  const frame = now => {
    if (!ctx.canvas.isConnected) return;
    if (!md.paused) { acc += Math.min(0.25, (now - last) / 1000) * md.speed * 4; while (acc >= TICK && !s.over) { step(s); acc -= TICK; } }
    last = now;
    drawMatch(ctx, s, colors, { highlight: md.hl });
    if (now - lastPanel > 250 || s.over) { panel(app, W, s); lastPanel = now; }
    if (s.over) return setTimeout(() => finishGame(app), 1200);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
function panel(app, W, s) {
  const gold = side => s.champs.filter(c => c.side === side).reduce((n, c) => n + c.st.gold, 0);
  $('#k0', app).textContent = s.kills[0]; $('#k1', app).textContent = s.kills[1];
  $('#g0', app).textContent = `${kfmt(gold(0))} gold`; $('#g1', app).textContent = `${kfmt(gold(1))} gold`;
  $('#clock', app).textContent = fmt(s.t);
  $('#r0', app).innerHTML = rail(s, 0) + objectives(s, 0); $('#r1', app).innerHTML = rail(s, 1) + objectives(s, 1);
  $('#gold', app).innerHTML = goldGraph([...s.timeline, { t: s.t, g: [gold(0), gold(1)] }]);
  $('#feed', app).innerHTML = s.events.slice(-40).reverse().map(e => feedLine(W, s, e)).join('') || '<span class="dim small">Champions are heading to lane.</span>';
  if (!s.pending[md.userSide] && $('#pending', app)) $('#pending', app).textContent = '';
  on(app, '[data-hl]', 'click', el => { md.hl = md.hl === el.dataset.hl ? null : el.dataset.hl; });
}
function finishGame(app) {
  if (!md || md.phase !== 'live') return;
  const W = state.W, s = W.series[md.sid];
  md.sum = summarize(md.s);
  md.gid = recordGame(W, s, md.sum, md.blue, md.red, { picks: md.draft.picks, bans: md.draft.bans }).id;
  md.phase = 'post'; md.s = null;
  save();
  if (location.hash.startsWith('#/match')) renderPost(app);
}

// ================= Post-game (05b) =================
function potgReason(p, sum) { return `${p.k}/${p.d}/${p.a} · ${Math.round(p.share * 100)}% of team damage · ${p.cs} cs${p.obj ? ` · ${p.obj} objectives` : ''}`; }
function compareBars(sum, teams) {
  const agg = side => { const ps = sum.players.filter(p => p.side === side); return { Kills: sum.kills[side], Towers: sum.towers[side], Gold: ps.reduce((n, p) => n + p.gold, 0), Damage: ps.reduce((n, p) => n + p.dmg, 0), Titans: sum.titans[side], Shrines: sum.shrines[side], Vision: ps.reduce((n, p) => n + p.vision, 0) }; };
  const a = agg(0), b = agg(1);
  return Object.keys(a).map(k => { const t = a[k] + b[k] || 1, f = v => (v >= 10000 ? kfmt(v) : v); return `<div class="cmp"><div class="row between"><b class="num blue">${f(a[k])}</b><span class="caps">${k}</span><b class="num red">${f(b[k])}</b></div><div class="cmpbar"><i class="bl" style="flex:${Math.max(0.02, a[k] / t)}"></i><i class="rd" style="flex:${Math.max(0.02, b[k] / t)}"></i></div></div>`; }).join('');
}
const statTable = (W, sum, side) => `<table><thead><tr><th>Player</th><th>Champion</th><th class="n">K/D/A</th><th class="n">CS</th><th class="n">Gold</th><th class="n">DMG</th><th class="n">Vision</th><th class="n">Rating</th></tr></thead><tbody>${sum.players.filter(p => p.side === side).map(p => `<tr class="${p.pid === sum.mvp ? 'me' : ''}"><td><a href="#/player/${p.pid}">${esc(p.name)}</a> <span class="dim small">${ROLE_SHORT[p.role]}</span></td><td><span class="tm">${champSprite(p.champ, 20)} ${esc(CHAMPS[p.champ].name)}</span></td><td class="n">${p.k}/${p.d}/${p.a}</td><td class="n">${p.cs}</td><td class="n">${kfmt(p.gold)}</td><td class="n">${kfmt(p.dmg)}</td><td class="n">${p.vision}</td><td class="n"><b>${p.rating}</b></td></tr>`).join('')}</tbody></table>`;

function renderPost(app) {
  const W = state.W, s = W.series[md.sid], sum = md.sum, teams = [team(W, md.blue), team(W, md.red)];
  const win = teams[sum.winner], mvp = sum.players.find(p => p.pid === sum.mvp);
  const done = !!s.winner;
  app.innerHTML = `<div class="post pad">
    <header class="post-head"><span class="caps">${seriesHeader(W, s).replace(/Game \d+/, `Game ${s.games.length}`)}</span><h1 class="disp xxl">${esc(win.name)} win</h1><span class="dim">${fmt(sum.duration)} · ${sum.endReason === 'core' ? 'Core destroyed' : 'on time'} · series ${s.wins[md.blue]} – ${s.wins[md.red]}</span></header>
    <div class="g3 post-top">
      <section class="card potg"><div class="ch"><h3>Player of the game</h3></div><div class="pad-s row">${champSprite(mvp.champ, 72)}<div><h2 class="disp xl">${esc(mvp.name)}</h2><span class="dim">${esc(CHAMPS[mvp.champ].name)} · rating <b>${mvp.rating}</b></span><p class="small">${potgReason(mvp, sum)}</p></div></div></section>
      <section class="card"><div class="ch"><h3>Team comparison</h3><span class="meta"><span class="blue">${esc(teams[0].tag)}</span> v <span class="red">${esc(teams[1].tag)}</span></span></div><div class="pad-s">${compareBars(sum, teams)}</div></section>
      <section class="card"><div class="ch"><h3>Gold lead</h3></div><div class="pad-s">${goldGraph(sum.timeline)}</div></section></div>
    <div class="g2 mt">${[0, 1].map(side => `<section class="card"><div class="ch"><h3 class="${side ? 'red' : 'blue'}">${esc(teams[side].name)}</h3><span class="meta">${sum.kills[side]} kills · ${sum.towers[side]} towers</span></div><div class="scroll">${statTable(W, sum, side)}</div></section>`).join('')}</div>
    <div class="post-foot"><a class="btn btn-secondary" href="#/report/${md.gid}">Match report</a>${done ? `<b>${esc(team(W, s.winner).name)} take the series ${s.wins[s.winner]}–${s.wins[s.winner === s.a ? s.b : s.a]}.</b><button class="btn btn-primary btn-lg" id="done">Finish ▸</button>` : '<button class="btn btn-primary btn-lg" id="next">Next game ▸</button>'}</div></div>`;
  $('#done', app)?.addEventListener('click', () => { md = null; go('#/home'); });
  $('#next', app)?.addEventListener('click', () => { newGame(W, s); renderDraft(app); });
}

// ================= Match report (15) =================
export function report(app, gid, startT = null) {
  const W = state.W, r = W.reports[gid], g = W.games.find(x => x.id === +gid);
  const top = `<header class="top"><a class="wm" href="#/home">LANE<i>/</i>BREAK</a><span class="crumb"><a href="#/stats/games">Stats › Games</a> › <b>Match report</b></span><span class="sp"></span><button class="btn btn-ghost" onclick="history.back()">◂ Back</button></header>`;
  if (!r) { app.innerHTML = `${top}<main class="view pad">${empty('Detailed report not kept', g ? `${esc(team(W, g.winner)?.name)} won ${g.kills[0]}–${g.kills[1]} in ${fmt(g.dur)}. Full reports are kept for your games and finals (the latest 40).` : 'This game is no longer in the records.', '<a class="btn btn-secondary" href="#/stats/games">All games</a>')}</main>`; return; }
  const s = W.series[g?.sid], teams = [team(W, r.blue), team(W, r.red)];
  const others = s ? s.games.filter(id => W.reports[id]) : [+gid];
  const frames = r.frames ?? [];
  let t = frames.length ? (startT != null ? Math.min(startT, frames.at(-1).t) : Math.min(frames.at(-1).t, 300)) : 0;
  const hl = highlights(r, +gid, [team(W, r.blue)?.tag ?? 'Blue', team(W, r.red)?.tag ?? 'Red']).slice(0, 6);
  const names = r.players.map(p => p.name);
  app.innerHTML = `${top}<main class="view pad report">
    <div class="row between"><div><span class="caps">${esc(W.comps[r.comp]?.name ?? '')} ${s ? `· ${esc(s.label)}` : ''}</span><h1 class="disp xxl"><span class="blue">${esc(teams[0].name)}</span> ${r.kills[0]} – ${r.kills[1]} <span class="red">${esc(teams[1].name)}</span></h1><span class="dim">${esc(teams[r.winner].name)} win · ${fmt(r.duration)} · ${r.endReason === 'core' ? 'Core destroyed' : 'time'}${r.fast ? ' · statistical sim (no map data)' : ''}</span>${gameSummary(W, +gid) ? `<p class="small aw-recap">${esc(gameSummary(W, +gid))}</p>` : ''}</div>
      <nav class="seg">${others.map((id, i) => `<a href="#/report/${id}"><span class="${id === +gid ? 'on' : ''}">Game ${s ? s.games.indexOf(id) + 1 : i + 1}</span></a>`).join('')}</nav></div>
    <div class="g2 mt">
      <section class="card"><div class="ch"><h3>Gold timeline</h3><span class="meta">${frames.length ? '<button class="btn btn-ghost" id="play">▶ Play</button> ' : ''}Drag to scrub · minute <b id="tm">${fmt(t)}</b></span></div><div class="pad-s" id="rgold">${goldGraph(r.timeline, 340, 110, t)}</div>${frames.length ? `<input type="range" id="scrub" min="0" max="${frames.at(-1).t}" step="5" value="${t}" aria-label="Minute">` : ''}</section>
      <section class="card"><div class="ch"><h3>Map at minute</h3>${hl.length ? `<span class="meta">${hl.map(h => `<button class="chip" data-seek="${Math.max(0, Math.round(h.t) - 5)}" title="${esc(h.text)}">${fmt(h.t)} ${esc(h.text.split(':')[0])}</button>`).join('')}</span>` : ''}</div>${frames.length ? `<canvas id="rmap" width="560" height="${mapHeight(560)}"></canvas>` : `<div class="pad-s">${empty('No positional data', 'Games played on the statistical engine record results only.')}</div>`}</section></div>
    <div class="g2 mt">${[0, 1].map(side => `<section class="card"><div class="ch"><h3 class="${side ? 'red' : 'blue'}">${esc(teams[side].name)}</h3><span class="meta">Bans: ${(r.bans?.[side] ?? []).map(id => CHAMPS[id]?.name).join(', ') || '–'}</span></div><div class="scroll">${statTable(W, r, side)}</div></section>`).join('')}</div>
    <div class="g2 mt">${card('Phase plans used', '', (r.plans ?? []).length ? `<table><tbody>${r.plans.map(p => `<tr><td class="num dim">${fmt(p.t)}</td><td class="${p.side ? 'red' : 'blue'}">${esc(teams[p.side].tag)}</td><td>${p.phases.map((x, i) => `<span class="small"><b>${['Early', 'Mid', 'Late'][i]}</b> ${x}</span>`).join(' · ')}</td><td class="small dim">${p.objective} · ${p.focus}</td></tr>`).join('')}</tbody></table>` : '<div class="pad-s dim">Not recorded</div>')}
      ${card('Key events', '', `<div class="feed pad-s">${(r.events ?? []).filter(e => e.type !== 'death').map(e => feedLine(W, { champs: r.players.map(p => ({ pid: p.pid, name: p.name })), teams: teams.map(x => ({ name: x.name })) }, e)).join('') || '<span class="dim">No events recorded</span>'}</div>`)}</div></main>`;
  const draw = () => {
    const cv = $('#rmap', app); if (!cv) return;
    const f = frames.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
    drawFrame(cv.getContext('2d'), f, { names, colors: SIDE }, r.events ?? []);
  };
  draw();
  const seek = v => { t = v; if ($('#scrub', app)) $('#scrub', app).value = t; $('#tm', app).textContent = fmt(t); $('#rgold', app).innerHTML = goldGraph(r.timeline, 340, 110, t); draw(); };
  $('#scrub', app)?.addEventListener('input', e => { stop(); seek(+e.target.value); });
  on(app, '[data-seek]', 'click', b => seek(+b.dataset.seek));
  // Replay: 1 s of game time per 50 ms (20× speed).
  let timer = null;
  const stop = () => { clearInterval(timer); timer = null; const b = $('#play', app); if (b) b.textContent = '▶ Play'; };
  $('#play', app)?.addEventListener('click', e => {
    if (timer) return stop();
    if (t >= frames.at(-1).t) t = 0;
    e.target.textContent = '❚❚ Pause';
    timer = setInterval(() => { if (!$('#rmap', app)) return clearInterval(timer); if (t >= frames.at(-1).t) return stop(); seek(Math.min(frames.at(-1).t, t + 1)); }, 50);
  });
  if (startT != null) draw();
}
// Replays (Stats › Replays): every kept match report, newest first, with its best moments.
export function replays(el) {
  const W = state.W;
  const ids = Object.keys(W.reports).map(Number).sort((a, b) => b - a);
  el.innerHTML = `<div class="pad">${ids.length ? `<section class="card"><div class="ch"><h3>Replays</h3><span class="meta">${ids.length} kept · your games and finals</span></div><table><thead><tr><th>Competition</th><th>Game</th><th>Score</th><th>Highlights</th><th></th></tr></thead><tbody>${ids.map(id => {
    const r = W.reports[id], tb = team(W, r.blue), tr = team(W, r.red), hl = highlights(r, id);
    return `<tr><td>${esc(W.comps[r.comp]?.name ?? '')}</td><td><span class="blue">${esc(tb?.tag ?? '')}</span> v <span class="red">${esc(tr?.tag ?? '')}</span></td><td class="num">${r.kills[0]}–${r.kills[1]}</td><td class="small">${hl.slice(0, 2).map(h => `<a href="#/report/${id}/${Math.max(0, Math.round(h.t) - 5)}">${esc(h.text)}</a>`).join(' · ') || '<span class="dim">–</span>'}</td><td>${r.frames?.length ? `<a class="btn btn-secondary" href="#/report/${id}">▶ Watch</a>` : `<a class="btn btn-ghost" href="#/report/${id}">Report</a>`}</td></tr>`;
  }).join('')}</tbody></table></section>` : empty('No replays yet', 'Reports of your games and finals are kept here (the latest 40).')}</div>`;
}
function card(title, meta, body) { return `<section class="card"><div class="ch"><h3>${title}</h3>${meta ? `<span class="meta">${meta}</span>` : ''}</div>${body}</section>`; }
