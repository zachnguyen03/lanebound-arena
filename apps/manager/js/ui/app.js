// App shell: hash router, top bar with tabs / inbox / settings / date + Continue, sim controls,
// main menu, new career, settings, season rollover and inbox.
import {
  createWorld, newSeason, setUserTeam, userTeam, team, unread, fmtDate, playDay, endDay, simTo, userSeriesToday, nextUserSeries, currentSplit,
  REGIONS, REGION_INFO, TIERS, leagueTeams, strength, D, overall, teamPlayers, tierName, acceptOffer, rejectOffer, acceptSponsor, ordinal, money as addMoney,
  takeJob, confLabel, applyChoice, gameSummary,
} from '../career.js';
import { state, go, run, save, autosave, applySettings } from './state.js';
import { listSaves, readSave, deleteSave, SLOTS, SLOT_LABEL, hasLegacySave, clearLegacySave, importSave } from './store.js';
import { esc, $, on, money, crest, modal, toast, empty, card, seg, select, download } from './dom.js';
import * as S from './screens.js';
import * as C from './comps.js';
import * as M from './matchday.js';
import { devCards } from './cards.js';
import { CHAMPS } from '../data.js';

const app = document.getElementById('app');
const TABS = [
  ['home', 'Home'], ['squad', 'Squad'], ['training', 'Training'], ['tactics', 'Tactics'], ['transfers', 'Transfers'],
  ['competitions', 'Competitions'], ['stats', 'Stats'], ['club', 'Club'],
];
const SUBS = {
  squad: [['players', 'Players'], ['lineup', 'Lineup'], ['contracts', 'Contracts'], ['academy', 'Academy']],
  transfers: [['market', 'Market'], ['shortlist', 'Shortlist'], ['offers', 'Offers']],
  competitions: [['league', 'League'], ['bracket', 'Bracket'], ['international', 'International'], ['schedule', 'Schedule'], ['awards', 'Awards'], ['meta', 'Meta']],
  stats: [['overview', 'Overview'], ['players', 'Players'], ['champions', 'Champions'], ['teams', 'Teams'], ['games', 'Games'], ['replays', 'Replays'], ['economy', 'Economy']],
};
const VIEWS = {
  home: S.home, squad: S.squad, training: S.training, tactics: S.tactics, transfers: S.transfers, club: S.club, player: S.player, team: S.teamView, negotiate: S.negotiate,
  competitions: C.competitions, stats: C.stats, inbox, settings,
};

// ---------- Router ----------
function route() {
  const [name = 'menu', ...args] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const W = state.W;
  if (name === 'dev' && args[0] === 'cards') return devCards(app); // dev-only card gallery, works without a save
  if (name === 'menu' || (!W && !['new', 'settings'].includes(name))) return mainMenu();
  if (name === 'new') return newCareer(args[0]);
  if (W && !W.userTeamId) return name === 'jobs' ? jobs() : go('#/jobs');
  if (!W?.userTeamId) return go('#/menu');
  if (name === 'match') return M.match(app, args[0]);
  if (name === 'report') return M.report(app, args[0], +args[1] || null);
  if (name === 'rollover') return rollover();
  const view = VIEWS[name] ?? S.home;
  const tab = TABS.find(t => t[0] === name) ? name : null;
  const sub = SUBS[name] ? (args[0] && SUBS[name].some(s => s[0] === args[0]) ? args[0] : SUBS[name][0][0]) : null;
  app.innerHTML = `${topBar(tab ?? (name === 'inbox' || name === 'settings' ? name : ''))}${sub ? `<nav class="subtabs" aria-label="Sections">${SUBS[name].map(([k, l]) => `<a href="#/${name}/${k}" class="${k === sub ? 'on' : ''}"><span class="${k === sub ? 'on' : ''}">${l}</span></a>`).join('')}</nav>` : ''}<main id="view" class="view"></main>`;
  wireTop();
  const el = $('#view', app);
  try { (name === 'stats' && sub === 'replays' ? M.replays : view)(el, sub ? args.slice(1) : args, sub); } catch (e) { console.error(e); el.innerHTML = errorState(e); }
}
state.rerender = route;
window.addEventListener('hashchange', route);
const errorState = e => `<div class="pad">${empty('Something went wrong drawing this screen', esc(e.message), '<a class="btn btn-secondary" href="#/home">Back to Home</a>')}</div>`;

