// Squad, contracts, transfers, scouting, training, development, staff, facilities, sponsors and finances.
// User actions return an error string (or null / a result object). No DOM.
import { ROLES, CHAMPS, CHAMP_IDS, ATTRS, REGIONS, REGION_INFO } from './data.js';
import { metaFit } from './meta.js';
import { scrimWeekly } from './scrims.js';
import { weeklyDigest } from './highlights.js';
import { newsTransfer, newsWeekly } from './news.js';
import { has, chemJoin, addPromises, ensurePeople, PERSONAS, peopleWeekly } from './people.js';
import {
  rand, randInt, pick, shuffle, overall, clamp, wageFor, valueOf, makePlayer, makeStaff, team, userTeam, teamPlayers, academyPlayers,
  allPlayers, autoStarters, mail, payroll, wageCap, FIRST_TEAM_MAX, ACADEMY_MAX, ROSTER_MIN, FACILITIES, STAFF_ROLES, sponsorName, sponsorBase, TRAITS, fmtDate,
} from './world.js';

// ---------------- Finances ----------------
export const fmtMoney = n => (Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : `$${Math.round(n / 1000)}k`);
const monthKey = W => `${W.year}-${String(new Date(Date.UTC(W.year, 0, 1 + W.day)).getUTCMonth() + 1).padStart(2, '0')}`;
export function money(W, t, amount, cat) {
  t.cash += amount;
  if (t.id !== W.userTeamId) return;
  const m = (t.fin[monthKey(W)] ??= {});
  m[cat] = (m[cat] ?? 0) + amount;
}
export const capRoom = (W, t) => wageCap(t) - payroll(W, t);

// ---------------- Training ----------------
export const DRILLS = {
  laning: { name: 'Laning drills', attrs: ['laning', 'mech'], fatigue: 6 },
  mechanics: { name: 'Mechanics', attrs: ['mech', 'positioning'], fatigue: 7 },
  teamfight: { name: 'Teamfight scrim', attrs: ['teamwork', 'positioning'], fatigue: 8 },
  vod: { name: 'VOD review', attrs: ['decision', 'vision'], fatigue: 2 },
  macro: { name: 'Macro rotations', attrs: ['decision', 'vision', 'teamwork'], fatigue: 4 },
  mental: { name: 'Mental coaching', attrs: ['resilience', 'clutch'], fatigue: 1 },
  aggression: { name: 'Skirmish drills', attrs: ['aggression', 'mech'], fatigue: 7 },
  champion: { name: 'Champion practice', attrs: [], fatigue: 5 },
  rest: { name: 'Rest', attrs: [], fatigue: -12 },
};
export const DEFAULT_PLAN = ['laning', 'vod', 'mechanics', 'teamfight', 'macro', 'champion', 'teamfight', 'mental', 'vod', 'rest'];
export const SESSION_LABEL = ['Mon AM', 'Mon PM', 'Tue AM', 'Tue PM', 'Wed AM', 'Wed PM', 'Thu AM', 'Thu PM', 'Fri AM', 'Fri PM'];
export const FOCUS_COST = { attr: 2, champ: 1 };
export const FOCUS_POINTS = 15;
export const trainingPlan = t => t.training.plan ?? DEFAULT_PLAN;
export const focusSpent = (W, t) => allPlayers(W, t).reduce((n, p) => n + (p.focus ? (CHAMP_IDS.includes(p.focus) ? FOCUS_COST.champ : FOCUS_COST.attr) : 0), 0);

export function setFocus(W, pid, focus) {
  const u = userTeam(W), p = W.players[pid];
  const old = p.focus; p.focus = null;
  const cost = focus ? (CHAMP_IDS.includes(focus) ? FOCUS_COST.champ : FOCUS_COST.attr) : 0;
  if (focusSpent(W, u) + cost > FOCUS_POINTS) { p.focus = old; return `Not enough focus points (${FOCUS_POINTS - focusSpent(W, u)} left). They refill each Monday; swapping a focus is free.`; }
  p.focus = focus || null;
  return null;
}
export function setSession(W, i, drill) { const u = userTeam(W); u.training.plan = [...trainingPlan(u)]; u.training.plan[i] = drill; }

