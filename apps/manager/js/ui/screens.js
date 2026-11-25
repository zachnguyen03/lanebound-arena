// Club-side screens: Home (03), Squad (02/18/18b), Training (08), Tactics (09), Transfers (10/10b), Club (11), player and team pages.
import { ROLES, CHAMPS, CHAMP_IDS, ATTRS, ATTR_LABEL, ATTR_SHORT, REGIONS, PLAN_PRESETS, clonePlan } from '../data.js';
import {
  userTeam, team, teamPlayers, academyPlayers, allPlayers, overall, strength, payroll, wageCap, capRoom, valueOf, wageFor, MASTERY, potentialStars, fmtDate, weekday,
  nextUserSeries, involvesUser, userLeague, sortedTable, currentSplit, autoStarters, setStarter, promote, demote, transferList, releaseCompensation, releasePlayer,
  termsLikelihood, playerAsk, renew, SCOUT_COST, scout, knowledge, askingPrice, clubResponse, offerTerms, toggleShortlist, acceptOffer, rejectOffer, acceptSponsor,
  staffMarket, hireStaff, fireStaff, upgradeFacility, FACILITIES, STAFF_ROLES, DRILLS, SESSION_LABEL, trainingPlan, setSession, setFocus, focusSpent, FOCUS_POINTS,
  conditionForecast, FIRST_TEAM_MAX, ACADEMY_MAX, ledger, tierName, coachRating, REGION_INFO, ordinal, scoutDays, comfortPool, metaFit, weeksTo, initManager, confLabel, requestBudget, takeJob, setUserTeam, scrimPartners, PERSONAS, PROMISES, STATUS_LABEL, statusOf, personaKnown, ensurePeople, pairChem, teamChem,
} from '../career.js';
import { state, go } from './state.js';
import { esc, $, on, money, pct, num, crest, sprite, bar, condColor, spark, wl, seg, select, empty, card, table, wireTables, toast, modal, ROLE_SHORT } from './dom.js';

const rr = () => state.rerender();
// Champion portrait: the Watch app's painted 64 px art (apps/watch/public).
export const champSprite = (id, size = 32) => `<span class="sprite" style="width:${size}px;height:${size}px" title="${esc(CHAMPS[id]?.name)}"><img src="/champions/portraits/painted/${id}/${id}-64.png" alt="" width="${size}" height="${size}"></span>`;
export const pLink = p => `<a href="#/player/${p.id}">${esc(p.name)}</a>`;
export const tLink = t => (t ? `<a class="tm" href="#/team/${t.id}">${crest(t, 18)} ${esc(t.name)}</a>` : '<span class="dim">Free agent</span>');
const recent = (W, tid, n = 5) => W.games.filter(g => g.blue === tid || g.red === tid).slice(-n).map(g => g.winner === tid);
export function winChance(W, a, b) { const d = strength(W, a) - strength(W, b); return 1 / (1 + Math.exp(-(d * 0.05 + d ** 3 * 0.00044))); }
const seasonAgg = (W, t) => { const a = { gp: 0, fb: 0, mins: 0, score: 0, sa: 0 }; for (const [k, s] of Object.entries(t.season)) if (k.startsWith(String(W.year))) { a.gp += s.gp; a.fb += s.fb; a.mins += s.mins; a.score += s.score; a.sa += s.scoreAgainst; } return a; };
const compare = (label, a, b, fmt) => { const tot = Math.abs(a) + Math.abs(b) || 1; return `<div class="cmp"><span class="caps">${label}</span><div class="cmp-row"><b class="num">${fmt(a)}</b><span class="cmpbar"><i class="bl" style="flex:${Math.max(0.05, Math.abs(a) / tot)}"></i><i class="rd" style="flex:${Math.max(0.05, Math.abs(b) / tot)}"></i></span><b class="num">${fmt(b)}</b></div></div>`; };

