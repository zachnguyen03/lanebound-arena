// 5v5 tick-based MOBA match engine. Pure logic + seeded RNG: same seed and inputs give the same match.
// Each champion re-thinks on its own decision tick (faster for high Game Sense), scoring every intent
// against the game state and its team's tactics, and executes that intent every tick in between.
import { CHAMPS, ROLES, ITEMS, BUILDS, TF_DEFAULT, TRAITS, COMP_BEATS, compOf } from './data.js';
import { FOUNTAIN, LANE_PATH, CAMPS, TITAN_PIT, SHRINE_PIT, makeStructures, steer, isBlocked } from './map.js';

export const TICK = 0.1;
export const MAX_TIME = 600;          // 10:00 cap, then tiebreak
const LANING_END = 180, LATE = 360;
const WAVE_EVERY = 25;
const RETREAT_AT = { aggressive: 0.15, balanced: 0.3, defensive: 0.45 };
const ENGAGE = { aggressive: 18, balanced: 14, defensive: 10 };
const TOWER_RANGE = 9;
const ROLE_LANE = { Top: 'top', Jungle: null, Mid: 'mid', Carry: 'bot', Support: 'bot' };
const RANGED = new Set(['Marksman', 'Mage', 'Enchanter']);
const STYLE_TO_STRATEGY = { teamfight: 'group', split: 'split', macro: 'farm' };
export const PHASES = ['early', 'mid', 'late'];
export const phaseAt = t => (t < LANING_END ? 'early' : t < LATE ? 'mid' : 'late');

// Game plan: posture + style per phase, plus global target focus, jungle focus, objective priority, adaptation.
export const PLAN_PRESETS = {
  standard: { name: 'Standard', phases: { early: { posture: 'balanced', style: 'macro' }, mid: { posture: 'balanced', style: 'teamfight' }, late: { posture: 'balanced', style: 'teamfight' } }, focus: 'nearest', jungle: 'any', objective: 'titan', adapt: true },
  early: { name: 'Early aggression', phases: { early: { posture: 'aggressive', style: 'teamfight' }, mid: { posture: 'aggressive', style: 'teamfight' }, late: { posture: 'balanced', style: 'teamfight' } }, focus: 'weakest', jungle: 'mid', objective: 'shrine', adapt: true },
  scale: { name: 'Scale and teamfight', phases: { early: { posture: 'defensive', style: 'macro' }, mid: { posture: 'balanced', style: 'macro' }, late: { posture: 'aggressive', style: 'teamfight' } }, focus: 'carry', jungle: 'bot', objective: 'titan', adapt: true },
  split: { name: 'Split map', phases: { early: { posture: 'balanced', style: 'macro' }, mid: { posture: 'balanced', style: 'split' }, late: { posture: 'balanced', style: 'split' } }, focus: 'nearest', jungle: 'top', objective: 'towers', adapt: true },
  objective: { name: 'Objective control', phases: { early: { posture: 'balanced', style: 'macro' }, mid: { posture: 'balanced', style: 'teamfight' }, late: { posture: 'defensive', style: 'teamfight' } }, focus: 'nearest', jungle: 'any', objective: 'titan', adapt: true },
};
export const clonePlan = p => JSON.parse(JSON.stringify(p ?? PLAN_PRESETS.standard));
// Flatten the current phase of a plan into the engine's tactic shape.
function tacOf(s, side) {
  const plan = s.teams[side].plan, ph = plan.phases[phaseAt(s.t)];
  return { aggression: ph.posture, strategy: STYLE_TO_STRATEGY[ph.style], priority: plan.objective === 'towers' ? 'structures' : 'objectives', focus: plan.focus, objective: plan.objective, jungle: plan.jungle };
}
// Queue a plan change; it applies at the next reset (whole team at base, or 60 s).
export function queuePlan(s, side, plan) { s.pending[side] = { plan: clonePlan(plan), at: s.t }; }

