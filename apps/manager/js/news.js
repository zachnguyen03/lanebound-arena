// News: short written pieces about the world, built from data the game already records.
// Systems queue stories during the week with story(); newsWeekly() adds computed stories (title races,
// milestones), ranks them, sends the top 3 to the inbox and keeps everything in W.news (Home feed).
import { mail, team, pick, userTeam, overall } from './world.js';

const $k = n => (Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : `$${Math.round(n / 1000)}k`);
const INBOX_PER_WEEK = 3, KEEP = 60;
const poss = name => (name.endsWith('s') ? `${name}'` : `${name}'s`);

// Queue a story. imp: base importance 0-100. tone: -1 bad news for the clubs named, 0 neutral, 1 good.
export function story(W, type, imp, headline, body, { clubs = [], players = [], tone = 0 } = {}) {
  (W.newsQ ??= []).push({ type, imp, headline, body, clubs, players, tone });
}

// Pick one of several templates. Each template is a function of the same args.
const say = (list, ...a) => pick(list)(...a);

// ---------- Series results and streaks (called from seriesDone) ----------
const UPSET = [
  (w, l, sc) => [`${w.name} stun ${l.name} ${sc}`, `Few gave ${w.name} a chance against ${l.name}, but they took the series ${sc}.`],
  (w, l, sc) => [`Upset: ${w.name} topple ${l.name}`, `${l.name} came in as clear favourites and left beaten ${sc} by ${w.name}.`],
  (w, l, sc) => [`${l.name} slip up against ${w.name}`, `A ${sc} defeat to ${w.name} is the shock of the week.`],
];
const REVERSE = [
  (w, l, sc) => [`${w.name} reverse-sweep ${l.name}`, `Two games down, ${w.name} won three straight to beat ${l.name} ${sc}.`],
  (w, l, sc) => [`Back from 0-2: ${w.name} win ${sc}`, `${l.name} were one game from the win. ${w.name} had other ideas.`],
];
const STREAK = [
  (t, n) => [`${n} straight: ${t.name} can't stop winning`, `${t.name} have won ${n} series in a row.`],
  (t, n) => [`${t.name} make it ${n} in a row`, `Nobody has found an answer to ${t.name}: ${n} series wins on the bounce.`],
  (t, n) => [`${t.name} unbeaten in ${n} series`, `The streak goes on. ${t.name} have not lost a series in ${n} attempts.`],
];
const SLUMP = [
  (t, n) => [`${t.name} lose ${n} in a row`, `${n} straight series defeats. Questions are being asked at ${t.name}.`],
  (t, n) => [`Crisis at ${t.name}?`, `${t.name} have now lost ${n} series in a row.`],
];
const SNAP = [
  (w, l, n) => [`${w.name} end ${poss(l.name)} run`, `${l.name} had won ${n} series in a row until ${w.name} stopped them.`],
  (w, l, n) => [`Streak over: ${l.name} beaten`, `${w.name} snap a ${n}-series winning run.`],
];

export function newsSeries(W, s, winner, rival) {
  const c = W.comps[s.comp], loser = winner === s.a ? s.b : s.a, w = team(W, winner), l = team(W, loser);
  const seen = c.tier === 0 || c.kind === 'intl';
  const runL = l.streak ?? 0;
  w.streak = Math.max(0, w.streak ?? 0) + 1; l.streak = Math.min(0, runL) - 1;
  if (!seen) return;
  const sc = `${s.wins[winner]}-${s.wins[loser]}`, clubs = [winner, loser], big = s.match === 'GF' || s.match === 'F' ? 15 : 0;
  const bump = rival ? 15 : 0;
  const first = s.games.slice(0, 2).map(id => W.games.find(g => g.id === id)?.winner);
  if (s.bestOf >= 5 && first.every(x => x === loser)) story(W, 'result', 55 + big + bump, ...say(REVERSE, w, l, sc), { clubs });
  else if (l.rep - w.rep >= (s.bestOf > 1 ? 15 : 25)) story(W, 'result', 45 + big + bump + Math.min(20, l.rep - w.rep - 15) - (s.bestOf > 1 ? 0 : 10), ...say(UPSET, w, l, sc), { clubs });
  if (runL >= 5) story(W, 'streak', 40 + runL * 2, ...say(SNAP, w, l, runL), { clubs });
  if (w.streak >= 5 && w.streak % 3 === 2) story(W, 'streak', 30 + w.streak * 2, ...say(STREAK, w, w.streak), { clubs: [winner], tone: 1 });
  if (l.streak <= -5 && -l.streak % 3 === 2) story(W, 'streak', 30 - l.streak * 2, ...say(SLUMP, l, -l.streak), { clubs: [loser], tone: -1 });
}

