// Tactic Cards (CARD_PLAN.md). Definitions and rules text; the match runtime comes in phase C1.
// Values are Common at level 1. rarityOf() scales them; card text is always generated from the data.
import { CHAMPS } from './data.js';

export const RARITY = {
  common: { label: 'Common', mult: 1, pips: 1, cost: 0 },
  rare: { label: 'Rare', mult: 1.3, pips: 2, cost: 0 },
  epic: { label: 'Epic', mult: 1.6, pips: 3, cost: 1 },
  signature: { label: 'Signature', mult: 1, pips: 3, cost: 0 },
};

// trigger.on: phase | camps | firstTower | killMarked | goldDown | holderPicks
// effect.stat: vision | gold | speed | mark | respawn | attr:<a> | objective | level | ultCd
// effect.target: team | holder | enemy | enemyRole:<role> | holderCards
export const CARDS = {
  'ward-river': { name: 'Ward the River', cost: 1, tags: ['early', 'vision'], art: 'ward', sky: 'teal',
    trigger: { on: 'phase', phase: 'early' }, effects: [{ stat: 'vision', v: 1, target: 'team', dur: 'phase' }] },
  'clear-speed': { name: 'Clear Speed', cost: 1, tags: ['early'], art: 'boot', sky: 'moss',
    trigger: { on: 'camps', n: 3, before: 150 }, effects: [{ stat: 'gold', v: 250, target: 'holder' }, { stat: 'speed', v: 0.05, target: 'holder', dur: 'phase' }] },
  'called-shot': { name: 'Called Shot', cost: 1, tags: ['pick'], art: 'crosshair', sky: 'dusk',
    trigger: { on: 'firstTower' }, effects: [{ stat: 'mark', target: 'enemyRole:Carry', dur: 90 }] },
  'bounty-hunter': { name: 'Bounty Hunter', cost: 2, tags: ['pick'], art: 'bounty', sky: 'olive',
    trigger: { on: 'killMarked' }, effects: [{ stat: 'gold', v: 250, target: 'team' }, { stat: 'respawn', v: 0.2, target: 'enemy', dur: 60 }] },
  'never-say-die': { name: 'Never Say Die', cost: 2, tags: ['comeback'], art: 'shield', sky: 'ember',
    trigger: { on: 'goldDown', x: 6000 }, effects: [{ stat: 'attr:resilience', v: 5, target: 'team', dur: 'game' }, { stat: 'attr:clutch', v: 5, target: 'team', dur: 'game' }, { stat: 'objective', v: -0.15, target: 'enemy', dur: 'game' }] },
  'huntress-specialist': { name: 'Huntress Specialist', cost: 3, signature: true, tags: ['draft'], art: 'holder', sky: 'forest',
    trigger: { on: 'holderPicks', champ: 'huntress' }, effects: [{ stat: 'level', v: 1, target: 'holderCards' }, { stat: 'ultCd', v: -0.15, target: 'holder', dur: 'game' }] },
};

// A held card: { id, rarity, lv }. Signature cards are always Signature.
export function cardView(c) {
  const d = CARDS[c.id], rarity = d.signature ? 'signature' : c.rarity, R = RARITY[rarity];
  const scale = e => {
    if (d.signature || ['mark', 'level', 'vision'].includes(e.stat)) return e.stat === 'mark' ? { ...e, dur: Math.round(e.dur * R.mult) } : e;
    const v = e.stat === 'gold' ? Math.round(e.v * R.mult / 25) * 25 : e.stat.startsWith('attr:') ? Math.round(e.v * R.mult) : +(e.v * R.mult).toFixed(3);
    return { ...e, v };
  };
  const effects = d.effects.map(scale);
  const targets = [...new Set(effects.map(e => (e.target.startsWith('enemy') ? 'enemy' : e.target === 'team' ? 'team' : 'holder')))];
  return { ...d, id: c.id, rarity, R, lv: c.lv ?? 1, cost: Math.min(3, d.cost + R.cost), effects, targets, when: whenText(d.trigger), then: thenText(effects, d.trigger) };
}

// ---------- Rules text ----------
// Keywords are wrapped as [[keyword]] so the UI can underline them with a glossary tooltip.
export const GLOSSARY = {
  'early phase': 'The laning phase, until 3:00 on the game clock.',
  'Early phase': 'The laning phase, until 3:00 on the game clock.',
  marked: 'A marked enemy can be targeted by cards that trigger on marked kills.',
  Marks: 'A marked enemy can be targeted by cards that trigger on marked kills.',
};
const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const pct = v => `${v > 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)}%`;
function whenText(t) {
  switch (t.on) {
    case 'phase': return `[[${t.phase[0].toUpperCase()}${t.phase.slice(1)} phase]] starts`;
    case 'camps': return `3rd camp cleared before ${clock(t.before)}`.replace('3rd', `${t.n}${t.n === 3 ? 'rd' : 'th'}`);
    case 'firstTower': return 'First tower for us';
    case 'killMarked': return 'We kill a [[marked]] target';
    case 'goldDown': return `We trail by ${t.x.toLocaleString('en')}+ gold`;
    case 'holderPicks': return `Holder picks ${CHAMPS[t.champ].name}`;
  }
  return '';
}
const durText = (d, t) => (d == null ? '' : typeof d === 'number' ? ` for ${d} s` : d === 'phase' ? ' until the [[early phase]] ends' : t.on === 'holderPicks' ? ' for the game' : ' for the rest of the game');
const WHO = { team: 'Team', holder: 'Holder', enemy: 'Enemy', holderCards: "Holder's other loaded cards" };
function effText(e, target) {
  switch (e.stat) {
    case 'vision': return `vision +${e.v}`;
    case 'gold': return `+${e.v} gold${target === 'team' ? ' each' : ''}`;
    case 'speed': return `${pct(e.v)} move speed`;
    case 'mark': return `[[Marks]] the enemy ${target.split(':')[1]}`;
    case 'respawn': return `respawn timers ${pct(e.v)}`;
    case 'objective': return `objective damage ${pct(e.v)}`;
    case 'level': return `+${e.v} level`;
    case 'ultCd': return `${CHAMPS.huntress.name} ult cooldown ${pct(e.v)}`;
    default: return e.stat.startsWith('attr:') ? `+${e.v} ${e.stat.slice(5)}` : '';
  }
}
// Effects are grouped by target ("Team +8 resilience, +8 clutch; enemy ..."); a duration shared by every group is said once.
function thenText(effects, t) {
  const groups = [];
  for (const e of effects) { const g = groups.find(x => x.target === e.target); g ? g.list.push(e) : groups.push({ target: e.target, list: [e] }); }
  const lastDur = g => g.list.at(-1).dur;
  const shared = groups.length > 1 && groups.every(g => lastDur(g) === lastDur(groups[0]));
  return groups.map((g, gi) => {
    const items = g.list.map((e, i) => {
      const next = g.list[i + 1], endOfGroup = !next;
      const say = e.dur != null && (endOfGroup ? !shared || gi === groups.length - 1 : next.dur !== e.dur);
      return effText(e, g.target) + (say ? durText(e.dur, t) : '');
    });
    const who = g.list[0].stat === 'mark' || g.list[0].stat === 'ultCd' ? '' : `${WHO[g.target] ?? ''} `;
    const text = `${who}${items.join(', ')}`;
    return gi && who ? text[0].toLowerCase() + text.slice(1) : text;
  }).join('; ');
}
