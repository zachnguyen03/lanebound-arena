// Match day: draft (04), live view (05), post-game (05b) and the match report (15).
// Live and report play the game in the Watch match view (watch.jsx), re-simulated from the summary's MatchConfig.
import { ROLES, CHAMPS, CHAMP_IDS, fmt } from '../data.js';
import { DRAFT_ORDER, newDraft, turn, draftDone, applyDraft, aiChoice, effProf } from '../draft.js';
import { runPayload } from '../fastsim.js';
import { team, userTeam, starterPlayers, engineTeam, nextGameSides, recordGame, stakesOf, draftPrefs, MASTERY, TALKS, teamTalk, isRivalry, scoutReport, highlights, gameSummary, cardPool, usedCards, aiLoadout, loadCards } from '../career.js';
import { CARDS, LOADOUT, bestLoadout, loadoutError, costOf, cardView, triggerStatus } from '../cards.js';
import { cardHTML } from './cards.js';
import { state, go, save } from './state.js';
import { esc, $, on, crest, kfmt, empty, toast, card, ROLE_SHORT } from './dom.js';
import { champSprite } from './screens.js';
import { mountMatch } from './watch.jsx';

let md = null; // the game in progress (survives re-renders, not reloads)
const CLOCK = 30;

function newGame(W, s) {
  const [blue, red] = nextGameSides(s);
  md = { sid: s.id, blue, red, userSide: blue === W.userTeamId ? 0 : 1, phase: W.classic ? 'draft' : 'cards', draft: newDraft(), sel: null, role: '', q: '', hide: false, swap: null, clock: CLOCK, players: [blue, red].map(id => starterPlayers(W, team(W, id))) };
  if (W.classic) { md.load = [[], []]; return; }
  // Both coaches pick before the draft: the analyst pre-selects the user's best loadout; the opponent's stays hidden.
  const us = team(W, W.userTeamId), opp = team(W, blue === us.id ? red : blue);
  md.pool = cardPool(W, us); md.used = usedCards(s, us); md.rest = us.restCards ?? [];
  md.mine = bestLoadout(md.pool, md.used, us.plan);
  md.theirs = aiLoadout(W, s, opp);
}

export function match(app, sid) {
  const W = state.W, s = W.series[sid];
  if (!s) return go('#/home');
  if (!md || md.sid !== sid || (md.phase !== 'post' && s.winner)) {
    if (s.winner) return go('#/home');
    newGame(W, s);
  }
  ({ cards: renderCards, draft: renderDraft, live: renderLive, post: renderPost })[md.phase](app);
}

const sideName = side => (side ? 'Red' : 'Blue');
function seriesHeader(W, s) {
  const c = W.comps[s.comp];
  return `${esc(c.name)} · ${esc(s.label)} · Game ${s.games.length + 1} of ${s.bestOf}`;
}

// ================= Card select (CARD_PLAN §3, §14) =================
function renderCards(app) {
  const W = state.W, s = W.series[md.sid], teams = [team(W, md.blue), team(W, md.red)], mine = md.mine;
  const keys = mine.map(c => c.key), focus = mine.reduce((n, c) => n + costOf(c), 0), err = loadoutError(mine, md.used);
  const col = (p, i) => `<section class="cs-col"><header><span class="caps">${ROLES[i]}</span><b>${esc(p.name)}</b></header>${md.pool.filter(c => c.slot === i).map(c => {
    const v = cardView(c), used = md.used.includes(c.key), on = keys.includes(c.key);
    return `<div class="cs-card ${on ? 'on' : ''} ${used ? 'used' : ''}" data-key="${c.key}" role="button" tabindex="0" aria-pressed="${on}" ${used ? 'aria-disabled="true" title="Loaded earlier this series or in the last match"' : ''}>${cardHTML(c, 'hand')}
      <div class="cs-text"><p><b>When</b> ${esc(v.when.replace(/\[\[|\]\]/g, ''))}</p><p><b>Then</b> ${esc(v.then.replace(/\[\[|\]\]/g, ''))}</p><span class="caps ${used ? 'bad' : 'dim'}">${used ? (md.rest.includes(c.key) ? 'Resting' : 'Used this series') : triggerStatus(c, md.draft, md.userSide)}</span></div></div>`;
  }).join('')}</section>`;
  app.innerHTML = `<div class="cards-select">
    <header class="cs-head"><div><span class="dim small">${seriesHeader(W, s)} · <span class="blue">${esc(teams[0].name)}</span> v <span class="red">${esc(teams[1].name)}</span></span><h1 class="disp xl">Tactic Cards</h1>
      <span class="small dim">Load up to ${LOADOUT.size} cards from your starters: at most ${LOADOUT.perPlayer} from one player, one Signature. Hidden until they fire; a loaded card can't be loaded again this series, and rests for your next match.</span></div>
      <div class="cs-meter"><span class="caps">Focus</span><b class="disp score ${focus > LOADOUT.budget ? 'bad' : ''}">${focus}/${LOADOUT.budget}</b><span class="caps">${mine.length}/${LOADOUT.size} cards</span></div></header>
    <div class="cs-cols">${md.players[md.userSide].map(col).join('')}</div>
    <footer class="cs-foot"><span class="${err ? 'bad' : 'dim'} small">${err ?? (mine.length ? mine.map(c => esc(cardView(c).name)).join(' · ') : 'No cards loaded')}</span><span class="sp"></span>
      <button class="btn btn-ghost" id="cardsauto">Analyst pick</button><button class="btn btn-ghost" id="cardsclear">Clear</button><button class="btn btn-blue btn-lg" id="lockcards" ${err ? 'disabled' : ''}>Lock cards ▸</button></footer></div>`;
  on(app, '[data-key]', 'click', el => {
    if (el.getAttribute('aria-disabled')) return toast(el.title, true);
    const c = md.pool.find(x => x.key === el.dataset.key);
    md.mine = keys.includes(c.key) ? mine.filter(x => x !== c) : [...mine, c];
    renderCards(app);
  });
  $('#cardsauto', app).onclick = () => { md.mine = bestLoadout(md.pool, md.used, userTeam(W).plan); renderCards(app); };
  $('#cardsclear', app).onclick = () => { md.mine = []; renderCards(app); };
  $('#lockcards', app).onclick = () => { md.phase = 'draft'; md.load = md.userSide ? [md.theirs, md.mine] : [md.mine, md.theirs]; renderDraft(app); };
}