export function rngFrom(seed) { // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const fmt = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const say = (s, msg, kind = '') => s.log.push({ t: s.t, msg, kind });
const hpPct = u => u.hp / u.maxHp;
const cap = str => str[0].toUpperCase() + str.slice(1);
const isStruct = u => u.kind === 'tower' || u.kind === 'core';
const towerName = st => st.kind === 'core' ? 'the Core' : st.tier === 3 ? 'the base tower' : `the ${st.tier === 1 ? 'outer' : 'inner'} ${st.lane} tower`;
const OBJ = new Set(['titan', 'shrine']);

// ---------------- Setup ----------------
// team = { name, color, ai, plan, coach (0-20), lineup:[5 players in ROLES order] }
// player = { id, name, champ, prof, tfRole?, decision, mech, laning, positioning, vision, aggression, teamwork, resilience, clutch }
// opts.stakes (0-1): how much is riding on the game; Clutch matters more in deciding games.
export function createMatch(teamA, teamB, seed = Date.now(), opts = {}) {
  const s = {
    t: 0, tick: 0, rng: rngFrom(seed), seed, teams: [teamA, teamB], units: [], log: [], fx: [],
    over: false, winner: -1, kills: [0, 0], towers: [0, 0], buff: [0, 0], shrine: [0, 0], calls: [null, null],
    firstBlood: false, fbSide: -1, titans: [0, 0], shrines: [0, 0], adapted: false, nextId: 1, endReason: '',
    stakes: opts.stakes ?? 0, pending: [null, null], timeline: [], events: [], frames: [], planLog: [], zones: [],
  };
  for (const tm of s.teams) tm.plan = clonePlan(tm.plan);
  // Compositions: active traits per side and the counter-triangle edge (engage > poke > protect > engage).
  s.comps = [teamA, teamB].map(t => compOf(t.lineup.map(p => p.champ)));
  s.compEdge = s.comps.map((c, side) => (COMP_BEATS[c.tag] === s.comps[1 - side].tag ? 0.08 : 0));
  [teamA, teamB].forEach((team, side) => team.lineup.forEach((p, i) => {
    const c = patched(p.champ, opts.patch), role = ROLES[i];
    // Resilience narrows the spread of today's form roll.
    const spread = 0.13 - p.resilience * 0.0008, form = 1 + (s.rng() * 2 - 1) * spread;
    const coach = (team.coach ?? 10) - 10;
    const u = add(s, {
      kind: 'champ', side, role, lane: ROLE_LANE[role], name: p.name, pid: p.id, champ: p.champ, c,
      mech: p.mech * (p.prof ?? 1) * form, laning: p.laning * form, teamwork: p.teamwork * form,
      decision: Math.min(100, p.decision + coach * 0.6), positioning: p.positioning, vision: p.vision,
      aggression: p.aggression, resilience: p.resilience, clutch: p.clutch, form,
      tfRole: p.tfRole || TF_DEFAULT[c.cls], items: [], bank: 0, vis: 0,
      x: FOUNTAIN[side].x + 1.5, y: FOUNTAIN[side].y + (i - 2) * 1.2,
      level: 1, xp: 0, gold: 0, tier: 0, range: c.range, speed: c.speed, as: c.as,
      atkCd: 0, skillCd: c.cd * 0.6, intent: 'lane', target: null, nextDecision: 0,
      shield: 0, shieldUntil: 0, stunUntil: 0, slowUntil: 0, slowPct: 0, untargetableUntil: 0, frenzyUntil: 0,
      guardUntil: 0, hasteUntil: 0, burnUntil: 0, burnDps: 0, burnBy: null, ultCd: 0, bAtk: 0, bAs: 0, bDr: 0, bSpeed: 0, bUntil: 0,
      tauntBy: null, tauntUntil: 0, hitBy: {}, respawnAt: 0, streak: 0, lastKillT: -99,
      st: { k: 0, d: 0, a: 0, cs: 0, gold: 0, dmg: 0, taken: 0, heal: 0, towerDmg: 0, obj: 0, vision: 0 },
    });
    refresh(s, u, true);
  }));
  for (const st of makeStructures()) add(s, { ...st, atkCd: 0, aggro: null, aggroStreak: 0, lastChampHit: -99 });
  for (const c of CAMPS) add(s, { kind: 'camp', campSide: c.side, x: c.x, y: c.y, home: { x: c.x, y: c.y }, hp: 900, maxHp: 900, alive: false, spawnAt: 45, atk: 30, range: 2, as: 1.2, atkCd: 0, aggro: null });
  add(s, { kind: 'titan', name: 'the Titan', x: TITAN_PIT.x, y: TITAN_PIT.y, home: { ...TITAN_PIT }, hp: 6000, maxHp: 6000, alive: false, spawnAt: 240, atk: 120, range: 3, as: 1.5, atkCd: 0, aggro: null });
  add(s, { kind: 'shrine', name: 'the Shrine', x: SHRINE_PIT.x, y: SHRINE_PIT.y, home: { ...SHRINE_PIT }, hp: 4000, maxHp: 4000, alive: false, spawnAt: 120, atk: 90, range: 3, as: 1.5, atkCd: 0, aggro: null });
  s.champs = s.units.filter(u => u.kind === 'champ');
  s.structures = s.units.filter(isStruct);
  s.titan = s.units.find(u => u.kind === 'titan');
  s.shrineU = s.units.find(u => u.kind === 'shrine');
  s.neutrals = s.units.filter(u => u.side < 0);
  s.live = []; s.minions = [];
  say(s, `${teamA.name} (Blue) vs ${teamB.name} (Red). Champions are heading to their lanes.`);
  s.teams.forEach((tm, side) => logPlan(s, side));
  return s;
}

// Champion stats with the current patch applied: mods = { id: { hp, atk, cd } } as fractions (+0.05 = +5%).
function patched(id, patch) {
  const c = CHAMPS[id], m = patch?.[id];
  return m ? { ...c, hp: c.hp * (1 + (m.hp ?? 0)), atk: c.atk * (1 + (m.atk ?? 0)), cd: c.cd * (1 + (m.cd ?? 0)), ult: { ...c.ult, cd: c.ult.cd * (1 + (m.cd ?? 0)) } } : c;
}
const P = (u, k) => (u.c.passive === k);
const traitV = (s, u, stat) => u.c.traits.reduce((n, t) => { const tier = s.comps[u.side].active[t]; return n + (tier && TRAITS[t].stat === stat ? TRAITS[t].v[tier - 1] : 0); }, 0);

function add(s, u) {
  u.id = s.nextId++;
  if (u.alive === undefined) u.alive = true;
  if (u.side === undefined) u.side = -1;
  s.units.push(u);
  return u;
}

// Level / items / Shrine stacks -> max HP, attack power, attack speed, cooldowns, damage reduction.
function refresh(s, u, init = false) {
  const L = u.level, W = s.shrine[u.side];
  const it = k => u.items.reduce((n, id) => n + (ITEMS[id][k] ?? 0), 0);
  const old = u.maxHp || 0, tv = k => traitV(s, u, k);
  u.maxHp = u.c.hp * (1 + 0.09 * (L - 1) + it('hp') + tv('hp') + (P(u, 'giant') ? 0.08 : 0)) * (1 + 0.05 * W);
  u.power = u.c.atk * (1 + 0.07 * (L - 1) + it('atk') + tv('atk')) * (1 + 0.05 * W);
  u.as = u.c.as / (1 + it('as') + tv('as'));
  u.cdr = Math.min(0.4, it('cdr') + tv('cdr') + (P(u, 'spellweave') ? 0.1 : 0)); u.dr = it('dr') + tv('dr') + (P(u, 'thick') ? 0.06 : 0);
  u.ls = it('ls') + (P(u, 'lifesteal') ? 0.08 : 0) + tv('speed') * 0.8; u.healAmp = it('heal') + tv('heal') + (P(u, 'guardian') ? 0.2 : 0) + (u.c.cls === 'Enchanter' ? 0.25 : 0);
  u.speed = u.c.speed * (1 + tv('speed') + (P(u, 'swift') ? 0.08 : 0)); u.skillAmp = tv('skill');
  u.tier = u.items.length;
  u.hp = init ? u.maxHp : u.hp + Math.max(0, u.maxHp - old);
}
// Shop at the fountain: buy the next items of the class build while the bank allows.
function shop(s, u) {
  const build = BUILDS[u.c.cls];
  let bought = false;
  while (u.items.length < build.length && u.bank >= ITEMS[build[u.items.length]].cost) {
    const id = build[u.items.length];
    u.bank -= ITEMS[id].cost; u.items.push(id); bought = true;
  }
  if (bought) refresh(s, u);
}
const nextItemCost = u => { const id = BUILDS[u.c.cls][u.items.length]; return id ? ITEMS[id].cost : Infinity; };
function logPlan(s, side) {
  const p = s.teams[side].plan;
  s.planLog.push({ t: s.t, side, phases: PHASES.map(ph => `${p.phases[ph].posture} ${p.phases[ph].style}`), objective: p.objective, focus: p.focus, jungle: p.jungle });
}

function gainXp(s, u, xp) {
  u.xp += xp;
  const lvl = Math.min(12, 1 + Math.floor(Math.sqrt(u.xp / 45)));
  if (lvl !== u.level) { u.level = lvl; refresh(s, u); }
}
function gainGold(s, u, g) { u.gold += g; u.st.gold += g; u.bank += g; }

export function runMatch(teamA, teamB, seed, opts) {
  const s = createMatch(teamA, teamB, seed, opts);
  while (!s.over) step(s);
  return s;
}

// ---------------- Main tick ----------------
export function step(s) {
  if (s.over) return;
  s.tick++;
  s.t = s.tick / 10;

  if (s.tick % (WAVE_EVERY * 10) === 50) spawnWaves(s);
  for (const u of s.neutrals) {
    if (!u.alive && s.t >= u.spawnAt) {
      u.alive = true; u.hp = u.maxHp; u.x = u.home.x; u.y = u.home.y; u.aggro = null;
      if (OBJ.has(u.kind)) say(s, `${cap(u.name)} has spawned.`, 'obj');
    }
  }
  if (s.tick % 20 === 0) { teamThink(s, 0); teamThink(s, 1); }
  if (s.tick % 10 === 0) {
    for (const u of s.champs) if (u.alive) { gainGold(s, u, 2); gainXp(s, u, 1); u.st.vision += (0.25 + u.vision / 200 + (u.role === 'Support' ? 0.3 : u.role === 'Jungle' ? 0.15 : 0)) / 15; }
    for (const side of [0, 1]) applyPending(s, side);
  }
  if (s.tick % 50 === 0) record(s);

  s.live = s.units.filter(u => u.alive && u.side >= 0);
  s.minions = s.live.filter(u => u.kind === 'minion');
  const order = s.tick % 2 ? s.units : [...s.units].reverse(); // alternate so neither side always acts first
  for (const u of order) {
    if (s.over) break;
    if (!u.alive) {
      if (u.kind === 'champ' && s.t >= u.respawnAt) respawn(s, u);
      continue;
    }
    if (u.kind === 'champ') champTick(s, u);
    else if (u.kind === 'minion') minionTick(s, u);
    else if (isStruct(u)) towerTick(s, u);
    else neutralTick(s, u);
  }
  if (s.zones.length) tickZones(s);
  separate(s);
  if (s.tick % 50 === 0) s.units = s.units.filter(u => u.alive || u.kind !== 'minion');
  s.fx = s.fx.filter(f => (f.ttl -= TICK) > 0);

  if (!s.adapted && s.t >= 300) adapt(s);
  if (s.over) record(s);
  if (!s.over && s.t >= MAX_TIME) timeUp(s);
}

function spawnWaves(s) {
  const base = 1 + s.t / 400;
  for (const side of [0, 1]) for (const lane of ['top', 'mid', 'bot']) {
    const path = side ? [...LANE_PATH[lane]].reverse() : LANE_PATH[lane];
    // Breaking the enemy inner tower in a lane empowers your minions there.
    const sup = s.structures.some(t => t.side !== side && t.lane === lane && t.tier === 2 && !t.alive) ? 1.6 : 1;
    for (let i = 0; i < 3; i++) {
      const caster = i === 2, scale = base * sup;
      add(s, {
        kind: 'minion', side, lane, path, wp: 1, x: path[0].x + (i - 1) * 0.7, y: path[0].y + (i - 1) * 0.7,
        hp: (caster ? 200 : 300) * scale, maxHp: (caster ? 200 : 300) * scale, atk: (caster ? 24 : 18) * scale,
        range: caster ? 6 : 2, as: caster ? 1.4 : 1.2, speed: 3.6, atkCd: 0, target: null, retarget: 0,
      });
    }
  }
}

// Every 5 s: team gold for the gold-lead graph and champion positions for the match report map.
function record(s) {
  const last = s.timeline.at(-1);
  if (last && last.t === s.t) return;
  const gold = side => Math.round(s.champs.filter(c => c.side === side).reduce((n, c) => n + c.st.gold, 0));
  s.timeline.push({ t: s.t, g: [gold(0), gold(1)] });
  s.frames.push({ t: s.t, p: s.champs.map(c => [Math.round(c.x * 10) / 10, Math.round(c.y * 10) / 10, c.alive ? 1 : 0]), st: s.structures.map(st => (st.alive ? 1 : 0)) });
}

function applyPending(s, side) {
  const p = s.pending[side];
  if (!p) return;
  const team = s.champs.filter(c => c.side === side && c.alive);
  if (s.t - p.at < 60 && !team.every(c => Math.hypot(c.x - FOUNTAIN[side].x, c.y - FOUNTAIN[side].y) < 12)) return;
  s.teams[side].plan = p.plan; s.pending[side] = null;
  say(s, `${s.teams[side].name} reset and switch to the new game plan.`, 'coach');
  logPlan(s, side);
}

function respawn(s, u) {
  Object.assign(u, {
    alive: true, hp: u.maxHp, x: FOUNTAIN[u.side].x, y: FOUNTAIN[u.side].y, intent: 'lane', target: null, lastSpot: null,
    nextDecision: s.t, shield: 0, stunUntil: 0, slowUntil: 0, tauntUntil: 0, burnUntil: 0, hitBy: {},
  });
  shop(s, u);
}

// ---------------- Team-level calls (the shot-caller) ----------------
function teamThink(s, side) {
  const tac = tacOf(s, side), mine = aliveCount(s, side), theirs = aliveCount(s, 1 - side), adv = mine - theirs;
  const shift = tac.strategy === 'farm' ? 120 : 0;
  let call = null;
  for (const obj of tac.objective === 'shrine' ? [s.shrineU, s.titan] : [s.titan, s.shrineU]) {
    if (!obj.alive) continue;
    const want = tac.priority === 'objectives' ? adv >= 0 && s.t >= 150
      : adv >= 1 || (s.t >= LANING_END + shift && adv >= 0 && obj.hp < obj.maxHp * 0.5);
    if (want) { call = { type: 'objective', target: obj }; break; }
  }
  if (!call && s.t >= LANING_END + shift) {
    const groupUp = tac.strategy === 'group' || adv >= 2 || s.t >= LATE + shift || tac.priority === 'structures';
    const target = pushTarget(s, side);
    if (groupUp && target && mine >= 3) call = { type: 'push', target };
  }
  const prev = s.calls[side];
  if (call && prev?.target !== call.target) {
    const what = call.type === 'objective' ? call.target.name : towerName(call.target);
    say(s, `${s.teams[side].name} call ${call.type === 'objective' ? 'for' : 'a push on'} ${what}.`, 'call');
  }
  s.calls[side] = call;
}

const aliveCount = (s, side) => s.champs.filter(u => u.side === side && u.alive).length;
export function vulnerable(s, st) {
  if (!st.alive) return false;
  if (st.tier === 4) return !s.structures.find(o => o.side === st.side && o.tier === 3).alive;
  if (st.tier === 3) return s.structures.some(o => o.side === st.side && o.tier === 2 && !o.alive);
  if (st.tier === 2) return !s.structures.find(o => o.side === st.side && o.lane === st.lane && o.tier === 1).alive;
  return true;
}
function pushTarget(s, side) {
  const cands = s.structures.filter(st => st.side !== side && vulnerable(s, st));
  if (!cands.length) return null;
  // Prefer structures with own minions nearby, then the lowest HP.
  const value = st => s.minions.filter(m => m.side === side && m.alive && dist(m, st) < 14).length * 300 - st.hp;
  return cands.reduce((a, b) => (value(b) > value(a) ? b : a));
}

// Halftime team talk for AI coaches.
function adapt(s) {
  s.adapted = true;
  s.teams.forEach((tm, side) => {
    if (!tm.plan.adapt || (!tm.ai && s.pending[side])) return;
    const diff = (s.kills[side] - s.kills[1 - side]) + (s.towers[side] - s.towers[1 - side]) * 2;
    const p = tm.plan;
    if (diff < -2) { for (const ph of ['mid', 'late']) p.phases[ph] = { posture: 'aggressive', style: 'teamfight' }; p.objective = 'titan'; say(s, `${tm.name} adapt: "We're behind. Group up and force objectives!"`, 'coach'); logPlan(s, side); }
    else if (diff > 5) { p.phases.late = { posture: 'defensive', style: 'macro' }; p.objective = 'towers'; say(s, `${tm.name} adapt: "Play safe and take their towers."`, 'coach'); logPlan(s, side); }
  });
}

// ---------------- Champion brain ----------------
function champTick(s, u) {
  u.atkCd -= TICK; u.skillCd -= TICK; if (u.level >= 6) u.ultCd -= TICK;
  if (u.bUntil && u.bUntil <= s.t) { u.bAtk = u.bAs = u.bDr = u.bSpeed = 0; u.bUntil = 0; }
  if (u.shieldUntil < s.t) u.shield = 0;
  if (dist(u, FOUNTAIN[u.side]) < 8) { u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.1 * TICK); if (u.bank >= nextItemCost(u)) shop(s, u); }
  if (dist(u, FOUNTAIN[1 - u.side]) < 8) hurt(s, null, u, 300 * TICK);
  if (u.burnUntil > s.t && u.burnBy) hurt(s, u.burnBy, u, u.burnDps * TICK);
  if (!u.alive || u.stunUntil > s.t) return;
  if (s.t >= u.nextDecision || (u.target && !u.target.alive)) {
    decide(s, u);
    u.nextDecision = s.t + (1.3 - u.decision / 100) * (0.8 + s.rng() * 0.4);
  }
  act(s, u);
}