// ================= Home (03) =================
export function home(el) {
  const W = state.W, u = userTeam(W), s = nextUserSeries(W);
  const opp = s && team(W, s.a === u.id ? s.b : s.a);
  let hero;
  if (s) {
    const blue = (s.games.length % 2 === 0 ? s.a : s.b) === u.id, wc = winChance(W, u, opp), au = seasonAgg(W, u), ao = seasonAgg(W, opp);
    hero = `<section class="hero"><div class="hero-side">${crest(u, 72)}<div><h2 class="disp xl">${esc(u.name)}</h2><div>${wl(recent(W, u.id))}</div></div></div>
      <div class="hero-mid"><span class="caps">${fmtDate(W.year, s.day, { weekday: 'long', day: 'numeric', month: 'short' })} · Best of ${s.bestOf} · ${blue ? 'Blue' : 'Red'} side</span><div class="disp vs">VS</div>
        <div class="wc"><i class="bl" style="flex:${wc}"></i><i class="rd" style="flex:${1 - wc}"></i></div><div class="row between small"><span><b>${pct(wc)}</b> win chance</span><b>${pct(1 - wc)}</b></div>
        <span class="dim small">${esc(W.comps[s.comp].name)} · ${esc(s.label)}</span></div>
      <div class="hero-side right"><div><h2 class="disp xl">${esc(opp.name)}</h2><div>${wl(recent(W, opp.id))}</div></div>${crest(opp, 72)}</div></section>
      <div class="hero-stats">${compare('Score diff per game', au.gp ? (au.score - au.sa) / au.gp : 0, ao.gp ? (ao.score - ao.sa) / ao.gp : 0, v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`)}
        ${compare('First blood rate', au.gp ? au.fb / au.gp : 0, ao.gp ? ao.fb / ao.gp : 0, v => pct(v))}
        ${compare('Avg. game length', au.gp ? au.mins / au.gp : 0, ao.gp ? ao.mins / ao.gp : 0, v => `${Math.floor(v)}:${String(Math.round((v % 1) * 60)).padStart(2, '0')}`)}</div>`;
  } else hero = `<section class="hero empty-hero">${empty('No fixture scheduled', 'Your next match appears here once the schedule reaches it. Use Continue to move through the off-season.')}</section>`;

  // Needs your call
  const calls = [];
  if (W.board && W.board.conf < 40) calls.push([`The board is ${confLabel(W.board.conf).toLowerCase()}`, `Confidence ${Math.round(W.board.conf)}. Under 15 at a split's end means dismissal.`, 'Board', '#/club']);
  for (const o of (W.manager?.offers ?? []).filter(o => o.kind === 'approach')) calls.push([`${esc(team(W, o.teamId).name)} want you as manager`, `Reputation ${team(W, o.teamId).rep}`, 'Review', '#/club']);
  for (const o of W.offers.filter(o => o.status === 'open')) {
    const days = o.expires - W.day;
    if (o.kind === 'sponsor') calls.push([`Sponsor offer: ${esc(o.name)}`, `${money(o.weekly)} a week · <span class="warn">${days} days</span>`, 'Review', '#/inbox']);
    else calls.push([`${esc(team(W, o.from).name)} bid for ${esc(W.players[o.pid].name)}`, `${money(o.fee)} · <span class="warn">${days} days</span>`, 'Review', '#/transfers/offers']);
  }
  for (const p of allPlayers(W, u).filter(p => p.contractEnd <= W.year)) calls.push([`${esc(p.name)}'s contract ends this year`, `Asking ${money(playerAsk(p, u))} a year`, 'Negotiate', `#/squad/contracts/${p.id}`]);
  for (const p of u.starters.map(id => W.players[id]).filter(p => p.condition < 60)) calls.push([`${esc(p.name)} is fatigued`, `Condition ${Math.round(p.condition)}%. Lighter training or a rest day helps.`, 'Training', '#/training']);
  if (payroll(W, u) > wageCap(u)) calls.push(['Over the wage cap', `Payroll ${money(payroll(W, u))} of ${money(wageCap(u))}. Signings are blocked.`, 'Contracts', '#/squad/contracts']);
  if (u.cash < 0) calls.push(['Cash is negative', `${money(u.cash)}. Sell or release players.`, 'Club', '#/club']);
  const callsHtml = calls.length ? calls.slice(0, 5).map(([t, d, b, href]) => `<div class="call"><div><b>${t}</b><div class="dim small">${d}</div></div><a class="btn btn-secondary" href="${href}">${b}</a></div>`).join('') : `<div class="pad-s">${empty('All clear', 'Nothing needs a decision right now.')}</div>`;

  // This week
  const plan = trainingPlan(u);
  const week = Array.from({ length: 5 }, (_, i) => {
    const d = W.day + i, dow = weekday(W.year, d);
    const ser = (W.fixtures[d] ?? []).map(id => W.series[id]).find(x => involvesUser(W, x));
    const label = ser ? `vs ${esc(team(W, ser.a === u.id ? ser.b : ser.a).tag)}` : dow === 0 || dow === 6 ? 'Rest' : `${DRILLS[plan[(dow - 1) * 2]].name}`;
    return `<div class="day ${i === 0 ? 'on' : ''}"><span class="dim small">${fmtDate(W.year, d, { weekday: 'short' })}</span><b class="${ser ? 'gold' : ''}">${label}</b></div>`;
  }).join('');

  const lg = userLeague(W), rows = lg ? sortedTable(lg.table) : [];
  el.innerHTML = `<div class="pad home">${hero}
    <div class="g3 home-cards">
      <section class="card"><div class="ch"><h3>Needs your call</h3><span class="meta">${calls.length} open</span></div><div class="calls">${callsHtml}</div>
        <div class="ch mt-auto"><h3>This week</h3><span class="meta">Rest days restore condition</span></div><div class="week">${week}</div></section>
      ${card('Squad readiness', s ? `${fmtDate(W.year, s.day, { weekday: 'short' })} lineup` : 'Starting five', `<table><thead><tr><th>Role</th><th>Player</th><th>Condition</th><th>Form</th></tr></thead><tbody>${u.starters.map((id, i) => { const p = W.players[id]; return `<tr><td class="dim">${ROLE_SHORT[ROLES[i]]}</td><td><span class="tm">${sprite(p.id, u.color, 32)} ${pLink(p)}</span></td><td><span class="tm">${bar(p.condition, condColor(p.condition), '80px')} <span class="num">${Math.round(p.condition)}</span></span></td><td><span class="tm">${spark(p.form)} <span class="num">${p.form.length ? p.form.at(-1).toFixed(1) : ''}</span></span></td></tr>`; }).join('')}</tbody></table>`)}
      ${card(esc(lg?.name ?? 'League'), u.tier === 0 ? 'Top 6 to playoffs' : 'Top 2 promotion places', rows.length ? `<table><thead><tr><th>#</th><th>Team</th><th class="n">W-L</th><th class="n">Diff</th></tr></thead><tbody>${rows.map((r, i) => `<tr class="${r.id === u.id ? 'me' : ''} ${u.tier === 0 && i === 5 ? 'cut' : ''}"><td>${i + 1}</td><td>${tLink(team(W, r.id))}</td><td class="n">${r.w}-${r.l}</td><td class="n">${r.k - r.d >= 0 ? '+' : ''}${r.k - r.d}</td></tr>`).join('')}</tbody></table>` : `<div class="pad-s">${empty('No table yet')}</div>`)}
    </div>${newsFeed(W)}</div>`;
}

function newsFeed(W) {
  const list = (W.news ?? []).slice(0, 20);
  return card('News', 'Around the world', list.length ? `<div class="news-feed">${list.map(n => `<article class="news-item"><span class="dim small">${fmtDate(n.year, n.day, { day: 'numeric', month: 'short' })}</span><div><b>${esc(n.headline)}</b><p class="dim small">${esc(n.body.split('\n')[0])}</p><div class="row wrap small">${n.clubs.map(id => tLink(team(W, id))).join('')}</div></div></article>`).join('')}</div>` : `<div class="pad-s">${empty('No news yet', 'Stories from around the leagues appear here each week.')}</div>`);
}

// ================= Squad (02, 18, 18b) =================
export function squad(el, args, sub) {
  ({ players: squadPlayers, lineup, contracts, academy })[sub](el, args);
}
let selPlayer = null;
function squadPlayers(el) {
  const W = state.W, u = userTeam(W);
  const first = teamPlayers(W, u), starters = u.starters.map(id => W.players[id]), subs = first.filter(p => !u.starters.includes(p.id));
  const p = W.players[selPlayer] && W.players[selPlayer].teamId === u.id ? W.players[selPlayer] : starters[2];
  const row = (q, role) => `<tr class="link ${q === p ? 'me' : ''}" data-sel="${q.id}"><td class="dim">${role}</td><td><span class="tm">${sprite(q.id, u.color, 28)} <b>${esc(q.name)}</b></span></td><td class="n">${q.age}</td><td class="n">${overall(q)}</td><td><span class="tm">${bar(q.condition, condColor(q.condition), '80px')} <span class="num">${Math.round(q.condition)}</span></span></td><td><span class="tm">${spark(q.form)}</span></td><td class="${q.contractEnd <= W.year ? 'warn' : ''}">${q.contractEnd}</td><td class="n">${money(q.wage)}</td></tr>`;
  el.innerHTML = `<div class="pad split-wide">
    ${card('Roster', `Payroll ${money(payroll(W, u))} of ${money(wageCap(u))} cap · ${first.length}/${FIRST_TEAM_MAX}`, `<div class="scroll"><table><thead><tr><th>Role</th><th>Player</th><th class="n">Age</th><th class="n">OVR</th><th>Condition</th><th>Form</th><th>Contract to</th><th class="n">Wage / yr</th></tr></thead>
      <tbody><tr class="group"><td colspan="8">Starting five</td></tr>${starters.map((q, i) => row(q, ROLES[i])).join('')}<tr class="group"><td colspan="8">Substitutes</td></tr>${subs.map(q => row(q, q.role)).join('') || '<tr><td colspan="8" class="dim">No substitutes. Sign players or promote from the academy.</td></tr>'}</tbody></table></div>`)}
    ${playerPanel(W, p, u)}</div>`;
  on(el, '[data-sel]', 'click', r => { selPlayer = r.dataset.sel; rr(); });
}
function peopleLine(W, p, u) {
  ensurePeople(W, p);
  const mine = u && p.teamId === u.id, known = personaKnown(W, p);
  const mates = mine ? u.starters.filter(id => id !== p.id && W.players[id]) : [];
  return `<h4 class="caps mt">People</h4><p>Personality <b>${known ? p.persona.map(k => PERSONAS[k].split(':')[0]).join(', ') : 'unknown'}</b>${known ? '' : ' <span class="dim small">(scout them, or 60 days at the club)</span>'}${mine ? ` · expects <b>${STATUS_LABEL[statusOf(W, u, p)]}</b> · morale <b>${Math.round(p.morale)}</b>` : ''}${p.wantsOut ? ' · <b class="bad">wants to leave</b>' : ''}</p>
    ${(p.promises ?? []).length ? `<p class="small">Promises: ${p.promises.map(x => `${PROMISES[x.kind]}${x.broken ? ' <b class="bad">(broken)</b>' : ''}`).join(' · ')}</p>` : ''}
    ${mates.length ? `<p class="small">Chemistry ${mates.map(id => { const c = pairChem(u, p.id, id); return `${esc(W.players[id].name)} <b class="${c >= 60 ? 'good' : c < 40 ? 'bad' : ''}">${Math.round(c)}</b>`; }).join(' · ')} <span class="dim">(team ${Math.round(teamChem(u))})</span></p>` : ''}`;
}
function playerPanel(W, p, u) {
  const top = CHAMP_IDS.slice().sort((a, b) => p.prof[b] - p.prof[a]).slice(0, 5);
  return `<section class="card"><div class="pp-head">${sprite(p.id, u?.color ?? '#556', 72)}<div><span class="caps">${p.role} · ${u?.starters.includes(p.id) ? 'Starter' : p.squad === 'academy' ? 'Academy' : 'Substitute'}</span><h2 class="disp xl">${esc(p.name)}</h2><a class="small" href="#/player/${p.id}">Full profile ▸</a></div></div>
    <div class="attrs">${ATTRS.map(k => `<div class="attr"><div class="row between"><span>${ATTR_LABEL[k]}</span><b class="num">${Math.round(p[k])}</b></div>${bar(p[k], p[k] >= 75 ? 'var(--c-good)' : p[k] < 45 ? 'var(--c-warn)' : 'var(--c-text)')}</div>`).join('')}</div>
    <div class="pad-s"><h4 class="caps">Traits</h4><div class="chips">${p.traits.map(t => `<span class="chip">${esc(t)}</span>`).join('') || '<span class="dim">None</span>'}</div>
    <h4 class="caps mt">Champion pool · mastery</h4><div class="pool">${top.map(id => `<div>${champSprite(id, 44)}<span class="small">${CHAMPS[id].name}</span><b class="${MASTERY(p.prof[id]) === 'S' ? 'gold' : ''}">${MASTERY(p.prof[id])}</b></div>`).join('')}</div>
    <h4 class="caps mt">Development</h4><p>Overall <b>${overall(p)}</b> · potential <b>${p.potential}</b> · focus <b>${p.focus ? (ATTR_LABEL[p.focus] ?? CHAMPS[p.focus]?.name) : 'none'}</b> · professionalism ${p.professionalism}/20</p>
    <p>Comfort pool <b>${comfortPool(p).length}</b> champions at A or S${comfortPool(p).length ? ` <span class="dim small">(${comfortPool(p).map(id => CHAMPS[id].name).join(', ')})</span>` : ''} · meta fit <b class="${metaFit(W, p) > 0.05 ? 'good' : metaFit(W, p) < -0.05 ? 'bad' : ''}">${metaFit(W, p) > 0.05 ? 'strong' : metaFit(W, p) < -0.05 ? 'weak' : 'neutral'}</b> on patch ${esc(W.patch?.id ?? '')}</p>${peopleLine(W, p, u)}</div></section>`;
}

function lineup(el) {
  const W = state.W, u = userTeam(W), pool = teamPlayers(W, u);
  el.innerHTML = `<div class="pad"><div class="row between mb"><p class="dim">Pick who starts in each role. Playing off-role costs about 5–12% of their attributes.</p><button class="btn btn-secondary" id="auto">Auto-pick best five</button></div>
    <div class="lineup">${ROLES.map((role, i) => { const p = W.players[u.starters[i]]; return `<section class="card slot-card"><span class="caps">${role}</span>${sprite(p.id, u.color, 64)}
      ${select(`slot="${i}"`, pool.map(q => [q.id, `${q.name} · ${q.role} · ${overall(q, role)}`]), p.id, 'aria-label="Player"')}
      <div class="kv"><span>In this role</span><b>${overall(p, role)}</b></div><div class="kv"><span>Condition</span><b style="color:${condColor(p.condition)}">${Math.round(p.condition)}</b></div></section>`; }).join('')}</div></div>`;
  on(el, 'select[data-slot]', 'change', s => { setStarter(W, +s.dataset.slot, s.value); rr(); });
  $('#auto', el).onclick = () => { autoStarters(W, u); rr(); };
}

function contracts(el, args) {
  const W = state.W, u = userTeam(W);
  const rows = allPlayers(W, u).map(p => ({ p, id: p.id, name: p.name, squad: p.squad, role: p.role, age: p.age, ovr: overall(p), wage: p.wage, end: p.contractEnd, value: valueOf(p), ask: playerAsk(p, u), like: termsLikelihood(W, p, u, { wage: p.wage, years: 2 }) }));
  el.innerHTML = `<div class="pad">${card('Contracts', `Payroll ${money(payroll(W, u))} · cap ${money(wageCap(u))} · room <b class="${capRoom(W, u) < 0 ? 'bad' : ''}">${money(capRoom(W, u))}</b>`, `<div class="scroll">${table('contracts', [
    { key: 'name', label: 'Player', fmt: r => `<span class="tm">${sprite(r.id, u.color, 24)} ${pLink(r.p)}</span>` }, { key: 'squad', label: 'Squad' }, { key: 'role', label: 'Role' }, { key: 'age', label: 'Age', n: 1 }, { key: 'ovr', label: 'OVR', n: 1 },
    { key: 'wage', label: 'Wage / yr', n: 1, fmt: r => money(r.wage) }, { key: 'end', label: 'Ends', n: 1, fmt: r => `<span class="${r.end <= W.year ? 'warn' : ''}">${r.end}</span>` }, { key: 'ask', label: 'Asks', n: 1, fmt: r => money(r.ask) },
    { key: 'value', label: 'Value', n: 1, fmt: r => money(r.value) }, { key: 'act', label: '', fmt: r => `<button class="btn btn-secondary" data-renew="${r.id}">Renew</button> <button class="btn btn-ghost" data-list="${r.id}">${r.p.listed ? 'Unlist' : 'List'}</button> <button class="btn btn-ghost" data-release="${r.id}">Release</button>` },
  ], rows, { defaultSort: { key: 'end', dir: 1 } })}</div>`)}</div>`;
  wireTables(el, rr);
  on(el, '[data-renew]', 'click', b => renewDrawer(W, W.players[b.dataset.renew]));
  on(el, '[data-list]', 'click', b => { const p = W.players[b.dataset.list]; transferList(W, p.id, !p.listed); toast(p.listed ? `${p.name} is transfer-listed. Expect more bids.` : `${p.name} is off the list.`); rr(); });
  on(el, '[data-release]', 'click', b => { const p = W.players[b.dataset.release]; modal(`<div class="ch"><h3>Release ${esc(p.name)}?</h3></div><div class="mbody">Compensation owed: <b>${money(releaseCompensation(W, p))}</b> (half the remaining wages). The player becomes a free agent.</div><div class="mfoot"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-secondary" id="yes">Release</button></div>`, (m, close) => { m.querySelector('#yes').onclick = () => { const err = releasePlayer(W, p.id); close(); toast(err ?? `${p.name} released.`, !!err); rr(); }; }); });
  if (args[0] && W.players[args[0]]) renewDrawer(W, W.players[args[0]]);
}
function renewDrawer(W, p) {
  const u = userTeam(W);
  const t = { years: 2, wage: playerAsk(p, u), bonus: 0, promises: [] };
  modal(`<div class="ch"><h3>Contract · ${esc(p.name)}</h3><span class="meta">Current ${money(p.wage)} / yr to ${p.contractEnd}</span></div><div class="mbody form" id="drawer"></div>
    <div class="mfoot"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="offer">Offer contract</button></div>`, (m, close) => {
    const draw = () => {
      const l = termsLikelihood(W, p, u, t);
      m.querySelector('#drawer').innerHTML = `<label>Length ${seg('years', [[1, '1 year'], [2, '2 years'], [3, '3 years']], t.years)}</label>
        <label>Wage per year <b class="num">${money(t.wage)}</b><input type="range" id="wage" min="${Math.round(p.wage * 0.5)}" max="${Math.round(playerAsk(p, u) * 2)}" step="500" value="${t.wage}"></label>
        <label>Signing bonus <b class="num">${money(t.bonus)}</b><input type="range" id="bonus" min="0" max="${Math.max(0, Math.min(u.cash, playerAsk(p, u) * 2))}" step="1000" value="${t.bonus}"></label>
        <label>Promises <span class="chips">${Object.entries(PROMISES).map(([k, v]) => `<button type="button" class="chip ${t.promises.includes(k) ? 'on' : ''}" data-promise="${k}">${v}</button>`).join('')}</span></label>
        <div><span class="caps">Likelihood</span><div class="meter"><i style="width:${l * 100}%;background:${l >= 0.7 ? 'var(--c-good)' : l >= 0.5 ? 'var(--c-warn)' : 'var(--c-bad)'}"></i></div><b>${pct(l)}</b> <span class="dim">· asks ${money(playerAsk(p, u))} · cap room after: ${money(capRoom(W, u) + p.wage - t.wage)}</span></div>`;
      on(m, '[data-years]', 'click', b => { t.years = +b.dataset.years; draw(); });
      on(m, '[data-promise]', 'click', b => { const k = b.dataset.promise; t.promises = t.promises.includes(k) ? t.promises.filter(x => x !== k) : [...t.promises, k]; draw(); });
      m.querySelector('#wage').oninput = e => { t.wage = +e.target.value; draw(); m.querySelector('#wage').focus(); };
      m.querySelector('#bonus').oninput = e => { t.bonus = +e.target.value; draw(); m.querySelector('#bonus').focus(); };
    };
    draw();
    m.querySelector('#offer').onclick = () => { const r = renew(W, p.id, t); toast(r.msg, !r.ok); if (r.ok) { close(); rr(); } };
  });
}
function academy(el) {
  const W = state.W, u = userTeam(W), ac = academyPlayers(W, u);
  el.innerHTML = `<div class="pad split-wide">${card('Academy', `${ac.length}/${ACADEMY_MAX} · academy facility level ${u.facilities.academy}`, ac.length ? `<table><thead><tr><th>Player</th><th>Role</th><th class="n">Age</th><th class="n">OVR</th><th class="n">POT</th><th>Contract</th><th></th></tr></thead><tbody>${ac.map(p => `<tr><td><span class="tm">${sprite(p.id, u.color, 24)} ${pLink(p)}</span></td><td>${p.role}</td><td class="n">${p.age}</td><td class="n">${overall(p)}</td><td class="n">${p.potential}</td><td>${p.contractEnd}</td><td><button class="btn btn-secondary" data-up="${p.id}">Promote</button></td></tr>`).join('')}</tbody></table>` : `<div class="pad-s">${empty('No academy players', 'Sign young free agents from the market or wait for newgens after the season review.', '<a class="btn btn-secondary" href="#/transfers/market">Find prospects</a>')}</div>`)}
    ${card('First team', `${u.players.length}/${FIRST_TEAM_MAX}`, `<table><tbody>${teamPlayers(W, u).map(p => `<tr><td>${pLink(p)}</td><td>${p.role}</td><td class="n">${overall(p)}</td><td>${u.starters.includes(p.id) ? '<span class="pill hi">Starter</span>' : `<button class="btn btn-ghost" data-down="${p.id}">Send to academy</button>`}</td></tr>`).join('')}</tbody></table>`)}</div>`;
  on(el, '[data-up]', 'click', b => { const e = promote(W, b.dataset.up); toast(e ?? 'Promoted to the first team.', !!e); rr(); });
  on(el, '[data-down]', 'click', b => { const e = demote(W, b.dataset.down); toast(e ?? 'Moved to the academy.', !!e); rr(); });
}