// ================= Draft (04) =================
function lockReason(d, id) {
  for (const sd of [0, 1]) if (d.bans[sd].includes(id)) return `Banned by ${sideName(sd)}`;
  for (const sd of [0, 1]) if (d.picks[sd].includes(id)) return `Picked by ${sideName(sd)}`;
  return null;
}
function renderDraft(app) {
  const W = state.W, s = W.series[md.sid], d = md.draft, us = md.userSide, cur = turn(d), done = draftDone(d);
  const myTurn = cur && cur[0] === us, mine = md.players[us], theirs = md.players[1 - us];
  if (!done && !myTurn) setTimeout(() => aiStep(app), 500);
  const steady = () => 0.5; // steady rng: the suggestion doesn't flicker between renders
  const suggestion = myTurn ? aiChoice(d, us, mine, theirs, steady, draftPrefs(W)) : null;
  if (myTurn && cur[1] === 'pick' && (md.slot == null || d.picks[us][md.slot])) md.slot = suggestion?.slot ?? d.picks[us].indexOf(null);
  const teams = [team(W, md.blue), team(W, md.red)];
  const used = side => s.games.map(gid => W.games.find(g => g.id === gid)).filter(Boolean).map((g, i) => { const tid = side ? md.red : md.blue, sd = g.blue === tid ? 0 : 1; return `<div class="used"><span class="caps">G${i + 1}</span>${g.picks[sd].map(id => champSprite(id, 28)).join('')}<span class="f ${g.winner === tid ? 'w' : 'l'}">${g.winner === tid ? 'W' : 'L'}</span></div>`; }).join('');
  const bans = side => Array.from({ length: DRAFT_ORDER.filter(x => x[0] === side && x[1] === 'ban').length }, (_, i) => (d.bans[side][i] ? `<span class="ban">${champSprite(d.bans[side][i], 30)}</span>` : '<span class="ban empty"></span>')).join('');
  const col = side => `<aside class="d-col ${side ? 'rside' : ''}">${ROLES.map((role, i) => { const p = md.players[side][i], id = d.picks[side][i], me = side === us; const active = me && ((myTurn && cur[1] === 'pick' && md.slot === i) || md.swap === i); return `<div class="d-slot ${active ? 'active' : ''} ${cur && cur[0] === side && cur[1] === 'pick' && !id ? 'turn' : ''}" ${me ? `data-slot="${i}" role="button" tabindex="0"` : ''}>${id ? champSprite(id, 56) : `<span class="d-empty">${active ? '?' : ''}</span>`}<div><span class="caps">${role}${id ? ` · ${esc(p.name)}` : ''}</span><b class="${id ? 'disp lg' : ''}">${id ? esc(CHAMPS[id].name) : esc(p.name)}</b>${id && me ? `<span class="small dim">Mastery ${MASTERY(effProf(p, i, id))}</span>` : ''}</div></div>`; }).join('')}
    ${side !== us ? intel(W, team(W, side ? md.red : md.blue)) : md.load[us].length ? `<div class="d-used"><span class="caps">Your cards</span>${md.load[us].map(c => { const st = triggerStatus(c, d, us); return `<div class="small">${esc(cardView(c).name)} <b class="${st === 'Live' ? 'good' : st === 'Dead' ? 'bad' : 'dim'}">${st}</b></div>`; }).join('')}</div>` : ''}<div class="d-used"><span class="caps">Used this series</span>${used(side) || '<span class="dim small">First game</span>'}</div></aside>`;
  const list = CHAMP_IDS.filter(id => (!md.role || CHAMPS[id].roles.includes(md.role)) && (!md.q || CHAMPS[id].name.toLowerCase().includes(md.q.toLowerCase())) && (!md.hide || !lockReason(d, id)));
  const unavailable = CHAMP_IDS.filter(id => lockReason(d, id)).length;
  const selId = md.sel && !lockReason(d, md.sel) ? md.sel : suggestion?.id;
  const selC = selId && CHAMPS[selId], slotP = md.slot != null ? mine[md.slot] : null, mod = selId && W.patch?.mods?.[selId];
  const diff = s.wins[W.userTeamId] - s.wins[md.userSide ? md.blue : md.red];
  const talk = md.talk ? `<div class="small">${md.talk.map(r => `${esc(r.name)} <b class="${r.d > 0 ? 'good' : r.d < 0 ? 'bad' : ''}">${r.mood}</b>`).join(' · ')}</div>`
    : `<div class="row wrap"><span class="caps">Team talk</span>${Object.entries(TALKS).map(([k, l]) => `<button class="btn btn-ghost" data-talk="${k}">${l}</button>`).join('')}</div>`;
  const analyst = done ? `Draft complete. Click two of your slots to trade champions between players, then start.${isRivalry(W, s.a, s.b) ? ' <b class="bad">Rivalry game</b>: higher stakes, bigger mood swings.' : ''}${talk}` : !myTurn ? `${sideName(cur[0])} is ${cur[1] === 'ban' ? 'banning' : 'picking'}…`
    : esc(suggestion.why);
  app.innerHTML = `<div class="draft">
    <header class="d-head"><div class="d-team">${crest(teams[0], 40)}<div><h2 class="disp xl">${esc(teams[0].name)}</h2><span class="blue caps">Blue side</span></div><div class="bans">${bans(0)}</div></div>
      <div class="d-mid"><span class="dim small">${seriesHeader(W, s)}</span><b class="disp score">${s.wins[md.blue]} – ${s.wins[md.red]}</b><span class="caps ${cur ? (cur[0] ? 'red' : 'blue') : ''}">${cur ? `${sideName(cur[0])} ${cur[1]}s · step ${d.i + 1} of ${DRAFT_ORDER.length}` : 'Draft complete'}</span>${myTurn ? `<b class="disp clock" id="clock">0:${String(md.clock).padStart(2, '0')}</b>` : ''}</div>
      <div class="d-team right"><div class="bans">${bans(1)}</div><div><h2 class="disp xl">${esc(teams[1].name)}</h2><span class="red caps">Red side</span></div>${crest(teams[1], 40)}</div></header>
    <div class="d-body">${col(0)}
      <section class="d-center">
        <div class="d-filters">${[['', 'All'], ...ROLES.map(r => [r, ROLE_SHORT[r]])].map(([r, l]) => `<button class="chip ${md.role === r ? 'on' : ''}" data-role="${r}">${l}</button>`).join('')}<button class="chip ${md.hide ? 'on' : ''}" id="hide">Hide unavailable · ${unavailable}</button><input type="search" id="q" placeholder="Search champions" value="${esc(md.q)}" aria-label="Search champions"></div>
        <div class="d-legend small"><span class="gold">◆</span> Analyst pick · off-role champions play at 85% mastery</div>
        <div class="d-grid">${list.map(id => { const why = lockReason(d, id), by = [0, 1].find(sd => d.picks[sd].includes(id)); return `<button class="d-tile ${why ? 'locked' : ''} ${id === selId ? 'sel' : ''} ${d.bans.flat().includes(id) ? 'banned' : ''}" data-champ="${id}" ${why ? `title="${esc(why)}" aria-disabled="true"` : `title="${esc(CHAMPS[id].name)} · ${CHAMPS[id].cls}"`}>${champSprite(id, 64)}${by != null ? `<span class="d-by ${by ? 'red' : 'blue'}">${by ? 'RED' : 'BLUE'}</span>` : ''}${suggestion?.id === id ? '<span class="d-ana">◆</span>' : ''}<span class="small">${esc(CHAMPS[id].name)}</span></button>`; }).join('') || empty('No champions match')}</div>
        <div class="d-analyst"><b class="gold">Analyst:</b> ${analyst}</div>
        <div class="d-detail">${selC ? `${champSprite(selId, 72)}<div><h2 class="disp xl">${esc(selC.name)}</h2><span class="dim">${selC.cls} · ${selC.roles.join('/')}${slotP && cur?.[1] === 'pick' ? ` · for ${esc(slotP.name)}` : ''}</span>
          <div class="row"><span><span class="caps">Mastery</span><b>${slotP ? MASTERY(effProf(slotP, md.slot, selId)) : '–'}</b></span>${mod ? `<span class="pill">Patch ${Object.entries(mod).map(([k, v]) => `${{ hp: 'HP', atk: 'ATK', cd: 'CD' }[k]} ${v > 0 ? '+' : ''}${Math.round(v * 100)}%`).join(' ')}</span>` : ''}</div></div>` : ''}
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
  const c = aiChoice(d, cur[0], md.players[cur[0]], md.players[1 - cur[0]], Math.random, draftPrefs(state.W));
  applyDraft(d, c.id, c.slot); md.clock = CLOCK;
  renderDraft(app);
}
function intel(W, t) {
  const r = scoutReport(W, t);
  return `<div class="d-comp small"><span class="caps">Scouting</span><div>Form <b>${r.form || '–'}</b> · plan <b>${esc(r.plan)}</b> · chemistry <b>${r.chem}</b></div>
    ${!W.classic ? `<div>Resting cards ${(t.restCards ?? []).map(k => esc(CARDS[k.split(':')[1]].name)).join(', ') || 'none'}</div>` : ''}
    ${r.recent.length ? `<div>Recent picks ${r.recent.map(x => `${esc(CHAMPS[x.id].name)}×${x.n}`).join(', ')}</div>` : ''}
    ${r.known ? r.players.map(p => `<div>${ROLE_SHORT[p.role]} ${esc(p.name)}: ${p.comfort.map(c => esc(CHAMPS[c].name)).join(', ') || '–'}</div>`).join('') : '<div class="dim">Comfort picks unknown. Scrim them, or build a level-4 analytics room.</div>'}</div>`;
}

// ================= Score graph (live, post-game, report, result mails) =================
let gid = 0;
// Score lead over time (blue up, red down). upto cuts the line at a time; marker draws a gold cursor.
export const scoreGraph = (tl, w = 340, h = 110, marker = null, upto = Infinity) => {
  const pts0 = tl.filter(x => x.t <= upto);
  if (pts0.length < 2) return `<svg width="100%" viewBox="0 0 ${w} ${h + 14}"></svg>`;
  const diffs = pts0.map(x => x.s[0] - x.s[1]), m = Math.max(5, ...tl.map(x => Math.abs(x.s[0] - x.s[1]))), T = Math.max(240, tl.at(-1).t);
  const X = t => (t / T) * w, Y = v => h / 2 - (v / m) * (h / 2 - 6);
  const pts = pts0.map((x, i) => `${X(x.t).toFixed(1)},${Y(diffs[i]).toFixed(1)}`).join(' '), end = X(pts0.at(-1).t);
  return `<svg width="100%" viewBox="0 0 ${w} ${h + 14}" preserveAspectRatio="none" class="gold-graph" role="img" aria-label="Score lead over time"><line x1="0" x2="${w}" y1="${h / 2}" y2="${h / 2}" stroke="var(--c-line-2)"/>
    <clipPath id="gtop${++gid}"><rect x="0" y="0" width="${w}" height="${h / 2}"/></clipPath><clipPath id="gbot${gid}"><rect x="0" y="${h / 2}" width="${w}" height="${h / 2}"/></clipPath>
    <polygon points="0,${h / 2} ${pts} ${end},${h / 2}" fill="var(--c-blue)" opacity=".25" clip-path="url(#gtop${gid})"/><polygon points="0,${h / 2} ${pts} ${end},${h / 2}" fill="var(--c-red)" opacity=".25" clip-path="url(#gbot${gid})"/>
    <polyline points="${pts}" fill="none" stroke="var(--c-text)" stroke-width="1.5"/>${marker != null ? `<line x1="${X(marker)}" x2="${X(marker)}" y1="0" y2="${h}" stroke="var(--c-action)" stroke-width="1.5"/>` : ''}
    <text x="2" y="10" fill="var(--c-faint)" font-size="9">+${m}</text><text x="2" y="${h - 2}" fill="var(--c-faint)" font-size="9">−${m}</text>${[0, 1, 2, 3, 4].filter(t => t * 60 <= T).map(t => `<text x="${X(t * 60)}" y="${h + 12}" fill="var(--c-faint)" font-size="9">${t}m</text>`).join('')}</svg>`;
};

// Feed line for a summary event; players = summary players (pid -> name).
function feedLine(players, names, e, jump = false) {
  const nm = pid => esc(players.find(p => p.pid === pid)?.name ?? '?');
  const side = `class="${e.side ? 'red' : 'blue'}"`, at = `<span class="num dim">${fmt(e.t)}</span>`, attr = jump ? ` data-jump="${e.t}" role="button" tabindex="0"` : '';
  if (e.type === 'kill') return `<div class="feed-row"${attr}>${at}<b ${side}>${nm(e.k)}</b>${champSprite(e.kc, 20)}<span class="dim">›</span>${champSprite(e.vc, 20)}<span>${nm(e.v)}</span>${e.fb ? '<span class="pill">First blood</span>' : ''}${e.shutdown ? '<span class="pill hi">Shutdown</span>' : ''}${e.streak >= 3 ? `<span class="pill">${e.streak} streak</span>` : ''}</div>`;
  if (e.type === 'card') return `<div class="feed-row"${attr}>${at}<span ${side}>▮</span><span>${esc(names[e.side])} revealed <b>${esc(CARDS[e.id]?.name ?? e.id)}</b>${e.score ? ` (+${e.score})` : ''}</span></div>`;
  const txt = { ace: `ACE for ${esc(names[e.side])}`, capture: `${esc(names[e.side])} captured ${esc(String(e.point ?? 'a point'))}`, claim: `${esc(names[e.side])} won a fight claim` }[e.type];
  return txt ? `<div class="feed-row"${attr}>${at}<span ${side}>◆</span><span>${txt}</span></div>` : '';
}
const planText = tac => `${{ hold_the_pit: 'Hold the pit', hunt: 'Hunt', starve: 'Starve' }[tac.preset] ?? tac.preset} · ${['defensive', 'balanced', 'aggressive'][tac.aggression + 1]} · focus ${tac.focus && tac.focus !== 'auto' ? ROLE_SHORT[ROLES[['top', 'jungle', 'mid', 'adc', 'support'].indexOf(tac.focus)]] : 'auto'} · ${tac.protect_the_carry ? 'protect the carry' : 'no peel'}`;

// ================= Live (05) =================
function startLive(app) {
  const W = state.W, s = W.series[md.sid];
  const [b, r] = [md.blue, md.red].map(id => team(W, id));
  md.load.forEach((cs, side) => loadCards(s, team(W, side ? md.red : md.blue), cs));
  md.sum = runPayload({ teamA: engineTeam(W, b, md.draft.picks[0], b.plan, md.load[0]), teamB: engineTeam(W, r, md.draft.picks[1], r.plan, md.load[1]), seed: Math.floor(Math.random() * 2 ** 31), fast: false, opts: { stakes: stakesOf(W, s), patch: W.patch?.mods } });
  md.phase = 'live'; md.speed = state.settings.speed; md.paused = false;
  renderLive(app);
}
function renderLive(app) {
  const W = state.W, ser = W.series[md.sid], sum = md.sum, us = md.userSide;
  const teams = [team(W, md.blue), team(W, md.red)], names = teams.map(t => t.name);
  app.innerHTML = `<div class="live"><div class="l-stage" id="stage"></div>
    <div class="l-low">
      <div class="l-ctl"><span class="caps dim">${seriesHeader(W, ser)} · series ${ser.wins[md.blue]} – ${ser.wins[md.red]}</span>
        <div class="row"><span class="seg">${[[0, '❚❚'], [1, '1×'], [2, '2×'], [4, '4×']].map(([v, l]) => `<span role="button" tabindex="0" data-speed="${v}" class="${(md.paused ? 0 : md.speed) === v ? 'on' : ''}" aria-label="${v ? `Speed ${l}` : 'Pause'}">${l}</span>`).join('')}</span><button class="btn btn-ghost" id="skip">Skip to end</button></div>
        <div class="small"><span class="caps dim">Your plan</span> ${esc(planText(sum.config[us ? 'red' : 'blue'].tactics))}</div>
        <div class="small dim">The plan is fixed for the game. Click a feed line to watch that moment again.</div></div>
      <div class="l-gold"><div class="row between"><h3 class="disp">Score lead</h3><span class="small dim"><span class="blue">■</span> ${esc(teams[0].tag)} · <span class="red">■</span> ${esc(teams[1].tag)} · <b id="lscore"></b></span></div><div id="gold"></div></div>
      <div class="l-feed"><h3 class="disp">Feed</h3><div id="feed"></div></div></div></div>`;
  let shown = -1;
  const ctl = mountMatch($('#stage', app), sum.config, {
    names, tags: teams.map(x => x?.tag), speed: md.speed, paused: md.paused,
    onTick: t => {
      const sec = Math.floor(t); if (sec === shown) return; shown = sec;
      const sc = sum.timeline.filter(x => x.t <= t).at(-1).s;
      $('#lscore', app).textContent = `${sc[0]} – ${sc[1]}`;
      $('#gold', app).innerHTML = scoreGraph(sum.timeline, 340, 110, null, t);
      $('#feed', app).innerHTML = sum.events.filter(e => e.t <= t).reverse().map(e => feedLine(sum.players, names, e, true)).join('') || '<span class="dim small">The teams are heading to the points.</span>';
    },
    onEnd: () => setTimeout(() => finishGame(app), 1200),
  });
  on(app, '[data-speed]', 'click', b => { const v = +b.dataset.speed; md.paused = v === 0; if (v) md.speed = v; ctl.setSpeed(v); app.querySelectorAll('[data-speed]').forEach(x => x.classList.toggle('on', x === b)); });
  $('#skip', app).onclick = () => ctl.toEnd();
  $('#feed', app).addEventListener('click', e => { const row = e.target.closest('[data-jump]'); if (row) { ctl.seek(Math.max(0, +row.dataset.jump - 4)); shown = -1; } });
}
function finishGame(app) {
  if (!md || md.phase !== 'live') return;
  const W = state.W, s = W.series[md.sid];
  md.gid = recordGame(W, s, md.sum, md.blue, md.red, { picks: md.draft.picks, bans: md.draft.bans }).id;
  md.phase = 'post';
  save();
  if (location.hash.startsWith('#/match')) renderPost(app);
}

// ================= Post-game (05b) =================
const potgReason = p => `${p.k}/${p.d}/${p.a} · ${Math.round(p.share * 100)}% of team damage · ${p.obj} s on points${p.heal ? ` · ${p.heal} healing` : ''}`;
function compareBars(sum) {
  const agg = side => { const ps = sum.players.filter(p => p.side === side), tot = k => ps.reduce((n, p) => n + p[k], 0); return { Score: sum.score[side], 'Kill points': sum.split[side].kills, 'Objective points': sum.split[side].obj, Captures: sum.caps[side], Damage: tot('dmg'), Healing: tot('heal') }; };
  const a = agg(0), b = agg(1);
  return Object.keys(a).map(k => { const t = a[k] + b[k] || 1, f = v => (v >= 10000 ? kfmt(v) : v); return `<div class="cmp"><div class="row between"><b class="num blue">${f(a[k])}</b><span class="caps">${k}</span><b class="num red">${f(b[k])}</b></div><div class="cmpbar"><i class="bl" style="flex:${Math.max(0.02, a[k] / t)}"></i><i class="rd" style="flex:${Math.max(0.02, b[k] / t)}"></i></div></div>`; }).join('');
}
const statTable = (sum, side, short = false) => `<table><thead><tr><th>Player</th><th>Champion</th><th class="n">K/D/A</th><th class="n">DMG</th>${short ? '' : '<th class="n">Taken</th><th class="n">Heal</th><th class="n" title="Seconds on capture points">Points</th>'}<th class="n">Rating</th></tr></thead><tbody>${sum.players.filter(p => p.side === side).map(p => `<tr class="${p.pid === sum.mvp ? 'me' : ''}"><td><a href="#/player/${p.pid}">${esc(p.name)}</a> <span class="dim small">${ROLE_SHORT[p.role]}</span></td><td><span class="tm">${champSprite(p.champ, 20)} ${short ? '' : esc(CHAMPS[p.champ].name)}</span></td><td class="n">${p.k}/${p.d}/${p.a}</td><td class="n">${kfmt(p.dmg)}</td>${short ? '' : `<td class="n">${kfmt(p.taken)}</td><td class="n">${p.heal >= 1000 ? kfmt(p.heal) : p.heal}</td><td class="n">${p.obj}s</td>`}<td class="n"><b>${p.rating}</b></td></tr>`).join('')}</tbody></table>`;
const howEnded = sum => (sum.endReason === 'score' ? `first to ${Math.max(...sum.score)}` : 'on the clock');

function renderPost(app) {
  const W = state.W, s = W.series[md.sid], sum = md.sum, teams = [team(W, md.blue), team(W, md.red)];
  const win = teams[sum.winner], mvp = sum.players.find(p => p.pid === sum.mvp);
  const done = !!s.winner;
  app.innerHTML = `<div class="post pad">
    <header class="post-head"><span class="caps">${seriesHeader(W, s).replace(/Game \d+/, `Game ${s.games.length}`)}</span><h1 class="disp xxl">${esc(win.name)} win ${sum.score[sum.winner]}–${sum.score[1 - sum.winner]}</h1><span class="dim">${fmt(sum.duration)} · ${howEnded(sum)} · series ${s.wins[md.blue]} – ${s.wins[md.red]}</span></header>
    <div class="g3 post-top">
      <section class="card potg"><div class="ch"><h3>Player of the game</h3></div><div class="pad-s row">${champSprite(mvp.champ, 72)}<div><h2 class="disp xl">${esc(mvp.name)}</h2><span class="dim">${esc(CHAMPS[mvp.champ].name)} · rating <b>${mvp.rating}</b></span><p class="small">${potgReason(mvp)}</p></div></div></section>
      <section class="card"><div class="ch"><h3>Team comparison</h3><span class="meta"><span class="blue">${esc(teams[0].tag)}</span> v <span class="red">${esc(teams[1].tag)}</span></span></div><div class="pad-s">${compareBars(sum)}</div></section>
      <section class="card"><div class="ch"><h3>Score lead</h3></div><div class="pad-s">${scoreGraph(sum.timeline)}</div></section></div>
    ${md.load[0].length + md.load[1].length ? `<div class="post-cards small">${[md.userSide, 1 - md.userSide].map(side => { const fired = sum.events.filter(e => e.type === 'card' && e.side === side); const shown = side === md.userSide ? md.load[side] : md.load[side].filter(c => fired.some(e => e.id === c.id && e.pid === c.pid)); return `<span class="caps ${side ? 'red' : 'blue'}">${side === md.userSide ? 'Your cards' : 'Revealed'}</span>${shown.map(c => { const f = fired.find(e => e.id === c.id && e.pid === c.pid); return `<span class="pill ${f ? 'hi' : ''}">${esc(cardView(c).name)} · ${f ? `fired ${fmt(f.t)}` : 'not fired'}</span>`; }).join('') || '<span class="dim">none</span>'}`; }).join('')}</div>` : ''}
    <div class="g2 mt">${[0, 1].map(side => `<section class="card"><div class="ch"><h3 class="${side ? 'red' : 'blue'}">${esc(teams[side].name)}</h3><span class="meta">${sum.score[side]} points · ${sum.kills[side]} kills · ${sum.caps[side]} captures</span></div><div class="scroll">${statTable(sum, side)}</div></section>`).join('')}</div>
    <div class="post-foot"><a class="btn btn-secondary" href="#/report/${md.gid}">Match report</a>${done ? `<b>${esc(team(W, s.winner).name)} take the series ${s.wins[s.winner]}–${s.wins[s.winner === s.a ? s.b : s.a]}.</b><button class="btn btn-primary btn-lg" id="done">Finish ▸</button>` : '<button class="btn btn-primary btn-lg" id="next">Next game ▸</button>'}</div></div>`;
  $('#done', app)?.addEventListener('click', () => { md = null; go('#/home'); });
  $('#next', app)?.addEventListener('click', () => { newGame(W, s); (md.phase === 'cards' ? renderCards : renderDraft)(app); });
}

// ================= Match report (15) =================
export function report(app, gid, startT = null) {
  const W = state.W, r = W.reports[gid], g = W.games.find(x => x.id === +gid);
  const top = `<header class="top"><a class="wm" href="#/home">LANE<i>/</i>BOUND</a><span class="crumb"><a href="#/stats/games">Stats › Games</a> › <b>Match report</b></span><span class="sp"></span><button class="btn btn-ghost" onclick="history.back()">◂ Back</button></header>`;
  if (!r) { app.innerHTML = `${top}<main class="view pad">${empty('Detailed report not kept', g ? `${esc(team(W, g.winner)?.name)} won ${g.score[0]}–${g.score[1]} in ${fmt(g.dur)}. Full reports are kept for your games and finals (the latest 40).` : 'This game is no longer in the records.', '<a class="btn btn-secondary" href="#/stats/games">All games</a>')}</main>`; return; }
  const s = W.series[g?.sid], teams = [team(W, r.blue), team(W, r.red)], names = teams.map(t => t?.name ?? '?');
  const others = s ? s.games.filter(id => W.reports[id]) : [+gid];
  const hl = highlights(r, +gid, teams.map((t, i) => t?.tag ?? sideName(i))).slice(0, 6);
  const replay = !!r.config;
  let t = startT ?? 0;
  app.innerHTML = `${top}<main class="view pad report">
    <div class="row between"><div><span class="caps">${esc(W.comps[r.comp]?.name ?? '')} ${s ? `· ${esc(s.label)}` : ''}</span><h1 class="disp xxl"><span class="blue">${esc(names[0])}</span> ${r.score[0]} – ${r.score[1]} <span class="red">${esc(names[1])}</span></h1><span class="dim">${esc(names[r.winner])} win · ${fmt(r.duration)} · ${howEnded(r)}${r.fast ? ' · statistical sim (no replay)' : ''}</span>${gameSummary(W, +gid) ? `<p class="small aw-recap">${esc(gameSummary(W, +gid))}</p>` : ''}</div>
      <nav class="seg">${others.map((id, i) => `<a href="#/report/${id}"><span class="${id === +gid ? 'on' : ''}">Game ${s ? s.games.indexOf(id) + 1 : i + 1}</span></a>`).join('')}</nav></div>
    <div class="r-body mt">
      <section class="card r-watch">${replay ? `<div id="rstage"></div><div class="row pad-s"><button class="btn btn-ghost" id="play">▶ Play</button><input type="range" id="scrub" min="0" max="${Math.ceil(r.duration)}" step="1" value="${t}" aria-label="Game time"><b class="num" id="tm">${fmt(t)}</b></div>
        ${hl.length ? `<div class="chips">${hl.map(h => `<button class="chip" data-seek="${Math.max(0, Math.round(h.t) - 5)}" title="${esc(h.text)}">${fmt(h.t)} ${esc(h.text)}</button>`).join('')}</div>` : ''}` : `<div class="pad-s">${empty('No replay', 'Games played on the statistical engine record results only.')}</div>`}
        <div class="pad-s" id="rgold">${scoreGraph(r.timeline, 340, 70, replay ? t : null)}</div></section>
      <div class="stack r-side">${[0, 1].map(side => card(`<span class="${side ? 'red' : 'blue'}">${esc(names[side])}</span>`, `${r.split[side].kills} kill + ${r.split[side].obj} objective points · ${r.caps[side]} caps · ban ${(r.bans?.[side] ?? []).map(id => CHAMPS[id]?.name).join(', ') || '–'}`, statTable(r, side, true))).join('')}
        ${r.config ? card('Game plans', '', `<div class="pad-s small">${[0, 1].map(side => `<div><b class="${side ? 'red' : 'blue'}">${esc(teams[side]?.tag ?? '')}</b> ${esc(planText(r.config[side ? 'red' : 'blue'].tactics))}</div>`).join('')}</div>`) : ''}
        ${card('Key events', '', `<div class="feed pad-s r-feed">${(r.events ?? []).map(e => feedLine(r.players, names, e, replay)).join('') || '<span class="dim">No events recorded</span>'}</div>`)}</div></div></main>`;
  if (!replay) return;
  let playing = false, sec = -1;
  const ctl = mountMatch($('#rstage', app), r.config, {
    names, tags: teams.map(x => x?.tag), paused: true, startT: t, scale: 0.6,
    onTick: x => { t = x; if (Math.floor(x) === sec) return; sec = Math.floor(x); $('#scrub', app).value = Math.floor(t); $('#tm', app).textContent = fmt(t); $('#rgold', app).innerHTML = scoreGraph(r.timeline, 340, 70, t); },
    onEnd: () => setPlaying(false),
  });
  const setPlaying = v => { playing = v; ctl.setSpeed(v ? 4 : 0); $('#play', app).textContent = v ? '❚❚ Pause' : '▶ Play'; };
  $('#play', app).onclick = () => { if (!playing && t >= ctl.maxT - 0.1) ctl.seek(0); setPlaying(!playing); };
  $('#scrub', app).oninput = e => ctl.seek(+e.target.value);
  on(app, '[data-seek]', 'click', b => { ctl.seek(+b.dataset.seek); setPlaying(true); });
  $('.r-feed', app).addEventListener('click', e => { const row = e.target.closest('[data-jump]'); if (row) { ctl.seek(Math.max(0, +row.dataset.jump - 4)); setPlaying(true); } });
  if (startT != null) setPlaying(true);
}
// Replays (Stats › Replays): every kept match report, newest first, with its best moments.
export function replays(el) {
  const W = state.W;
  const ids = Object.keys(W.reports).map(Number).sort((a, b) => b - a);
  el.innerHTML = `<div class="pad">${ids.length ? `<section class="card"><div class="ch"><h3>Replays</h3><span class="meta">${ids.length} kept · your games and finals</span></div><div class="scroll"><table><thead><tr><th>Competition</th><th>Game</th><th>Score</th><th>Highlights</th><th></th></tr></thead><tbody>${ids.map(id => {
    const r = W.reports[id], tb = team(W, r.blue), tr = team(W, r.red), hl = highlights(r, id);
    return `<tr><td>${esc(W.comps[r.comp]?.name ?? '')}</td><td><span class="blue">${esc(tb?.tag ?? '')}</span> v <span class="red">${esc(tr?.tag ?? '')}</span></td><td class="num">${r.score[0]}–${r.score[1]}</td><td class="small">${hl.slice(0, 2).map(h => `<a href="#/report/${id}/${Math.max(0, Math.round(h.t) - 5)}">${esc(h.text)}</a>`).join(' · ') || '<span class="dim">–</span>'}</td><td>${r.config ? `<a class="btn btn-secondary" href="#/report/${id}">▶ Watch</a>` : `<a class="btn btn-ghost" href="#/report/${id}">Report</a>`}</td></tr>`;
  }).join('')}</tbody></table></div></section>` : empty('No replays yet', 'Reports of your games and finals are kept here (the latest 40).')}</div>`;
}