function decide(s, u) {
  const tac = tacOf(s, u.side), hp = hpPct(u), noise = (110 - u.decision) * 0.5;
  if (u.tauntUntil > s.t && u.tauntBy?.alive) { u.intent = 'fight'; u.target = u.tauntBy; return; }
  const enemies = s.champs.filter(e => e.side !== u.side && e.alive && e.untargetableUntil <= s.t);
  const call = s.calls[u.side];
  const splitter = tac.strategy === 'split' && u.role === 'Top' && s.t >= LANING_END;
  const cands = [];
  const push = (intent, target, score) => cands.push({ intent, target, score: score + (s.rng() - 0.5) * noise });
  const retreatAt = RETREAT_AT[tac.aggression] - (u.aggression - 50) / 500;
  const engageR = ENGAGE[tac.aggression] + (u.aggression - 50) / 20;
  const alliesClose = alliesNear(s, u, 12);

  if (u.intent === 'retreat' && hp < 0.85) push('retreat', null, 200);
  if (hp < retreatAt) push('retreat', null, 80 + u.decision * 0.3);
  // Vision: spot roamers early and back off from a fight you can't win.
  const sight = 5 + u.vision / 12;
  if (u.role !== 'Jungle' && enemies.some(e => dist(u, e) < sight && e.lane !== u.lane)) {
    const ratio = localPower(s, u.side, u, 11) / (localPower(s, 1 - u.side, u, 11) + 1);
    if (ratio < 0.85) push('retreat', null, 45 + u.vision * 0.35);
  }
  // Recall to spend gold when it is safe.
  if (u.bank >= nextItemCost(u) + 300 && hp < 0.7 && !enemies.some(e => dist(u, e) < 14)) push('retreat', null, 46);

  // Fight: every reachable enemy champion, judged by the local balance of power and the teamfight role.
  for (const e of enemies) {
    const d = dist(u, e);
    if (d > engageR) continue;
    const ratio = localPower(s, u.side, e, 11) / (localPower(s, 1 - u.side, e, 11) + 1);
    let sc = 30 + Math.max(-30, Math.min(30, (ratio - 1) * 25)) - d * (tac.focus === 'nearest' ? 2 : 1.2);
    if (tac.focus === 'weakest') sc += (1 - hpPct(e)) * 25;
    if (tac.focus === 'carry' && (e.c.cls === 'Marksman' || e.c.cls === 'Mage')) sc += 15;
    switch (u.tfRole) {
      case 'Frontline': sc += d < 4 ? 6 : 0; break;
      case 'Initiator': if (alliesClose >= 2) sc += 10; break;
      case 'Assassin': if (RANGED.has(e.c.cls)) sc += 14; break;
      case 'Midline': sc += (1 - hpPct(e)) * 12; break;
      case 'Backline': if (d > u.range + 2) sc -= 10; break;
    }
    if (RANGED.has(e.c.cls) && u.tfRole !== 'Assassin') sc -= e.positioning / 10; // well-positioned backliners are harder to reach
    if (underEnemyTower(s, u.side, e)) sc -= tac.aggression === 'aggressive' ? 12 : 30;
    if (e.target === u || (e.target?.side === u.side && e.target.kind === 'champ' && dist(e.target, u) < 8)) sc += 10;
    if (s.t < LANING_END && u.lane && e.lane !== u.lane && e.role !== 'Jungle') sc -= 12;
    push('fight', e, sc);
  }
  if (u.role !== 'Jungle') push('lane', null, splitter ? 55 : s.t < LANING_END ? 50 : tac.strategy === 'farm' ? 38 : 22);
  if (u.role === 'Jungle' || (tac.strategy === 'farm' && s.t >= LANING_END)) {
    const c = nearest(u, s.units.filter(c => c.kind === 'camp' && c.alive && (c.campSide === u.side || tac.aggression === 'aggressive')));
    if (c) push('jungle', c, (u.role === 'Jungle' ? (s.t < LANING_END ? 52 : 42) : 25) - dist(u, c) / 4);
  }
  // Ganks: the jungler hunts weak or over-extended laners; the plan's jungle focus picks the lane.
  if (u.role === 'Jungle' && s.t > 60) { // ponytail: mid roams were a net loss (left lane); re-add with a lane-safety check
    for (const e of enemies) {
      if (e.role === 'Jungle') continue;
      const ownTower = nearest(e, s.structures.filter(t => t.side === e.side && t.alive));
      let sc = 28 + (1 - hpPct(e)) * 35 + (ownTower && dist(e, ownTower) > 25 ? 15 : 0) - dist(u, e) / 3;
      if (tac.jungle !== 'any' && e.lane === tac.jungle && u.role === 'Jungle') sc += 12;
      sc -= (e.vision - 50) / 6; // high-vision laners see the gank coming
      if (underEnemyTower(s, u.side, e)) sc -= 25;
      push('fight', e, sc);
    }
  }
  if (call && !splitter) {
    if (call.type === 'objective') push('objective', call.target, 62 - dist(u, call.target) / 6 + (tac.priority === 'objectives' ? 12 : 0));
    else push('push', call.target, 55 - dist(u, call.target) / 10);
  }
  if (splitter) { const t = laneTarget(s, u); if (t) push('push', t, 50); }
  for (const st of s.structures) {
    if (st.side !== u.side || !st.alive || s.t - st.lastChampHit > 3) continue;
    push('defend', st, 50 + (st.tier >= 3 ? 30 : st.tier === 2 ? 10 : 0) - dist(u, st) / 4);
  }
  if (s.t >= LANING_END) push('group', null, s.t >= LATE ? 35 : 15);
  push('lane', null, -100); // fallback (jungler waiting for camps walks to its jungle)

  const best = cands.reduce((a, b) => (b.score > a.score ? b : a));
  if (best.intent === 'retreat' && u.intent !== 'retreat' && hp > 0.05) say(s, `${u.name} backs off.`, 'minor');
  u.intent = best.intent; u.target = best.target;
}

