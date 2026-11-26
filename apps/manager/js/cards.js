// Tactic Cards (CARD_PLAN.md, translated to points mode). Definitions, ownership from standing, loadout rules,
// AI loadouts, rules text. The sim runs them (sim/cards.ts, MatchConfig.cards); the fast engine uses CARD_STATS.
// Values are Common; rarity scales every numeric effect except score. Card text is always generated from the data.
import { CHAMPS, ATTRS, overall } from './data.js';

export const RARITY = {
  common: { label: 'Common', mult: 1, pips: 1, cost: 0 },
  rare: { label: 'Rare', mult: 1.3, pips: 2, cost: 0 },
  epic: { label: 'Epic', mult: 1.6, pips: 3, cost: 1 },
  signature: { label: 'Signature', mult: 1, pips: 3, cost: 0 },
};
export const SLOTS = ['top', 'jungle', 'mid', 'adc', 'support'];
export const LOADOUT = { size: 3, budget: 6, perPlayer: 2 };

// trigger / effects follow sim/cards.ts (CardTrigger, CardEffect). tags: plan fit for the AI (early, fight, objective, comeback, scale).
const T = (team, dur, more = {}) => ({ target: team, dur, ...more });
export const CARDS = {
  // Role cards (slot 1)
  'island-lord': { name: 'Island Lord', cost: 1, role: 'Top', tags: ['early'], art: 'shield', sky: 'forest',
    trigger: { on: 'alive', t: 30 }, effects: [{ stat: 'dmg', v: 0.1, ...T('owner', 60) }, { stat: 'taken', v: -0.1, ...T('owner', 60) }] },
  stubborn: { name: 'Stubborn', cost: 1, role: 'Top', tags: ['comeback'], art: 'shield', sky: 'ember',
    trigger: { on: 'deaths', n: 2 }, effects: [{ stat: 'taken', v: -0.08, ...T('owner', 45) }] },
  'clear-speed': { name: 'Clear Speed', cost: 1, role: 'Jungle', tags: ['early', 'objective'], art: 'boot', sky: 'moss',
    trigger: { on: 'first_capture' }, effects: [{ stat: 'ms', v: 0.15, ...T('team', 45) }, { stat: 'cap', v: 0.7, ...T('team', 45) }, { stat: 'dmg', v: 0.05, ...T('team', 45) }] },
  'bounty-hunter': { name: 'Bounty Hunter', cost: 2, role: 'Jungle', tags: ['fight'], art: 'bounty', sky: 'olive',
    trigger: { on: 'deaths', role: 'adc', enemy: true, n: 2 }, effects: [{ stat: 'dmg', v: 0.02, ...T('team', 45) }, { stat: 'respawn', v: 0.05, ...T('enemy', 45) }] },
  'triple-threat': { name: 'Triple Threat', cost: 1, role: 'Mid', tags: ['fight'], art: 'crosshair', sky: 'dusk',
    trigger: { on: 'kills', n: 3 }, effects: [{ stat: 'dmg', v: 0.3, ...T('owner', 60) }, { stat: 'cd', v: 0.15, ...T('owner', 60) }] },
  'called-shot': { name: 'Called Shot', cost: 2, role: 'Mid', tags: ['objective', 'fight'], art: 'crosshair', sky: 'teal',
    trigger: { on: 'majority' }, effects: [{ stat: 'tactic', tactic: { focus: 'adc' }, ...T('team', 45) }, { stat: 'dmg', v: 0.02, ...T('team', 45) }] },
  hypercarry: { name: 'Hypercarry', cost: 2, role: 'Carry', tags: ['scale', 'fight'], art: 'crosshair', sky: 'ember',
    trigger: { on: 'kills', n: 4 }, effects: [{ stat: 'dmg', v: 0.035, ...T('owner', 60) }, { stat: 'cd', v: 0.08, ...T('owner', 60) }] },
  'second-wind': { name: 'Second Wind', cost: 1, role: 'Carry', tags: ['comeback'], art: 'boot', sky: 'dusk',
    trigger: { on: 'deaths', n: 2 }, effects: [{ stat: 'respawn', v: -0.06, ...T('team', 30) }, { stat: 'dmg', v: 0.02, ...T('owner', 60) }] },
  'hold-the-line': { name: 'Hold the Line', cost: 1, role: 'Support', tags: ['objective', 'comeback'], art: 'ward', sky: 'teal', repeat: true,
    trigger: { on: 'point_lost' }, effects: [{ stat: 'taken', v: -0.03, ...T('team', 12) }] },
  peel: { name: 'Peel', cost: 2, role: 'Support', tags: ['scale'], art: 'shield', sky: 'forest',
    trigger: { on: 'deaths', role: 'adc', n: 1 }, effects: [{ stat: 'shield', v: 0.08, ...T('team', 8) }] },
  // Trait and attribute cards (slot 2, and slot 3 for 70+)
  'spoils-of-war': { name: 'Spoils of War', cost: 1, tags: ['early', 'fight'], art: 'bounty', sky: 'ember',
    trigger: { on: 'first_blood', us: true }, effects: [{ stat: 'dmg', v: 0.04, ...T('team', 45) }] },
  'shake-it-off': { name: 'Shake It Off', cost: 1, tags: ['comeback'], art: 'shield', sky: 'dusk',
    trigger: { on: 'first_blood', us: false }, effects: [{ stat: 'dmg', v: 0.065, ...T('team', 45) }] },
  'never-say-die': { name: 'Never Say Die', cost: 2, tags: ['comeback'], art: 'shield', sky: 'ember',
    trigger: { on: 'behind', x: 5 }, effects: [{ stat: 'taken', v: -0.06, ...T('team', 60) }, { stat: 'dmg', v: 0.05, ...T('team', 60) }] },
  'call-it': { name: 'Call It', cost: 2, tags: ['objective', 'fight'], art: 'crosshair', sky: 'olive',
    trigger: { on: 'hold', s: 20 }, effects: [{ stat: 'dmg', v: 0.05, ...T('team', 45) }] },
  'press-the-claim': { name: 'Press the Claim', cost: 1, tags: ['objective'], art: 'ward', sky: 'moss',
    trigger: { on: 'majority' }, effects: [{ stat: 'cap', v: 0.3, ...T('team', 45) }] },
  'blood-in-the-water': { name: 'Blood in the Water', cost: 1, tags: ['fight'], art: 'bounty', sky: 'ember',
    trigger: { on: 'multikill', n: 2 }, effects: [{ stat: 'ms', v: 0.035, ...T('team', 30) }, { stat: 'dmg', v: 0.05, ...T('team', 30) }] },
  'dead-heat': { name: 'Dead Heat', cost: 2, tags: ['scale'], art: 'crosshair', sky: 'teal',
    trigger: { on: 'close', t: 120, x: 3 }, effects: [{ stat: 'dmg', v: 0.035, ...T('team', 60) }] },
  'long-game': { name: 'Long Game', cost: 1, tags: ['scale'], art: 'ward', sky: 'forest',
    trigger: { on: 'time', t: 150 }, effects: [{ stat: 'cd', v: 0.04, ...T('team', 60) }] },
  'closing-argument': { name: 'Closing Argument', cost: 2, tags: ['early', 'fight'], art: 'bounty', sky: 'olive',
    trigger: { on: 'ahead', x: 6 }, effects: [{ stat: 'score', v: 1, target: 'team' }, { stat: 'ms', v: 0.06, ...T('team', 30) }] },
  'last-stand': { name: 'Last Stand', cost: 2, tags: ['comeback'], art: 'shield', sky: 'dusk',
    trigger: { on: 'behind', x: 8 }, effects: [{ stat: 'respawn', v: -0.2, ...T('team', 45) }, { stat: 'taken', v: -0.08, ...T('team', 45) }] },
  'first-claim': { name: 'First Claim', cost: 1, tags: ['early', 'objective'], art: 'ward', sky: 'olive',
    trigger: { on: 'first_capture' }, effects: [{ stat: 'dmg', v: 0.12, ...T('team', 45) }] },
  'closing-time': { name: 'Closing Time', cost: 2, tags: ['objective'], art: 'bounty', sky: 'moss',
    trigger: { on: 'hold', s: 45 }, effects: [{ stat: 'score', v: 1, target: 'team' }] },
  'can-opener': { name: 'Can Opener', cost: 1, tags: ['draft'], art: 'crosshair', sky: 'olive',
    trigger: { on: 'enemy_class', cls: 'Tank', n: 2 }, effects: [{ stat: 'dmg', v: 0.02, target: 'team' }] },
  'mage-hunter': { name: 'Mage Hunter', cost: 1, tags: ['draft'], art: 'shield', sky: 'teal',
    trigger: { on: 'enemy_class', cls: 'Mage', n: 2 }, effects: [{ stat: 'taken', v: -0.01, target: 'team' }] },
  // Signature cards (slot 3, one per player)
  specialist: { name: 'Specialist', cost: 3, signature: true, tags: ['draft', 'scale'], art: 'holder', sky: 'forest',
    trigger: { on: 'owner_champ' }, effects: [{ stat: 'dmg', v: 0.04, target: 'owner' }, { stat: 'cd', v: 0.06, target: 'owner' }] },
  franchise: { name: 'Franchise', cost: 3, signature: true, tags: ['fight'], art: 'holder', sky: 'dusk',
    trigger: { on: 'time', t: 60 }, effects: [{ stat: 'dmg', v: 0.05, ...T('owner', 90) }, { stat: 'taken', v: -0.05, ...T('owner', 90) }] },
};
export const CARD_IDS = Object.keys(CARDS);

