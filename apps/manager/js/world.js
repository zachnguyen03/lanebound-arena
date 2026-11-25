// World state: generation, clubs, players and shared helpers. Pure data logic (no DOM).
import { ROLES, CHAMP_IDS, CHAMPS, REGIONS, REGION_INFO, TIERS, TIER_SIZE, CLUB_PARTS, TEAM_COLORS, NAME_A, NAME_B, ATTRS, ROLE_WEIGHTS, overall, clamp, PLAN_PRESETS, clonePlan } from './data.js';

export const SAVE_VERSION = 5; // v5: Lanebound engine, attributes and champions (older saves can't be converted)
export const START_YEAR = 2027;
export const FIRST_TEAM_MAX = 10, ACADEMY_MAX = 10, ROSTER_MIN = 5;
export const WAGE_CAP = [1_000_000, 500_000, 250_000]; // per tier, covers first team + academy

export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export { overall, clamp };

// ---------------- Dates ----------------
// W.day = day of the year, 0 = Jan 1. Dates are labels only; all logic uses day numbers.
export const dateOf = (year, day) => new Date(Date.UTC(year, 0, 1 + day));
export const weekday = (year, day) => dateOf(year, day).getUTCDay(); // 0 Sun .. 6 Sat
export const fmtDate = (year, day, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => dateOf(year, day).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });
export const dayOfDate = (year, month, date) => Math.round((Date.UTC(year, month, date) - Date.UTC(year, 0, 1)) / 864e5);

// ---------------- Player economics ----------------
export const ability = p => overall(p);
// Annual wage the player expects.
export const wageFor = p => Math.round((5000 + Math.max(0, (overall(p) - 30) / 50) ** 2.5 * 220000) / 500) * 500;
export function valueOf(p) { // transfer value in $
  const ov = overall(p), age = p.age;
  const ageMult = age <= 19 ? 1.6 : age <= 22 ? 1.35 : age <= 25 ? 1 : age <= 27 ? 0.75 : 0.45;
  return Math.max(5000, Math.round((ov / 10) ** 3 * 1500 * ageMult * (1 + Math.max(0, p.potential - ov) / 60) / 1000) * 1000);
}
export const potentialStars = p => Math.round(clamp((p.potential - 40) / 12, 1, 5) * 2) / 2;
export const MASTERY = v => (v >= 1.08 ? 'S' : v >= 0.98 ? 'A' : v >= 0.85 ? 'B' : 'C');

// ---------------- Traits ----------------
export const TRAITS = {
  'Aggressive': { aggression: 8, reflexes: 3 },
  'Tilts when behind': { resilience: -12 },
  'Clutch performer': { clutch: 10 },
  'Shotcaller': { decision: 5, teamwork: 4 },
  'Sharpshooter': { aim: 8 },
  'Team player': { teamwork: 6 },
  'Hot-headed': { aggression: 10, positioning: -5 },
  'Ice cold': { resilience: 8, clutch: 4 },
  'Professional': {}, // develops faster
  'Inconsistent': { resilience: -6 },
};

// ---------------- Names ----------------
function newName(W) {
  for (let i = 0; i < 300; i++) {
    const n = pick(NAME_A) + pick(NAME_B) + (Math.random() < 0.3 ? pick(NAME_B) : '');
    if (!W.names[n]) { W.names[n] = 1; return n; }
  }
  return `Player${W.nextPid}`;
}

// ---------------- Players ----------------
export function makePlayer(W, level, role, age = randInt(17, 27), region = pick(REGIONS)) {
  const p = {
    id: `p${W.nextPid++}`, name: newName(W), region, age, role, role2: pick(ROLES.filter(r => r !== role)),
    teamId: null, squad: null, morale: 70, condition: 90, form: [], focus: null, prof: {}, traits: [],
    professionalism: randInt(5, 20), listed: false,
  };
  const w = ROLE_WEIGHTS[role];
  for (const k of ATTRS) p[k] = Math.round(clamp(level + rand(-11, 11) + (w[k] >= 0.15 ? 4 : 0), 12, 96));
  const ov = overall(p);
  p.potential = Math.round(clamp(ov + (age <= 19 ? rand(6, 32) : age <= 22 ? rand(2, 18) : age <= 24 ? rand(0, 8) : rand(0, 3)), ov, 97));
  for (const id of CHAMP_IDS) p.prof[id] = +rand(0.6, 0.85).toFixed(2);
  const mine = shuffle(CHAMP_IDS.filter(id => CHAMPS[id].roles.includes(role))).slice(0, 3);
  for (const id of [...mine, pick(CHAMP_IDS)]) p.prof[id] = +rand(0.95, 1.12).toFixed(2);
  if (Math.random() < 0.6) p.traits.push(pick(Object.keys(TRAITS)));
  if (Math.random() < 0.15) { const t = pick(Object.keys(TRAITS)); if (!p.traits.includes(t)) p.traits.push(t); }
  p.wage = wageFor(p);
  p.contractEnd = W.year + randInt(0, 2);
  p.stats = {}; p.champStats = {}; p.history = []; p.awards = []; p.career = [];
  p.rookieYear = null;
  W.players[p.id] = p;
  return p;
}