// Daily: weekday sessions cost condition; weekends and rest restore it. Matches cost condition separately.
export function dailyCondition(W, t, dow) {
  const plan = trainingPlan(t);
  const sessions = dow >= 1 && dow <= 5 ? [plan[(dow - 1) * 2], plan[(dow - 1) * 2 + 1]] : [];
  const fatigue = sessions.reduce((n, d) => n + DRILLS[d].fatigue, 0);
  for (const p of allPlayers(W, t)) {
    const prof = 1.2 - p.professionalism / 50;
    p.condition = clamp(p.condition - Math.max(fatigue, -20) * prof * 0.5 + (dow === 0 || dow === 6 ? 9 : 5), 20, 100);
  }
}
export const matchFatigue = (W, pids) => { for (const pid of pids) { const p = W.players[pid]; if (p) p.condition = clamp(p.condition - 7, 20, 100); } };

// Condition forecast for the next n days (for the training screen).
export function conditionForecast(W, t, p, days) {
  let c = p.condition; const out = [];
  for (let d = 1; d <= days; d++) {
    const dow = (new Date(Date.UTC(W.year, 0, 1 + W.day + d)).getUTCDay());
    const plan = trainingPlan(t);
    const s = dow >= 1 && dow <= 5 ? DRILLS[plan[(dow - 1) * 2]].fatigue + DRILLS[plan[(dow - 1) * 2 + 1]].fatigue : 0;
    c = clamp(c - Math.max(s, -20) * (1.2 - p.professionalism / 50) * 0.5 + (dow === 0 || dow === 6 ? 9 : 5), 20, 100);
    out.push(Math.round(c));
  }
  return out;
}

// Weekly growth: age, potential gap, professionalism, staff, facilities, playing time, the week's drills and focus.
export function develop(W, p) {
  const t = p.teamId && team(W, p.teamId), starter = t && t.starters.includes(p.id), academy = p.squad === 'academy';
  const gap = Math.max(0, p.potential - overall(p)) / 20;
  const age = p.age;
  let rate = age <= 21 ? 0.3 * gap : age <= 25 ? 0.12 * gap : age <= 28 ? 0 : -0.07 * (age - 28);
  if (rate > 0 && t) {
    rate *= 1 + 0.05 * ((academy ? t.facilities.academy : t.facilities.training) - 1);
    rate *= 1 + ((t.staff.development?.rating ?? 6) - 10) / 40;
    rate *= 0.8 + p.professionalism / 50;
    if (p.traits.includes('Professional')) rate *= 1.15;
    if (has(p, 'lazy')) rate *= 0.85;
    if (academy && teamPlayers(W, t).some(x => has(x, 'mentor'))) rate *= 1.15;
  }
  const plan = t ? trainingPlan(t) : [];
  const drillCount = {};
  for (const d of plan) for (const a of DRILLS[d].attrs) drillCount[a] = (drillCount[a] ?? 0) + 1;
  for (const k of ATTRS) {
    let d = rate * rand(0.3, 1.7) * (starter ? 1.2 : academy ? 1 : 0.8);
    if (rate > 0) d += (drillCount[k] ?? 0) * 0.015 * Math.min(1, gap + 0.3);
    if (p.focus === k && d > -0.2) d += 0.25;
    p[k] = clamp(+(p[k] + d).toFixed(2), 8, 99);
  }
  const champPractice = plan.filter(d => d === 'champion').length;
  if (p.focus && CHAMP_IDS.includes(p.focus)) p.prof[p.focus] = Math.min(1.2, +((p.prof[p.focus] ?? 0.7) + 0.01 + champPractice * 0.003).toFixed(3));
  // AI clubs practise the patch's buffed champions for each player's role.
  if (t && t.id !== W.userTeamId) for (const [id, v] of Object.entries(W.patch?.meta ?? {})) if (v > 0.01 && CHAMPS[id].roles.includes(p.role)) p.prof[id] = Math.min(1.2, +((p.prof[id] ?? 0.7) + 0.004).toFixed(3));
  if (t && !starter && p.squad === 'first' && t.id === W.userTeamId) p.morale = clamp(p.morale - 0.5, 20, 100);
}

