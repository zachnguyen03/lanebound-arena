// People: chemistry between starters, hidden personalities, squad status and promises, team talks,
// rivalries, and player conversations in the inbox (messages with choices).
import { userTeam, mail, clamp, overall, teamPlayers, pick, rand } from './world.js';
import { newsBrokenPromise } from './news.js';

// ---------- Personalities (hidden until scouted or after 60 days at the club) ----------
export const PERSONAS = {
  ambitious: 'Ambitious: wants to start and to win; asks for more; sulks on the bench',
  loyal: 'Loyal: easier to re-sign, patient when benched',
  volatile: 'Volatile: big mood swings, clashes with team-mates',
  mentor: 'Mentor: academy players at the club grow faster',
  lazy: 'Lazy: develops slower',
  leader: 'Leader: lifts morale after losses and grows chemistry faster',
};
export const has = (p, k) => (p.persona ?? []).includes(k);
export const personaOf = () => { const a = pick(Object.keys(PERSONAS)); const b = Math.random() < 0.35 ? pick(Object.keys(PERSONAS).filter(x => x !== a && !(a === 'loyal' && x === 'ambitious'))) : null; return b ? [a, b] : [a]; };
// Known after 60 days together: from the player's arrival or the manager's, whichever is later.
export const personaKnown = (W, p) => p.personaKnown || (p.teamId === W.userTeamId && p.joined != null && W.year * 400 + W.day - Math.max(p.joined, W.manager?.sinceKey ?? 0) >= 60);
export function ensurePeople(W, p) { // older saves
  p.persona ??= personaOf();
  if (p.joined == null && p.teamId) p.joined = W.year * 400 + W.day - 90;
}

// ---------- Chemistry: pair values 0-100 between first-team players ----------
const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
export const pairChem = (t, a, b) => t.chem?.[key(a, b)] ?? 50;
export function teamChem(t) {
  const s = t.starters; let n = 0, c = 0;
  for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) { n += pairChem(t, s[i], s[j]); c++; }
  return c ? n / c : 50;
}
// After a game: the five who played grow closer (faster with a leader, and when they win).
export function chemAfterGame(W, t, pids, won) {
  t.chem ??= {};
  const lead = pids.some(id => has(W.players[id] ?? {}, 'leader')) ? 1.3 : 1;
  for (let i = 0; i < pids.length; i++) for (let j = i + 1; j < pids.length; j++) {
    const k = key(pids[i], pids[j]);
    t.chem[k] = clamp(+((t.chem[k] ?? 50) + (0.5 + (won ? 0.4 : 0)) * lead).toFixed(1), 0, 100);
  }
}
// A new arrival starts with low chemistry with everyone at the club.
export function chemJoin(W, t, p) {
  t.chem ??= {}; p.joined = W.year * 400 + W.day; p.benchWeeks = 0; p.promises = []; p.wantsOut = false;
  for (const id of [...t.players, ...t.academy]) if (id !== p.id) t.chem[key(p.id, id)] = 35;
}
// Engine effect: chemistry above/below 50 moves Teamwork by up to ±5 and Decision Making (shot-calling) by up to ±2.
export const chemBonus = t => { const c = teamChem(t); return { teamwork: (c - 50) / 10, decision: (c - 50) / 25 }; };
// Drop chemistry entries for players who left (save size).
export function pruneChem(t) {
  if (!t.chem) return;
  const ids = new Set([...t.players, ...t.academy]);
  for (const k of Object.keys(t.chem)) { const [a, b] = k.split('|'); if (!ids.has(a) || !ids.has(b)) delete t.chem[k]; }
}

