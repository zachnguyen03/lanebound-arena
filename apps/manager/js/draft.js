// 12-step draft for the 14-champion pool: one ban each, then picks B R R B B R R B B R. Side 0 = Blue (first pick).
import { CHAMPS, CHAMP_IDS, ROLES } from './data.js';

export const DRAFT_ORDER = [
  [0, 'ban'], [1, 'ban'],
  [0, 'pick'], [1, 'pick'], [1, 'pick'], [0, 'pick'], [0, 'pick'], [1, 'pick'], [1, 'pick'], [0, 'pick'], [0, 'pick'], [1, 'pick'],
];
export const OFF_ROLE = 0.85;

export const newDraft = () => ({ i: 0, bans: [[], []], picks: [Array(5).fill(null), Array(5).fill(null)] });
export const isTaken = (d, id) => d.bans.flat().includes(id) || d.picks.flat().includes(id);
export const turn = d => DRAFT_ORDER[d.i] ?? null;
export const draftDone = d => d.i >= DRAFT_ORDER.length;

// Effective proficiency of a player (in role slot) on a champion.
export const effProf = (player, slot, id) => (player.prof[id] ?? 0.7) * (CHAMPS[id].roles.includes(ROLES[slot]) ? 1 : OFF_ROLE);

export function applyDraft(d, id, slot) {
  const [side, type] = turn(d);
  if (isTaken(d, id)) throw new Error(`${id} not available`);
  if (type === 'ban') d.bans[side].push(id);
  else {
    if (slot == null || d.picks[side][slot]) slot = d.picks[side].findIndex((v, i) => !v && CHAMPS[id].roles.includes(ROLES[i]));
    if (slot < 0) slot = d.picks[side].indexOf(null);
    d.picks[side][slot] = id;
  }
  d.i++;
}

// mine / theirs = 5 players each, in ROLES order. prefs = { meta: { id: strength delta } }.
// Bans take the opponent's best comfort pick for an open role; picks take the best mastery for an open slot plus the meta.
// Returns { id, slot, sc, why } — why is the analyst's reason.
export function aiChoice(d, side, mine, theirs, rng = Math.random, prefs = {}) {
  const free = CHAMP_IDS.filter(id => !isTaken(d, id)), meta = prefs.meta ?? {};
  if (turn(d)[1] === 'ban') {
    const open = d.picks[1 - side].map((v, i) => (v ? -1 : i)).filter(i => i >= 0);
    const threat = id => Math.max(...open.map(i => effProf(theirs[i], i, id))) + (meta[id] ?? 0) * 0.5 + rng() * 0.04;
    const id = free.reduce((a, b) => (threat(b) > threat(a) ? b : a));
    const who = open.reduce((a, i) => (effProf(theirs[i], i, id) > effProf(theirs[a], a, id) ? i : a), open[0] ?? 0);
    return { id, why: `Ban ${CHAMPS[id].name}: comfort pick for ${theirs[who]?.name ?? 'them'}${meta[id] > 0.02 ? ', strong this patch' : ''}.` };
  }
  let best = null;
  d.picks[side].forEach((taken, slot) => {
    if (taken) return;
    for (const id of free) {
      const sc = effProf(mine[slot], slot, id) + rng() * 0.03 + (meta[id] ?? 0);
      if (!best || sc > best.sc) best = { id, slot, sc };
    }
  });
  best.why = `${CHAMPS[best.id].name} for ${mine[best.slot].name}: ${(meta[best.id] ?? 0) > 0.02 ? 'strong this patch' : 'best mastery'}.`;
  return best;
}

export function autoDraft(a, b, rng = Math.random, opts = {}) {
  const d = newDraft();
  while (!draftDone(d)) {
    const side = turn(d)[0];
    const c = aiChoice(d, side, side ? b : a, side ? a : b, rng, opts.prefs?.[side]);
    applyDraft(d, c.id, c.slot);
  }
  return d;
}