// ---------------- Squad management ----------------
export function promote(W, pid) {
  const u = userTeam(W), p = W.players[pid];
  if (u.players.length >= FIRST_TEAM_MAX) return `First team is full (${FIRST_TEAM_MAX}).`;
  u.academy = u.academy.filter(id => id !== pid); u.players.push(pid); p.squad = 'first'; p.fromAcademy = true;
  return null;
}
export function demote(W, pid) {
  const u = userTeam(W), p = W.players[pid];
  if (u.academy.length >= ACADEMY_MAX) return `Academy is full (${ACADEMY_MAX}).`;
  if (u.players.length <= ROSTER_MIN) return `The first team needs at least ${ROSTER_MIN} players.`;
  u.players = u.players.filter(id => id !== pid); u.academy.push(pid); p.squad = 'academy';
  if (u.starters.includes(pid)) autoStarters(W, u);
  return null;
}
export function setStarter(W, slot, pid) {
  const u = userTeam(W), other = u.starters.indexOf(pid);
  if (other >= 0) u.starters[other] = u.starters[slot];
  u.starters[slot] = pid;
}
export function transferList(W, pid, on = true) { W.players[pid].listed = on; }

function removeFromClub(W, p) {
  const t = team(W, p.teamId);
  if (!t) return;
  t.players = t.players.filter(id => id !== p.id); t.academy = t.academy.filter(id => id !== p.id);
  p.teamId = null; p.squad = null; p.listed = false;
  if (t.starters.includes(p.id)) fillAndStart(W, t);
}
export function releaseCompensation(W, p) { return Math.round(Math.max(0, p.contractEnd - W.year + 0.5) * p.wage * 0.5 / 1000) * 1000; }
export function releasePlayer(W, pid) {
  const u = userTeam(W), p = W.players[pid];
  if (p.squad === 'first' && u.players.length <= ROSTER_MIN) return `The first team needs at least ${ROSTER_MIN} players.`;
  money(W, u, -releaseCompensation(W, p), 'compensation');
  removeFromClub(W, p); W.freeAgents.push(p.id);
  return null;
}
function join(W, t, p, { wage = wageFor(p), years = 2, squad } = {}) {
  W.freeAgents = W.freeAgents.filter(id => id !== p.id);
  p.teamId = t.id; p.wage = wage; p.contractEnd = W.year + years - 1; p.morale = 72; p.listed = false;
  p.squad = squad ?? (t.players.length < FIRST_TEAM_MAX ? 'first' : 'academy');
  (p.squad === 'first' ? t.players : t.academy).push(p.id);
  ensurePeople(W, p); chemJoin(W, t, p);
}
// Top up a short first team from free agents, then pick starters.
export function fillAndStart(W, t) {
  while (t.players.length < ROSTER_MIN) {
    const fa = W.freeAgents.map(id => W.players[id]).filter(p => !p.retired).sort((a, b) => overall(b) - overall(a))[0];
    if (!fa) break;
    join(W, t, fa, { wage: Math.min(wageFor(fa), Math.max(5000, capRoom(W, t))), years: 1, squad: 'first' });
  }
  autoStarters(W, t);
}

// ---------------- Contracts ----------------
// Likelihood (0-1) that the player accepts these terms. Used by renewals, free agents and transfers.
export function termsLikelihood(W, p, t, { wage, years, bonus = 0, promises }) {
  const ask = wageFor(p) * (1 + Math.max(0, (60 - t.rep) / 200));
  const value = (wage * years + bonus) / (ask * years);
  let l = 0.5 + (value - 1) * 2.2;
  l += (p.morale - 60) / 200;
  if (p.teamId === t.id && !t.starters.includes(p.id) && p.squad === 'first' && overall(p) > 60) l -= 0.1; // wants to play
  if (years === 3 && p.age >= 27) l += 0.05;
  if (years === 1 && p.age <= 22) l -= 0.05;
  if (p.teamId === t.id) l += has(p, 'loyal') ? 0.1 : 0;
  if (has(p, 'ambitious')) l -= t.rep < 55 ? 0.1 : 0.03;
  if (p.wantsOut && p.teamId === t.id) l -= 0.3;
  l += (promises ?? []).length * (has(p, 'ambitious') ? 0.1 : 0.06); // promises sweeten a deal, and must be kept
  return clamp(l, 0, 1);
}
export const playerAsk = (p, t) => Math.round(wageFor(p) * (1 + Math.max(0, (60 - t.rep) / 200)) / 500) * 500;

