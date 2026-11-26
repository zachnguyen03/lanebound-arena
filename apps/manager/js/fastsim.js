// Statistical match engine for bulk background games (lower tiers, other leagues on "fast" detail).
// Same input and summary shape as the full engine (engine.ts runFull), no sim: the winner comes from a logistic
// on the lineups' effective sim strength, then the score, stat lines and events are drawn around means measured
// on the full engine. Calibrate with test/fit.mjs (numbers below).
import { ROLES, ROLE_WEIGHTS, CHAMPS } from './data.js';
import { CARD_STATS, SLOTS } from './cards.js';
import { runFull, rngFrom, simPlayer, rate, SIM_ATTRS, ROLE_MEANS as RM } from './engine.ts';

const KPM = Object.values(RM).reduce((n, m) => n + m.k, 0); // team kills per minute
// Logistic fit (Newton, per-game strength gap d): logit p(blue wins) = 0.0188 + 0.1089·d. Win rate of the stronger side:
//   gap 0: full 49.3%, fast 50.3% | gap 4: full 62.2%, fast 62.2% | gap 8: full 72.2%, fast 71.7% | gap 16: full 83.8%, fast 85.8%
// (a uniform career gap g gives d ≈ g). Score: loser 18.0 ± 5.5 points, 0.239 points/s (duration 194 ± 26 s),
// kill share of points 0.63 (winner) / 0.75 (loser), 4.42 captures a minute, 54.3% of them by the winner.
// 6.2% of games reach the 4:00 clock with nobody at 28 (loser 23.8 on average); the leader wins.
const FIT = { c: 0.0188, k: 0.1089 };
const LOSER = { mean: 18.0, sd: 5.5 }, P_CLOCK = 0.062, CLOCK_S = 240, PTS_PER_S = 0.2386, KILL_SHARE = [0.628, 0.746], CAPS_PER_MIN = 4.419, CAP_WIN_SHARE = 0.543;

// Effective sim strength of a lineup: role-weighted sim attributes (expected form, coach, mastery on Aim/Execution).
export function strength(t, stakes = 0) {
  return t.lineup.reduce((n, p, i) => {
    const w = ROLE_WEIGHTS[ROLES[i]], sp = simPlayer(p, 1 + ((p.clutch - 50) / 400) * stakes, t.coach), m = Math.max(-8, Math.min(8, (sp.mastery[p.champ] - 50) * 0.15));
    const tot = SIM_ATTRS.reduce((s, k) => s + w[k], 0);
    return n + SIM_ATTRS.reduce((s, k) => s + w[k] * (sp.attrs[k] + (k === 'aim' || k === 'execution' ? m : 0)), 0) / tot;
  }, 0) / t.lineup.length;
}

// Tactic Cards: each loaded card adds its measured win-chance gain (CARD_STATS, js/cards.js) as a strength bonus.
// Draft triggers are known exactly from the picks (gain / fire rate if met, else 0); the rest add fire rate × gain on firing = the measured gain.
const draftMet = (c, mine, theirs) => (c.trigger.on === 'enemy_class' ? theirs.lineup.filter(p => CHAMPS[p.champ]?.cls === c.trigger.cls).length >= c.trigger.n
  : c.trigger.on === 'owner_champ' ? mine.lineup[SLOTS.indexOf(c.owner)]?.champ === c.trigger.champ : null);
function cardGain(c, mine, theirs) {
  const [fire, lo, hi] = CARD_STATS[c.id] ?? [0, 0, 0], g = c.rarity === 'epic' ? hi : c.rarity === 'rare' ? (lo + hi) / 2 : lo, met = draftMet(c, mine, theirs);
  return { p: met === null ? fire : met ? 1 : 0, gain: met === null ? g : met ? g / Math.max(0.05, fire) : 0 };
}
// Win-chance gain -> strength gap: dp ≈ p(1-p)·k·dd, so dd = 4·dp / k at even odds.
const cardEdge = (mine, theirs) => (mine.cards ?? []).reduce((n, c) => n + (4 * cardGain(c, mine, theirs).gain) / FIT.k, 0);

