// Statistical match engine for bulk background games (lower tiers, other leagues on "fast" detail).
// Same input and output shape as runMatch + summarize, no map: the winner comes from a logistic on the
// lineups' effective strength, then stat lines are drawn around per-role averages measured from the
// full engine. Calibrated by test/fastsim.test.mjs against the full engine.
import { ROLES, overall, CHAMPS, COMP_BEATS, compOf } from './data.js';
import { rngFrom, PHASES, clonePlan, runMatch, summarize } from './sim.js';

// Per-minute means per role, measured from the full engine (scratch means.mjs).
const RM = {
  Top: { k: 0.13, d: 0.22, a: 0.2, cs: 1.52, dmg: 372, taken: 1102, heal: 24, towerDmg: 141, vision: 2.0 },
  Jungle: { k: 0.31, d: 0.43, a: 0.14, cs: 1.19, dmg: 436, taken: 1302, heal: 4, towerDmg: 80, vision: 2.4 },
  Mid: { k: 0.2, d: 0.24, a: 0.21, cs: 1.75, dmg: 508, taken: 930, heal: 4, towerDmg: 170, vision: 2.0 },
  Carry: { k: 0.22, d: 0.24, a: 0.23, cs: 1.35, dmg: 640, taken: 812, heal: 6, towerDmg: 176, vision: 2.0 },
  Support: { k: 0.1, d: 0.2, a: 0.29, cs: 0.83, dmg: 258, taken: 915, heal: 235, towerDmg: 95, vision: 3.2 },
};
const LANE_PTS = [[24, 7], [54, 7], [84, 7], [30, 31], [54, 31], [78, 31], [24, 55], [54, 55], [84, 55], [40, 22], [68, 40], [54, 18], [54, 44]];

export function effStrength(p, slot) { return overall(p, ROLES[slot]) * (0.7 + 0.3 * (p.prof ?? 1)); }