export function renew(W, pid, terms) {
  const u = userTeam(W), p = W.players[pid];
  const l = termsLikelihood(W, p, u, terms);
  if (payroll(W, u) - p.wage + terms.wage > wageCap(u)) return { ok: false, likelihood: l, msg: 'That wage would break the wage cap.' };
  if (terms.bonus > u.cash) return { ok: false, likelihood: l, msg: 'Not enough cash for the signing bonus.' };
  if (l < 0.5) { p.morale = clamp(p.morale - 3, 20, 100); return { ok: false, likelihood: l, msg: `${p.name} turns the offer down.` }; }
  p.wage = terms.wage; p.contractEnd = W.year + terms.years; money(W, u, -terms.bonus, 'bonuses'); addPromises(W, p, terms.promises);
  mail(W, `${p.name} renews`, `New deal: ${fmtMoney(terms.wage)} a year until the end of ${p.contractEnd}.`, 'news');
  return { ok: true, likelihood: l, msg: `${p.name} signs a new contract.` };
}

// ---------------- Scouting ----------------
export const SCOUT_COST = 1000;
export const scoutDays = t => Math.max(7, 15 - t.facilities.analytics - Math.floor((t.staff.analyst?.rating ?? 0) / 7));
export function scout(W, pid) {
  const u = userTeam(W);
  if (W.scouting[pid]) return 'Already scouted or in progress.';
  if (u.cash < SCOUT_COST) return 'Not enough cash.';
  money(W, u, -SCOUT_COST, 'scouting');
  W.scouting[pid] = { start: W.day, year: W.year, days: scoutDays(u), done: false };
  return null;
}
// What the user knows: exact for own players; otherwise a range that narrows while scouting.
export function knowledge(W, p) {
  const u = userTeam(W), ov = overall(p);
  if (p.teamId === u?.id) return { exact: true, ability: [ov, ov], potential: [p.potential, p.potential], progress: 1 };
  const sc = W.scouting[p.id];
  const prog = sc ? clamp(((W.year - sc.year) * 365 + W.day - sc.start) / sc.days, 0, 1) : 0;
  const wa = Math.round(12 * (1 - prog)), wp = Math.round(18 * (1 - prog));
  const off = (p.nextPid ?? p.id.length) % 3 - 1; // stable small offset so ranges aren't centred on the truth
  return { exact: prog >= 1, ability: [clamp(ov - wa + off, 1, 99), clamp(ov + wa + off, 1, 99)], potential: [clamp(p.potential - wp, 1, 99), clamp(p.potential + wp, 1, 99)], progress: prog, scouting: !!sc && prog < 1 };
}
export function scoutingTick(W) {
  for (const [pid, sc] of Object.entries(W.scouting)) {
    if (sc.done) continue;
    if ((W.year - sc.year) * 365 + W.day - sc.start >= sc.days) {
      sc.done = true; const p = W.players[pid];
      if (p) { ensurePeople(W, p); p.personaKnown = true; }
      if (p) mail(W, `Scouting report: ${p.name}`, `${p.role}, age ${p.age}. Ability ${overall(p)}, potential ${p.potential}. ${p.traits.length ? `Traits: ${p.traits.join(', ')}. ` : ''}Personality: ${p.persona.map(k => PERSONAS[k].split(':')[0]).join(', ')}.`, 'scouting', { pid });
    }
  }
}

