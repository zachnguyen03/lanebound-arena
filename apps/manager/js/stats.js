// Stats centre queries: scopes, player / team / champion / game / economy aggregates, CSV export. No DOM.
import { CHAMP_IDS, CHAMPS, REGIONS, ROLES } from './data.js';
import { team } from './world.js';
import { emptyAgg } from './calendar.js';

// scope: season | career | archive (needs year) | series (needs sid). Filters: region, tier, kind.
// A series scope is an empty key list tagged with .sid: rows then come from that series' games only.
export function compKeys(W, { scope = 'season', year, sid, region, tier, kind } = {}) {
  if (scope === 'series') return Object.assign([], { sid: W.series[sid] ? sid : null });
  const yr = scope === 'season' ? W.year : scope === 'archive' ? year : null;
  return Object.values(W.comps).filter(c => (yr == null || c.year === yr) && (!region || c.region === region || (c.kind === 'intl' && !region))
    && (tier == null || tier === '' || c.tier === +tier || c.kind === 'intl') && (!kind || c.kind === kind)).map(c => c.key);
}
export const archiveYears = W => [...new Set(Object.values(W.comps).map(c => c.year))].filter(y => y < W.year).sort((a, b) => b - a);

function sumAgg(stats, keys) {
  const t = { ...emptyAgg(), rc: [0, 0, 0, 0, 0], team: null };
  for (const k of keys) {
    const a = stats[k]; if (!a) continue;
    for (const f in emptyAgg()) t[f] += a[f] ?? 0;
    a.rc?.forEach((n, i) => { t.rc[i] += n; });
    t.team = a.team ?? t.team;
  }
  return t;
}
const per = (n, d) => (d ? n / d : 0);
const emptyTeam = () => ({ gp: 0, w: 0, kills: 0, deaths: 0, towers: 0, towersLost: 0, mins: 0, fb: 0, titans: 0, shrines: 0, gold: 0, goldAgainst: 0 });

// Player and team aggregates straight from game records (series scope). g.pl rows are in engine order:
// blue Top..Support, then red Top..Support.
function aggFromGames(games) {
  const players = {}, teams = {};
  for (const g of games) {
    [g.blue, g.red].forEach((tid, side) => {
      const t = teams[tid] ??= emptyTeam(), o = 1 - side;
      t.gp++; if (g.winner === tid) t.w++;
      t.kills += g.kills[side]; t.towers += g.towers[side]; t.towersLost += g.towers[o]; t.mins += g.dur / 60;
      t.deaths += g.pl ? g.pl.slice(side * 5, side * 5 + 5).reduce((n, r) => n + r[3], 0) : g.kills[o];
      if (g.fb === side) t.fb++; t.titans += g.titans[side]; t.shrines += g.shrines[side]; t.gold += g.gold[side]; t.goldAgainst += g.gold[o];
    });
    (g.pl ?? []).forEach(([pid, , k, d, a, cs, gold, dmg, vision, rating], i) => {
      const side = i < 5 ? 0 : 1, tid = side ? g.red : g.blue;
      const x = players[pid] ??= { ...emptyAgg(), rc: [0, 0, 0, 0, 0], team: tid };
      x.gp++; if (g.winner === tid) x.w++;
      Object.assign(x, { k: x.k + k, d: x.d + d, a: x.a + a, cs: x.cs + cs, gold: x.gold + gold, dmg: x.dmg + dmg, vision: x.vision + vision, rating: x.rating + rating, mins: x.mins + g.dur / 60, team: tid });
      if (g.mvp === pid) x.mvp++;
      x.rc[i % 5]++;
    });
  }
  return { players, teams };
}

export function playerRows(W, keys, { role, minGp = 1, teamId } = {}) {
  const rows = [], fromGames = keys.sid !== undefined ? aggFromGames(gamesIn(W, keys)).players : null;
  for (const p of Object.values(W.players)) {
    const a = fromGames ? fromGames[p.id] : sumAgg(p.stats, keys);
    if (!a || a.gp < minGp) continue;
    // Role and club as played: most-played role in scope, club of the latest game (older saves: current values).
    const max = Math.max(...a.rc), played = max > 0 ? ROLES[a.rc.indexOf(max)] : p.role, tid = a.team ?? p.teamId;
    if (role && played !== role) continue;
    if (teamId && tid !== teamId) continue;
    rows.push({
      id: p.id, name: p.name, team: team(W, tid)?.tag ?? 'FA', role: played, gp: a.gp, w: a.w, winPct: per(a.w, a.gp) * 100,
      k: a.k, d: a.d, a: a.a, kda: (a.k + a.a) / Math.max(1, a.d), csm: per(a.cs, a.mins), gpm: per(a.gold, a.mins), dpm: per(a.dmg, a.mins),
      vpm: per(a.vision, a.mins), rating: per(a.rating, a.gp), mvp: a.mvp,
    });
  }
  return rows;
}