// ---------- Top bar ----------
export function dateLabel(W) {
  const d = W.day, y = W.year;
  const phase = d < D(W, 0, 5) ? 'Pre-season' : d < D(W, 3, 31) ? 'Spring Split' : d < D(W, 4, 6) ? 'Spring break' : d < D(W, 5, 1) ? 'Vernal Invitational'
    : d < D(W, 6, 6) ? 'Mid-season' : d < D(W, 8, 30) ? 'Summer Split' : d < D(W, 9, 1) ? 'Promotion' : d < D(W, 10, 1) ? 'Grand Convergence' : 'Off-season';
  return `${fmtDate(y, d)} ${y} · <b>${phase}</b>`;
}
function topBar(tab) {
  const W = state.W, n = unread(W);
  return `<header class="top">
    <a class="wm" href="#/home">LANE<i>/</i>BOUND</a>
    <nav class="tabs" aria-label="Main">${TABS.map(([k, l]) => `<a class="tab ${tab === k ? 'on' : ''}" href="#/${k}">${l}</a>`).join('')}</nav>
    <span class="sp"></span>
    <a class="icon-btn ${tab === 'inbox' ? 'on' : ''}" href="#/inbox" aria-label="Inbox, ${n} unread"><svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x=".75" y=".75" width="16.5" height="12.5"/><path d="m1 1 8 6 8-6"/></svg>${n ? `<span class="badge">${n > 99 ? '99+' : n}</span>` : ''}</a>
    <a class="icon-btn ${tab === 'settings' ? 'on' : ''}" href="#/settings" aria-label="Settings"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="9" r="2.5"/><path d="M9 1v2.5M9 14.5V17M1 9h2.5M14.5 9H17M3.3 3.3l1.8 1.8M12.9 12.9l1.8 1.8M3.3 14.7l1.8-1.8M12.9 5.1l1.8-1.8"/></svg></a>
    <span class="date" id="date">${dateLabel(W)}</span>
    ${state.busy ? '<button class="btn btn-secondary" id="stop">Stop</button>' : `<span class="cont"><button class="btn btn-primary" id="continue">${userSeriesToday(W) ? 'Play match ▸' : W.rollover && !W.rollover.seen ? 'Season review ▸' : 'Continue ▸'}</button><button class="btn btn-ghost" id="simmenu" aria-label="More sim options" aria-haspopup="menu">▾</button></span>`}
  </header>`;
}
function wireTop() {
  $('#continue', app)?.addEventListener('click', () => advance('day'));
  $('#stop', app)?.addEventListener('click', () => { state.stop = true; });
  $('#simmenu', app)?.addEventListener('click', simMenu);
}
function simMenu() {
  const W = state.W, next = nextUserSeries(W);
  modal(`<div class="ch"><h3>Sim controls</h3><span class="meta">Pauses on your fixtures${state.settings.pauseOffers ? ' and new offers' : ''}</span></div>
    <div class="mbody stack">
      <button class="btn btn-secondary" data-mode="match">Next match${next ? ` · ${fmtDate(W.year, next.day)}` : ''}</button>
      <label class="row">Until <input type="date" id="until" value="${new Date(Date.UTC(W.year, 0, W.day + 8)).toISOString().slice(0, 10)}"> <button class="btn btn-secondary" data-mode="date">Go</button></label>
      <button class="btn btn-secondary" data-mode="season">Rest of season (auto-play my matches)</button>
    </div><div class="mfoot"><button class="btn btn-ghost" data-close>Cancel</button></div>`, (m, close) => {
    on(m, '[data-mode]', 'click', b => {
      const mode = b.dataset.mode;
      let until = mode;
      if (mode === 'date') { const v = new Date(m.querySelector('#until').value); if (isNaN(v)) return toast('Pick a date.', true); until = { year: v.getUTCFullYear(), day: Math.round((v - Date.UTC(v.getUTCFullYear(), 0, 1)) / 864e5) }; }
      close(); advance(until);
    });
  });
}

