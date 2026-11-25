// 20-step pro draft: 3 bans each, 3 picks each, 2 bans each, 2 picks each. Side 0 = Blue (first pick).
import { CHAMPS, CHAMP_IDS, ROLES, COMP_BEATS, compOf, traitTier } from './data.js';

export const DRAFT_ORDER = [
  [0, 'ban'], [1, 'ban'], [0, 'ban'], [1, 'ban'], [0, 'ban'], [1, 'ban'],
  [0, 'pick'], [1, 'pick'], [1, 'pick'], [0, 'pick'], [0, 'pick'], [1, 'pick'],
  [1, 'ban'], [0, 'ban'], [1, 'ban'], [0, 'ban'],
  [1, 'pick'], [0, 'pick'], [0, 'pick'], [1, 'pick'],
];
// Fearless series: champions a team played in the previous game are locked for that team (full 20 steps; 40 champions).
export const OFF_ROLE = 0.85;

// locks = [[ids locked for Blue], [ids locked for Red]]
export const newDraft = ({ fearless = false, locks = [[], []] } = {}) => ({ i: 0, order: DRAFT_ORDER, fearless, locks, bans: [[], []], picks: [Array(5).fill(null), Array(5).fill(null)] });
export const isTaken = (d, id) => d.bans.flat().includes(id) || d.picks.flat().includes(id);
export const isLocked = (d, side, id) => !!d.locks?.[side]?.includes(id);
export const canPick = (d, side, id) => !isTaken(d, id) && !isLocked(d, side, id);
export const turn = d => (d.order ?? DRAFT_ORDER)[d.i] ?? null;
export const draftDone = d => d.i >= (d.order ?? DRAFT_ORDER).length;

// Effective proficiency of a player (in role slot) on a champion.
export const effProf = (player, slot, id) => (player.prof[id] ?? 0.7) * (CHAMPS[id].roles.includes(ROLES[slot]) ? 1 : OFF_ROLE);

export function applyDraft(d, id, slot) {
  const [side, type] = turn(d);
  if (isTaken(d, id) || (type === 'pick' && isLocked(d, side, id))) throw new Error(`${id} not available`);
  if (type === 'ban') d.bans[side].push(id);
  else {
    if (slot == null || d.picks[side][slot]) slot = d.picks[side].findIndex((v, i) => !v && CHAMPS[id].roles.includes(ROLES[i]));
    if (slot < 0) slot = d.picks[side].indexOf(null);
    d.picks[side][slot] = id;
  }
  d.i++;
}

// mine / theirs = 5 players each, in ROLES order. prefs = { comp: target tag or 'auto', meta: { id: strength delta } }.
// Picks: mastery first, then composition (trait completion, a coherent tag, counters), the meta, frontline/range sanity.
// Returns { id, slot, sc, why } — why is the analyst's reason.
const LEAN = 0.03; // how much composition is worth against mastery (mastery runs about 0.6-1.2)
export function aiChoice(d, side, mine, theirs, rng = Math.random, prefs = {}) {
  const free = CHAMP_IDS.filter(id => canPick(d, side, id)), meta = prefs.meta ?? {};
  if (turn(d)[1] === 'ban') {
    // Ban their comfort picks for still-open roles (what they can still pick), weighted by the meta.
    const open = d.picks[1 - side].map((v, i) => (v ? -1 : i)).filter(i => i >= 0);
    const pool = CHAMP_IDS.filter(id => !isTaken(d, id) && !isLocked(d, 1 - side, id));
    const threat = id => Math.max(...open.map(i => effProf(theirs[i], i, id))) + (meta[id] ?? 0) * 0.5 + rng() * 0.04;
    const id = (pool.length ? pool : CHAMP_IDS.filter(x => !isTaken(d, x))).reduce((a, b) => (threat(b) > threat(a) ? b : a));
    const who = open.reduce((a, i) => (effProf(theirs[i], i, id) > effProf(theirs[a], a, id) ? i : a), open[0] ?? 0);
    return { id, why: `Ban ${CHAMPS[id].name}: comfort pick for ${theirs[who]?.name ?? 'them'}${meta[id] > 0.02 ? ', strong this patch' : ''}.` };
  }
  const own = d.picks[side].filter(Boolean), opp = d.picks[1 - side].filter(Boolean);
  const me = compOf(own), them = compOf(opp);
  const target = prefs.comp && prefs.comp !== 'auto' ? prefs.comp : me.tags && Object.entries(me.tags).sort((a, b) => b[1] - a[1])[0]?.[0];
  const cls = own.map(id => CHAMPS[id].cls);
  const frontline = cls.some(c => c === 'Tank' || c === 'Bruiser'), ranged = cls.some(c => c === 'Marksman' || c === 'Mage');
  const left = d.picks[side].filter(v => !v).length;
  let best = null;
  d.picks[side].forEach((taken, slot) => {
    if (taken) return;
    for (const id of free) {
      const c = CHAMPS[id], why = [];
      let sc = effProf(mine[slot], slot, id) + rng() * 0.03 + (meta[id] ?? 0);
      const traitGain = c.traits.filter(t => traitTier((me.traits[t] ?? 0) + 1) > traitTier(me.traits[t] ?? 0));
      if (traitGain.length) { sc += LEAN * traitGain.length; why.push(`completes ${traitGain.join(' and ')}`); }
      if (target && c.tag === target) { sc += LEAN; why.push(`fits the ${target} plan`); }
      if (them.tag !== 'mixed' && COMP_BEATS[c.tag] === them.tag) { sc += LEAN; why.push(`counters their ${them.tag}`); }
      if (them.tag !== 'mixed' && COMP_BEATS[them.tag] === c.tag) sc -= LEAN * 0.7;
      if (left <= 2 && !frontline && c.cls !== 'Tank' && c.cls !== 'Bruiser') sc -= 0.08;
      if (left <= 2 && !ranged && c.cls !== 'Marksman' && c.cls !== 'Mage') sc -= 0.08;
      if ((meta[id] ?? 0) > 0.02) why.push('strong this patch');
      if (!best || sc > best.sc) best = { id, slot, sc, why };
    }
  });
  best.why = `${CHAMPS[best.id].name} for ${mine[best.slot].name}: ${best.why.length ? best.why.join(', ') : 'best mastery'}.`;
  return best;
}

export function autoDraft(a, b, rng = Math.random, opts = {}) {
  const d = newDraft(opts);
  while (!draftDone(d)) {
    const side = turn(d)[0];
    const c = aiChoice(d, side, side ? b : a, side ? a : b, rng, opts.prefs?.[side]);
    applyDraft(d, c.id, c.slot);
  }
  return d;
}