export function teamRows(W, keys) {
  const fromGames = keys.sid !== undefined ? aggFromGames(gamesIn(W, keys)).teams : null;
  return W.teams.map(t => {
    let a = emptyTeam();
    if (fromGames) a = fromGames[t.id] ?? a;
    else for (const k of keys) { const s = t.season[k]; if (s) for (const f in a) a[f] += s[f] ?? 0; }
    return { id: t.id, name: t.name, tag: t.tag, region: t.region, gp: a.gp, w: a.w, winPct: per(a.w, a.gp) * 100, kpg: per(a.kills, a.gp), dpg: per(a.deaths, a.gp),
      tpg: per(a.towers, a.gp), fbPct: per(a.fb, a.gp) * 100, titans: a.titans, shrines: a.shrines, len: per(a.mins, a.gp), gpm: per(a.gold, a.mins * 5) , gdpg: per(a.gold - a.goldAgainst, a.gp) };
  }).filter(r => r.gp > 0);
}

export const gamesIn = (W, keys) => { if (keys.sid !== undefined) return W.games.filter(g => g.sid === keys.sid); const set = new Set(keys); return W.games.filter(g => set.has(g.comp)); };

export function champRows(W, keys, { pt } = {}) {
  const games = gamesIn(W, keys).filter(g => !pt || g.pt === pt), n = games.length;
  // K/D/A only exists for games that kept player lines (top leagues, internationals, the user's games): kdaGames counts them.
  const rows = Object.fromEntries(CHAMP_IDS.map(id => [id, { id, name: CHAMPS[id].name, cls: CHAMPS[id].cls, picks: 0, bans: 0, wins: 0, k: 0, d: 0, a: 0, kdaGames: 0 }]));
  for (const g of games) {
    g.picks.forEach((side, s) => side.forEach(id => { if (!rows[id]) return; rows[id].picks++; if ((s === 0 ? g.blue : g.red) === g.winner) rows[id].wins++; }));
    g.bans.flat().forEach(id => rows[id] && rows[id].bans++);
    for (const [, champ, k, d, a] of g.pl ?? []) if (rows[champ]) { rows[champ].k += k; rows[champ].d += d; rows[champ].a += a; rows[champ].kdaGames++; }
  }
  return Object.values(rows).map(r => ({ ...r, pickPct: per(r.picks, n) * 100, banPct: per(r.bans, n) * 100, presence: per(r.picks + r.bans, n) * 100, winPct: per(r.wins, r.picks) * 100, kda: r.kdaGames ? (r.k + r.a) / Math.max(1, r.d) : null, games: n }));
}

export function gameRows(W, keys) {
  return gamesIn(W, keys).map(g => ({
    id: g.id, year: g.year, day: g.day, comp: W.comps[g.comp]?.name ?? g.comp, blue: team(W, g.blue)?.tag, red: team(W, g.red)?.tag, winner: team(W, g.winner)?.tag,
    score: `${g.kills[0]}-${g.kills[1]}`, len: g.dur / 60, gd: g.gold[0] - g.gold[1], report: !!W.reports[g.id],
  })).reverse();
}

// Club ledger by month for the user's club (Economy tab).
export function ledger(t) {
  return Object.entries(t.fin).sort(([a], [b]) => a.localeCompare(b)).map(([month, cats]) => ({ month, ...cats, net: Object.values(cats).reduce((n, v) => n + v, 0) }));
}

export function toCSV(rows, cols) {
  const esc = v => { const s = typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.map(c => esc(c.label)).join(','), ...rows.map(r => cols.map(c => esc(r[c.key])).join(','))].join('\n');
}
export { REGIONS };