// Continue / sim. mode: 'day' | 'match' | 'season' | { year, day }
async function advance(mode) {
  const W = state.W;
  if (state.busy) return;
  if (W.rollover && !W.rollover.seen) return go('#/rollover');
  const mine = userSeriesToday(W);
  if (mine && mode !== 'season') return go(`#/match/${mine.id}`);
  if (state.settings.confirmContinue && mode === 'day' && !confirm('Advance to the next day?')) return;
  const offers0 = W.offers.filter(o => o.status === 'open').length;
  const scout0 = W.inbox.filter(m => m.cat === 'scouting').length;
  const stopOnNews = () => (state.settings.pauseOffers && W.offers.filter(o => o.status === 'open').length > offers0) || (state.settings.pauseScouting && W.inbox.filter(m => m.cat === 'scouting').length > scout0);
  state.busy = true; state.stop = false;
  route();
  let res = 'day';
  try {
    if (mode === 'day') { await playDay(W, run); endDay(W); }
    else {
      res = await simTo(W, run, {
        until: mode, autoUser: mode === 'season', shouldStop: () => state.stop || stopOnNews(),
        onDay: () => { const d = $('#date', app); if (d) d.innerHTML = dateLabel(W); return new Promise(r => setTimeout(r)); },
      });
    }
  } catch (e) { console.error(e); toast(`Simulation error: ${e.message}`, true); }
  state.busy = false;
  if (state.settings.autosave === 'daily' || new Date(Date.UTC(W.year, 0, 1 + W.day)).getUTCDay() === 1 || res !== 'day') autosave();
  if (res === 'sacked') return go('#/jobs');
  if (W.rollover && !W.rollover.seen) return go('#/rollover');
  if (res === 'stopped' && stopOnNews()) toast('Paused: something needs your attention in the inbox.');
  route();
}

// ---------- Main menu ----------
async function mainMenu() {
  const saves = await listSaves();
  const latest = Object.entries(saves).sort((a, b) => b[1].savedAt - a[1].savedAt)[0];
  app.innerHTML = `<main class="menu">
    <div class="menu-l">
      <div class="wm big">LANE<i>/</i>BOUND</div>
      <p class="dim">Esports manager · 5v5 arena · ${REGIONS.length} regions</p>
      <div class="stack menu-actions">
        ${latest ? `<button class="btn btn-primary btn-lg" data-load="${latest[0]}">Continue career ▸</button><span class="dim small">${esc(latest[1].club)} · ${fmtDate(latest[1].year, latest[1].day)} ${latest[1].year} · ${SLOT_LABEL[latest[0]]}</span>` : ''}
        <a class="btn ${latest ? 'btn-secondary' : 'btn-primary btn-lg'}" href="#/new">New career</a>
        <a class="btn btn-ghost" href="#/settings">Settings</a>
        <label class="btn btn-ghost">Import save (.json)<input type="file" id="import" accept=".json,application/json" hidden></label>
      </div>
      ${hasLegacySave() ? `<div class="notice">A save from an older version (v0.3, pre-arena) was found. It can't be converted to the new world. <button class="btn btn-ghost" id="clearLegacy">Remove it</button></div>` : ''}
    </div>
    <div class="menu-r card">
      <div class="ch"><h3>Saves</h3><span class="meta">3 slots + autosave · each keeps a backup</span></div>
      ${SLOTS.map(slot => { const m = saves[slot]; return `<div class="slot-row">${m ? `<span class="sw" style="background:${m.color ?? '#333'}"></span><div><b>${esc(m.club)}</b><div class="dim small">${fmtDate(m.year, m.day)} ${m.year} · saved ${new Date(m.savedAt).toLocaleString()}</div></div><span class="sp"></span><button class="btn btn-secondary" data-load="${slot}">Load</button><button class="btn btn-ghost" data-del="${slot}" aria-label="Delete ${SLOT_LABEL[slot]}">Delete</button>` : `<span class="sw"></span><div class="dim">${SLOT_LABEL[slot]} · empty</div>`}</div>`; }).join('')}
    </div></main>`;
  on(app, '[data-load]', 'click', async b => {
    const r = await readSave(b.dataset.load);
    if (r.error) return modal(`<div class="ch"><h3>Can't load this save</h3></div><div class="mbody">${esc(r.error)}</div><div class="mfoot"><button class="btn btn-ghost" data-close>Close</button><a class="btn btn-primary" href="#/new" data-close>New career</a></div>`);
    state.W = r.W; state.slot = b.dataset.load === 'auto' ? 'slot1' : b.dataset.load;
    if (r.fromBackup) toast('The main save was unreadable; loaded its backup.');
    go('#/home');
  });
  on(app, '[data-del]', 'click', b => modal(`<div class="ch"><h3>Delete ${SLOT_LABEL[b.dataset.del]}?</h3></div><div class="mbody">This removes the save and its backup. It can't be undone.</div><div class="mfoot"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-secondary danger" id="yes">Delete</button></div>`, (m, close) => { m.querySelector('#yes').onclick = async () => { await deleteSave(b.dataset.del); close(); mainMenu(); }; }));
  $('#clearLegacy', app)?.addEventListener('click', () => { clearLegacySave(); mainMenu(); });
  $('#import', app).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    const r = importSave(await f.text());
    if (r.error) return toast(r.error, true);
    state.W = r.W; state.slot = 'slot1'; toast('Save imported. Save it to a slot to keep it.'); go('#/home');
  };
}