// ---------------- Transfers ----------------
export function askingPrice(W, p) {
  const t = team(W, p.teamId);
  if (!t) return 0;
  let m = 1.1;
  if (t.starters.includes(p.id)) m = 1.3;
  if (p.listed) m = 0.85;
  if (p.contractEnd <= W.year) m *= 0.6;
  m *= 1 + clamp(metaFit(W, p), -0.1, 0.25); // players good on this patch's buffed champions cost more
  return Math.round(valueOf(p) * m / 1000) * 1000;
}
// Step 1: the selling club's answer to a fee (optionally with one of your players as part-exchange).
export function clubResponse(W, pid, { fee, swapPid = null }) {
  const p = W.players[pid], seller = team(W, p.teamId), u = userTeam(W);
  const neg = (W.negotiations[pid] ??= { attempts: 3, stage: 'fee' });
  if (neg.attempts <= 0) return { result: 'reject', msg: `${seller.name} have ended talks.`, attemptsLeft: 0 };
  if (seller.players.length + seller.academy.length <= ROSTER_MIN + (swapPid ? -1 : 0) && p.squad === 'first') return { result: 'reject', msg: `${seller.name} won't sell below ${ROSTER_MIN} players.`, attemptsLeft: neg.attempts };
  const swapVal = swapPid ? valueOf(W.players[swapPid]) * 0.8 : 0;
  if (fee > u.cash) return { result: 'reject', msg: 'You cannot afford that fee.', attemptsLeft: neg.attempts };
  const ask = askingPrice(W, p), floor = Math.round(ask * 0.92 / 1000) * 1000, total = fee + swapVal;
  neg.attempts--;
  if (total >= floor) { neg.stage = 'terms'; neg.fee = fee; neg.swapPid = swapPid; return { result: 'accept', msg: `${seller.name} accept. Now agree terms with ${p.name}.`, attemptsLeft: neg.attempts }; }
  if (total >= ask * 0.7) return { result: 'counter', counter: Math.max(0, floor - swapVal), msg: `${seller.name} want at least ${fmtMoney((floor - swapVal))}${swapPid ? ' plus the player' : ''}.`, attemptsLeft: neg.attempts };
  return { result: 'reject', msg: `${seller.name} reject the offer outright.`, attemptsLeft: neg.attempts };
}
// Step 2: player terms; completes the transfer when accepted.
export function offerTerms(W, pid, terms) {
  const p = W.players[pid], u = userTeam(W), neg = W.negotiations[pid], free = !p.teamId;
  if (!free && neg?.stage !== 'terms') return { ok: false, msg: 'Agree a fee with the club first.' };
  if (u.players.length + u.academy.length >= FIRST_TEAM_MAX + ACADEMY_MAX) return { ok: false, msg: 'Your squad is full (20).' };
  const out = !free && neg.swapPid ? W.players[neg.swapPid].wage : 0;
  if (payroll(W, u) - out + terms.wage > wageCap(u)) return { ok: false, msg: `That wage breaks the wage cap (${fmtMoney(capRoom(W, u))} room).` };
  const fee = free ? 0 : neg.fee;
  if (fee + (terms.bonus ?? 0) > u.cash) return { ok: false, msg: 'Not enough cash for the fee and bonus.' };
  const l = termsLikelihood(W, p, u, terms);
  if (l < 0.5) return { ok: false, likelihood: l, msg: `${p.name} wants a better offer.` };
  const seller = team(W, p.teamId);
  if (!free) {
    money(W, u, -fee, 'transfers'); money(W, seller, fee, 'transfers');
    if (neg.swapPid) { const sw = W.players[neg.swapPid]; removeFromClub(W, sw); join(W, seller, sw, { wage: sw.wage, years: Math.max(1, sw.contractEnd - W.year + 1) }); autoStarters(W, seller); }
    removeFromClub(W, p);
  }
  money(W, u, -(terms.bonus ?? 0), 'bonuses');
  join(W, u, p, { wage: terms.wage, years: terms.years }); addPromises(W, p, terms.promises);
  delete W.negotiations[pid];
  W.shortlist = W.shortlist.filter(id => id !== pid);
  newsTransfer(W, p, seller, u, fee);
  mail(W, `${p.name} signs`, `${free ? 'Free transfer' : `Fee ${fmtMoney(fee)} from ${seller.name}`}. ${fmtMoney(terms.wage)} a year until the end of ${p.contractEnd}.`, 'news');
  return { ok: true, likelihood: l, msg: `${p.name} joins the club.` };
}
export function toggleShortlist(W, pid) { W.shortlist = W.shortlist.includes(pid) ? W.shortlist.filter(id => id !== pid) : [...W.shortlist, pid]; }