// ---------- Ownership (CARD_PLAN §8): role card, then trait › best attribute, a third card at 70+ ----------
const ROLE_CARDS = { Top: ['island-lord', 'stubborn'], Jungle: ['clear-speed', 'bounty-hunter'], Mid: ['triple-threat', 'called-shot'], Carry: ['hypercarry', 'second-wind'], Support: ['hold-the-line', 'peel'] };
const TRAIT_CARD = { Aggressive: 'spoils-of-war', 'Hot-headed': 'blood-in-the-water', 'Clutch performer': 'never-say-die', Shotcaller: 'call-it', 'Team player': 'press-the-claim', 'Ice cold': 'dead-heat', Professional: 'long-game', Sharpshooter: 'closing-time' };
const ATTR_CARDS = { aim: ['first-claim', 'triple-threat'], reflexes: ['shake-it-off'], execution: ['closing-argument'], decision: ['can-opener', 'mage-hunter', 'dead-heat'], positioning: ['last-stand'], teamwork: ['press-the-claim'], aggression: ['spoils-of-war', 'blood-in-the-water'], resilience: ['long-game', 'hold-the-line'], clutch: ['never-say-die'] };
const hash = s => [...s].reduce((h, ch) => (Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0), 2166136261);

/** A player's cards: [{ id, rarity, champ? }]. Derived from role, traits, attributes and overall, so they change as the player does. */
export function playerCards(p) {
  const ov = overall(p), first = ROLE_CARDS[p.role][hash(p.id) % 2];
  const sources = [...p.traits.map(t => TRAIT_CARD[t]), ...[...ATTRS].sort((a, b) => p[b] - p[a]).flatMap(a => ATTR_CARDS[a])].filter(id => id && id !== first);
  const [second, third] = [...new Set(sources)];
  const best = Object.entries(p.prof ?? {}).filter(([id]) => CHAMPS[id]?.roles.includes(p.role)).sort((a, b) => b[1] - a[1])[0];
  const rar = (isBest) => (ov >= 80 ? 'epic' : ov >= 70 ? (isBest ? 'epic' : 'rare') : ov >= 60 && isBest ? 'rare' : 'common');
  const out = [{ id: first, rarity: rar(false) }, { id: second, rarity: rar(true) }];
  if (ov >= 80) out.push({ id: 'franchise', rarity: 'signature' });
  else if (ov >= 75 && best?.[1] >= 1.1) out.push({ id: 'specialist', rarity: 'signature', champ: best[0] });
  else if (ov >= 70) out.push({ id: third, rarity: rar(false) });
  return out;
}

