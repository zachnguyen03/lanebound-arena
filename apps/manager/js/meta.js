// Patches and the meta: three balance patches a year (season start, summer split, before the Grand Convergence).
// Each nerfs the most dominant champions of the previous patch and buffs the weakest, 4-8 champions in all.
// W.patch = { id, year, day, mods: { champ: { hp, atk, cd } } (cumulative, ±25% cap), meta: { champ: draft value }, notes }
import { CHAMPS, CHAMP_IDS } from './data.js';
import { newsPatch } from './news.js';

const STATS = { hp: 'base HP', atk: 'attack', cd: 'cooldowns' };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r2 = v => Math.round(v * 1000) / 1000;
// Draft value of a champion's patch state: + for stronger (more HP/attack, shorter cooldowns).
export const metaValue = m => r2(((m?.hp ?? 0) + (m?.atk ?? 0) - (m?.cd ?? 0) * 0.6) * 0.5);

// Champion performance on a patch from top-league and international games: presence, win rate.
export function patchStats(W, pt = W.patch?.id) {
  const games = W.games.filter(g => g.pt === pt && (W.comps[g.comp]?.tier === 0 || W.comps[g.comp]?.kind === 'intl'));
  const s = Object.fromEntries(CHAMP_IDS.map(id => [id, { picks: 0, bans: 0, wins: 0 }]));
  for (const g of games) {
    g.picks.forEach((side, i) => side.forEach(id => { if (!s[id]) return; s[id].picks++; if ((i ? g.red : g.blue) === g.winner) s[id].wins++; }));
    g.bans.flat().forEach(id => s[id] && s[id].bans++);
  }
  const n = games.length;
  return { n, rows: Object.fromEntries(Object.entries(s).map(([id, x]) => [id, { ...x, presence: n ? (x.picks + x.bans) / n : 0, win: x.picks ? x.wins / x.picks : 0.5 }])) };
}

// Power score used to pick patch targets: presence and win rate (win rate only counts with enough picks).
const power = x => x.presence + (x.picks >= 8 ? (x.win - 0.5) * 2 : 0);

export function newPatch(W, rng = Math.random) {
  const prev = W.patch, n = prev?.year === W.year ? +prev.id.split('.')[1] + 1 : 1;
  const mods = JSON.parse(JSON.stringify(prev?.mods ?? {}));
  const { n: games, rows } = patchStats(W, prev?.id);
  const ranked = CHAMP_IDS.slice().sort((a, b) => (games ? power(rows[b]) - power(rows[a]) : rng() - 0.5));
  const k = 2 + Math.floor(rng() * 3); // 2-4 nerfs and 2-4 buffs
  const notes = [];
  const change = (id, dir) => {
    const stat = ['hp', 'atk', 'cd'][Math.floor(rng() * 3)], size = r2(0.05 + rng() * 0.07);
    const delta = stat === 'cd' ? -dir * size : dir * size; // a buff shortens cooldowns
    const m = mods[id] ??= {};
    m[stat] = r2(clamp((m[stat] ?? 0) + delta, -0.25, 0.25));
    notes.push({ id, dir, stat, pct: Math.round(size * 100), text: `${CHAMPS[id].name}: ${STATS[stat]} ${delta > 0 ? '+' : '−'}${Math.round(size * 100)}%` });
  };
  ranked.slice(0, k).forEach(id => change(id, -1));
  ranked.slice(-k).forEach(id => change(id, 1));
  // Old changes drift back a little each patch so the meta keeps moving instead of stacking forever.
  for (const [id, m] of Object.entries(mods)) for (const st of Object.keys(m)) { if (!notes.some(x => x.id === id && x.stat === st)) m[st] = r2(m[st] * 0.7); if (Math.abs(m[st]) < 0.01) delete m[st]; }
  for (const id of Object.keys(mods)) if (!Object.keys(mods[id]).length) delete mods[id];
  const id = `${W.year % 100}.${n}`;
  W.patch = { id, year: W.year, day: W.day, mods, meta: Object.fromEntries(Object.entries(mods).map(([c, m]) => [c, metaValue(m)])), notes };
  (W.patches ??= []).push({ id, year: W.year, day: W.day, notes });
  if (W.patches.length > 12) W.patches.shift();
  if (W.userTeamId) newsPatch(W, W.patch);
  return W.patch;
}

// Tier list for the current patch: S/A/B/C by presence and win rate, with the patch change.
export function tierList(W) {
  const { n, rows } = patchStats(W);
  return CHAMP_IDS.map(id => {
    const x = rows[id], sc = n ? power(x) : metaValue(W.patch?.mods?.[id]) * 4;
    return { id, ...x, games: n, score: sc, mod: W.patch?.mods?.[id] ?? null, meta: W.patch?.meta?.[id] ?? 0 };
  }).sort((a, b) => b.score - a.score).map((r, i, all) => ({ ...r, tier: i < all.length * 0.15 ? 'S' : i < all.length * 0.4 ? 'A' : i < all.length * 0.75 ? 'B' : 'C' }));
}

// Players: comfort pool (A or S mastery) and meta fit (mastery on buffed champions of their role).
export const comfortPool = p => CHAMP_IDS.filter(id => (p.prof[id] ?? 0) >= 0.98);
export function metaFit(W, p) {
  const buffed = Object.entries(W.patch?.meta ?? {}).filter(([id, v]) => v > 0.01 && CHAMPS[id].roles.includes(p.role)).map(([id]) => id);
  return buffed.length ? buffed.reduce((n, id) => n + ((p.prof[id] ?? 0.7) - 0.85), 0) / buffed.length : 0;
}
// Weeks of champion focus to reach a mastery target (training: +0.01 a week, +0.003 per Champion practice session).
export const weeksTo = (cur, target, sessions = 0) => (cur >= target ? 0 : Math.ceil((target - cur) / (0.01 + sessions * 0.003)));