// AI clubs bid for the user's players (any time; listed players draw more interest). Offers expire after 14 days.
export function aiBids(W, chance = 0.25) {
  const u = userTeam(W);
  if (!u) return;
  for (const p of allPlayers(W, u)) {
    if (W.offers.some(o => o.pid === p.id && o.status === 'open')) continue;
    const want = (p.listed ? 0.35 : 0.03) * chance * 4 * (overall(p) > 55 ? 1 : 0.4);
    if (Math.random() > want) continue;
    const buyers = W.teams.filter(t => t.id !== u.id && t.tier <= u.tier && t.cash > valueOf(p) && capRoom(W, t) > p.wage && t.players.length < FIRST_TEAM_MAX);
    const buyer = pick(buyers);
    if (!buyer) continue;
    const fee = Math.round(valueOf(p) * rand(p.listed ? 0.8 : 1, p.listed ? 1.1 : 1.35) / 1000) * 1000;
    const o = { id: `o${W.nextMsg}`, pid: p.id, from: buyer.id, fee, wage: Math.round(p.wage * rand(1.1, 1.5) / 500) * 500, contractEnd: W.year + randInt(1, 3), expires: W.day + 14, year: W.year, status: 'open' };
    W.offers.push(o);
    mail(W, `${buyer.name} want ${p.name}`, `${buyer.name} offer ${fmtMoney(fee)}. ${p.name} would earn ${fmtMoney(o.wage)} a year there. The offer expires in 14 days.`, 'offer', { offer: o.id });
  }
}
export function acceptOffer(W, oid) {
  const o = W.offers.find(x => x.id === oid), p = W.players[o.pid], u = userTeam(W), buyer = team(W, o.from);
  if (o.status !== 'open') return 'This offer is no longer open.';
  if (p.squad === 'first' && u.players.length <= ROSTER_MIN) return `You need at least ${ROSTER_MIN} first-team players.`;
  money(W, u, o.fee, 'transfers'); money(W, buyer, -o.fee, 'transfers');
  removeFromClub(W, p); join(W, buyer, p, { wage: o.wage, years: o.contractEnd - W.year + 1 }); autoStarters(W, buyer);
  newsTransfer(W, p, u, buyer, o.fee);
  o.status = 'accepted';
  return null;
}
export function rejectOffer(W, oid) { const o = W.offers.find(x => x.id === oid); if (o) o.status = 'rejected'; }
export function expireOffers(W) {
  for (const o of W.offers) if (o.status === 'open' && (o.year < W.year || W.day >= o.expires)) {
    o.status = 'expired';
    if (o.kind === 'sponsor') { mail(W, `Sponsor offer expired: ${o.name}`, 'The offer lapsed without an answer.', 'board', { offer: o.id }); continue; }
    const p = W.players[o.pid];
    mail(W, `Offer expired: ${p?.name}`, `${team(W, o.from).name}'s bid lapsed. ${p?.listed ? 'The player stays transfer-listed.' : 'Transfer-list the player to attract new bids.'}`, 'offer', { offer: o.id });
  }
  W.offers = W.offers.filter(o => o.status === 'open' || (W.year === o.year && W.day - o.expires < 30));
}

// ---------------- Staff, facilities, sponsors ----------------
export function staffMarket(W) {
  if (!W.staffPool || W.staffPool.day !== Math.floor(W.day / 7)) W.staffPool = { day: Math.floor(W.day / 7), list: Array.from({ length: 6 }, () => makeStaff(W, randInt(25, 95))) };
  return W.staffPool.list;
}
export function hireStaff(W, role, sid) {
  const u = userTeam(W), c = staffMarket(W).find(x => x.id === sid);
  if (!c) return 'Candidate not found.';
  if (u.cash < c.wage / 4) return 'Not enough cash.';
  u.staff[role] = c; W.staffPool.list = W.staffPool.list.filter(x => x.id !== sid);
  mail(W, `${c.name} joins as ${STAFF_ROLES[role]}`, `Rating ${c.rating}/20, ${fmtMoney(c.wage)} a year.`, 'news');
  return null;
}
export function fireStaff(W, role) { userTeam(W).staff[role] = null; }
export function upgradeFacility(W, key) {
  const u = userTeam(W), lvl = u.facilities[key];
  if (u.build) return 'One build at a time.';
  if (lvl >= 5) return 'Already at the top level.';
  const cost = FACILITIES[key].cost(lvl + 1);
  if (u.cash < cost) return 'Not enough cash.';
  money(W, u, -cost, 'facilities');
  u.build = { key, done: W.day + FACILITIES[key].days(lvl + 1), year: W.year };
  return null;
}
function buildTick(W, t) {
  if (t.build && (t.build.year < W.year || W.day >= t.build.done)) {
    t.facilities[t.build.key]++;
    if (t.id === W.userTeamId) mail(W, `${FACILITIES[t.build.key].name} upgraded`, `Now level ${t.facilities[t.build.key]}: ${FACILITIES[t.build.key].effect.toLowerCase()}.`, 'board');
    t.build = null;
  }
}
export function sponsorOffer(W) {
  const u = userTeam(W);
  if (!u || u.sponsors.length >= 3 || W.offers.some(o => o.kind === 'sponsor' && o.status === 'open')) return;
  const o = { id: `o${W.nextMsg}`, kind: 'sponsor', name: sponsorName(), weekly: Math.round(sponsorBase(u) * rand(0.2, 0.45) / 100) * 100, bonus: Math.round(u.rep * rand(400, 900) / 1000) * 1000, until: W.year, expires: W.day + 7, year: W.year, status: 'open' };
  W.offers.push(o);
  mail(W, `Sponsor offer: ${o.name}`, `$${(o.weekly / 1000).toFixed(1)}k a week until the end of ${o.until}, plus a ${fmtMoney(o.bonus)} bonus for a top-4 domestic finish. Answer within 7 days.`, 'board', { offer: o.id });
}
export function acceptSponsor(W, oid) {
  const o = W.offers.find(x => x.id === oid), u = userTeam(W);
  if (!o || o.status !== 'open') return 'This offer is no longer open.';
  u.sponsors.push({ name: o.name, weekly: o.weekly, until: o.until, bonus: o.bonus });
  o.status = 'accepted';
  return null;
}