export function fastMatch(teamA, teamB, seed = 1, opts = {}) {
  const rng = rngFrom(seed), gauss = () => (rng() + rng() + rng() - 1.5) * 1.41;
  const teams = [teamA, teamB];
  const eff = teams.map(t => t.lineup.map((p, i) => effStrength(p, i) * (1 + gauss() * (0.06 - p.resilience * 0.0004)) + ((t.coach ?? 10) - 10) * 0.25));
  const str = eff.map(e => e.reduce((n, v) => n + v, 0) / 5);
  // Composition counter (+8% damage in the full engine is worth about 2.6 strength points) and patch strength per champion.
  const comps = teams.map(t => compOf(t.lineup.map(p => p.champ)));
  comps.forEach((c, side) => { if (COMP_BEATS[c.tag] === comps[1 - side].tag) str[side] += 2.6; });
  teams.forEach((t, side) => { for (const p of t.lineup) { const m = opts.patch?.[p.champ]; if (m) str[side] += ((m.hp ?? 0) + (m.atk ?? 0) - (m.cd ?? 0) * 0.5) * 12; } });
  const d = str[0] - str[1], pA = 1 / (1 + Math.exp(-(d * 0.067 + d ** 3 * 0.00012))); // fitted to the full engine (v0.5 attribute rebalance, 500 games per gap)
  const winner = rng() < pA ? 0 : 1, loser = 1 - winner;
  const dom = Math.min(1.5, Math.abs(str[winner] - str[loser]) / 15 + rng() * 0.5); // how one-sided
  const core = rng() < 0.75 + dom * 0.1;
  const duration = core ? Math.round(Math.max(300, Math.min(598, 520 - dom * 50 + gauss() * 45))) : 600;
  const mins = duration / 60;

  // Kills: total around the measured average, split toward the winner.
  const aggr = teams.map(t => t.lineup.reduce((n, p) => n + p.aggression, 0) / 5);
  const total = Math.max(4, Math.round((15.6 * mins / 8.1) * (0.8 + (aggr[0] + aggr[1]) / 500) + gauss() * 3.5));
  const wShare = Math.max(0.5, Math.min(0.88, 0.58 + dom * 0.12 + gauss() * 0.06));
  const kills = []; kills[winner] = Math.round(total * wShare); kills[loser] = total - kills[winner];

  const players = teams.flatMap((t, side) => t.lineup.map((p, i) => ({
    pid: p.id, name: p.name, side, role: ROLES[i], champ: p.champ, level: 0, tfRole: p.tfRole ?? null, items: [],
    k: 0, d: 0, a: 0, cs: 0, obj: 0, vision: 0, gold: 0, dmg: 0, taken: 0, heal: 0, towerDmg: 0, share: 0, rating: 0, _p: p, _e: eff[side][i],
  })));
  const pick = (list, w) => { const tot = list.reduce((n, x) => n + w(x), 0); let r = rng() * tot; for (const x of list) if ((r -= w(x)) <= 0) return x; return list.at(-1); };
  const events = [];
  const times = Array.from({ length: total }, () => Math.round(30 + Math.pow(rng(), 0.8) * (duration - 35))).sort((a, b) => a - b);
  const sideSeq = [...Array(kills[0]).fill(0), ...Array(kills[1]).fill(1)].sort(() => rng() - 0.5);
  times.forEach((tm, n) => {
    const side = sideSeq[n];
    const mine = players.filter(x => x.side === side), theirs = players.filter(x => x.side !== side);
    const k = pick(mine, x => RM[x.role].k * (x._e / 60) * (0.6 + x._p.aggression / 125));
    const v = pick(theirs, x => RM[x.role].d * (1.6 - x._p.positioning / 100));
    const as = mine.filter(x => x !== k && rng() < RM[x.role].a / 0.4 * (0.5 + x._p.teamwork / 100) * 0.5);
    k.k++; v.d++; for (const x of as) x.a++;
    const [x, y] = LANE_PTS[Math.floor(rng() * LANE_PTS.length)];
    events.push({ t: tm, type: 'kill', side, k: k.pid, v: v.pid, a: as.map(z => z.pid), x, y, kc: k.champ, vc: v.champ, streak: 1, fb: n === 0, shutdown: false });
  });
  // Executions: deaths to towers and minions with no champion credit (about 0.39 per kill in the full engine).
  for (let i = 0, n = Math.max(0, Math.round(total * 0.39 + gauss())); i < n; i++) {
    const side = rng() < 0.6 ? loser : winner, v = pick(players.filter(x => x.side === side), x => RM[x.role].d * (1.6 - x._p.positioning / 100));
    v.d++; events.push({ t: Math.round(60 + rng() * (duration - 65)), type: 'death', side, v: v.pid, x: 54, y: 31 });
  }
  // Structures and objectives.
  const towers = []; towers[winner] = core ? 4 + Math.floor(rng() * 5) : 2 + Math.floor(rng() * 4); towers[loser] = Math.floor(rng() * (towers[winner] - 1) * (0.7 - dom * 0.3));
  const titans = [0, 0], shrines = [0, 0];
  for (let i = 0, n = Math.round(1.6 * mins / 8.1 + gauss() * 0.6); i < n; i++) titans[rng() < 0.5 + dom * 0.25 ? winner : loser]++;
  for (let i = 0, n = Math.round(2.9 * mins / 8.1 + gauss() * 0.8); i < n; i++) shrines[rng() < 0.5 + dom * 0.2 ? winner : loser]++;
  for (const [type, arr] of [['titan', titans], ['shrine', shrines], ['tower', towers]]) arr.forEach((c, side) => { for (let i = 0; i < c; i++) {
    const t = Math.round(120 + rng() * (duration - 125)), who = pick(players.filter(x => x.side === side), () => 1);
    who.obj++; events.push({ t, type, side, pid: who.pid, x: 54, y: type === 'titan' ? 18 : type === 'shrine' ? 44 : 31 });
  } });
  events.sort((a, b) => a.t - b.t);

  for (const x of players) {
    const m = RM[x.role], f = x._e / 60, won = x.side === winner ? 1.08 : 0.94, p = x._p;
    x.cs = Math.max(0, Math.round(m.cs * mins * (0.75 + p.laning / 200) * won * (1 + gauss() * 0.12)));
    x.dmg = Math.round(m.dmg * mins * f * won * (1 + gauss() * 0.2));
    x.taken = Math.round(m.taken * mins * (1 + gauss() * 0.2));
    x.heal = Math.round(m.heal * mins * f * (1 + gauss() * 0.2));
    x.towerDmg = Math.round(m.towerDmg * mins * (x.side === winner ? 1.4 : 0.6) * (1 + gauss() * 0.25));
    x.vision = Math.round(m.vision * mins * (0.6 + p.vision / 125));
    x.gold = Math.round(135 * mins + x.cs * 20 + x.k * 300 + x.a * 75 + towers[x.side] * 150);
    x.level = Math.min(12, Math.round(5 + mins * 0.7 + (x.side === winner ? 1 : 0)));
  }
  const teamDmg = side => players.filter(x => x.side === side).reduce((n, x) => n + x.dmg, 0) || 1;
  for (const x of players) {
    x.share = +(x.dmg / teamDmg(x.side)).toFixed(3);
    x.rating = +Math.max(3, Math.min(10, 5.2 + x.k * 0.3 + x.a * 0.15 - x.d * 0.3 + x.share * 4 + (x.cs / mins) * 0.1 + x.obj * 0.2 + x.vision / mins * 0.08 + (x.side === winner ? 0.6 : -0.3))).toFixed(1);
    delete x._p; delete x._e;
  }
  const gold = [0, 1].map(side => players.filter(x => x.side === side).reduce((n, x) => n + x.gold, 0));
  // Gold timeline: random walk that ends at the final difference.
  const timeline = []; let walk = 0;
  for (let t = 0; t <= duration; t += 5) {
    const frac = t / duration;
    walk += gauss() * 120;
    const diff = (gold[0] - gold[1]) * frac * frac + walk * (1 - frac);
    const base = 2500 + t * 9.5 * 5;
    timeline.push({ t, g: [Math.round(base + diff / 2), Math.round(base - diff / 2)] });
  }
  timeline[timeline.length - 1].g = gold;
  const mvp = players.filter(x => x.side === winner).reduce((a, b) => (b.rating > a.rating ? b : a));
  const gd5 = timeline.find(x => x.t >= 300)?.g; 
  return {
    winner, duration, kills, towers, fbSide: events.find(e => e.type === 'kill')?.side ?? -1, titans, shrines,
    endReason: core ? 'core' : 'time', players, mvp: mvp.pid, gd5: gd5 ? gd5[0] - gd5[1] : 0, gold, timeline, events, frames: [],
    plans: teams.map((t, side) => { const pl = clonePlan(t.plan); return { t: 0, side, phases: PHASES.map(ph => `${pl.phases[ph].posture} ${pl.phases[ph].style}`), objective: pl.objective, focus: pl.focus, jungle: pl.jungle }; }),
    fast: true,
  };
}

// One engine job (see calendar.gameJob): fast or full engine.
export const runPayload = ({ teamA, teamB, seed, fast, opts }) => (fast ? fastMatch(teamA, teamB, seed, opts) : summarize(runMatch(teamA, teamB, seed, opts)));