/** Every card a lineup brings: [{ key, pid, slot, ...held }]. key = pid:id, unique in a squad. */
export const poolOf = players => players.flatMap((p, slot) => playerCards(p).map(c => ({ ...c, key: `${p.id}:${c.id}`, pid: p.id, slot })));
export const costOf = c => (CARDS[c.id].signature ? 3 : Math.min(3, CARDS[c.id].cost + RARITY[c.rarity].cost));

/** Why a loadout (pool entries) is illegal, or null. used = keys loaded earlier in the series (Fearless cards). */
export function loadoutError(cards, used = []) {
  if (cards.length > LOADOUT.size) return `At most ${LOADOUT.size} cards`;
  if (cards.reduce((n, c) => n + costOf(c), 0) > LOADOUT.budget) return `Over the ${LOADOUT.budget} Focus budget`;
  if (cards.some(c => cards.filter(x => x.pid === c.pid).length > LOADOUT.perPlayer)) return `At most ${LOADOUT.perPlayer} cards from one player`;
  if (cards.filter(c => c.rarity === 'signature').length > 1) return 'At most one Signature card';
  if (cards.some(c => used.includes(c.key))) return 'Already loaded this series';
  return null;
}

// Plan fit for the AI: tags each plan likes.
const PLAN_TAGS = { early: ['early', 'fight'], scale: ['scale', 'comeback'], split: ['objective'], objective: ['objective', 'scale'], standard: ['fight', 'objective'] };
const planKey = plan => Object.entries({ early: 'hunt', split: 'starve' }).find(([, v]) => plan?.preset === v)?.[0] ?? (plan?.posture === 'defensive' ? (plan?.preset === 'starve' ? 'objective' : 'scale') : 'standard');
/** Expected win-chance gain of a held card (measured, CARD_STATS), plus a nudge for cards that fit the plan. */
export const cardValue = (c, plan) => winGain(c) + (CARDS[c.id].tags.some(t => PLAN_TAGS[planKey(plan)]?.includes(t)) ? 0.005 : 0);
/** Best legal loadout from a pool (every 1-3 card combination). */
export function bestLoadout(pool, used = [], plan) {
  const free = pool.filter(c => !used.includes(c.key));
  let best = [], bestV = -1;
  const val = cs => cs.reduce((n, c) => n + cardValue(c, plan), 0);
  for (let i = 0; i < free.length; i++) for (let j = i; j < free.length; j++) for (let k = j; k < free.length; k++) {
    const cs = [...new Set([free[i], free[j], free[k]])];
    if (!loadoutError(cs) && val(cs) > bestV) { best = cs; bestV = val(cs); }
  }
  return best;
}