function localPower(s, side, at, r) {
  let p = 0;
  for (const c of s.champs) if (c.side === side && c.alive && dist(c, at) < r) p += c.hp * c.power * (0.83 + c.mech / 300);
  for (const t of s.structures) if (t.side === side && t.alive && dist(t, at) < TOWER_RANGE) p += 150000; // towers defend
  return p;
}
function underEnemyTower(s, side, at) {
  return s.structures.some(t => t.side !== side && t.alive && t.kind === 'tower' && dist(t, at) < TOWER_RANGE + 1 &&
    !s.minions.some(m => m.side === side && m.alive && dist(m, t) < TOWER_RANGE));
}
const nearest = (u, list) => { let b = null, bd = Infinity; for (const e of list) { const d = dist(u, e); if (d < bd) { bd = d; b = e; } } return b; };

// The next enemy structure down this champion's lane.
function laneTarget(s, u) {
  return s.structures.filter(st => st.side !== u.side && vulnerable(s, st) && (st.lane === u.lane || st.lane === null))
    .sort((a, b) => a.tier - b.tier)[0];
}

// Where a laner stands: just behind their front-most minion, or at their own front tower.
function laneSpot(s, u) {
  const lane = u.lane ?? 'mid', home = FOUNTAIN[u.side];
  const own = s.minions.filter(m => m.side === u.side && m.lane === lane && m.alive);
  const front = own.length ? own.reduce((a, b) => (dist(b, home) > dist(a, home) ? b : a)) : null;
  // Fresh waves walk up from base; keep holding the old spot until they catch up.
  if (front && !(u.lastSpot && dist(front, home) < dist(u.lastSpot, home) - 2)) {
    const k = 3 / (dist(front, home) || 1);
    return (u.lastSpot = { x: front.x + (home.x - front.x) * k, y: front.y + (home.y - front.y) * k });
  }
  // Between waves: hold where the last wave was, unless that is under an enemy tower.
  if (u.lastSpot && !underEnemyTower(s, u.side, u.lastSpot)) return u.lastSpot;
  const tower = s.structures.filter(t => t.side === u.side && t.alive && t.lane === lane).sort((a, b) => a.tier - b.tier)[0];
  return tower ?? home;
}

function act(s, u) {
  const tg = u.target;
  switch (u.intent) {
    case 'retreat': return moveTo(s, u, FOUNTAIN[u.side]);
    case 'fight': case 'jungle': case 'objective': return engage(s, u, tg);
    case 'defend': {
      const foe = nearest(tg, s.champs.filter(e => e.side !== u.side && e.alive && dist(e, tg) < 14 && e.untargetableUntil <= s.t));
      return foe ? engage(s, u, foe) : moveTo(s, u, tg);
    }
    case 'push': {
      if (!tg?.alive) return;
      const helpers = s.minions.some(m => m.side === u.side && m.alive && dist(m, tg) < TOWER_RANGE);
      const friends = s.champs.filter(c => c.side === u.side && c.alive && dist(c, tg) < 14).length;
      const foes = s.champs.filter(c => c.side !== u.side && c.alive && dist(c, tg) < 14).length;
      if (helpers || tg.kind === 'core' || tg.hp < tg.maxHp * 0.2 || (friends >= 3 && foes <= 1)) return engage(s, u, tg);
      const foe = nearest(u, s.champs.filter(e => e.side !== u.side && e.alive && dist(e, u) < u.range + 3 && e.untargetableUntil <= s.t));
      if (foe) return engage(s, u, foe);
      const m = nearest(u, s.minions.filter(m => m.side !== u.side && m.alive && dist(m, tg) < 16));
      return m ? engage(s, u, m) : holdOutside(s, u, tg);
    }
    case 'group': {
      const foe = nearest(u, s.champs.filter(e => e.side !== u.side && e.alive && dist(e, u) < u.range + 3 && e.untargetableUntil <= s.t));
      if (foe) return engage(s, u, foe);
      const mates = s.champs.filter(c => c.side === u.side && c.alive && c !== u);
      if (!mates.length) return moveTo(s, u, laneSpot(s, u));
      return moveTo(s, u, { x: mates.reduce((n, c) => n + c.x, 0) / mates.length, y: mates.reduce((n, c) => n + c.y, 0) / mates.length });
    }
    default: { // lane
      if (u.role === 'Jungle') return moveTo(s, u, nearest(u, s.units.filter(c => c.kind === 'camp' && c.campSide === u.side)));
      const foes = s.minions.filter(m => m.side !== u.side && m.alive && dist(m, u) < u.range + 4 && !underEnemyTower(s, u.side, m));
      if (foes.length) {
        // Good laners time their hits to last-hit minions.
        const killable = foes.find(m => m.hp <= hitDamage(u, m));
        return engage(s, u, killable && s.rng() < 0.4 + u.laning / 170 ? killable : nearest(u, foes));
      }
      const champ = nearest(u, s.champs.filter(e => e.side !== u.side && e.alive && dist(e, u) <= u.range && e.untargetableUntil <= s.t && !underEnemyTower(s, u.side, e)));
      if (champ && s.t < LANING_END) return engage(s, u, champ); // poke trades in lane
      const st = laneTarget(s, u);
      if (st && dist(u, st) < TOWER_RANGE + 3 && s.minions.some(m => m.side === u.side && m.alive && dist(m, st) < TOWER_RANGE)) return engage(s, u, st);
      return moveTo(s, u, laneSpot(s, u));
    }
  }
}

function holdOutside(s, u, tg) {
  const d = dist(u, tg);
  if (d > TOWER_RANGE + 2.5) return moveTo(s, u, tg);
  if (d < TOWER_RANGE + 1.5) { const k = (TOWER_RANGE + 2 - d) / (d || 1); moveTo(s, u, { x: u.x + (u.x - tg.x) * k, y: u.y + (u.y - tg.y) * k }); }
}

function engage(s, u, tg) {
  if (!tg || !tg.alive) return;
  if (tg.kind === 'champ' && (tryUlt(s, u, tg) || trySkill(s, u, tg))) return;
  if (isStruct(tg) && !vulnerable(s, tg)) return moveTo(s, u, laneSpot(s, u));
  const reach = u.range + (isStruct(tg) || OBJ.has(tg.kind) ? 2 : 0.3);
  if (dist(u, tg) > reach) return moveTo(s, u, tg);
  // Ranged champions with good positioning kite back from melee threats between attacks.
  if (RANGED.has(u.c.cls) && u.atkCd > 0.3) {
    const threat = nearest(u, s.champs.filter(e => e.side !== u.side && e.alive && !RANGED.has(e.c.cls) && dist(e, u) < 3));
    if (threat && s.rng() < u.positioning / 120) {
      const k = 3 / (dist(u, threat) || 1);
      return moveTo(s, u, { x: u.x + (u.x - threat.x) * k, y: u.y + (u.y - threat.y) * k });
    }
  }
  if (u.atkCd > 0) return;
  u.atkCd = u.as / (u.frenzyUntil > s.t ? 1.5 : 1) / (u.hasteUntil > s.t ? 1.3 : 1) / (1 + u.bAs);
  if (u.range > 3) s.fx.push({ type: 'shot', x1: u.x, y1: u.y, x2: tg.x, y2: tg.y, color: u.c.color, ttl: 0.15 });
  if (tg.kind === 'champ' && s.rng() > Math.min(0.97, 0.72 + u.mech / 350)) return; // miss
  hurt(s, u, tg, hitDamage(u, tg));
}

