// Run: node test/news.test.mjs   (one season, fast engine)
import assert from 'node:assert/strict';
import { createWorld, newSeason, setUserTeam, simTo, takeJob } from '../js/career.js';
import { runPayload } from '../js/fastsim.js';

const fast = async payloads => payloads.map(p => runPayload({ ...p, fast: true }));
const W = createWorld();
newSeason(W);
setUserTeam(W, W.teams.find(t => t.tier === 0).id);
while (await simTo(W, fast, { until: 'season', autoUser: true }) === 'sacked') takeJob(W, W.manager.offers[0].teamId, setUserTeam);

const types = new Set(W.news.map(n => n.type));
for (const t of ['result', 'title', 'patch', 'award']) assert.ok(types.has(t), `story type ${t}`);
assert.ok(W.news.length <= 60, 'feed capped');
// At most 3 news stories reach the inbox per week.
const perDay = {};
for (const m of W.inbox.filter(m => m.data?.news)) perDay[`${m.year}-${m.day}`] = (perDay[`${m.year}-${m.day}`] ?? 0) + 1;
assert.ok(Object.values(perDay).every(n => n <= 3), 'inbox cap');
assert.ok(W.news.every(n => n.headline && n.body && !/undefined|NaN/.test(n.headline + n.body)), 'no broken text');
const long = W.news.filter(n => n.headline.length > 60);
console.log(`news ok: ${W.news.length} stories, types ${[...types].join(', ')}; headlines over 60 chars: ${long.length}`);
for (const n of W.news.slice(0, 8)) console.log(`  [${n.type}] ${n.headline}`);