// ---------- Measured effects (apps/manager/test/card-fit.mjs; even teams, the card on one side) ----------
// [fire rate, win-chance gain at Common, at Epic]: one slope per card fitted from both rarities (Epic = 1.6 x Common),
// clamped to 0.5-2.5 points (Signature 0.5-4), since single measurements are +-4 points. Rare is interpolated.
export const CARD_STATS = {
  "island-lord": [0.6, 0.009, 0.015], "stubborn": [0.95, 0.011, 0.017], "clear-speed": [0.5, 0.02, 0.032], "bounty-hunter": [0.63, 0.015, 0.024], "triple-threat": [0.58, 0.025, 0.04], "called-shot": [0.99, 0.018, 0.028], "hypercarry": [0.8, 0.005, 0.008], "second-wind": [0.62, 0.016, 0.026], "hold-the-line": [1.0, 0.019, 0.031], "peel": [0.88, 0.024, 0.038], "spoils-of-war": [0.51, 0.012, 0.019], "shake-it-off": [0.5, 0.018, 0.028], "never-say-die": [0.51, 0.025, 0.04], "call-it": [0.93, 0.025, 0.04], "press-the-claim": [0.99, 0.01, 0.017], "blood-in-the-water": [0.88, 0.008, 0.012], "dead-heat": [0.43, 0.019, 0.031], "long-game": [1.0, 0.013, 0.021], "closing-argument": [0.49, 0.019, 0.03], "last-stand": [0.3, 0.014, 0.022], "first-claim": [0.5, 0.025, 0.04], "closing-time": [0.61, 0.02, 0.033], "can-opener": [0.31, 0.024, 0.038], "mage-hunter": [0.61, 0.018, 0.028], "specialist": [1.0, 0.04, 0.04], "franchise": [1.0, 0.04, 0.04]
};
export function winGain(c) {
  const [, lo, hi] = CARD_STATS[c.id];
  return c.rarity === 'epic' ? hi : c.rarity === 'rare' ? lo + (hi - lo) * 0.5 : lo;
}