// ================= Training (08) =================
export function training(el) {
  const W = state.W, u = userTeam(W), plan = trainingPlan(u), ps = allPlayers(W, u);
  const fatigue = plan.reduce((n, d) => n + DRILLS[d].fatigue, 0);
  const champSessions = trainingPlan(u).filter(d => d === 'champion').length;
  const focusOpts = [['', 'No focus'], ...ATTRS.map(k => [k, `${ATTR_LABEL[k]} (2 pts)`]), ...CHAMP_IDS.map(id => [id, `${CHAMPS[id].name} (1 pt)`])];
  el.innerHTML = `<div class="pad training">
    ${card('Weekly plan', `10 sessions · weekly fatigue ${fatigue > 0 ? '+' : ''}${fatigue}`, `<div class="sessions">${SESSION_LABEL.map((l, i) => `<div class="session"><span class="caps">${l}</span>${select(`sess="${i}"`, Object.entries(DRILLS).map(([k, d]) => [k, d.name]), plan[i])}<span class="dim small">${DRILLS[plan[i]].attrs.map(a => ATTR_SHORT[a]).join(' · ') || (plan[i] === 'rest' ? 'Recovers condition' : 'Champion mastery')}</span></div>`).join('')}</div>
      <div class="drills">${Object.entries(DRILLS).map(([k, d]) => `<div class="drill"><b>${d.name}</b><span class="dim small">${d.attrs.map(a => ATTR_LABEL[a]).join(', ') || (k === 'rest' ? 'Restores condition' : 'Raises focus-champion mastery')}</span><span class="pill ${d.fatigue > 5 ? 'hi' : ''}">${d.fatigue > 0 ? '+' : ''}${d.fatigue} fatigue</span></div>`).join('')}</div>`)}
    ${card('Individual focus', `<b class="${focusSpent(W, u) > FOCUS_POINTS ? 'bad' : ''}">${FOCUS_POINTS - focusSpent(W, u)}</b> of ${FOCUS_POINTS} focus points left`, `<div class="scroll"><table><thead><tr><th>Player</th><th class="n">OVR</th><th class="n">POT</th><th>Growth room</th><th>Focus</th><th>Condition · next 7 days</th></tr></thead><tbody>
      ${ps.map(p => { const fc = conditionForecast(W, u, p, 7); return `<tr><td><span class="tm">${sprite(p.id, u.color, 24)} ${pLink(p)} <span class="dim small">${p.squad === 'academy' ? 'ACA' : ROLE_SHORT[p.role]}</span></span></td><td class="n">${overall(p)}</td><td class="n">${p.potential}</td><td>${bar((overall(p) / Math.max(1, p.potential)) * 100, 'var(--c-blue)', '90px')}</td><td>${select(`focus="${p.id}"`, focusOpts, p.focus ?? '')}${CHAMPS[p.focus] ? `<span class="dim small"> ${MASTERY(p.prof[p.focus] ?? 0.7)} now${(p.prof[p.focus] ?? 0.7) < 1.08 ? ` · ${(p.prof[p.focus] ?? 0.7) < 0.98 ? `A in ${weeksTo(p.prof[p.focus] ?? 0.7, 0.98, champSessions)} wk` : `S in ${weeksTo(p.prof[p.focus] ?? 0.7, 1.08, champSessions)} wk`}` : ''}</span>` : ''}</td><td><span class="fc">${fc.map(c => `<i style="height:${c / 5}px;background:${condColor(c)}" title="${c}"></i>`).join('')}</span> <span class="num small">${Math.round(p.condition)}→${fc.at(-1)}</span></td></tr>`; }).join('')}</tbody></table></div>`)}
  </div>`;
  on(el, 'select[data-sess]', 'change', s => { setSession(W, +s.dataset.sess, s.value); rr(); });
  on(el, 'select[data-focus]', 'change', s => { const e = setFocus(W, s.dataset.focus, s.value); if (e) toast(e, true); rr(); });
}