// ---------- Event hooks ----------
export function newsChampion(W, c, champ, loser, sc) {
  const intl = c.kind === 'intl';
  story(W, 'title', intl ? 90 : 75, ...say([
    () => [`${champ.name} win the ${c.name}`, `${champ.name} beat ${loser.name} ${sc} in the final to lift the trophy.`],
    () => [`Champions: ${champ.name}`, `The ${c.name} belongs to ${champ.name} after a ${sc} final against ${loser.name}.`],
    () => [`Title for ${champ.name}`, `${loser.name} pushed them, but ${champ.name} closed out the ${c.name} final ${sc}.`],
  ]), { clubs: [champ.id, loser.id], tone: 1 });
}
export function newsIntlStart(W, c, top) {
  story(W, 'intl', 60, `The ${c.name} begins`, `${c.teams.length} clubs from every region meet in the group stage. ${top.name} start as top seed.`, { clubs: [top.id] });
}
export function newsPatch(W, p) {
  const nerf = p.notes.filter(x => x.dir < 0).sort((a, b) => b.pct - a.pct)[0];
  const head = nerf ? `Patch ${p.id}: ${nerf.text.split(':')[0]} toned down` : `Patch ${p.id} is live`;
  story(W, 'patch', 65, head, `Balance changes:\n${p.notes.map(x => `• ${x.text}`).join('\n')}\n\nBuffed champions are worth more in the draft; check Competitions › Meta.`);
}
export function newsAward(W, c, mvp, rating) {
  story(W, 'award', 60, `${mvp.name} named ${c.name} MVP`, `${mvp.name} of ${team(W, mvp.teamId)?.name ?? 'no club'} averaged a ${rating.toFixed(2)} rating across the split.`, { clubs: [mvp.teamId], players: [mvp.id], tone: 1 });
}
export function newsTransfer(W, p, from, to, fee) {
  const big = fee > 0 && fee >= feeBar(W);
  if (fee > 0) (W.fees ??= []).push(fee), W.fees.length > 40 && W.fees.shift();
  if (!big && !(fee === 0 && overall(p) >= 70)) return;
  const head = big ? say([() => `Big money: ${p.name} joins ${to.name}`, () => `${to.name} pay ${$k(fee)} for ${p.name}`]) : `Free agent ${p.name} joins ${to.name}`;
  story(W, 'transfer', big ? 55 : 45, head, big ? `${to.name} sign ${p.name} from ${from?.name ?? 'free agency'} for ${$k(fee)}, one of the biggest fees this season.` : `${p.name}, one of the best players without a club, signs for ${to.name}.`, { clubs: [to.id, from?.id].filter(Boolean), players: [p.id] });
}
// Top 10% of recent fees (at least 3 recorded).
const feeBar = W => { const f = [...(W.fees ?? [])].sort((a, b) => b - a); return f.length < 3 ? Infinity : f[Math.floor(f.length * 0.1)]; };
export function newsPressure(W, t, conf) {
  story(W, 'club', 50, say([() => `Pressure grows at ${t.name}`, () => `${t.name} board losing patience`]), `Results have not met expectations. Board confidence is reported at ${Math.round(conf)}.`, { clubs: [t.id], tone: -1 });
}
export function newsBrokenPromise(W, p, t) {
  story(W, 'club', 40, `${p.name} unhappy at ${t.name}`, `${p.name} was promised a starting spot and is reported to want a move.`, { clubs: [t.id], players: [p.id], tone: -1 });
}