// ---------- Sim spec ----------
const scaleV = (e, m) => (e.v == null || e.stat === 'score' ? e : { ...e, v: +(e.v * m).toFixed(3) });
/** Held card -> rarity-scaled effects (and the Specialist's champion). */
function scaled(c) {
  const d = CARDS[c.id], m = RARITY[d.signature ? 'signature' : c.rarity].mult;
  return { trigger: d.trigger.on === 'owner_champ' ? { ...d.trigger, champ: c.champ ?? 'huntress' } : d.trigger, effects: d.effects.map(e => scaleV(e, m)) };
}
/** Pool entry -> sim CardSpec (sim/cards.ts) plus the career fields the fast engine reads (rarity, pid). */
export const cardSpec = c => ({ id: c.id, owner: SLOTS[c.slot], ...scaled(c), ...(CARDS[c.id].repeat ? { repeat: true } : {}), rarity: c.rarity, pid: c.pid });

/** Draft-time hint for a loaded card: Live (draft trigger met), Dead (can't fire), or Likely with the measured fire rate. */
export function triggerStatus(c, d, side) {
  const tr = CARDS[c.id].trigger, theirs = d.picks[1 - side], mine = d.picks[side];
  if (tr.on === 'enemy_class') {
    const have = theirs.filter(id => id && CHAMPS[id].cls === tr.cls).length, open = theirs.filter(id => !id).length;
    return have >= tr.n ? 'Live' : have + open < tr.n ? 'Dead' : 'Pending';
  }
  if (tr.on === 'owner_champ') {
    const champ = c.champ ?? 'huntress';
    return mine[c.slot] === champ ? 'Live' : mine[c.slot] || d.bans.flat().includes(champ) || d.picks.flat().includes(champ) ? 'Dead' : 'Pending';
  }
  return `Likely · ${Math.round(CARD_STATS[c.id][0] * 100)}%`;
}

