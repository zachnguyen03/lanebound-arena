// Run: node test/people.test.mjs   (chemistry, personalities, promises, talks, rivalries, conversations)
import assert from 'node:assert/strict';
import { createWorld, newSeason, setUserTeam, simTo, userTeam, teamChem, pairChem, teamTalk, applyChoice, peopleWeekly, addPromises, rivalry, addRivalry, isRivalry, stakesOf, termsLikelihood, playerAsk, enginePlayer, PERSONAS } from '../js/career.js';
import { runPayload } from '../js/fastsim.js';

const fast = async ps => ps.map(p => runPayload({ ...p, fast: true }));
const W = createWorld(); newSeason(W);
setUserTeam(W, W.teams.find(t => t.tier === 0).id);
const u = userTeam(W);
assert.equal(teamChem(u), 50, 'fresh world is neutral');

// Chemistry grows with games played together, and feeds Teamwork.
await simTo(W, fast, { until: { year: W.year, day: W.day + 60 }, autoUser: true });
assert.ok(teamChem(userTeam(W)) > 52, `chemistry grows: ${teamChem(userTeam(W))}`);
const t = userTeam(W), p = W.players[t.starters[0]];
assert.ok(enginePlayer(p, 0, 'rhedan', t).teamwork >= enginePlayer(p, 0, 'rhedan', null).teamwork);

// Every player has a personality after a week.
assert.ok(Object.values(W.players).filter(x => x.teamId).every(x => x.persona?.every(k => PERSONAS[k])));

// Promises: a benched promised starter turns on you after four weeks.
const sub = W.players[t.players.find(id => !t.starters.includes(id))];
addPromises(W, sub, ['start']); sub.benchWeeks = 3;
peopleWeekly(W);
assert.ok(sub.wantsOut && sub.promises[0].broken);
const msg = W.inbox.find(m => m.data?.choices && m.title.includes(sub.name));
assert.ok(applyChoice(W, msg, 0));
assert.ok(t.starters.includes(sub.id) || !t.starters.some(id => W.players[id].role === sub.role), 'put back in the lineup');
assert.equal(applyChoice(W, msg, 0), null, 'a choice resolves once');
const offer = { wage: playerAsk(sub, t), years: 2 }; // at the ask, so the likelihood isn't clamped at 0 by morale
assert.ok(termsLikelihood(W, sub, t, offer) < termsLikelihood(W, sub, t, { ...offer, promises: ['title'] }));

// Team talks move morale and report a mood per starter.
const r = teamTalk(W, t, 'motivate', -1);
assert.equal(r.length, 5); assert.ok(r.every(x => x.mood));

// Rivalries raise league stakes.
const opp = W.teams.find(x => x.id !== t.id && x.tier === 0);
addRivalry(W, t.id, opp.id, 3);
assert.ok(isRivalry(W, opp.id, t.id) && rivalry(W, t.id, opp.id) === 3);
const s = Object.values(W.series).find(x => W.comps[x.comp].kind === 'league' && [x.a, x.b].includes(t.id) && [x.a, x.b].includes(opp.id));
if (s) assert.equal(stakesOf(W, s), 0.3);
console.log(`people ok: team chemistry ${teamChem(t).toFixed(1)}, pair ${pairChem(t, t.starters[0], t.starters[1])}`);
process.exit(0);