// ================= Tactics (09) =================
export function tactics(el) {
  const W = state.W, u = userTeam(W), plan = u.plan;
  el.innerHTML = `<div class="pad split-wide">
    ${card('Game plan', `Preset ${select('preset', [['', 'Custom'], ...Object.entries(PLAN_PRESETS).map(([k, p]) => [k, p.name])], Object.keys(PLAN_PRESETS).find(k => PLAN_PRESETS[k].name === plan.name) ?? '')}`, `<div class="pad-s form">
      <p class="dim">The plan is fixed for the whole game. Team Aggression can shift the posture one step.</p>
      <label>Approach ${seg('preset', [['hold_the_pit', 'Hold the pit'], ['hunt', 'Hunt'], ['starve', 'Starve']], plan.preset)}<small class="dim">Hold: group on the centre point. Hunt: chase fights and take enemy-held points. Starve: spread over the points and avoid fights.</small></label>
      <label>Posture ${seg('posture', [['aggressive', 'Aggressive'], ['balanced', 'Balanced'], ['defensive', 'Defensive']], plan.posture)}</label>
      <label>Target focus ${seg('focus', [['auto', 'Auto'], ...ROLES.map(r => [r, ROLE_SHORT[r]])], plan.focus)}</label>
      <label>Protect the carry ${seg('protect', [[true, 'On'], [false, 'Off']], plan.protect)}</label>
      <label>Scrim partner ${select('scrim', [['', 'None'], ...scrimPartners(W, u).map(t => [t.id, `${t.name} (rep ${t.rep})`])], u.scrim ?? '')}<small class="dim">Weekly: starters gain mastery on their best champions (more against stronger clubs), chemistry grows, and you learn the partner's comfort picks. Costs a little condition.</small></label></div>`)}
    ${card('Lanes and mastery', `Coach rating ${coachRating(u)}/20`, `<table><thead><tr><th>Lane</th><th>Player</th><th>Best champions</th></tr></thead><tbody>${u.starters.map((id, i) => { const p = W.players[id], top = CHAMP_IDS.slice().sort((a, b) => p.prof[b] - p.prof[a]).slice(0, 3); return `<tr><td>${select(`lane="${i}"`, ROLES.map((r, j) => [j, r]), i)}</td><td>${pLink(p)}</td><td class="mastery">${top.map(c => `<span title="${CHAMPS[c].name}">${champSprite(c, 24)}<b class="${MASTERY(p.prof[c]) === 'S' ? 'gold' : ''}">${MASTERY(p.prof[c])}</b></span>`).join('')}</td></tr>`; }).join('')}</tbody></table>
      <p class="pad-s dim small">Lane swap: pick a different lane for a player and they trade places with whoever holds it.</p>`)}</div>`;
  const set = (k, v) => { plan[k] = v; plan.name = 'Custom'; rr(); };
  for (const k of ['preset', 'posture', 'focus']) on(el, `[data-${k}]:not(select)`, 'click', b => set(k, b.dataset[k]));
  on(el, '[data-protect]', 'click', b => set('protect', b.dataset.protect === 'true'));
  $('select[data-scrim]', el)?.addEventListener('change', e => { u.scrim = e.target.value || null; toast(u.scrim ? 'Scrims booked for Mondays.' : 'Scrims cancelled.'); });
  $('select[data-preset]', el).onchange = e => { if (e.target.value) { u.plan = clonePlan(PLAN_PRESETS[e.target.value]); rr(); } };
  on(el, 'select[data-lane]', 'change', s => { const from = +s.dataset.lane, to = +s.value; [u.starters[from], u.starters[to]] = [u.starters[to], u.starters[from]]; rr(); });
}

// ================= Transfers (10, 10b) =================
const mf = { role: '', region: '', maxAge: 40, free: false, listed: false, q: '' };
export function transfers(el, args, sub) {
  const W = state.W, u = userTeam(W);
  if (sub === 'offers') return offersView(el, W, u);
  const pool = sub === 'shortlist' ? W.shortlist.map(id => W.players[id]).filter(Boolean)
    : Object.values(W.players).filter(p => !p.retired && p.teamId !== u.id && (!mf.role || p.role === mf.role) && (!mf.region || p.region === mf.region) && p.age <= mf.maxAge && (!mf.free || !p.teamId) && (!mf.listed || p.listed) && (!mf.q || p.name.toLowerCase().includes(mf.q.toLowerCase())));
  const rows = pool.map(p => { const k = knowledge(W, p); return { p, id: p.id, name: p.name, team: team(W, p.teamId)?.tag ?? 'FA', role: p.role, age: p.age, ab: (k.ability[0] + k.ability[1]) / 2, abTxt: k.exact ? `${k.ability[0]}` : `${k.ability[0]}–${k.ability[1]}`, pot: (k.potential[0] + k.potential[1]) / 2, potTxt: k.exact ? `${k.potential[0]}` : `${k.potential[0]}–${k.potential[1]}`, price: p.teamId ? askingPrice(W, p) : 0, wage: p.wage, k }; });
  el.innerHTML = `<div class="pad">
    ${sub === 'market' ? `<div class="filters"><input type="search" id="q" placeholder="Search players" value="${esc(mf.q)}" aria-label="Search players">${select('frole', [['', 'All roles'], ...ROLES.map(r => [r, r])], mf.role)}${select('fregion', [['', 'All regions'], ...REGIONS.map(r => [r, r])], mf.region)}${select('fage', [[40, 'Any age'], [19, 'Age ≤ 19'], [22, 'Age ≤ 22'], [25, 'Age ≤ 25']], mf.maxAge)}
      <button class="chip ${mf.free ? 'on' : ''}" id="ffree">Free agents</button><button class="chip ${mf.listed ? 'on' : ''}" id="flisted">Transfer-listed</button><span class="sp"></span><span class="dim">Cash ${money(u.cash)} · cap room ${money(capRoom(W, u))}</span></div>` : ''}
    ${card(sub === 'shortlist' ? 'Shortlist' : 'Market', `${rows.length} players · scouting costs ${money(SCOUT_COST)} and takes ${scoutDays(u)} days`, rows.length ? `<div class="scroll">${table(`mkt-${sub}`, [
      { key: 'name', label: 'Player', fmt: r => `<span class="tm">${sprite(r.id, team(W, r.p.teamId)?.color ?? '#556', 24)} ${pLink(r.p)} ${r.p.listed ? '<span class="pill">Listed</span>' : ''}</span>` }, { key: 'team', label: 'Club' }, { key: 'role', label: 'Role' }, { key: 'age', label: 'Age', n: 1 },
      { key: 'ab', label: 'Ability', n: 1, fmt: r => `${r.abTxt}${r.k.scouting ? ' <span class="dim small">scouting</span>' : ''}` }, { key: 'pot', label: 'Potential', n: 1, fmt: r => r.potTxt }, { key: 'price', label: 'Asking', n: 1, fmt: r => (r.p.teamId ? money(r.price) : '<span class="good">Free</span>') }, { key: 'wage', label: 'Wage', n: 1, fmt: r => money(r.wage) },
      { key: 'act', label: '', fmt: r => `<button class="btn btn-ghost" data-star="${r.id}" aria-label="Shortlist">${W.shortlist.includes(r.id) ? '★' : '☆'}</button>${r.k.exact || r.k.scouting ? '' : `<button class="btn btn-ghost" data-scout="${r.id}">Scout</button>`}<a class="btn btn-secondary" href="#/negotiate/${r.id}">${r.p.teamId ? 'Bid' : 'Sign'}</a>` },
    ], rows, { defaultSort: { key: 'ab', dir: -1 }, limit: 250 })}</div>` : `<div class="pad-s">${empty(sub === 'shortlist' ? 'Your shortlist is empty' : 'No players match these filters', sub === 'shortlist' ? 'Star players on the market to track them here.' : 'Loosen the filters to see more players.')}</div>`)}</div>`;
  wireTables(el, rr);
  if (sub === 'market') {
    $('#q', el).onchange = e => { mf.q = e.target.value; rr(); };
    $('select[data-frole]', el).onchange = e => { mf.role = e.target.value; rr(); };
    $('select[data-fregion]', el).onchange = e => { mf.region = e.target.value; rr(); };
    $('select[data-fage]', el).onchange = e => { mf.maxAge = +e.target.value; rr(); };
    $('#ffree', el).onclick = () => { mf.free = !mf.free; rr(); };
    $('#flisted', el).onclick = () => { mf.listed = !mf.listed; rr(); };
  }
  on(el, '[data-star]', 'click', b => { toggleShortlist(W, b.dataset.star); rr(); });
  on(el, '[data-scout]', 'click', b => { const e = scout(W, b.dataset.scout); toast(e ?? `Scouting started. Report in ${scoutDays(u)} days.`, !!e); rr(); });
}
function offersView(el, W, u) {
  const open = W.offers.filter(o => o.status === 'open' && !o.kind), recentClosed = W.offers.filter(o => o.status !== 'open' && !o.kind).slice(-8).reverse();
  const listed = allPlayers(W, u).filter(p => p.listed);
  el.innerHTML = `<div class="pad split-wide">
    ${card('Offers for your players', `${open.length} open · offers expire after 14 days`, open.length ? `<table><thead><tr><th>Player</th><th>From</th><th class="n">Fee</th><th class="n">Their wage</th><th>Expires</th><th></th></tr></thead><tbody>${open.map(o => { const p = W.players[o.pid]; return `<tr><td>${pLink(p)} <span class="dim">${p.role} · ${overall(p)}</span></td><td>${tLink(team(W, o.from))}</td><td class="n">${money(o.fee)}</td><td class="n">${money(o.wage)}</td><td class="warn">${o.expires - W.day} days</td><td><button class="btn btn-ghost" data-rej="${o.id}">Reject</button><button class="btn btn-primary" data-acc="${o.id}">Accept</button></td></tr>`; }).join('')}</tbody></table>` : `<div class="pad-s">${empty('No open offers', 'Transfer-list a player on the Contracts screen to draw bids.')}</div>`)
    + (recentClosed.length ? card('Recent', '', `<table><tbody>${recentClosed.map(o => `<tr><td>${esc(W.players[o.pid]?.name)}</td><td>${esc(team(W, o.from)?.name)}</td><td class="n">${money(o.fee)}</td><td class="${o.status === 'accepted' ? 'good' : 'dim'}">${o.status}</td></tr>`).join('')}</tbody></table>`) : '')}
    ${card('Transfer list', `${listed.length} listed`, listed.length ? `<table><tbody>${listed.map(p => `<tr><td>${pLink(p)}</td><td class="n">${money(valueOf(p))}</td><td><button class="btn btn-ghost" data-unlist="${p.id}">Unlist</button></td></tr>`).join('')}</tbody></table>` : `<div class="pad-s">${empty('Nobody listed', 'Listed players draw more and cheaper bids.')}</div>`)}</div>`;
  on(el, '[data-acc]', 'click', b => { const e = acceptOffer(W, b.dataset.acc); toast(e ?? 'Transfer completed.', !!e); rr(); });
  on(el, '[data-rej]', 'click', b => { rejectOffer(W, b.dataset.rej); rr(); });
  on(el, '[data-unlist]', 'click', b => { transferList(W, b.dataset.unlist, false); rr(); });
}

// Negotiation: fee with the club (counter-offers, 3 attempts, optional part-exchange), then the player's terms.
export function negotiate(el, [pid]) {
  const W = state.W, u = userTeam(W), p = W.players[pid];
  if (!p) return go('#/transfers/market');
  const seller = team(W, p.teamId), neg = W.negotiations[pid], k = knowledge(W, p);
  const stage = !seller || neg?.stage === 'terms' ? 'terms' : 'fee';
  const st = negState[pid] ??= { fee: seller ? Math.round(askingPrice(W, p) * 0.85 / 1000) * 1000 : 0, swap: '', wage: playerAsk(p, u), years: 2, bonus: 0, promises: [], msg: '' };
  const l = termsLikelihood(W, p, u, st);
  el.innerHTML = `<div class="pad split-wide">
    <section class="card"><div class="pp-head">${sprite(p.id, seller?.color ?? '#556', 72)}<div><span class="caps">${p.role} · age ${p.age} · ${esc(p.region)}</span><h2 class="disp xl">${esc(p.name)}</h2>${tLink(seller)}</div></div>
      <div class="pad-s"><div class="kv"><span>Ability</span><b>${k.exact ? k.ability[0] : `${k.ability[0]}–${k.ability[1]}`}</b></div><div class="kv"><span>Potential</span><b>${k.exact ? k.potential[0] : `${k.potential[0]}–${k.potential[1]}`}</b></div>
      <div class="kv"><span>Value</span><b>${money(valueOf(p))}</b></div>${seller ? `<div class="kv"><span>Asking price</span><b>${money(askingPrice(W, p))}</b></div>` : ''}<div class="kv"><span>Current wage</span><b>${money(p.wage)}</b></div><div class="kv"><span>Contract to</span><b>${p.contractEnd}</b></div>
      <div class="kv"><span>Traits</span><b>${p.traits.map(esc).join(', ') || '—'}</b></div>${k.exact ? '' : `<p class="dim small">Estimates narrow as your scouts watch the player. ${W.scouting[pid] ? 'Scouting in progress.' : `<button class="btn btn-ghost" id="sc">Scout (${money(SCOUT_COST)})</button>`}</p>`}</div></section>
    <section class="card"><div class="ch"><h3>${stage === 'fee' ? 'Step 1 · Fee' : 'Step 2 · Player terms'}</h3><span class="meta">${seller ? `Attempts left ${neg?.attempts ?? 3}` : 'Free agent: no fee'}</span></div>
      <div class="pad-s form">${stage === 'fee' ? `
        <label>Fee <b class="num">${money(st.fee)}</b><input type="range" id="fee" min="0" max="${Math.max(askingPrice(W, p) * 2, 10000)}" step="1000" value="${st.fee}"></label>
        <label>Part-exchange (trade) ${select('swap', [['', 'None'], ...teamPlayers(W, u).filter(q => !u.starters.includes(q.id)).map(q => [q.id, `${q.name} · ${q.role} · ${money(valueOf(q))}`])], st.swap)}</label>
        <div class="row"><button class="btn btn-primary" id="bid">Submit bid</button><span class="dim">Cash ${money(u.cash)}</span></div>`
        : `<label>Length ${seg('years', [[1, '1 year'], [2, '2 years'], [3, '3 years']], st.years)}</label>
        <label>Wage per year <b class="num">${money(st.wage)}</b><input type="range" id="wage" min="5000" max="${playerAsk(p, u) * 2}" step="500" value="${st.wage}"></label>
        <label>Signing bonus <b class="num">${money(st.bonus)}</b><input type="range" id="bonus" min="0" max="${Math.max(0, Math.min(u.cash, playerAsk(p, u) * 2))}" step="1000" value="${st.bonus}"></label>
        <label>Promises <span class="chips">${Object.entries(PROMISES).map(([k, v]) => `<button type="button" class="chip ${st.promises.includes(k) ? 'on' : ''}" data-promise="${k}">${v}</button>`).join('')}</span></label>
        <div><span class="caps">Likelihood</span><div class="meter"><i style="width:${l * 100}%;background:${l >= 0.7 ? 'var(--c-good)' : l >= 0.5 ? 'var(--c-warn)' : 'var(--c-bad)'}"></i></div><b>${pct(l)}</b> <span class="dim">· asks ${money(playerAsk(p, u))} · cap room ${money(capRoom(W, u))}</span></div>
        <div class="row"><button class="btn btn-primary" id="terms">Offer terms</button></div>`}
        ${st.msg ? `<div class="notice ${st.bad ? 'bad' : ''}">${esc(st.msg)}</div>` : ''}</div>
      <div class="mfoot"><a class="btn btn-ghost" href="#/transfers/market">◂ Market</a></div></section></div>`;
  $('#sc', el)?.addEventListener('click', () => { const e = scout(W, pid); toast(e ?? 'Scouting started.', !!e); rr(); });
  $('#fee', el)?.addEventListener('input', e => { st.fee = +e.target.value; e.target.previousElementSibling.textContent = money(st.fee); });
  $('select[data-swap]', el)?.addEventListener('change', e => { st.swap = e.target.value; });
  $('#bid', el)?.addEventListener('click', () => {
    const r = clubResponse(W, pid, { fee: st.fee, swapPid: st.swap || null });
    st.msg = r.msg; st.bad = r.result !== 'accept';
    if (r.result === 'counter') st.fee = r.counter;
    rr();
  });
  on(el, '[data-years]', 'click', b => { st.years = +b.dataset.years; rr(); });
  on(el, '[data-promise]', 'click', b => { const k = b.dataset.promise; st.promises = st.promises.includes(k) ? st.promises.filter(x => x !== k) : [...st.promises, k]; rr(); });
  $('#wage', el)?.addEventListener('change', e => { st.wage = +e.target.value; rr(); });
  $('#bonus', el)?.addEventListener('change', e => { st.bonus = +e.target.value; rr(); });
  $('#terms', el)?.addEventListener('click', () => {
    const r = offerTerms(W, pid, st);
    if (r.ok) { delete negState[pid]; toast(r.msg); go(`#/player/${pid}`); return; }
    st.msg = r.msg; st.bad = true; rr();
  });
}
const negState = {};