export function fastMatch(teamA, teamB, seed = 1, opts = {}) {
  const rng = rngFrom(seed), gauss = () => (rng() + rng() + rng() - 1.5) * 1.41;
  const teams = [teamA, teamB];
  const d = strength(teamA, opts.stakes) - strength(teamB, opts.stakes) + cardEdge(teamA, teamB) - cardEdge(teamB, teamA);
  const winner = rng() < 1 / (1 + Math.exp(-(FIT.c + FIT.k * d))) ? 0 : 1, loser = 1 - winner;
  const clock = rng() < P_CLOCK, score = [];
  // ponytail: the clock game's winning margin is a guess (only the loser's 23.8 was measured).
  if (clock) { score[winner] = Math.round(Math.max(2, Math.min(27, 25.5 + gauss() * 1.5))); score[loser] = Math.max(0, score[winner] - 1 - Math.floor(Math.abs(gauss()) * 2.5)); }
  else { score[winner] = 28; score[loser] = Math.round(Math.max(0, Math.min(27, LOSER.mean + gauss() * LOSER.sd))); }
  const duration = clock ? CLOCK_S : Math.round(Math.max(60, Math.min(CLOCK_S - 1, (28 + score[loser]) / PTS_PER_S * (1 + gauss() * 0.12))) * 10) / 10, mins = duration / 60;
  const split = score.map((s, side) => { const k = Math.max(0, Math.min(s, Math.round(s * KILL_SHARE[side === winner ? 0 : 1] + gauss() * 2))); return { kills: k, obj: s - k }; });
  const kills = split.map(x => x.kills);

  const players = teams.flatMap((t, side) => t.lineup.map((p, i) => ({
    pid: p.id, name: p.name, side, role: ROLES[i], champ: p.champ, level: 0, k: 0, d: 0, a: 0, obj: 0, dmg: 0, taken: 0, heal: 0, share: 0, rating: 0, sp: 0, sd: 0, anc: 0, _p: p,
  })));
  const pick = (list, w) => { const tot = list.reduce((n, x) => n + w(x), 0); let r = rng() * tot; for (const x of list) if ((r -= w(x)) <= 0) return x; return list.at(-1); };
  const at = () => Math.round((2 + rng() * (duration - 4)) * 10) / 10;
  // Score events at random times; the winner's last point ends the game (or lands on the clock).
  const pts = [];
  for (const side of [0, 1]) for (const [part, n] of [['kills', split[side].kills], ['obj', split[side].obj]]) for (let i = 0; i < n; i++) pts.push({ side, part, t: at() });
  pts.sort((a, b) => a.t - b.t);
  const last = pts.findLastIndex(x => x.side === winner); pts.push(...pts.splice(last, 1)); pts.at(-1).t = duration;
  const events = [], timeline = [{ t: 0, s: [0, 0] }], s = [0, 0], streak = new Map();
  for (const x of pts) {
    s[x.side]++; timeline.push({ t: x.t, s: [...s] });
    if (x.part === 'obj') { events.push({ t: x.t, type: 'majority', side: x.side }); continue; }
    const mine = players.filter(y => y.side === x.side), theirs = players.filter(y => y.side !== x.side);
    const k = pick(mine, y => RM[y.role].k), v = pick(theirs, y => RM[y.role].d * (1.6 - y._p.positioning / 100));
    const as = mine.filter(y => y !== k && rng() < RM[y.role].a / (KPM - RM[y.role].k));
    k.k++; v.d++; for (const y of as) y.a++;
    const vs = streak.get(v.pid) ?? 0; streak.set(v.pid, 0); streak.set(k.pid, (streak.get(k.pid) ?? 0) + 1);
    events.push({ t: x.t, type: 'kill', side: x.side, k: k.pid, v: v.pid, a: as.map(z => z.pid), kc: k.champ, vc: v.champ, fb: !events.some(e => e.type === 'kill'), shutdown: vs >= 3, streak: streak.get(k.pid) });
  }
  // Point captures.
  const caps = [0, 0];
  for (let i = 0, n = Math.max(1, Math.round(CAPS_PER_MIN * mins * (1 + gauss() * 0.2))); i < n; i++) { const side = rng() < CAP_WIN_SHARE ? winner : loser; caps[side]++; events.push({ t: at(), type: 'capture', side, point: ['north', 'centre', 'south'][Math.floor(rng() * 3)] }); }
  // Cards that "fired": sampled with their fire rate; timed triggers at their time, the rest anywhere in the game.
  teams.forEach((t, side) => { for (const c of t.cards ?? []) if (rng() < cardGain(c, t, teams[1 - side]).p) {
    const tt = c.trigger.t ?? (['enemy_class', 'owner_champ'].includes(c.trigger.on) ? 0 : 10 + rng() * (duration - 20));
    if (tt < duration) events.push({ t: Math.round(tt * 10) / 10, type: 'card', side, id: c.id, pid: c.pid });
  } });
  events.sort((a, b) => a.t - b.t);

  for (const x of players) {
    const m = RM[x.role], won = x.side === winner ? 1.08 : 0.94;
    x.dmg = Math.round(m.dmg * mins * won * (1 + gauss() * 0.2));
    x.taken = Math.round(m.taken * mins * (1 + gauss() * 0.2));
    x.heal = Math.round(m.heal * mins * (1 + gauss() * 0.2));
    x.obj = Math.round(Math.max(0, m.obj * mins * won * (1 + gauss() * 0.3)));
    delete x._p;
  }
  const mvp = rate(players, winner, duration), at60 = timeline.filter(x => x.t <= 60).at(-1).s;
  return {
    winner, duration, score, split, caps, kills, fbSide: events.find(e => e.type === 'kill')?.side ?? -1, endReason: clock ? 'clock' : 'score',
    players, mvp, sd60: at60[0] - at60[1], timeline, events, config: null, fast: true, sweeps: [0, 0], // no milestones in the fast engine
  };
}

// One engine job (see calendar.gameJob): fast or full engine.
export const runPayload = ({ teamA, teamB, seed, fast, opts }) => (fast ? fastMatch(teamA, teamB, seed, opts) : runFull(teamA, teamB, seed, opts));