// ---------- Rules text ----------
// Keywords are wrapped as [[keyword]] so the UI can underline them with a glossary tooltip.
export const GLOSSARY = {
  majority: 'Owning 2 of the 3 capture points. The majority holder scores 1 point every 15 s.',
  Repeat: 'Fires every time the trigger happens, not just once a game.',
};
const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const pct = v => `${v > 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)}%`;
const ROLE_OF = { top: 'Top', jungle: 'Jungle', mid: 'Mid', adc: 'Carry', support: 'Support' };
function whenText(t, c) {
  switch (t.on) {
    case 'first_capture': return 'We make the first capture';
    case 'majority': return 'We take the [[majority]]';
    case 'point_lost': return 'The enemy takes a point we held';
    case 'hold': return `We hold the [[majority]] for ${t.s} s`;
    case 'behind': return `We trail by ${t.x}+ points`;
    case 'ahead': return `We lead by ${t.x}+ points`;
    case 'close': return `The score is within ${t.x} at ${clock(t.t)}`;
    case 'time': return `The clock reaches ${clock(t.t)}`;
    case 'first_blood': return t.us ? 'We draw first blood' : 'The enemy draws first blood';
    case 'kills': return `Holder reaches ${t.n} kills`;
    case 'deaths': return t.role ? `${t.enemy ? 'Their' : 'Our'} ${ROLE_OF[t.role]} has died${t.n > 1 ? ` ${t.n} times` : ''}` : `Holder has died ${t.n} times`;
    case 'multikill': return `An ally scores ${t.n} kills within 10 s`;
    case 'alive': return `Holder hasn't died by ${clock(t.t)}`;
    case 'enemy_class': return `The enemy drafts ${t.n}+ ${t.cls}s`;
    case 'owner_champ': return `Holder plays ${CHAMPS[c.champ ?? 'huntress'].name}`;
  }
  return '';
}
const TACTIC = { hunt: 'Hunt', hold_the_pit: 'Hold the pit', starve: 'Starve' };
function effText(e) {
  switch (e.stat) {
    case 'dmg': return `${pct(e.v)} damage`;
    case 'taken': return `takes ${Math.round(Math.abs(e.v) * 100)}% ${e.v < 0 ? 'less' : 'more'} damage`;
    case 'ms': return `${pct(e.v)} move speed`;
    case 'cd': return `${pct(e.v)} cooldown recovery`;
    case 'cap': return `${pct(e.v)} capture speed`;
    case 'respawn': return `respawn timers ${pct(e.v)}`;
    case 'shield': return `a shield of ${Math.round(e.v * 100)}% max HP`;
    case 'score': return `+${e.v} point`;
    case 'tactic': return `switches to ${[e.tactic.preset && TACTIC[e.tactic.preset], e.tactic.aggression > 0 && 'aggressive', e.tactic.focus && `focus the enemy ${ROLE_OF[e.tactic.focus]}`].filter(Boolean).join(', ')}`;
  }
  return '';
}
const durText = e => (e.stat === 'score' ? '' : e.dur == null ? ' for the game' : ` for ${e.dur} s`);
const WHO = { team: 'Team', owner: 'Holder', enemy: 'Enemy' };
// Effects are grouped by target ("Team +8% damage, +6% move speed for 30 s; enemy ..."); a duration is said once per run of equal durations.
function thenText(effects) {
  const groups = [];
  for (const e of effects) { const g = groups.find(x => x.target === e.target); g ? g.list.push(e) : groups.push({ target: e.target, list: [e] }); }
  return groups.map((g, gi) => {
    const items = g.list.map((e, i) => effText(e) + (g.list[i + 1] && durText(g.list[i + 1]) === durText(e) ? '' : durText(e)));
    const text = `${WHO[g.target]} ${items.join(', ')}`;
    return gi ? text[0].toLowerCase() + text.slice(1) : text;
  }).join('; ');
}

// A held card: { id, rarity, champ? }. Signature cards are always Signature.
export function cardView(c) {
  const d = CARDS[c.id], rarity = d.signature ? 'signature' : c.rarity, R = RARITY[rarity], s = scaled(c);
  const targets = [...new Set(s.effects.map(e => (e.target === 'owner' ? 'holder' : e.target)))];
  const name = c.id === 'specialist' ? `${CHAMPS[c.champ ?? 'huntress'].name} Specialist` : d.name;
  return { ...d, id: c.id, name, rarity, R, lv: c.lv ?? 1, cost: costOf({ ...c, rarity }), effects: s.effects, targets,
    when: whenText(d.trigger, c), then: thenText(s.effects) + (d.repeat ? '. [[Repeat]]' : '') };
}
