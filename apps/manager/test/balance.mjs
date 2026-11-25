// Run: node test/balance.mjs [games=600] [offset=0]   -> champion and composition win rates on the full engine,
// random role-legal lineups, equal 60-rated players. Writes test/balance.txt. Target: every champion 45-55%.
// For the BAL table in data.js, run several in parallel with different offsets and merge (about 0.2 s per game).
import fs from 'node:fs';
import { CHAMPS, CHAMP_IDS, ROLES, ATTRS, COMP_BEATS, compOf } from '../js/data.js';
import { runMatch, summarize, fmt, rngFrom } from '../js/sim.js';

const N = +(process.argv[2] ?? 600), off = +(process.argv[3] ?? 0);
const lineup = (tag, ids, rng) => ({ name: tag, ai: true, lineup: ids.map((champ, i) => ({ id: tag + i, name: tag + i, ...Object.fromEntries(ATTRS.map(a => [a, 60])), champ, prof: 0.85 + rng() * 0.25 })) });
const champ = Object.fromEntries(CHAMP_IDS.map(id => [id, { g: 0, w: 0 }])), tags = {};
let dur = 0, kills = 0, ults = 0, good = 0, edge = [0, 0];
for (let i = off; i < off + N; i++) {
  const r = rngFrom(i * 7 + 3), used = new Set();
  const pick = () => ROLES.map(role => { const pool = CHAMP_IDS.filter(id => CHAMPS[id].roles.includes(role) && !used.has(id)); const id = pool[Math.floor(r() * pool.length)]; used.add(id); return id; });
  const ids = [pick(), pick()];
  const sum = summarize(runMatch(lineup('A', ids[0], r), lineup('B', ids[1], r), i + 11));
  dur += sum.duration; kills += sum.kills[0] + sum.kills[1];
  const u = sum.events.filter(e => e.type === 'ult'); ults += u.length; good += u.filter(e => e.good).length;
  ids.forEach((side, s) => side.forEach(id => { champ[id].g++; if (sum.winner === s) champ[id].w++; }));
  const t = ids.map(x => compOf(x).tag);
  t.forEach((tag, s) => { const x = tags[tag] ??= { g: 0, w: 0 }; x.g++; if (sum.winner === s) x.w++; });
  for (const s of [0, 1]) if (COMP_BEATS[t[s]] === t[1 - s]) { edge[1]++; if (sum.winner === s) edge[0]++; }
}
const pct = x => `${(x.w / x.g * 100).toFixed(1)}%`;
const rows = Object.entries(champ).sort((a, b) => b[1].w / b[1].g - a[1].w / a[1].g);
const out = [
  `${N} games: avg ${fmt(dur / N)}, ${(kills / N).toFixed(1)} kills, ${(ults / N).toFixed(1)} ultimates (${(good / ults * 100).toFixed(0)}% on a good moment)`,
  `Counter edge: ${edge[0]}/${edge[1]} (${(edge[0] / edge[1] * 100).toFixed(1)}%)`,
  `Compositions: ${Object.entries(tags).map(([t, x]) => `${t} ${pct(x)} (${x.g})`).join(', ')}`,
  `Outside 45-55%: ${rows.filter(([, x]) => Math.abs(x.w / x.g - 0.5) > 0.05).map(([id, x]) => `${id} ${pct(x)}`).join(', ') || 'none'}`,
  ...rows.map(([id, x]) => `${CHAMPS[id].name.padEnd(13)} ${pct(x).padStart(6)}  (${x.g})`),
];
fs.writeFileSync(new URL('./balance.txt', import.meta.url), out.join('\n') + '\n');
console.log(out.slice(0, 4).join('\n'));