// ---------- New career (16, 16b) ----------
let pending = null; // world generated for the new-career flow
function newCareer(region) {
  if (!pending) { pending = createWorld(); newSeason(pending); }
  const W = pending;
  if (!region) {
    app.innerHTML = `<main class="focus"><div class="focus-head"><span class="caps">New career · step 1 of 2</span><h1 class="disp">Choose a region</h1><p class="dim">Each region has a top league, the Crown Challengers (Tier 2) and the Open Circuit. Finish high to qualify for the Vernal Invitational (May) and the Grand Convergence (October).</p></div>
      <div class="region-grid">${REGIONS.map(r => { const info = REGION_INFO[r], top = leagueTeams(W, r, 0); return `<a class="card region" href="#/new/${encodeURIComponent(r)}"><div class="ch"><h3>${esc(info.league)}</h3><span class="pill">${top.length} clubs</span></div><div class="pad-s"><p class="dim">${esc(info.blurb)}</p><div class="kv"><span>Sponsor market</span><b>${'●'.repeat(Math.round(info.sponsor * 3))}</b></div><div class="kv"><span>Talent</span><b>${'●'.repeat(Math.round(info.talent * 3))}</b></div><div class="kv"><span>Grand Convergence spots</span><b>${{ 'Eastern Crown': 4, 'Jade Delta': 4, Westmark: 3, Frontier: 2, Sunward: 2 }[r]}</b></div></div></a>`; }).join('')}</div>
      <div class="focus-foot"><a class="btn btn-ghost" href="#/menu">◂ Back</a></div></main>`;
    return;
  }
  region = decodeURIComponent(region);
  const tiers = [0, 1, 2].map(t => leagueTeams(W, region, t).sort((a, b) => strength(W, b) - strength(W, a)));
  let sel = tiers[0].at(-1).id, tierSel = 0;
  const draw = () => {
    const t = team(W, sel);
    app.innerHTML = `<main class="focus"><div class="focus-head"><span class="caps">New career · step 2 of 2 · ${esc(REGION_INFO[region].league)}</span><h1 class="disp">Choose your club</h1></div>
      <div class="split2">
        <section class="card"><div class="ch"><h3>Clubs</h3>${seg('tier', [[0, 'Top league'], [1, TIERS[1]], [2, TIERS[2]]], tierSel)}</div>
          <table><thead><tr><th>Club</th><th class="n">Strength</th><th class="n">Rep</th><th class="n">Budget</th><th>Expectation</th></tr></thead><tbody>
          ${tiers[tierSel].map(c => `<tr class="link ${c.id === sel ? 'me' : ''}" data-club="${c.id}"><td><span class="tm">${crest(c, 20)} ${esc(c.name)}</span></td><td class="n">${strength(W, c)}</td><td class="n">${c.rep}</td><td class="n">${money(c.cash)}</td><td class="dim">${esc(c.target)}</td></tr>`).join('')}</tbody></table></section>
        <section class="card"><div class="ch"><h3>${esc(t.name)}</h3><span class="meta">${esc(tierName(region, t.tier))}</span></div>
          <div class="pad-s">${crest(t, 64)}
            <div class="kv"><span>Board expects</span><b>${esc(t.target)}</b></div><div class="kv"><span>Cash</span><b>${money(t.cash)}</b></div>
            <div class="kv"><span>Wage cap</span><b>${money([1e6, 5e5, 2.5e5][t.tier])}</b></div>
            <h4 class="caps mt">Starting five</h4>
            ${t.starters.map(id => W.players[id]).map(p => `<div class="kv"><span>${p.role} · ${esc(p.name)}</span><b>${overall(p)}</b></div>`).join('')}
          </div>
          <div class="mfoot"><button class="btn btn-primary btn-lg" id="start">Start career ▸</button></div></section>
      </div><div class="focus-foot"><a class="btn btn-ghost" href="#/new">◂ Regions</a></div></main>`;
    on(app, '[data-club]', 'click', r => { sel = r.dataset.club; draw(); });
    on(app, '[data-tier]', 'click', b => { tierSel = +b.dataset.tier; sel = tiers[tierSel].at(-1).id; draw(); });
    $('#start', app).onclick = async () => {
      setUserTeam(W, sel);
      state.W = W; pending = null;
      const saves = await listSaves();
      state.slot = SLOTS.slice(0, 3).find(s => !saves[s]) ?? 'slot1';
      await save();
      go('#/home');
    };
  };
  draw();
}