// ---------- Status, playing time and promises ----------
// Expected status by overall rank in the first team: 1-2 star, 3-5 starter, 6-8 rotation, rest prospect.
export function statusOf(W, t, p) {
  if (p.squad === 'academy') return 'prospect';
  const rank = teamPlayers(W, t).sort((a, b) => overall(b) - overall(a)).findIndex(x => x.id === p.id);
  return rank < 2 ? 'star' : rank < 5 ? 'starter' : rank < 8 ? 'rotation' : 'prospect';
}
export const STATUS_LABEL = { star: 'Star player', starter: 'First-team regular', rotation: 'Rotation', prospect: 'Prospect' };
export const PROMISES = { start: 'You will start', title: 'We will compete for a title' };
export function addPromises(W, p, promises = []) {
  for (const k of promises) (p.promises ??= []).push({ kind: k, made: W.year * 400 + W.day, year: W.year });
}

// ---------- Weekly: playing time, promises, clashes, personality reveals ----------
export function peopleWeekly(W) {
  const u = userTeam(W), met = [];
  for (const t of W.teams) {
    for (const id of t.academy) if (W.players[id]) ensurePeople(W, W.players[id]);
    for (const p of teamPlayers(W, t)) {
      ensurePeople(W, p);
      const starter = t.starters.includes(p.id), st = statusOf(W, t, p);
      p.benchWeeks = starter ? 0 : (p.benchWeeks ?? 0) + 1;
      if (!starter && (st === 'star' || st === 'starter')) p.morale = clamp(p.morale - (has(p, 'ambitious') ? 2 : has(p, 'loyal') ? 0.5 : 1), 20, 100);
      if (t !== u) continue;
      // Broken "you will start" promise after 4 weeks on the bench.
      const pr = (p.promises ?? []).find(x => x.kind === 'start' && !x.broken);
      if (pr && p.benchWeeks >= 4) {
        pr.broken = true; newsBrokenPromise(W, p, t); p.morale = clamp(p.morale - 15, 20, 100); p.wantsOut = true;
        for (const o of t.starters) if (t.chem) t.chem[key(p.id, o)] = clamp((t.chem[key(p.id, o)] ?? 50) - 8, 0, 100);
        mail(W, `${p.name} feels betrayed`, `You promised ${p.name} a starting spot. After four weeks on the bench, they want to leave.`, 'squad', { choices: [{ label: 'Put them back in the lineup', act: 'start', pid: p.id }, { label: 'Transfer-list them', act: 'list', pid: p.id }] });
      } else if (!pr && !starter && (st === 'star' || st === 'starter') && p.benchWeeks === 3) {
        mail(W, `${p.name} wants to talk`, `${p.name} expects to be a ${STATUS_LABEL[st].toLowerCase()} and has been on the bench for three weeks.`, 'squad', {
          choices: [{ label: 'Promise a starting spot', act: 'promise', pid: p.id }, { label: 'Tell them to fight for it', act: 'fight', pid: p.id }, { label: 'Transfer-list them', act: 'list', pid: p.id }],
        });
      }
      if (!p.personaKnown && personaKnown(W, p)) { p.personaKnown = true; met.push(`${p.name}: ${p.persona.map(k => PERSONAS[k].split(':')[0]).join(', ')}`); }
    }
    // Clashes: volatile players fall out with team-mates.
    const ps = t.starters.map(id => W.players[id]).filter(Boolean);
    for (const p of ps) {
      if (Math.random() > (has(p, 'volatile') ? 0.06 : 0.008)) continue;
      const o = pick(ps.filter(x => x !== p)); if (!o) continue;
      t.chem ??= {}; t.chem[key(p.id, o.id)] = clamp((t.chem[key(p.id, o.id)] ?? 50) - 15, 0, 100);
      p.morale = clamp(p.morale - 5, 20, 100); o.morale = clamp(o.morale - 5, 20, 100);
      if (t === u) mail(W, `${p.name} and ${o.name} clash`, `A heated argument after scrims. Their chemistry has taken a hit.`, 'squad', {
        choices: [{ label: `Back ${p.name}`, act: 'side', pid: p.id, other: o.id }, { label: `Back ${o.name}`, act: 'side', pid: o.id, other: p.id }, { label: 'Fine them both', act: 'fine', pid: p.id, other: o.id }],
      });
      break;
    }
  }
  if (met.length) mail(W, 'Getting to know the squad', `Staff report on personalities. ${met.join('. ')}.`, 'squad');
}
// Resolve a conversation choice from the inbox.
export function applyChoice(W, msg, i) {
  const c = msg.data?.choices?.[i]; if (!c || msg.data.chosen != null) return null;
  const u = userTeam(W), p = W.players[c.pid]; if (!u || !p) return null;
  const o = c.other && W.players[c.other];
  msg.data.chosen = i;
  switch (c.act) {
    case 'promise': addPromises(W, p, ['start']); p.morale = clamp(p.morale + 8, 20, 100); return `${p.name} is happy, for now. Start them within four weeks.`;
    case 'fight': { const ok = has(p, 'leader') || has(p, 'loyal') || Math.random() < 0.4; p.morale = clamp(p.morale + (ok ? 3 : -8), 20, 100); return ok ? `${p.name} accepts the challenge.` : `${p.name} is not impressed.`; }
    case 'list': p.listed = true; p.morale = clamp(p.morale - 5, 20, 100); return `${p.name} is on the transfer list.`;
    case 'start': if (!u.starters.includes(p.id)) { const slot = u.starters.findIndex(id => W.players[id]?.role === p.role); if (slot >= 0) u.starters[slot] = p.id; } p.morale = clamp(p.morale + 5, 20, 100); p.wantsOut = false; return `${p.name} is back in the lineup.`;
    case 'side': p.morale = clamp(p.morale + 6, 20, 100); o.morale = clamp(o.morale - (has(o, 'volatile') ? 12 : 6), 20, 100); return `You backed ${p.name}. ${o.name} sulks.`;
    case 'fine': for (const x of [p, o]) x.morale = clamp(x.morale - 3, 20, 100); u.chem[key(p.id, o.id)] = clamp((u.chem[key(p.id, o.id)] ?? 50) + 6, 0, 100); return 'Both fined. The air clears a little.';
  }
  return null;
}