// ================= Club (11) =================
export function club(el) {
  const W = state.W, u = userTeam(W), led = ledger(u).slice(-6);
  initManager(W);
  const maxAbs = Math.max(1, ...led.map(m => Math.abs(m.net)));
  el.innerHTML = `<div class="pad g2 club">
    ${card('Finances', `Cash <b class="${u.cash < 0 ? 'bad' : ''}">${money(u.cash)}</b>`, `<div class="pad-s"><div class="kv"><span>Payroll</span><b>${money(payroll(W, u))} / ${money(wageCap(u))} cap</b></div>${bar(payroll(W, u) / wageCap(u) * 100, payroll(W, u) > wageCap(u) ? 'var(--c-bad)' : 'var(--c-blue)')}
      <div class="kv mt"><span>Sponsor income</span><b>${money(u.sponsors.reduce((n, s) => n + s.weekly, 0))} / week</b></div>
      <h4 class="caps mt">Net by month</h4>${led.length ? `<div class="months">${led.map(m => `<div class="month" title="${m.month}: ${money(m.net)}"><i style="height:${Math.abs(m.net) / maxAbs * 60}px;background:${m.net >= 0 ? 'var(--c-good)' : 'var(--c-bad)'}"></i><span class="small dim">${m.month.slice(5)}</span><span class="small num">${money(m.net)}</span></div>`).join('')}</div>` : '<p class="dim">No transactions yet.</p>'}
      <p class="dim small"><a href="#/stats/economy">Full ledger ▸</a></p></div>`)}
    ${card('Board', `Confidence <b class="${W.board.conf < 25 ? 'bad' : W.board.conf < 40 ? 'warn' : 'good'}">${Math.round(W.board.conf)}</b> · ${confLabel(W.board.conf)}`, `<div class="pad-s">${bar(W.board.conf, W.board.conf < 25 ? 'var(--c-bad)' : W.board.conf < 40 ? 'var(--c-warn)' : 'var(--c-good)')}
      <p class="dim small">Below 15 at the end of a split, or below 5 at any time, means dismissal.</p>
      <div class="kv"><span>Season target</span><b>${esc(u.target)}</b></div>${(u.goals ?? []).map(g => `<div class="kv"><span>Goal by ${g.by}</span><b class="${g.done > 0 ? 'good' : g.done < 0 ? 'bad' : ''}">${esc(g.text)}${g.done > 0 ? ' ✓' : g.done < 0 ? ' ✗' : ''}</b></div>`).join('')}
      <div class="kv"><span>Club reputation</span><b>${u.rep}</b></div><div class="kv"><span>Trophies</span><b>${u.trophies.map(esc).join(', ') || 'none yet'}</b></div>
      <div class="kv"><span>History</span><b>${u.history.map(h => `${h.year}: ${h.best < 99 ? ordinal(h.best) : '—'} ${h.met ? '✓' : '✗'}`).join(' · ') || '—'}</b></div>
      <h4 class="caps mt">Recent board mood</h4><div class="small">${(W.board.log ?? []).slice(0, 5).map(l => `<div><span class="${l.d >= 0 ? 'good' : 'bad'} num">${l.d >= 0 ? '+' : ''}${l.d}</span> ${esc(l.why)}</div>`).join('') || '<span class="dim">Nothing yet.</span>'}</div>
      <div class="row mt"><button class="btn btn-secondary" id="budget" ${u.capBonus ? 'disabled' : ''}>${u.capBonus ? 'Budget raised this season' : 'Ask for +10% wage budget'}</button></div></div>`)}
    ${card('Manager', `Reputation <b>${W.manager.rep}</b>`, `<div class="pad-s">${W.manager.offers.filter(o => o.kind === 'approach').map(o => { const t = team(W, o.teamId); return `<div class="kv"><span class="tm">${crest(t, 20)} <b>${esc(t.name)}</b> want you (rep ${t.rep}, ${esc(tierName(t.region, t.tier))})</span><button class="btn btn-secondary" data-job="${t.id}">Accept</button></div>`; }).join('')}
      <table><thead><tr><th>Club</th><th>Years</th><th class="n">W-L</th><th class="n">Trophies</th><th>Left</th></tr></thead><tbody>${[...W.manager.history, { club: u.name, from: W.manager.since, to: 'now', w: '', l: '', trophies: '', how: '' }].map(h => `<tr><td>${esc(h.club)}</td><td>${h.from}–${h.to}</td><td class="n">${h.w === '' ? '' : `${h.w}-${h.l}`}</td><td class="n">${h.trophies}</td><td class="${h.how === 'sacked' ? 'bad' : ''}">${h.how}</td></tr>`).join('')}</tbody></table></div>`)}
    ${card('Facilities', u.build ? `Building: ${FACILITIES[u.build.key].name}, done ${fmtDate(u.build.year, u.build.done)}` : 'One build at a time', `<table><tbody>${Object.entries(FACILITIES).map(([k, f]) => `<tr><td><b>${f.name}</b><div class="dim small">${f.effect}</div></td><td><span class="dots">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= u.facilities[k] ? 'on' : ''}"></i>`).join('')}</span></td><td class="n">${u.facilities[k] >= 5 ? 'Max' : `${money(f.cost(u.facilities[k] + 1))} · ${f.days(u.facilities[k] + 1)} d`}</td><td>${u.facilities[k] < 5 ? `<button class="btn btn-secondary" data-build="${k}" ${u.build ? 'disabled' : ''}>Upgrade</button>` : ''}</td></tr>`).join('')}</tbody></table>`)}
    ${card('Staff and sponsors', '', `<table><tbody>${Object.entries(STAFF_ROLES).map(([k, label]) => { const c = u.staff[k]; return `<tr><td>${label}</td>${c ? `<td><b>${esc(c.name)}</b></td><td class="n">${c.rating}/20</td><td class="n">${money(c.wage)}</td><td><button class="btn btn-ghost" data-fire="${k}">Release</button></td>` : `<td colspan="3" class="warn">Open role</td><td><button class="btn btn-secondary" data-hire="${k}">Hire</button></td>`}</tr>`; }).join('')}
      ${u.sponsors.map(s => `<tr><td>Sponsor</td><td><b>${esc(s.name)}</b></td><td class="n">${money(s.weekly)}/wk</td><td class="n">to ${s.until}</td><td></td></tr>`).join('')}</tbody></table>`)}
  </div>`;
  on(el, '[data-build]', 'click', b => { const e = upgradeFacility(W, b.dataset.build); toast(e ?? 'Construction started.', !!e); rr(); });
  $('#budget', el)?.addEventListener('click', () => { const r = requestBudget(W); toast(r.msg, !r.ok); rr(); });
  on(el, '[data-job]', 'click', b => { const t = team(W, b.dataset.job); if (confirm(`Leave ${u.name} for ${t.name}?`)) { takeJob(W, t.id, setUserTeam); toast(`Welcome to ${t.name}.`); go('#/home'); } });
  on(el, '[data-fire]', 'click', b => { fireStaff(W, b.dataset.fire); rr(); });
  on(el, '[data-hire]', 'click', b => {
    const role = b.dataset.hire;
    modal(`<div class="ch"><h3>Hire ${STAFF_ROLES[role]}</h3><span class="meta">Candidates refresh weekly</span></div><table><tbody>${staffMarket(W).map(c => `<tr><td>${esc(c.name)}</td><td class="n">${c.rating}/20</td><td class="n">${money(c.wage)}/yr</td><td><button class="btn btn-secondary" data-pick="${c.id}">Hire</button></td></tr>`).join('')}</tbody></table><div class="mfoot"><button class="btn btn-ghost" data-close>Cancel</button></div>`,
      (m, close) => on(m, '[data-pick]', 'click', x => { const e = hireStaff(W, role, x.dataset.pick); toast(e ?? 'Hired.', !!e); close(); rr(); }));
  });
}

// ================= Player and team pages =================
export function player(el, [pid]) {
  const W = state.W, p = W.players[pid];
  if (!p) { el.innerHTML = `<div class="pad">${empty('Player not found', 'They may have retired and left the records.')}</div>`; return; }
  const t = team(W, p.teamId), k = knowledge(W, p), own = t?.id === W.userTeamId;
  const comps = Object.entries(p.stats).map(([key, a]) => ({ key, name: W.comps[key]?.name ?? key, year: +key.slice(0, 4), ...a })).sort((a, b) => b.year - a.year);
  el.innerHTML = `<div class="pad split-wide">
    <div class="stack">
      <section class="card"><div class="pp-head">${sprite(p.id, t?.color ?? '#556', 88)}<div><span class="caps">${p.role} (also ${p.role2}) · age ${p.age} · ${esc(p.region)}</span><h1 class="disp xxl">${esc(p.name)}</h1>${tLink(t)} ${p.retired ? '<span class="pill">Retired</span>' : ''}</div><span class="sp"></span>
        ${!own && !p.retired ? `<a class="btn btn-primary" href="#/negotiate/${p.id}">${t ? 'Make a bid' : 'Offer contract'}</a>` : ''}</div>
        <div class="pad-s row wrap"><span class="kvc"><span class="caps">Overall</span><b>${k.exact ? overall(p) : `${k.ability[0]}–${k.ability[1]}`}</b></span><span class="kvc"><span class="caps">Potential</span><b>${k.exact ? p.potential : `${k.potential[0]}–${k.potential[1]}`}</b></span>
        <span class="kvc"><span class="caps">Value</span><b>${money(valueOf(p))}</b></span><span class="kvc"><span class="caps">Wage</span><b>${money(p.wage)}</b></span><span class="kvc"><span class="caps">Contract</span><b>${p.contractEnd}</b></span><span class="kvc"><span class="caps">Form</span>${spark(p.form, 60, 18)}</span></div></section>
      ${card('Stats by competition', '', comps.length ? `<div class="scroll"><table><thead><tr><th>Competition</th><th class="n">GP</th><th class="n">W</th><th class="n">KDA</th><th class="n">DMG/m</th><th class="n" title="Seconds on capture points a minute">Pts s/m</th><th class="n">Rating</th><th class="n">MVP</th></tr></thead><tbody>${comps.map(c => `<tr><td>${esc(c.name)}</td><td class="n">${c.gp}</td><td class="n">${c.w}</td><td class="n">${num((c.k + c.a) / Math.max(1, c.d), 2)}</td><td class="n">${Math.round(c.dmg / c.mins)}</td><td class="n">${num(c.obj / c.mins)}</td><td class="n">${num(c.rating / c.gp, 2)}</td><td class="n">${c.mvp}</td></tr>`).join('')}</tbody></table></div>` : `<div class="pad-s">${empty('No games yet')}</div>`)}
      ${card('Recent games', '', p.history.length ? `<table><tbody>${p.history.map(h => `<tr><td class="dim">${fmtDate(h.year, h.day)}</td><td>vs ${esc(team(W, h.opp)?.name ?? '?')}</td><td><span class="tm">${champSprite(h.champ, 20)} ${CHAMPS[h.champ]?.name}</span></td><td class="n">${h.k}/${h.d}/${h.a}</td><td class="n">${h.rating}</td><td><span class="f ${h.win ? 'w' : 'l'}">${h.win ? 'W' : 'L'}</span></td><td>${W.reports[h.g] ? `<a href="#/report/${h.g}">Report</a>` : ''}</td></tr>`).join('')}</tbody></table>` : `<div class="pad-s">${empty('No games yet')}</div>`)}
    </div>
    <div class="stack">${k.exact || own ? playerPanel(W, p, t) : card('Attributes', 'Unknown', `<div class="pad-s">${empty('Scout to reveal attributes', `Ranges narrow over ${scoutDays(userTeam(W))} days of scouting.`, W.scouting[pid] ? '<span class="dim">Scouting in progress</span>' : `<button class="btn btn-secondary" id="sc">Scout (${money(SCOUT_COST)})</button>`)}</div>`)}
      ${card('Awards and honours', '', `<div class="pad-s">${p.awards.map(a => `<div class="award">🏆 ${esc(a)}</div>`).join('') || '<span class="dim">None yet</span>'}</div>`)}</div></div>`;
  $('#sc', el)?.addEventListener('click', () => { const e = scout(W, pid); toast(e ?? 'Scouting started.', !!e); rr(); });
}
export function teamView(el, [tid]) {
  const W = state.W, t = team(W, tid);
  if (!t) { el.innerHTML = `<div class="pad">${empty('Club not found')}</div>`; return; }
  el.innerHTML = `<div class="pad split-wide">
    <section class="card"><div class="pp-head">${crest(t, 72)}<div><span class="caps">${esc(tierName(t.region, t.tier))} · rep ${t.rep}</span><h1 class="disp xxl">${esc(t.name)}</h1><span class="dim">Strength ${strength(W, t)} · ${money(t.cash)} · coach ${coachRating(t)}/20</span></div></div>
      <table><thead><tr><th>Role</th><th>Player</th><th class="n">Age</th><th class="n">OVR</th><th>Contract</th></tr></thead><tbody>${t.starters.map((id, i) => { const p = W.players[id]; return `<tr><td class="dim">${ROLES[i]}</td><td><span class="tm">${sprite(p.id, t.color, 24)} ${pLink(p)}</span></td><td class="n">${p.age}</td><td class="n">${t.id === W.userTeamId || knowledge(W, p).exact ? overall(p) : '?'}</td><td>${p.contractEnd}</td></tr>`; }).join('')}
      ${teamPlayers(W, t).filter(p => !t.starters.includes(p.id)).map(p => `<tr><td class="dim">Sub</td><td>${pLink(p)}</td><td class="n">${p.age}</td><td class="n">${knowledge(W, p).exact ? overall(p) : '?'}</td><td>${p.contractEnd}</td></tr>`).join('')}</tbody></table></section>
    ${card('Honours', '', `<div class="pad-s">${t.trophies.map(x => `<div class="award">🏆 ${esc(x)}</div>`).join('') || '<span class="dim">No trophies yet</span>'}</div>`)}</div>`;
}