// ---------- Settings (13) ----------
function settings(el) {
  const s = state.settings;
  el.innerHTML = `<div class="pad g2">
    ${card('Match', '', `<div class="pad-s form">
      <label>Default live speed ${seg('speed', [[1, '1×'], [2, '2×'], [4, '4×']], s.speed)}</label>
      <label>Background sim detail ${seg('simDetail', [['fast', 'Fast (statistical)'], ['top', 'Full engine for top leagues']], s.simDetail)}<small class="dim">Full engine is much slower: about 0.25 s per game in a worker, minutes for a season.</small></label>
    </div>`)}
    ${card('Sim and saving', '', `<div class="pad-s form">
      <label>Pause when a new offer arrives ${seg('pauseOffers', [[true, 'On'], [false, 'Off']], s.pauseOffers)}</label>
      <label>Pause when a scouting report arrives ${seg('pauseScouting', [[true, 'On'], [false, 'Off']], s.pauseScouting)}</label>
      <label>Confirm before Continue ${seg('confirmContinue', [[true, 'On'], [false, 'Off']], s.confirmContinue)}</label>
      <label>Autosave ${seg('autosave', [['weekly', 'Weekly'], ['daily', 'Daily']], s.autosave)}</label>
      ${state.W ? `<div class="row">Save to ${SLOTS.slice(0, 3).map(sl => `<button class="btn btn-secondary" data-save="${sl}">${SLOT_LABEL[sl]}${sl === state.slot ? ' (current)' : ''}</button>`).join('')}</div>
      <div class="row"><button class="btn btn-ghost" id="export">Download save (.json)</button><a class="btn btn-ghost" href="#/menu" id="quit">Main menu</a></div>` : '<a class="btn btn-ghost" href="#/menu">◂ Main menu</a>'}
    </div>`)}</div>`;
  for (const k of ['speed', 'simDetail', 'pauseOffers', 'pauseScouting', 'confirmContinue', 'autosave']) {
    on(el, `[data-${k}]`, 'click', b => { const v = b.dataset[k]; s[k] = v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v; applySettings(); settings(el); });
  }
  on(el, '[data-save]', 'click', async b => { state.slot = b.dataset.save; await save(state.slot, { quiet: false }); settings(el); });
  $('#quit', el)?.addEventListener('click', () => save());
  $('#export', el)?.addEventListener('click', () => download(`lanebreak-${state.W.year}-${state.W.day}.json`, JSON.stringify(state.W), 'application/json'));
}