// ---------------- Weekly / daily ticks ----------------
export function weekly(W) {
  for (const t of W.teams) {
    const sponsor = t.sponsors.reduce((n, s) => n + s.weekly, 0) || sponsorBase(t) * 0.6;
    money(W, t, sponsor, 'sponsors');
    money(W, t, -Math.round(payroll(W, t) / 52), 'wages');
    const staffWages = Object.values(t.staff).reduce((n, c) => n + (c?.wage ?? 0), 0);
    money(W, t, -Math.round(staffWages / 52), 'staff');
    buildTick(W, t);
  }
  for (const p of Object.values(W.players)) if (!p.retired && p.teamId) develop(W, p);
  for (const t of W.teams) if (t.id !== W.userTeamId) autoStarters(W, t);
  const u = userTeam(W);
  if (u) {
    if (u.cash < 0) mail(W, 'Finances in the red', `Cash is ${fmtMoney(u.cash)}. Transfers are blocked until it recovers.`, 'board');
    aiBids(W);
    if (Math.random() < 0.12) sponsorOffer(W);
  }
  if (Math.random() < 0.3) aiMarket(W, false);
  peopleWeekly(W);
  scrimWeekly(W);
  weeklyDigest(W);
  newsWeekly(W);
}

// ---------------- AI market ----------------
export function aiMarket(W, offseason) {
  for (const t of W.teams) {
    if (t.id === W.userTeamId) continue;
    const target = t.tier === 0 ? 8 : 7;
    if (offseason) { // release weak bench players
      const avg = t.starters.length ? t.starters.reduce((n, id) => n + overall(W.players[id]), 0) / 5 : 50;
      for (const p of teamPlayers(W, t)) if (!t.starters.includes(p.id) && overall(p) < avg - 15 && t.players.length > ROSTER_MIN + 1) { removeFromClub(W, p); W.freeAgents.push(p.id); }
      // Over the wage cap (e.g. after relegation): shed the priciest non-starters, academy first.
      for (const p of allPlayers(W, t).filter(x => !t.starters.includes(x.id)).sort((a, b) => (a.squad === 'academy' ? -1 : 0) - (b.squad === 'academy' ? -1 : 0) || b.wage - a.wage)) {
        if (capRoom(W, t) >= 0) break;
        if (p.squad === 'first' && t.players.length <= ROSTER_MIN) continue;
        removeFromClub(W, p); W.freeAgents.push(p.id);
      }
    }
    let guard = 0;
    while (t.players.length < target && guard++ < 4) {
      const weakest = t.starters.map((pid, i) => ({ i, ov: overall(W.players[pid], ROLES[i]) })).sort((a, b) => a.ov - b.ov)[0];
      const role = ROLES[weakest?.i ?? 0];
      const room = capRoom(W, t);
      const fa = W.freeAgents.map(id => W.players[id]).filter(p => !p.retired && wageFor(p) <= room).sort((a, b) => overall(b, role) - overall(a, role))[0];
      if (!fa) break;
      join(W, t, fa, { wage: wageFor(fa), years: randInt(1, 3), squad: 'first' });
      newsTransfer(W, fa, null, t, 0);
    }
    // Academy: top-league clubs keep a few prospects.
    if (offseason && t.tier === 0) {
      while (t.academy.length < 4) {
        const prospect = W.freeAgents.map(id => W.players[id]).filter(p => !p.retired && p.age <= 19).sort((a, b) => b.potential - a.potential)[0];
        if (!prospect) break;
        join(W, t, prospect, { wage: Math.min(wageFor(prospect), 15000), years: 2, squad: 'academy' });
      }
      // Promote the best academy prospect if they beat the weakest bench player.
      const best = academyPlayers(W, t).sort((a, b) => overall(b) - overall(a))[0];
      if (best && t.players.length < FIRST_TEAM_MAX && overall(best) > 55) { t.academy = t.academy.filter(id => id !== best.id); t.players.push(best.id); best.squad = 'first'; }
    }
    autoStarters(W, t);
  }
}