// Damage of one auto-attack (= a 1.0x ability) from champion u against tg.
function hitDamage(u, tg = null) {
  let d = u.power * (0.83 + u.mech / 300) * (1 + (u.bAtk ?? 0));
  if (tg && isStruct(tg)) d *= 1.0;
  if (tg?.kind === 'minion') d *= 1.3 + u.laning / 100; // champions clear waves; laning = better farming
  return d;
}

function mult(s, u, tg) {
  let m = 1;
  if (s.buff[u.side] > s.t) m *= 1.2;
  if (u.kind === 'champ') {
    if (P(u, 'bloodlust')) m *= 1 + 0.2 * (1 - hpPct(u));
    if (P(u, 'opener') && tg && hpPct(tg) > 0.8) m *= 1.2;
    if (P(u, 'siege') && isStruct(tg)) m *= 1.3;
    if (P(u, 'hunter') && (tg?.kind === 'camp' || OBJ.has(tg?.kind))) m *= 1.25;
    if (P(u, 'farmer') && tg?.kind === 'minion') m *= 1.25;
  }
  if (tg?.kind === 'champ') {
    if (P(u, 'executioner') && hpPct(tg) < 0.35) m *= 1.12;
    m *= 1 + s.compEdge[u.side];
    if (s.comps[u.side].tag === 'pick' && alliesNear(s, tg, 6) === 0) m *= 1.04; // pick comps punish isolated targets
    if (s.t < LANING_END && u.lane) m *= 1 + (u.laning - 50) / 85;
    if (s.t < LANING_END) m *= 1 + (u.aggression - 50) / 425; // aggressive players win early trades (and over-extend more)
    if (alliesNear(s, u, 12) >= 2) m *= 1 + (u.teamwork - 50) / 190;
    m *= 1 + (u.decision - 50) / 500; // shot-calling: hitting the right target at the right time
    s.vis ??= [teamVision(s, 0), teamVision(s, 1)];
    m *= 1 + (s.vis[u.side] - s.vis[1 - u.side]) / 290; // vision edge: fights start on your terms
    // Resilience: low-resilience players tilt when their team is down on kills.
    if (s.kills[1 - u.side] - s.kills[u.side] >= 3) m *= 0.9 + u.resilience / 1000;
    // Clutch: late game and high stakes.
    if (s.t >= LATE) m *= 1 + (u.clutch - 50) / 500 * (1 + s.stakes);
  }
  if (OBJ.has(tg?.kind)) m *= 1 + (teamVision(s, u.side) - 50) / 400; // vision control helps take objectives
  if (isStruct(tg) && s.comps[u.side].tag === 'split') m *= 1.06; // split comps take towers faster
  return m;
}
const teamVision = (s, side) => { const c = s.champs.filter(x => x.side === side); return c.reduce((n, x) => n + x.vision, 0) / c.length; };
const alliesNear = (s, u, r) => s.champs.filter(c => c !== u && c.side === u.side && c.alive && dist(c, u) < r).length;

// ---------------- Abilities ----------------
function trySkill(s, u, tg) {
  if (u.skillCd > 0) return false;
  if (u.c.skill === 'fx') { const ok = castFx(s, u, tg, u.c.fx, false); if (ok) u.skillCd = u.c.cd * (1 - u.cdr); return ok; }
  const foes = s.champs.filter(e => e.side !== u.side && e.alive && e.untargetableUntil <= s.t);
  const near = r => foes.filter(e => dist(u, e) <= r);
  const allies = s.champs.filter(a => a.side === u.side && a.alive);
  // Hold crowd control for a priority target (carry, mage, assassin, or a low foe) when one is close; sharp players wait.
  if (CC_SKILLS.has(u.c.skill) && !isPriority(tg) && near(u.range + 4).some(isPriority) && s.rng() < u.decision / 110) return false;
  const L = u.level, base = hitDamage(u) * (1 + u.skillAmp);
  const fumble = s.rng() < 0.25 - u.mech / 500 ? 0.4 : 1; // weak mechanics: the ability lands badly
  const hit = (e, k) => hurt(s, u, e, base * k * fumble);
  const ring = (x, y, r, color) => s.fx.push({ type: 'ring', x, y, r, color, ttl: 0.4 });
  const area = (at, r) => s.live.filter(e => e.side === 1 - u.side && e.alive && (e.kind === 'champ' || e.kind === 'minion') && dist(e, at) <= r && !(e.kind === 'champ' && e.untargetableUntil > s.t));
  const dashTo = e => { const d = dist(u, e), k = Math.max(0, d - 1) / (d || 1), nx = u.x + (e.x - u.x) * k, ny = u.y + (e.y - u.y) * k; if (!isBlocked(nx, ny)) { u.x = nx; u.y = ny; } };
  const shieldOf = (a, v, dur) => { v *= 1 + u.healAmp; a.shield = v; a.shieldUntil = s.t + dur; u.st.heal += v; };
  let cast = false;
  switch (u.c.skill) {
    case 'guard': { const f = near(3); if (!f.length) break; u.shield = 250 + 50 * L; u.shieldUntil = s.t + 4; for (const e of f) { e.tauntBy = u; e.tauntUntil = s.t + 1.5; e.target = u; } ring(u.x, u.y, 3, '#ffffff'); cast = true; break; }
    case 'cleave': { const f = area(u, 2.5); if (!f.some(e => e.kind === 'champ')) break; for (const e of f) { hit(e, 1.3); if (e.kind === 'champ') heal(s, u, u, 40 + 10 * L); } ring(u.x, u.y, 2.5, u.c.color); cast = true; break; }
    case 'lunge': { const d = dist(u, tg); if (d < 3 || d > 7) break; dashTo(tg); hit(tg, 1.8); cast = true; break; }
    case 'harvest': { if (dist(u, tg) > 2.5) break; hurt(s, u, tg, (base * 1.2 + (tg.maxHp - tg.hp) * 0.3) * fumble); ring(tg.x, tg.y, 1, '#ff3030'); cast = true; break; }
    case 'shadow': { const f = near(10).sort((a, b) => hpPct(a) - hpPct(b))[0]; if (!f) break; ring(u.x, u.y, 0.8, u.c.color); dashTo(f); u.target = f; hit(f, 2.0); cast = true; break; }
    case 'frenzy': { if (dist(u, tg) > u.range + 1) break; u.frenzyUntil = s.t + 4; ring(u.x, u.y, 1.2, u.c.color); cast = true; break; }
    case 'slam': { const f = near(3); if (!f.length) break; for (const e of f) { e.stunUntil = s.t + 1; hit(e, 1.0); } ring(u.x, u.y, 3, u.c.color); cast = true; break; }
    case 'rift': { if (dist(u, tg) > 7) break; dashTo(tg); hit(tg, 1.9); u.untargetableUntil = s.t + 1; cast = true; break; }
    case 'nova': { if (dist(u, tg) > u.range + 1) break; for (const e of area(tg, 2.5)) hit(e, 1.5); ring(tg.x, tg.y, 2.5, u.c.color); cast = true; break; }
    case 'tempest': { if (dist(u, tg) > u.range) break; for (const e of area(tg, 3)) { hit(e, 1.2); if (e.kind === 'champ') { e.slowUntil = s.t + 2; e.slowPct = 0.4; } } ring(tg.x, tg.y, 3, u.c.color); cast = true; break; }
    case 'volley': { if (dist(u, tg) > u.range) break; s.fx.push({ type: 'shot', x1: u.x, y1: u.y, x2: tg.x, y2: tg.y, color: '#ffffff', ttl: 0.3, w: 3 }); hit(tg, 2.3); cast = true; break; }
    case 'snipe': { const f = near(12).sort((a, b) => a.hp - b.hp)[0]; if (!f) break; s.fx.push({ type: 'shot', x1: u.x, y1: u.y, x2: f.x, y2: f.y, color: '#ffffff', ttl: 0.4, w: 3 }); hit(f, 2.2); cast = true; break; }
    case 'scatter': { if (dist(u, tg) > u.range) break; hit(tg, 1.5); for (const e of area(tg, 2.5)) if (e !== tg) hit(e, 0.8); ring(tg.x, tg.y, 2.5, u.c.color); cast = true; break; }
    case 'mend': { const a = allies.filter(a => dist(u, a) <= 7 && hpPct(a) < 0.65).sort((a, b) => hpPct(a) - hpPct(b))[0]; if (!a) break; heal(s, u, a, (120 + 25 * L + u.mech * 1.0) * fumble); ring(a.x, a.y, 1, '#7dff9a'); cast = true; break; }
    case 'bind': { if (dist(u, tg) > 3) break; tg.stunUntil = s.t + 1.75; hit(tg, 1.0); const a = nearest(u, allies.filter(a => a !== u)); if (a && dist(a, u) < 8) shieldOf(a, 200 + 40 * L, 3); ring(tg.x, tg.y, 1, u.c.color); cast = true; break; }
    case 'aegis': { const a = allies.filter(a => dist(u, a) <= 6); if (!a.some(x => hpPct(x) < 0.8) || !near(10).length) break; for (const x of a) shieldOf(x, (190 + 35 * L) * fumble, 3); ring(u.x, u.y, 6, u.c.color); cast = true; break; }
    case 'fortify': { const f = near(2.5); if (!f.length) break; u.guardUntil = s.t + 3; for (const e of f) { e.tauntBy = u; e.tauntUntil = s.t + 1; e.target = u; } ring(u.x, u.y, 2.5, '#ffffff'); cast = true; break; }
    case 'leap': { const d = dist(u, tg); if (d < 4 || d > 8) break; dashTo(tg); hit(tg, 1.5); tg.slowUntil = s.t + 2; tg.slowPct = 0.4; ring(tg.x, tg.y, 1.5, u.c.color); cast = true; break; }
    case 'blink': { if (dist(u, tg) > 6) break; dashTo(tg); hit(tg, 2.0); ring(tg.x, tg.y, 1, u.c.color); cast = true; break; }
    case 'pounce': { const f = near(7).filter(e => hpPct(e) < 0.6).sort((a, b) => hpPct(a) - hpPct(b))[0]; if (!f) break; dashTo(f); u.target = f; f.stunUntil = s.t + 0.6; hit(f, 1.7); cast = true; break; }
    case 'inferno': { if (dist(u, tg) > u.range + 1) break; tg.burnUntil = s.t + 4; tg.burnDps = base * 0.6 * fumble; tg.burnBy = u; ring(tg.x, tg.y, 1.2, u.c.color); cast = true; break; }
    case 'fan': { const f = near(u.range + 1).sort((a, b) => dist(u, a) - dist(u, b)).slice(0, 3); if (!f.length) break; for (const e of f) { s.fx.push({ type: 'shot', x1: u.x, y1: u.y, x2: e.x, y2: e.y, color: '#ffffff', ttl: 0.3, w: 2 }); hit(e, 1.1); } cast = true; break; }
    case 'snare': { if (dist(u, tg) > u.range) break; tg.stunUntil = s.t + 1.5; hit(tg, 1.3); ring(tg.x, tg.y, 1, u.c.color); cast = true; break; }
    case 'haste': { const a = allies.filter(a => dist(u, a) <= 6); if (a.length < 2 || !near(12).length) break; for (const x of a) { x.hasteUntil = s.t + 3; heal(s, u, x, 60 + 15 * L); } ring(u.x, u.y, 6, u.c.color); cast = true; break; }
  }
  if (cast) u.skillCd = u.c.cd * (1 - u.cdr);
  return cast;
}