// ---------- Inbox (17) ----------
let inboxCat = 'all', inboxSel = null, showArchived = false;
function inbox(el) {
  const W = state.W;
  const cats = [['all', 'All'], ['offer', 'Offers'], ['scouting', 'Scouting'], ['news', 'News'], ['squad', 'Squad'], ['highlights', 'Highlights'], ['board', 'Board']];
  const list = W.inbox.filter(m => (inboxCat === 'all' || m.cat === inboxCat) && !!m.archived === showArchived);
  const m = W.inbox.find(x => x.id === inboxSel) ?? list[0];
  if (m && !m.read) { m.read = true; }
  const offer = m?.data?.offer && W.offers.find(o => o.id === m.data.offer);
  el.innerHTML = `<div class="inbox">
    <section class="card"><div class="ch"><h3>Inbox</h3><span class="meta">${unread(W)} unread</span></div>
      <div class="chips">${cats.map(([k, l]) => `<button class="chip ${inboxCat === k ? 'on' : ''}" data-cat="${k}">${l} <span class="dim">${W.inbox.filter(x => (k === 'all' || x.cat === k) && !x.read && !x.archived).length || ''}</span></button>`).join('')}<button class="chip ${showArchived ? 'on' : ''}" id="arch">Archive</button></div>
      <div class="list">${list.length ? list.map(x => `<button class="msg ${x === m ? 'on' : ''} ${x.read ? '' : 'unread'}" data-msg="${x.id}"><span class="pill">${x.cat}</span><b>${esc(x.title)}</b><span class="dim small">${fmtDate(x.year, x.day)}</span></button>`).join('') : empty(showArchived ? 'No archived messages' : 'Inbox zero', showArchived ? 'Archived messages show up here.' : 'Offers, scouting reports and news land here as the season moves.')}</div></section>
    <section class="card reader">${m ? `<div class="ch"><h3>${esc(m.title)}</h3><span class="meta">${fmtDate(m.year, m.day)} ${m.year}</span></div>
      <div class="pad-s">${m.data?.plays ? topFive(m.data.plays) : `<p>${esc(m.body)}</p>`}${offerBox(W, offer)}${m.data?.pid ? `<p><a class="btn btn-secondary" href="#/player/${m.data.pid}">View player</a></p>` : ''}${m.data?.series ? seriesRecap(W, m.data.series) : ''}${m.data?.news ? `<div class="row wrap">${m.data.clubs.map(id => S.tLink(team(W, id))).join('')}${m.data.players.map(id => W.players[id] ? S.pLink(W.players[id]) : '').join('')}</div>` : ''}${m.data?.choices ? `<div class="row wrap">${m.data.choices.map((c, i) => `<button class="btn ${m.data.chosen === i ? 'btn-primary' : 'btn-secondary'}" data-choice="${i}" ${m.data.chosen != null ? 'disabled' : ''}>${esc(c.label)}</button>`).join('')}</div>` : ''}</div>
      <div class="mfoot"><button class="btn btn-ghost" id="toggleArch">${m.archived ? 'Unarchive' : 'Archive'}</button></div>` : '<div class="pad">' + empty('Nothing selected') + '</div>'}</section></div>`;
  on(el, '[data-cat]', 'click', b => { inboxCat = b.dataset.cat; inboxSel = null; route(); });
  on(el, '[data-msg]', 'click', b => { inboxSel = +b.dataset.msg; route(); });
  $('#arch', el).onclick = () => { showArchived = !showArchived; inboxSel = null; route(); };
  $('#toggleArch', el)?.addEventListener('click', () => { m.archived = !m.archived; inboxSel = null; route(); });
  on(el, '[data-accept]', 'click', b => { const err = offer.kind === 'sponsor' ? acceptSponsor(W, offer.id) : acceptOffer(W, offer.id); toast(err ?? 'Offer accepted.', !!err); route(); });
  on(el, '[data-choice]', 'click', b => { const r = applyChoice(W, m, +b.dataset.choice); if (r) toast(r); route(); });
  on(el, '[data-reject]', 'click', () => { rejectOffer(W, offer.id); toast('Offer rejected.'); route(); });
}
function offerBox(W, o) {
  if (!o) return '';
  const days = o.expires - W.day;
  if (o.status !== 'open') return `<div class="notice">${o.status === 'expired' ? `This offer expired. ${o.kind === 'sponsor' ? '' : 'Transfer-list the player to draw new bids.'}` : `Offer ${o.status}.`}</div>`;
  if (o.kind === 'sponsor') return `<div class="offer"><div class="kv"><span>Weekly</span><b>${money(o.weekly)}</b></div><div class="kv"><span>Top-4 bonus</span><b>${money(o.bonus)}</b></div><div class="kv"><span>Expires</span><b class="warn">${days} days</b></div><div class="row"><button class="btn btn-secondary" data-reject>Decline</button><button class="btn btn-primary" data-accept>Accept</button></div></div>`;
  const p = W.players[o.pid];
  return `<div class="offer"><div class="kv"><span>Player</span><b><a href="#/player/${p.id}">${esc(p.name)}</a> · ${p.role} · ${overall(p)}</b></div><div class="kv"><span>Fee</span><b>${money(o.fee)}</b></div><div class="kv"><span>From</span><b>${esc(team(W, o.from).name)}</b></div><div class="kv"><span>Expires</span><b class="warn">${days} days</b></div><div class="row"><button class="btn btn-secondary" data-reject>Reject</button><button class="btn btn-primary" data-accept>Accept ${money(o.fee)}</button></div></div>`;
}
// Result mails: one recap and a small score-lead graph per game (blue side up).
const seriesRecap = (W, sid) => {
  const s = W.series[sid]; if (!s) return '';
  return `<div class="recaps">${s.games.map((g, i) => { const r = W.reports[g], sum = gameSummary(W, g); return `<div class="recap"><div class="row between"><span class="caps">Game ${i + 1}${r ? ` · <span class="blue">${esc(team(W, r.blue)?.tag ?? '')}</span> v <span class="red">${esc(team(W, r.red)?.tag ?? '')}</span>` : ''}</span><a class="btn btn-ghost" href="#/report/${g}">Report ▸</a></div>${sum ? `<p class="small">${esc(sum)}</p>` : ''}${r?.timeline?.length > 1 ? `<div class="recap-graph">${M.scoreGraph(r.timeline, 340, 46)}</div>` : ''}</div>`; }).join('')}</div>`;
};
// Weekly highlights (17b): rank, champion, one-line title, who · champion · match · minute, Watch.
const topFive = plays => `<p class="dim small">Picked by the highlight engine: multi-kills, solo outplays, game-turning ultimates, aces and comebacks. Each opens the replay just before the moment.</p>
  <div class="top5">${plays.map((p, i) => `<div class="t5-row"><b class="disp xl">${i + 1}</b><span class="t5-thumb">${p.champ ? S.champSprite(p.champ, 44) : ''}</span><div><b>${esc(p.title ?? p.text)}</b><span class="dim small">${[p.who, p.champ && CHAMPS[p.champ]?.name, p.match, fmtClock(p.t)].filter(Boolean).map(esc).join(' · ')}</span></div><a class="btn btn-secondary" href="#/report/${p.gid}/${Math.max(0, Math.round(p.t) - 5)}">Watch ▸</a></div>`).join('')}</div>`;