// ---------------- Off-season: aging, retirement, contracts, newgens ----------------
export function offseasonPlayers(W) {
  const u = userTeam(W);
  const retired = [], left = [];
  for (const p of Object.values(W.players)) {
    if (p.retired) continue;
    p.age++;
    const ov = overall(p);
    const retire = p.age >= 36 || (p.age >= 30 && Math.random() < (p.age - 29) * 0.18) || (!p.teamId && p.age > 25 && ov < 38);
    if (retire) { if (p.teamId === u?.id) retired.push(p.name); retirePlayer(W, p); continue; }
    if (p.teamId && p.contractEnd < W.year + 1) {
      const t = team(W, p.teamId);
      if (t.id === W.userTeamId) { left.push(p.name); removeFromClub(W, p); W.freeAgents.push(p.id); }
      else if (Math.random() < 0.7 && capRoom(W, t) + p.wage >= wageFor(p)) { p.contractEnd = W.year + randInt(1, 3); p.wage = wageFor(p); }
      else { removeFromClub(W, p); W.freeAgents.push(p.id); }
    }
  }
  // Newgens: 3 per role per region, aged 15-19.
  const newgens = [];
  for (const region of REGIONS) for (const role of ROLES) for (let i = 0; i < 3; i++) {
    const p = makePlayer(W, rand(24, 44) * REGION_INFO[region].talent, role, randInt(15, 19), region);
    p.potential = Math.round(clamp(p.potential + rand(0, 10), overall(p), 97)); p.rookieYear = W.year + 1;
    W.freeAgents.push(p.id); newgens.push(p.id);
  }
  // Free-agent pool stays bounded.
  W.freeAgents = W.freeAgents.filter(id => W.players[id] && !W.players[id].retired);
  if (W.freeAgents.length > 260) {
    const drop = W.freeAgents.map(id => W.players[id]).sort((a, b) => (overall(a) + a.potential / 2) - (overall(b) + b.potential / 2)).slice(0, W.freeAgents.length - 260);
    for (const p of drop) { retirePlayer(W, p); }
  }
  for (const t of W.teams) for (const p of allPlayers(W, t)) p.focus = null;
  return { retired, left, newgens };
}
export function retirePlayer(W, p) {
  removeFromClub(W, p);
  W.freeAgents = W.freeAgents.filter(id => id !== p.id);
  p.retired = true;
  // Keep retired players only while someone may look them up (history); drop heavy fields.
  p.history = p.history.slice(0, 5); p.prof = {}; p.champStats = {};
}

// ---------------- Board ----------------
export function boardTarget(W, t = userTeam(W)) {
  const league = W.teams.filter(x => x.region === t.region && x.tier === t.tier);
  const rank = league.sort((a, b) => b.rep - a.rep).findIndex(x => x.id === t.id) + 1;
  const [text, place] = t.tier > 0 ? (rank <= 2 ? ['win promotion', 1] : ['finish in the top half', Math.ceil(league.length / 2)])
    : rank === 1 ? ['win a domestic split', 1] : rank <= 3 ? ['reach a domestic final', 2] : rank <= 6 ? ['make the playoffs', 6] : ['avoid relegation', league.length - 2];
  t.target = text; t.targetPlace = place;
}
export { fmtDate };