const CC_SKILLS = new Set(['slam', 'bind', 'snare', 'guard', 'fortify']);
const isPriority = e => e && (e.c.cls === 'Marksman' || e.c.cls === 'Mage' || e.c.cls === 'Assassin' || hpPct(e) < 0.5);

// ---------------- Effect-list abilities (ultimates, newer champions' skills) ----------------
function tryUlt(s, u, tg) {
  if (u.level < 6 || u.ultCd > 0) return false;
  const ok = castFx(s, u, tg, u.c.ult, true);
  if (ok) u.ultCd = u.c.ult.cd * (1 - u.cdr);
  return ok;
}
// Pick the aim point, judge whether the moment is right (Decision Making), then apply the effects (Mechanics, Clutch).
function castFx(s, u, tg, def, isUlt) {
  const fx = def.fx, range = def.range ?? u.range + 1, r = def.r ?? 0;
  const foes = s.champs.filter(e => e.side !== u.side && e.alive && e.untargetableUntil <= s.t);
  const allies = s.champs.filter(a => a.side === u.side && a.alive);
  const inR = (list, at, rad) => list.filter(e => dist(e, at) <= rad);
  let aim = null;
  switch (def.aim) {
    case 'self': aim = u; break;
    case 'target': aim = tg?.kind === 'champ' && tg.alive && dist(u, tg) <= range ? tg : null; break;
    case 'lowestFoe': aim = inR(foes, u, range).sort((a, b) => a.hp - b.hp)[0] ?? null; break;
    case 'lowestAlly': aim = inR(allies, u, range).sort((a, b) => hpPct(a) - hpPct(b))[0] ?? null; break;
    case 'cluster': { let best = 0; for (const e of inR(foes, u, range)) { const n = inR(foes, e, r || 2.5).length + (e === tg ? 0.5 : 0); if (n > best) { best = n; aim = e; } } break; }
  }
  if (!aim) return false;
  const base = hitDamage(u) * (1 + u.skillAmp) * (isUlt ? 1 + (u.clutch - 50) / 400 * (1 + s.stakes) : 1);
  const hitFoes = r ? inR(foes, aim, r) : aim.side !== u.side ? [aim] : [];
  const hitAllies = fx.shield || fx.heal || fx.buff ? (r ? inR(allies, aim, r) : [aim.side === u.side ? aim : u]) : [];
  // Judge the moment. Good = worth it now; sharp players cast on good moments, poor ones hesitate or waste it.
  const foesNear = inR(foes, u, Math.max(range, r) + 3).length;
  let good;
  switch (def.when) {
    case 'engage': good = hitFoes.length >= 2 || (hitFoes.length >= 1 && alliesNear(s, u, 10) >= 2); break;
    case 'aoe': good = hitFoes.length >= 2 || (hitFoes.length === 1 && hpPct(hitFoes[0]) < 0.5); break;
    case 'burst': good = hitFoes.length >= 1 && (hpPct(hitFoes[0]) < 0.75 || alliesNear(s, u, 8) >= 1 || hitFoes[0].target === u); break;
    case 'execute': { const e = hitFoes[0]; good = !!e && base * (fx.dmg ?? 0) + (e.maxHp - e.hp) * (fx.exec ?? 0) >= e.hp * 0.9; break; }
    case 'save': good = hitAllies.some(a => hpPct(a) < 0.4 && inR(foes, a, 9).length > 0); break;
    default: good = foesNear > 0 && inR(foes, u, u.range + 2).length > 0; // buff: mid-fight
  }
  if (!foesNear && def.when !== 'save') return false;
  if (good ? s.rng() > 0.3 + u.decision / 140 : s.rng() > (100 - u.decision) / 8000) return false;
  const fumble = s.rng() < 0.25 - u.mech / 500 ? 0.4 : 1;
  if (def.dash && aim !== u) { const d = dist(u, aim), k = Math.max(0, d - 1) / (d || 1), nx = u.x + (aim.x - u.x) * k, ny = u.y + (aim.y - u.y) * k; if (!isBlocked(nx, ny)) { u.x = nx; u.y = ny; } }
  if (fx.pull && aim.side !== u.side) { const d = dist(u, aim), k = Math.max(0, d - 1.5) / (d || 1), nx = aim.x + (u.x - aim.x) * k, ny = aim.y + (u.y - aim.y) * k; if (!isBlocked(nx, ny)) { aim.x = nx; aim.y = ny; } }
  for (const e of hitFoes) {
    if (fx.dmg || fx.exec) hurt(s, u, e, (base * (fx.dmg ?? 0) + (e.maxHp - e.hp) * (fx.exec ?? 0)) * fumble);
    if (fx.stun && e.alive) e.stunUntil = s.t + fx.stun * fumble;
    if (fx.slow && e.alive) { e.slowUntil = s.t + fx.slow[1]; e.slowPct = fx.slow[0]; }
  }
  if (fx.dmg && r) for (const m of s.minions.filter(m => m.side !== u.side && m.alive && dist(m, aim) <= r)) hurt(s, u, m, base * fx.dmg * 0.5);
  const L = u.level;
  for (const a of hitAllies) {
    if (fx.heal) heal(s, u, a, (fx.heal + fx.heal * 0.15 * L) * fumble);
    if (fx.shield) { const v = (fx.shield + fx.shield * 0.18 * L) * fumble * (1 + u.healAmp); a.shield = Math.max(a.shield, v); a.shieldUntil = s.t + 3; if (a !== u) u.st.heal += v; }
    if (fx.buff) { const b = fx.buff; a.bAtk = b.atk ?? 0; a.bAs = b.as ?? 0; a.bDr = b.dr ?? 0; a.bSpeed = b.speed ?? 0; a.bUntil = s.t + b.dur; }
  }
  if (fx.zone) s.zones.push({ x: aim.x, y: aim.y, r: r || 3, side: u.side, src: u, dps: base * fx.zone.dps * fumble, slow: fx.zone.slow ?? 0, until: s.t + fx.zone.dur });
  if (fx.untarget) u.untargetableUntil = s.t + fx.untarget;
  s.fx.push({ type: 'ring', x: aim.x, y: aim.y, r: r || 1.2, color: isUlt ? '#ffd76a' : u.c.color, ttl: isUlt ? 0.8 : 0.4 });
  if (isUlt) {
    s.events.push({ t: s.t, type: 'ult', side: u.side, pid: u.pid, champ: u.champ, name: def.name, hits: hitFoes.length, good });
    say(s, `${u.name} casts ${def.name}${hitFoes.length > 1 ? ` on ${hitFoes.length} champions` : ''}.`, 'ult');
  }
  return true;
}
function tickZones(s) {
  s.zones = s.zones.filter(z => z.until > s.t);
  for (const z of s.zones) for (const e of s.champs) if (e.side !== z.side && e.alive && dist(e, z) <= z.r) {
    hurt(s, z.src, e, z.dps * TICK);
    if (z.slow) { e.slowUntil = s.t + 0.3; e.slowPct = Math.max(e.slowPct, z.slow); }
  }
}