// ---------- Weekly: computed stories, ranking, inbox ----------
const MILESTONES = { k: [500, 1000, 1500, 2000], gp: [100, 200, 300] };
function careerTotals(p) { let k = 0, gp = 0; for (const a of Object.values(p.stats ?? {})) { k += a.k; gp += a.gp; } return { k, gp }; }

export function newsWeekly(W) {
  const u = userTeam(W);
  // Title race: top-league table with the top two within one win and about two weeks left.
  for (const c of Object.values(W.comps)) {
    if (c.kind !== 'league' || c.tier !== 0 || c.done || c.raceNews || c.left > c.teams.length) continue;
    const [a, b] = Object.entries(c.table).map(([id, r]) => ({ id, ...r })).sort((x, y) => y.w - x.w);
    if (!a || !b || a.w - b.w > 1) continue;
    c.raceNews = true;
    const ta = team(W, a.id), tb = team(W, b.id);
    story(W, 'race', 50, say([() => `One win separates the top two`, () => `${c.name}: ${ta.name} and ${tb.name} neck and neck`]), `${ta.name} (${a.w}-${a.l}) and ${tb.name} (${b.w}-${b.l}) go into the final stretch of the ${c.name} level on almost everything.`, { clubs: [a.id, b.id] });
  }
  // Milestones for top-league players.
  for (const t of W.teams) if (t.tier === 0) for (const id of t.players) {
    const p = W.players[id]; if (!p) continue;
    const tot = careerTotals(p), ms = p.ms ??= { k: 0, gp: 0 };
    for (const key of ['k', 'gp']) {
      const hit = MILESTONES[key].filter(m => tot[key] >= m).at(-1) ?? 0;
      if (hit > ms[key]) {
        if (ms[key] || hit === MILESTONES[key][0] || tot[key] < hit + 50) story(W, 'milestone', 30 + hit / 50, `${p.name} reaches ${hit.toLocaleString('en')} career ${key === 'k' ? 'kills' : 'games'}`, `The ${t.name} ${p.role.toLowerCase()} passed the mark this week.`, { clubs: [t.id], players: [p.id], tone: 1 });
        ms[key] = hit;
      }
    }
  }
  const q = W.newsQ ?? []; W.newsQ = [];
  if (!q.length) return;
  const mine = new Set(u ? W.teams.filter(t => t.region === u.region && t.tier === u.tier).map(t => t.id) : []);
  for (const s of q) {
    if (u && s.clubs.includes(u.id)) s.imp += 50; else if (s.clubs.some(id => mine.has(id))) s.imp += 20;
  }
  q.sort((a, b) => b.imp - a.imp);
  // One story per type a week, so a busy week reads as variety rather than five streaks (your club's stories always stay).
  const seen = new Set();
  const kept = q.filter(s => (u && s.clubs.includes(u.id)) || (!seen.has(s.type) && seen.add(s.type)));
  q.length = 0; q.push(...kept);
  W.news ??= [];
  q.forEach((s, i) => {
    const n = { id: (W.newsId = (W.newsId ?? 0) + 1), year: W.year, day: W.day, ...s };
    W.news.unshift(n);
    if (i < INBOX_PER_WEEK) mail(W, s.headline, s.body, 'news', { news: n.id, clubs: s.clubs, players: s.players });
  });
  // Media pressure: bad press about your club costs a little board confidence.
  const bad = q.filter(s => u && s.tone < 0 && s.clubs[0] === u.id).length;
  if (bad && W.board) W.board.conf = Math.max(0, W.board.conf - 0.5 * bad);
  W.news = W.news.filter(n => n.year >= W.year - 1).slice(0, KEEP);
}