const fmtClock = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

// ---------- Jobs (after a sacking) ----------
function jobs() {
  const W = state.W, m = W.manager, key = W.year * 400 + W.day;
  if (W.rollover && !W.rollover.seen) W.rollover.seen = true; // no club to review
  const offers = m.offers.filter(o => o.until > key).map(o => ({ ...o, t: team(W, o.teamId) }));
  const last = m.history.at(-1);
  app.innerHTML = `<main class="focus"><div class="focus-head"><span class="caps">Out of work · ${fmtDate(W.year, W.day)} ${W.year}</span><h1 class="disp">Find your next club</h1>
    <p class="dim">Manager reputation <b>${m.rep}</b>${last ? ` · last job ${esc(last.club)} (${last.w}-${last.l}, ${last.how})` : ''}. Clubs offer jobs that fit your reputation; wait for better ones or take what is on the table.</p></div>
    <div class="g3">${offers.map(o => `<div class="card"><div class="pad-s stack"><span class="tm">${crest(o.t, 36)} <b class="disp lg">${esc(o.t.name)}</b></span>
      <div class="kv"><span>League</span><b>${esc(tierName(o.t.region, o.t.tier))}</b></div><div class="kv"><span>Reputation</span><b>${o.t.rep}</b></div><div class="kv"><span>Squad strength</span><b>${strength(W, o.t)}</b></div><div class="kv"><span>Cash</span><b>${money(o.t.cash)}</b></div>
      <div class="kv"><span>Offer open until</span><b>${fmtDate(W.year, o.until - W.year * 400)}</b></div><button class="btn btn-primary" data-take="${o.teamId}">Take the job</button></div></div>`).join('') || empty('No offers right now', 'Wait a week for clubs to call.')}</div>
    <div class="focus-foot"><button class="btn btn-ghost" id="retire">Retire (end career)</button><button class="btn btn-secondary" id="wait">Wait a week ▸</button></div></main>`;
  on(app, '[data-take]', 'click', b => { takeJob(W, b.dataset.take, setUserTeam); autosave(); toast(`Welcome to ${userTeam(W).name}.`); go('#/home'); });
  $('#retire', app).onclick = () => { if (confirm('End this career? The save stays in its slot.')) { state.W = null; go('#/menu'); } };
  $('#wait', app).onclick = async () => {
    const b = $('#wait', app); b.disabled = true; b.textContent = 'Waiting…';
    await simTo(W, run, { until: { year: W.year, day: W.day + 7 }, autoUser: true });
    autosave(); route();
  };
}