// ---------------- Clubs ----------------
function clubName(W, used) {
  for (let i = 0; i < 500; i++) {
    const n = `${pick(CLUB_PARTS[0])} ${pick(CLUB_PARTS[1])}`;
    const [a, b] = n.split(' ');
    if (!used.has(n) && !used.has(a) && !used.has(b) && a.slice(0, 4) !== b.slice(0, 4)) { used.add(n); used.add(a); used.add(b); return n; } // words unique within a region
  }
  return `Club ${used.size}`;
}
const tagOf = name => { const w = name.split(' '); return (w.length > 1 ? w[0].slice(0, 2) + w.at(-1)[0] : name.slice(0, 3)).toUpperCase(); };

export const FACILITIES = {
  training: { name: 'Training centre', effect: 'Faster player growth', cost: lvl => 120000 * lvl, days: lvl => 20 + 10 * lvl },
  analytics: { name: 'Analytics room', effect: 'Faster, sharper scouting; better draft reads', cost: lvl => 90000 * lvl, days: lvl => 15 + 10 * lvl },
  academy: { name: 'Academy', effect: 'Academy growth and better newgens', cost: lvl => 100000 * lvl, days: lvl => 20 + 10 * lvl },
  media: { name: 'Media studio', effect: 'More sponsor income', cost: lvl => 80000 * lvl, days: lvl => 15 + 8 * lvl },
};
export const STAFF_ROLES = { head: 'Head coach', strategy: 'Strategy coach', development: 'Development coach', analyst: 'Analyst' };
export function makeStaff(W, level) {
  const r = clamp(Math.round(level / 5 + rand(-3, 3)), 3, 20);
  return { id: `c${W.nextPid++}`, name: newName(W), rating: r, wage: 20000 + r * 5000 };
}

function makeClub(W, region, tier, rep, idx, used) {
  const name = clubName(W, used);
  const t = {
    id: `t${W.teams.length}`, name, tag: tagOf(name), region, tier, color: TEAM_COLORS[idx % TEAM_COLORS.length], rep,
    cash: tier === 0 ? 800000 + rep * 25000 : tier === 1 ? 250000 + rep * 6000 : 80000 + rep * 2000,
    players: [], academy: [], starters: [], plan: clonePlan(PLAN_PRESETS[pick(Object.keys(PLAN_PRESETS))]),
    facilities: { training: 1 + Math.floor(rep / 30), analytics: 1 + Math.floor(rep / 35), academy: 1 + Math.floor(rep / 35), media: 1 + Math.floor(rep / 30) },
    build: null, sponsors: [], staff: {}, fin: {}, trophies: [], history: [], season: {}, target: '', targetPlace: 6,
    training: { plan: null }, focusPoints: 15, scrims: [],
  };
  const level = tier === 0 ? 46 + rep * 0.28 : tier === 1 ? 33 + rep * 0.3 : 28 + rep * 0.25;
  const size = tier === 0 ? 8 : 7;
  const roles = [...ROLES, ...shuffle(ROLES).slice(0, size - 5)];
  roles.forEach((role, i) => {
    const p = makePlayer(W, level - (i >= 5 ? 6 : 0), role, undefined, region);
    p.teamId = t.id; p.squad = 'first'; t.players.push(p.id);
  });
  if (tier === 0) for (let i = 0; i < 4; i++) { const p = makePlayer(W, level - 14, pick(ROLES), randInt(15, 18), region); p.teamId = t.id; p.squad = 'academy'; t.academy.push(p.id); }
  for (const k of Object.keys(STAFF_ROLES)) t.staff[k] = tier === 0 || k === 'head' ? makeStaff(W, rep) : null;
  t.sponsors = [{ name: sponsorName(), weekly: sponsorBase(t), until: W.year + randInt(0, 1) }];
  W.teams.push(t);
  autoStarters(W, t);
  return t;
}
const SPONSOR_A = ['Lumacore', 'Brightway', 'Kestrel', 'Northlight', 'Velo', 'Quanta', 'Halcyon', 'Ridgeline', 'Ostra', 'Pinecrest', 'Sola', 'Arcwell'];
const SPONSOR_B = ['Energy', 'Telecom', 'Snacks', 'Hardware', 'Bank', 'Apparel', 'Mobility', 'Cloud', 'Drinks', 'Peripherals'];
export const sponsorName = () => `${pick(SPONSOR_A)} ${pick(SPONSOR_B)}`;
export const sponsorBase = t => Math.round(t.rep * 300 * REGION_INFO[t.region].sponsor * [1, 0.35, 0.12][t.tier] * (1 + 0.06 * ((t.facilities?.media ?? 1) - 1)) / 100) * 100;