function heal(s, src, tgt, amount) {
  const v = Math.min(amount * (1 + (src.healAmp || 0)), tgt.maxHp - tgt.hp);
  tgt.hp += v;
  if (src !== tgt) { src.st.heal += v; tgt.hitBy[`h${src.id}`] = s.t; }
}

// ---------------- Damage & deaths ----------------
function hurt(s, src, tgt, amount) {
  if (!tgt.alive) return;
  if (isStruct(tgt) && !vulnerable(s, tgt)) return;
  if (tgt.kind === 'champ' && tgt.untargetableUntil > s.t) return;
  if (src?.kind === 'champ') amount *= mult(s, src, tgt);
  if (tgt.kind === 'champ') {
    if (tgt.c.cls === 'Tank') amount *= 0.85;
    if (tgt.guardUntil > s.t) amount *= 0.6;
    if (alliesNear(s, tgt, 12) >= 2) amount *= 1 - (tgt.teamwork - 50) / 300 - (tgt.tfRole === 'Frontline' ? 0.08 : 0);
    amount *= (1 - tgt.dr) * (1 - tgt.bDr) * (1 - (tgt.positioning - 50) / 255); // positioning: caught out less, hit less
    const absorbed = Math.min(tgt.shield, amount);
    tgt.shield -= absorbed; amount -= absorbed;
    tgt.st.taken += amount;
    if (src) tgt.hitBy[src.id] = s.t;
  }
  tgt.hp -= amount;
  if (src?.kind === 'champ') {
    if (tgt.kind === 'champ') { src.st.dmg += amount; if (src.ls) src.hp = Math.min(src.maxHp, src.hp + amount * src.ls); }
    if (isStruct(tgt)) { src.st.towerDmg += amount; tgt.lastChampHit = s.t; }
  }
  if (src && tgt.kind !== 'champ' && tgt.kind !== 'minion' && !isStruct(tgt)) tgt.aggro = src;
  // Towers switch to champions that attack champions under them.
  if (tgt.kind === 'champ' && src?.kind === 'champ')
    for (const t of s.structures) if (t.side === tgt.side && t.alive && dist(t, src) < TOWER_RANGE && t.aggro?.kind !== 'champ') { t.aggro = src; t.aggroStreak = 0; }
  if (tgt.hp <= 0) die(s, src, tgt);
}

function lastChampHitter(s, victim, window) {
  let best = null, bt = -Infinity;
  for (const c of s.champs) if (c.side !== victim.side) { const t = victim.hitBy[c.id]; if (t !== undefined && s.t - t <= window && t > bt) { bt = t; best = c; } }
  return best;
}

function die(s, src, tgt) {
  tgt.alive = false; tgt.hp = 0;
  const killer = src?.kind === 'champ' ? src : tgt.kind === 'champ' ? lastChampHitter(s, tgt, 8) : null;
  switch (tgt.kind) {
    case 'minion': {
      if (killer) { killer.st.cs++; gainGold(s, killer, 20); }
      const near = s.champs.filter(c => c.side === 1 - tgt.side && c.alive && dist(c, tgt) < 12);
      for (const c of near) gainXp(s, c, 30 / near.length);
      return;
    }
    case 'camp':
      tgt.spawnAt = s.t + 60;
      if (killer) { killer.st.cs += 3; gainGold(s, killer, 60); gainXp(s, killer, 80); } // a camp counts as 3 CS (same gold as 3 minions)
      return;
    case 'titan': case 'shrine': {
      const side = killer?.side;
      if (side === undefined) { tgt.spawnAt = s.t + 30; return; }
      killer.st.obj++;
      (tgt.kind === 'titan' ? s.titans : s.shrines)[side]++;
      s.events.push({ t: s.t, type: tgt.kind, side, pid: killer.pid, x: tgt.x, y: tgt.y });
      if (tgt.kind === 'titan') { tgt.spawnAt = s.t + 180; s.buff[side] = s.t + 60; say(s, `${killer.name} slays the Titan! ${s.teams[side].name} empowered for 60s.`, `obj${side}`); }
      else {
        tgt.spawnAt = s.t + 120;
        if (s.shrine[side] < 4) { s.shrine[side]++; for (const c of s.champs) if (c.side === side) refresh(s, c); }
        say(s, `${killer.name} takes the Shrine for ${s.teams[side].name} (${s.shrine[side]} stack${s.shrine[side] > 1 ? 's' : ''}).`, `obj${side}`);
      }
      for (const c of s.champs) if (c.side === side && c.alive) gainXp(s, c, 120);
      return;
    }
    case 'tower': {
      const side = 1 - tgt.side;
      s.towers[side]++;
      if (killer) killer.st.obj++;
      for (const c of s.champs) if (c.side === side) gainGold(s, c, 150);
      s.events.push({ t: s.t, type: 'tower', side, pid: killer?.pid ?? null, x: tgt.x, y: tgt.y, tier: tgt.tier, lane: tgt.lane });
      say(s, `${s.teams[side].name} destroy ${towerName(tgt)}${killer ? ` (${killer.name})` : ''}.`, `tower${side}`);
      return;
    }
    case 'core':
      s.over = true; s.winner = 1 - tgt.side; s.endReason = 'core';
      s.events.push({ t: s.t, type: 'core', side: s.winner, x: tgt.x, y: tgt.y });
      say(s, `${s.teams[s.winner].name} destroy the Core and win in ${fmt(s.t)}!`, 'end');
      return;
    case 'champ': return champDeath(s, killer, tgt);
  }
}

function champDeath(s, killer, v) {
  v.st.d++;
  const victimStreak = v.streak;
  v.streak = 0;
  v.respawnAt = s.t + 6 + v.level * 1.5 + s.t / 60;
  v.intent = 'lane'; v.target = null; v.shield = 0;
  s.fx.push({ type: 'ring', x: v.x, y: v.y, r: 2, color: '#ff4040', ttl: 0.6 });
  if (!killer) { v.hitBy = {}; s.events.push({ t: s.t, type: 'death', side: v.side, v: v.pid, x: v.x, y: v.y }); return say(s, `${v.name} (${v.c.name}) has been executed.`); }
  killer.st.k++;
  s.kills[killer.side]++;
  const assists = s.champs.filter(c => c.side === killer.side && c !== killer &&
    (s.t - (v.hitBy[c.id] ?? -99) <= 8 || s.t - (v.hitBy[`h${c.id}`] ?? -99) <= 8));
  for (const c of assists) { c.st.a++; gainGold(s, c, 150 / assists.length); gainXp(s, c, (60 + v.level * 10) / assists.length); }
  gainGold(s, killer, 300 + Math.max(0, victimStreak - 1) * 50);
  gainXp(s, killer, 100 + v.level * 20);
  killer.streak = s.t - killer.lastKillT < 8 ? killer.streak + 1 : 1;
  killer.lastKillT = s.t;
  v.hitBy = {};
  if (!s.firstBlood) s.fbSide = killer.side;
  const shutdown = victimStreak >= 3;
  s.events.push({ t: s.t, type: 'kill', side: killer.side, k: killer.pid, v: v.pid, a: assists.map(c => c.pid), x: Math.round(v.x * 10) / 10, y: Math.round(v.y * 10) / 10, kc: killer.champ, vc: v.champ, streak: killer.streak, fb: !s.firstBlood, shutdown });
  const tag = !s.firstBlood ? 'FIRST BLOOD! ' : ['', '', 'DOUBLE KILL! ', 'TRIPLE KILL! ', 'QUADRA KILL! ', 'PENTA KILL! '][Math.min(killer.streak, 5)];
  s.firstBlood = true;
  say(s, `${tag}${killer.name} (${killer.c.name}) takes down ${v.name} (${v.c.name}).`, `kill${killer.side}`);
  if (s.champs.filter(c => c.side === v.side).every(c => !c.alive)) s.events.push({ t: s.t, type: 'ace', side: killer.side, x: v.x, y: v.y }), say(s, `ACE! ${s.teams[killer.side].name} wipe out ${s.teams[v.side].name}!`, `kill${killer.side}`);
}