// ---------- Season rollover (16c) ----------
function rollover() {
  const W = state.W, r = W.rollover, u = userTeam(W);
  if (!r) return go('#/home');
  app.innerHTML = `<main class="focus"><div class="focus-head"><span class="caps">Season review</span><h1 class="disp">${r.year} in review</h1>
    ${r.review ? `<p class="${r.review.met ? 'good' : 'warn'}">Board target: ${esc(r.review.target)} · ${r.review.met ? 'met' : 'missed'} · best finish ${r.review.best < 99 ? ordinal(r.review.best) : '—'}${u ? ` · reputation ${u.rep}` : ''}${r.review.conf != null ? ` · board confidence ${Math.round(r.review.conf)} (${confLabel(r.review.conf)})` : ''}</p>${(r.review.goals ?? []).map(g => `<p class="${g.startsWith('Met') ? 'good' : 'bad'}">${esc(g)}</p>`).join('')}${r.review.sacked ? '<p class="bad"><b>The board has dismissed you.</b> Continue to look for a new club.</p>' : ''}` : ''}</div>
    <div class="g3">
      ${card('Champions', '', `<table><tbody>${r.champions.map(c => `<tr class="${c.teamId === u.id ? 'me' : ''}"><td>${esc(c.comp)}</td><td><span class="tm">${crest(team(W, c.teamId), 18)} ${esc(c.team)}</span></td></tr>`).join('')}</tbody></table>`)}
      ${card('Promotion and relegation', '', `<table><tbody>${r.moves.map(m => `<tr class="${m.id === u.id ? 'me' : ''}"><td>${esc(m.name)}</td><td class="dim">${esc(m.region)}</td><td>→ ${esc(TIERS[m.to])}</td></tr>`).join('') || '<tr><td class="dim">None</td></tr>'}</tbody></table>`)}
      ${card('Your club', '', `<div class="pad-s"><div class="kv"><span>Rookies of the Year</span><b>${Object.entries(r.roy).map(([reg, pid]) => `${esc(W.players[pid]?.name ?? '?')} <span class="dim">(${esc(reg)})</span>`).join(', ') || '—'}</b></div>
        <div class="kv"><span>Contracts expired</span><b>${r.left.map(esc).join(', ') || 'none'}</b></div><div class="kv"><span>Retired</span><b>${r.retired.map(esc).join(', ') || 'none'}</b></div>
        <div class="kv"><span>Newgens in the pool</span><b>${r.newgens}</b></div><div class="kv"><span>Next season</span><b>${esc(tierName(u.region, u.tier))}</b></div><div class="kv"><span>Board target</span><b>${esc(u.target)}</b></div></div>`)}
    </div><div class="focus-foot"><a class="btn btn-secondary" href="#/transfers/market">Transfer market</a><button class="btn btn-primary btn-lg" id="ok">Continue to ${r.year + 1} ▸</button></div></main>`;
  $('#ok', app).onclick = () => { r.seen = true; autosave(); go('#/home'); };
}

// Boot
if (!location.hash) location.hash = '#/menu';
route();
export { route, addMoney };