// ---------------- World ----------------
export function createWorld() {
  const W = {
    v: SAVE_VERSION, year: START_YEAR, day: 0, userTeamId: null, players: {}, teams: [], freeAgents: [], names: {},
    nextPid: 1, comps: {}, series: {}, fixtures: {}, brackets: [], inbox: [], offers: [], scouting: {}, shortlist: [], negotiations: {},
    champions: [], games: [], reports: {}, nextGame: 1, nextMsg: 1, pendingUserSeries: null, rollover: null, news: [],
  };
  for (const region of REGIONS) {
    const used = new Set(W.teams.map(t => t.name));
    const n = REGION_INFO[region].clubs;
    const reps = shuffle(Array.from({ length: n }, (_, i) => Math.round(92 - i * (60 / (n - 1)))));
    reps.forEach((rep, i) => makeClub(W, region, 0, rep, i, used));
    for (let i = 0; i < TIER_SIZE[1]; i++) makeClub(W, region, 1, randInt(18, 40), i + 3, used);
    for (let i = 0; i < TIER_SIZE[2]; i++) makeClub(W, region, 2, randInt(5, 20), i + 7, used);
  }
  for (let i = 0; i < 60; i++) { const p = makePlayer(W, rand(28, 55), pick(ROLES)); W.freeAgents.push(p.id); }
  return W;
}

export const team = (W, id) => W.teams.find(t => t.id === id);
export const userTeam = W => team(W, W.userTeamId);
export const teamPlayers = (W, t) => t.players.map(id => W.players[id]);
export const academyPlayers = (W, t) => t.academy.map(id => W.players[id]);
export const allPlayers = (W, t) => [...t.players, ...t.academy].map(id => W.players[id]);
export const strength = (W, t) => Math.round(t.starters.reduce((n, pid, i) => n + overall(W.players[pid], ROLES[i]), 0) / 5);
export const leagueTeams = (W, region, tier = 0) => W.teams.filter(t => t.region === region && t.tier === tier);
export const payroll = (W, t) => allPlayers(W, t).reduce((n, p) => n + p.wage, 0);
export const wageCap = t => Math.round(WAGE_CAP[t.tier] * (1 + (t.capBonus ?? 0)));

const fit = (p, role) => overall(p, role) * (p.role === role ? 1 : p.role2 === role ? 0.95 : 0.85) * (0.85 + 0.15 * (p.condition ?? 100) / 100);
export { fit };
// Best total fit over all role assignments (first team only; 10P5 = 30240 worst case).
export function autoStarters(W, t) {
  const pool = teamPlayers(W, t);
  const top = ROLES.map(r => pool.slice().sort((a, b) => fit(b, r) - fit(a, r)).slice(0, 4)); // prune: top 4 per role
  let best = null, bestSc = -1;
  const rec = (i, used, sc, chosen) => {
    if (i === 5) { if (sc > bestSc) { bestSc = sc; best = [...chosen]; } return; }
    for (const p of top[i]) if (!used.has(p.id)) { used.add(p.id); chosen.push(p.id); rec(i + 1, used, sc + fit(p, ROLES[i]), chosen); chosen.pop(); used.delete(p.id); }
  };
  rec(0, new Set(), 0, []);
  if (!best) { // fewer distinct candidates than roles: fill greedily
    best = []; const used = new Set();
    for (const r of ROLES) { const p = pool.filter(x => !used.has(x.id)).sort((a, b) => fit(b, r) - fit(a, r))[0]; used.add(p.id); best.push(p.id); }
  }
  t.starters = best;
}

// ---------------- Inbox ----------------
// cat: offer | scouting | highlights | news | board
export function mail(W, title, body, cat = 'news', data = null) {
  W.inbox.unshift({ id: W.nextMsg++, year: W.year, day: W.day, title, body, cat, read: false, data });
  if (W.inbox.length > 150) W.inbox.length = 150;
}
export const unread = W => W.inbox.filter(m => !m.read && !m.archived).length;
export const ordinal = n => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th'}`;
export const tierName = (region, tier) => (tier === 0 ? REGION_INFO[region].league : `${region} ${TIERS[tier]}`);
export { REGIONS, REGION_INFO, TIERS };