// ---------------- Other units ----------------
function minionTick(s, m) {
  m.atkCd -= TICK;
  if ((m.retarget -= TICK) <= 0 || (m.target && !m.target.alive)) {
    m.retarget = 0.5;
    const foes = s.live.filter(e => e.side === 1 - m.side && e.alive && dist(e, m) < 7 &&
      (e.kind === 'minion' || (e.kind === 'champ' && e.untargetableUntil <= s.t) || (isStruct(e) && vulnerable(s, e))));
    m.target = nearest(m, foes.filter(e => e.kind === 'minion')) || nearest(m, foes.filter(e => e.kind !== 'champ')) || nearest(m, foes);
  }
  const tg = m.target;
  if (tg && tg.alive) {
    if (dist(m, tg) > m.range + (isStruct(tg) ? 2 : 0.3)) return walk(m, tg, m.speed);
    if (m.atkCd <= 0) { m.atkCd = m.as; hurt(s, m, tg, m.atk * (isStruct(tg) ? 1.5 : 1)); }
    return;
  }
  const wp = m.path[m.wp];
  if (!wp) return;
  if (dist(m, wp) < 1.5) m.wp++;
  walk(m, wp, m.speed);
}

function towerTick(s, t) {
  t.atkCd -= TICK;
  if (t.atkCd > 0) return;
  const inRange = e => e && e.alive && e.side === 1 - t.side && dist(e, t) < TOWER_RANGE && (e.kind === 'minion' || (e.kind === 'champ' && e.untargetableUntil <= s.t));
  if (!inRange(t.aggro)) {
    const foes = s.live.filter(inRange);
    t.aggro = nearest(t, foes.filter(e => e.kind === 'minion')) || nearest(t, foes);
    t.aggroStreak = 0;
  }
  if (!t.aggro) { t.atkCd = 0.3; return; }
  t.atkCd = 1;
  const champ = t.aggro.kind === 'champ';
  s.fx.push({ type: 'shot', x1: t.x, y1: t.y, x2: t.aggro.x, y2: t.aggro.y, color: t.side ? '#ff7070' : '#70b0ff', ttl: 0.2, w: 2 });
  hurt(s, t, t.aggro, champ ? 150 * (1 + 0.25 * t.aggroStreak++) : 110);
}

function neutralTick(s, n) {
  n.atkCd -= TICK;
  const leash = n.kind === 'camp' ? 8 : 12;
  if (n.aggro && (!n.aggro.alive || dist(n.aggro, n.home) > leash)) n.aggro = null;
  if (!n.aggro) {
    if (dist(n, n.home) > 0.5) walk(n, n.home, 4);
    n.hp = Math.min(n.maxHp, n.hp + n.maxHp * 0.05 * TICK);
    return;
  }
  if (dist(n, n.aggro) > n.range + 0.5) return walk(n, n.aggro, 4);
  if (n.atkCd > 0) return;
  n.atkCd = n.as;
  if (n.kind === 'camp') return hurt(s, n, n.aggro, n.atk * (1 + s.t / 300));
  // Big monsters cleave every champion near their target.
  for (const e of s.champs) if (e.alive && dist(e, n.aggro) < 2.5) hurt(s, n, e, n.atk * (1 + s.t / 600));
  s.fx.push({ type: 'ring', x: n.aggro.x, y: n.aggro.y, r: 2.5, color: '#c070ff', ttl: 0.3 });
}

// ---------------- Movement ----------------
function moveTo(s, u, p) {
  if (dist(u, p) < 0.3) return;
  walk(u, steer(u.x, u.y, p.x, p.y), u.speed * (u.slowUntil > s.t ? 1 - u.slowPct : 1) * (u.hasteUntil > s.t ? 1.3 : 1) * (1 + (u.bSpeed ?? 0)));
}

function walk(u, p, speed) {
  const dx = p.x - u.x, dy = p.y - u.y, d = Math.hypot(dx, dy);
  if (d < 0.05) return;
  const k = Math.min(d, speed * TICK) / d, nx = u.x + dx * k, ny = u.y + dy * k;
  if (!isBlocked(nx, ny)) { u.x = nx; u.y = ny; }
  else if (!isBlocked(nx, u.y)) u.x = nx; // slide along walls
  else if (!isBlocked(u.x, ny)) u.y = ny;
}

// ponytail: O(n²) push-apart over ~60 mobile units; spatial hash if unit counts grow.
function separate(s) {
  const live = s.units.filter(u => u.alive && (u.kind === 'champ' || u.kind === 'minion'));
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], b = live[j], dx = b.x - a.x, dy = b.y - a.y;
    if (dx > 1 || dx < -1 || dy > 1 || dy < -1) continue;
    const d = Math.hypot(dx, dy);
    if (d >= 1 || d === 0) continue;
    const p = (1 - d) / 2 / d;
    if (!isBlocked(a.x - dx * p, a.y - dy * p)) { a.x -= dx * p; a.y -= dy * p; }
    if (!isBlocked(b.x + dx * p, b.y + dy * p)) { b.x += dx * p; b.y += dy * p; }
  }
}

// ---------------- End of match ----------------
function timeUp(s) {
  s.over = true; s.endReason = 'time';
  const gold = side => s.champs.filter(c => c.side === side).reduce((n, c) => n + c.st.gold, 0);
  const cmp = [s.towers[0] - s.towers[1], s.kills[0] - s.kills[1], gold(0) - gold(1)].find(v => v !== 0) ?? 0;
  s.winner = cmp >= 0 ? 0 : 1;
  say(s, `Time! ${s.teams[s.winner].name} win on ${s.towers[0] !== s.towers[1] ? 'structures' : s.kills[0] !== s.kills[1] ? 'kills' : 'gold'}.`, 'end');
}

// Final per-player stat lines with a 1-10 match rating.
export function summarize(s) {
  const mins = Math.max(1, s.t / 60);
  const teamDmg = side => s.champs.filter(c => c.side === side).reduce((n, c) => n + c.st.dmg, 0) || 1;
  const players = s.champs.map(c => {
    const st = c.st, share = st.dmg / teamDmg(c.side);
    const rating = Math.max(3, Math.min(10, 5.2 + st.k * 0.3 + st.a * 0.15 - st.d * 0.3 + share * 4 + (st.cs / mins) * 0.1 + st.obj * 0.2 + st.vision / mins * 0.08 + (c.side === s.winner ? 0.6 : -0.3)));
    return {
      pid: c.pid, name: c.name, side: c.side, role: c.role, champ: c.champ, level: c.level, tfRole: c.tfRole, items: [...c.items],
      k: st.k, d: st.d, a: st.a, cs: st.cs, obj: st.obj, vision: Math.round(st.vision),
      gold: Math.round(st.gold), dmg: Math.round(st.dmg), taken: Math.round(st.taken), heal: Math.round(st.heal), towerDmg: Math.round(st.towerDmg),
      share: +share.toFixed(3), rating: +rating.toFixed(1),
    };
  });
  const mvp = players.filter(p => p.side === s.winner).reduce((a, b) => (b.rating > a.rating ? b : a));
  const gd = t => { const r = s.timeline.filter(x => x.t <= t).at(-1); return r ? r.g[0] - r.g[1] : 0; };
  const gold = [0, 1].map(side => players.filter(p => p.side === side).reduce((n, p) => n + p.gold, 0));
  if (s.timeline.at(-1)?.t === s.t) s.timeline.at(-1).g = gold; else s.timeline.push({ t: s.t, g: gold });
  return {
    winner: s.winner, duration: s.t, kills: [...s.kills], towers: [...s.towers], fbSide: s.fbSide, titans: [...s.titans], shrines: [...s.shrines],
    endReason: s.endReason, players, mvp: mvp.pid, gd5: gd(300),
    gold, timeline: s.timeline, events: s.events, frames: s.frames, plans: s.planLog,
  };
}