// ---------- Team talks (before a series, between games) ----------
export const TALKS = { calm: 'Stay calm, play our game', motivate: 'Believe in yourselves', demand: 'I expect more from you' };
// diff = our series wins minus theirs (0 before the series). Returns one line per player with their reaction.
export function teamTalk(W, t, kind, diff = 0) {
  const out = [];
  for (const id of t.starters) {
    const p = W.players[id]; if (!p) continue;
    ensurePeople(W, p);
    let d = kind === 'calm' ? (diff < 0 ? 4 : 2) : kind === 'motivate' ? (diff < 0 ? 6 : diff > 0 ? 1 : 4) : (diff > 0 ? -4 : 3);
    if (kind === 'demand') d += has(p, 'ambitious') || has(p, 'leader') ? 4 : has(p, 'volatile') ? -6 : 0;
    if (kind === 'motivate' && has(p, 'lazy')) d -= 2;
    if (has(p, 'volatile')) d *= 1.5;
    d = Math.round(d + rand(-1.5, 1.5));
    p.morale = clamp(p.morale + d, 20, 100);
    out.push({ name: p.name, d, mood: d >= 4 ? 'fired up' : d >= 1 ? 'focused' : d > -3 ? 'unmoved' : 'rattled' });
  }
  return out;
}

// ---------- Rivalries ----------
export const rivalKey = (a, b) => key(a, b);
export const rivalry = (W, a, b) => W.rivals?.[key(a, b)] ?? 0;
export function addRivalry(W, a, b, n) { W.rivals ??= {}; W.rivals[key(a, b)] = Math.min(10, (W.rivals[key(a, b)] ?? 0) + n); }
// Rivalries cool by one point a season.
export function coolRivalries(W) { for (const k of Object.keys(W.rivals ?? {})) if (--W.rivals[k] <= 0) delete W.rivals[k]; }
export const isRivalry = (W, a, b) => rivalry(W, a, b) >= 3;
