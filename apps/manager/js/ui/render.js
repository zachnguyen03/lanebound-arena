// Canvas renderer for the arena (design handoff §6): lanes, terrain, pits, structures, minions, champion dots.
import { W as MW, H as MH, TERRAIN, LANE_PATH, FOUNTAIN, TITAN_PIT, SHRINE_PIT, PLAZA, makeStructures } from '../map.js';
import { fmt } from '../sim.js';

const C = { ground: '#0F141D', lane: '#1F2839', terrain: '#161D2A', edge: '#2A3448', pit: '#F2C14E', text: '#EEF2F8', dim: '#A1ACBF', blue: '#4DA3FF', red: '#FF5C6C', good: '#3DDC97', dead: '#5a6478' };
export const SIDE = [C.blue, C.red];
export const mapHeight = w => Math.round(w * MH / MW);
const bgCache = new Map();

function hexPath(g, x, y, r) { g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i; g[i ? 'lineTo' : 'moveTo'](x + r * Math.cos(a), y + r * Math.sin(a)); } g.closePath(); }

function background(w) {
  if (bgCache.has(w)) return bgCache.get(w);
  const c = document.createElement('canvas');
  c.width = w; c.height = mapHeight(w);
  const g = c.getContext('2d'), S = w / MW;
  g.fillStyle = C.ground; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = C.lane; g.lineWidth = 3.2 * S; g.lineJoin = 'round'; g.lineCap = 'round';
  for (const path of Object.values(LANE_PATH)) { g.beginPath(); path.forEach((p, i) => g[i ? 'lineTo' : 'moveTo'](p.x * S, p.y * S)); g.stroke(); }
  // Plaza ring
  g.lineWidth = 1.6 * S; g.beginPath(); g.arc(PLAZA.x * S, PLAZA.y * S, PLAZA.r * S, 0, 7); g.stroke();
  // Terrain clusters
  for (const h of TERRAIN) { hexPath(g, h.x * S, h.y * S, h.r * S); g.fillStyle = C.terrain; g.fill(); g.strokeStyle = C.edge; g.lineWidth = 1; g.stroke(); }
  // Pits
  for (const p of [TITAN_PIT, SHRINE_PIT]) { g.strokeStyle = C.pit; g.globalAlpha = 0.35; g.lineWidth = 1.5; g.beginPath(); g.arc(p.x * S, p.y * S, 3 * S, 0, 7); g.stroke(); g.globalAlpha = 1; }
  bgCache.set(w, c);
  return c;
}

// Shared by the live view and the match-report / frame view.
function drawStructures(g, S, list, colors) {
  for (const u of list) {
    const x = u.x * S, y = u.y * S, col = colors[u.side];
    if (u.kind === 'core') {
      hexPath(g, x, y, 3.6 * S); g.fillStyle = u.alive ? col + '33' : '#00000000'; g.fill();
      g.strokeStyle = u.alive ? col : C.dead; g.lineWidth = 2; g.stroke();
      continue;
    }
    const r = 0.95 * S;
    if (u.alive) { g.fillStyle = col; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
    else { // destroyed tower: ⊠
      g.strokeStyle = C.dim; g.lineWidth = 1.2; g.strokeRect(x - r, y - r, 2 * r, 2 * r);
      g.beginPath(); g.moveTo(x - r, y - r); g.lineTo(x + r, y + r); g.moveTo(x + r, y - r); g.lineTo(x - r, y + r); g.stroke();
    }
    if (u.alive && u.hp != null && u.hp < u.maxHp) { g.fillStyle = '#000a'; g.fillRect(x - r, y - r - 5, 2 * r, 3); g.fillStyle = col; g.fillRect(x - r, y - r - 5, 2 * r * u.hp / u.maxHp, 3); }
  }
}

function dot(g, x, y, r, col, letter, hp, opts = {}) {
  if (opts.dead) {
    g.setLineDash([3, 3]); g.strokeStyle = C.dead; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); g.setLineDash([]);
    g.fillStyle = C.dead; g.font = `600 ${Math.round(r * 0.95)}px Geist, system-ui`; g.fillText(letter, x, y + 1);
    return;
  }
  g.fillStyle = '#0B0E14'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.strokeStyle = col; g.lineWidth = opts.hl ? 3 : 2; g.stroke();
  if (hp != null) { g.strokeStyle = hp > 0.3 ? C.good : C.red; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, hp)); g.stroke(); }
  if (opts.hl) { g.strokeStyle = '#F2C14E'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, r + 6, 0, 7); g.stroke(); }
  g.fillStyle = C.text; g.font = `600 ${Math.round(r * 0.95)}px Geist, system-ui`; g.fillText(letter, x, y + 1);
}

const trails = new WeakMap(); // match state -> Map(unit id -> [{x,y,t}])
const initial = n => (n || '?')[0].toUpperCase();

// Live match. opts: { highlight: pid, markers: true }
export function drawMatch(ctx, s, colors = SIDE, opts = {}) {
  const w = ctx.canvas.width, S = w / MW;
  ctx.drawImage(background(w), 0, 0);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // Pits: gold diamond while up, timer while down.
  for (const n of [s.titan, s.shrineU]) {
    const x = n.home.x * S, y = n.home.y * S;
    ctx.strokeStyle = C.pit; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 2.4 * S, 0, 7); ctx.stroke();
    if (n.alive) { const r = 0.9 * S; ctx.fillStyle = C.pit; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.fill(); }
    ctx.fillStyle = C.dim; ctx.font = '12px Geist, system-ui';
    const label = `${n.kind === 'titan' ? 'Titan' : 'Shrine'} · ${n.alive ? 'up' : fmt(Math.max(0, n.spawnAt - s.t))}`;
    ctx.fillText(label, x, y + (n.kind === 'titan' ? -3.6 : 3.8) * S);
    if (n.alive && n.hp < n.maxHp) { ctx.fillStyle = '#000a'; ctx.fillRect(x - 2.4 * S, y + 2.8 * S, 4.8 * S, 3); ctx.fillStyle = C.pit; ctx.fillRect(x - 2.4 * S, y + 2.8 * S, 4.8 * S * n.hp / n.maxHp, 3); }
  }
  drawStructures(ctx, S, s.structures, colors);
  for (const u of s.units) {
    if (!u.alive) continue;
    if (u.kind === 'minion') { ctx.fillStyle = colors[u.side]; ctx.globalAlpha = 0.75; ctx.fillRect(u.x * S - 0.35 * S, u.y * S - 0.35 * S, 0.7 * S, 0.7 * S); ctx.globalAlpha = 1; }
    else if (u.kind === 'camp') { ctx.fillStyle = '#6b7488'; ctx.beginPath(); ctx.arc(u.x * S, u.y * S, 0.8 * S, 0, 7); ctx.fill(); }
  }
  for (const f of s.fx) {
    ctx.strokeStyle = f.color; ctx.globalAlpha = Math.min(1, f.ttl * 4) * 0.8; ctx.lineWidth = f.w || 1.2;
    ctx.beginPath();
    if (f.type === 'shot') { ctx.moveTo(f.x1 * S, f.y1 * S); ctx.lineTo(f.x2 * S, f.y2 * S); } else ctx.arc(f.x * S, f.y * S, f.r * S, 0, 7);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Kill markers: white ✕ fading over 8 s.
  if (opts.markers !== false) for (const e of s.events) {
    if (e.type !== 'kill' || s.t - e.t > 8) continue;
    const x = e.x * S, y = e.y * S, k = 4;
    ctx.globalAlpha = 1 - (s.t - e.t) / 8; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - k, y - k); ctx.lineTo(x + k, y + k); ctx.moveTo(x + k, y - k); ctx.lineTo(x - k, y + k); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Trails (last ~2 s of game time) then dots.
  let tr = trails.get(s); if (!tr) trails.set(s, (tr = new Map()));
  const r = Math.max(9, 1.55 * S);
  for (const u of s.champs) {
    const list = tr.get(u.id) ?? []; tr.set(u.id, list);
    if (u.alive && (!list.length || list.at(-1).t !== s.t)) list.push({ x: u.x, y: u.y, t: s.t });
    while (list.length && s.t - list[0].t > 2) list.shift();
    if (!u.alive) { list.length = 0; continue; }
    if (list.length > 1) { ctx.strokeStyle = colors[u.side]; ctx.globalAlpha = 0.35; ctx.lineWidth = 2; ctx.beginPath(); list.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p.x * S, p.y * S)); ctx.stroke(); ctx.globalAlpha = 1; }
  }
  for (const u of s.champs) {
    if (!u.alive) {
      const f = FOUNTAIN[u.side], i = s.champs.filter(c => c.side === u.side).indexOf(u);
      dot(ctx, (f.x + (u.side ? -2.2 : 2.2)) * S, (f.y - 8 + i * 4) * S, r * 0.75, colors[u.side], initial(u.name), null, { dead: true });
      continue;
    }
    ctx.globalAlpha = u.untargetableUntil > s.t ? 0.45 : 1;
    dot(ctx, u.x * S, u.y * S, r, colors[u.side], initial(u.name), u.hp / u.maxHp, { hl: opts.highlight === u.pid });
    ctx.globalAlpha = 1;
  }
}

// A recorded frame (match report minute view / replays). meta = { names:[10], colors }
const STRUCTS = makeStructures();
export function drawFrame(ctx, frame, meta, events = []) {
  const w = ctx.canvas.width, S = w / MW, colors = meta.colors ?? SIDE;
  ctx.drawImage(background(w), 0, 0);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const p of [TITAN_PIT, SHRINE_PIT]) { ctx.strokeStyle = C.pit; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x * S, p.y * S, 2.4 * S, 0, 7); ctx.stroke(); }
  drawStructures(ctx, S, STRUCTS.map((st, i) => ({ ...st, hp: null, alive: frame.st ? frame.st[i] === 1 : true })), colors);
  for (const e of events) {
    if (e.type !== 'kill' || e.t > frame.t || frame.t - e.t > 20) continue;
    const x = e.x * S, y = e.y * S, k = 4;
    ctx.globalAlpha = 1 - (frame.t - e.t) / 20; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - k, y - k); ctx.lineTo(x + k, y + k); ctx.moveTo(x + k, y - k); ctx.lineTo(x - k, y + k); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const r = Math.max(8, 1.4 * S);
  frame.p.forEach(([x, y, alive], i) => {
    const side = i < 5 ? 0 : 1;
    if (alive) dot(ctx, x * S, y * S, r, colors[side], initial(meta.names[i]), null, { hl: meta.highlight === i });
    else { const f = FOUNTAIN[side]; dot(ctx, (f.x + (side ? -2.2 : 2.2)) * S, (f.y - 8 + (i % 5) * 4) * S, r * 0.75, colors[side], initial(meta.names[i]), null, { dead: true }); }
  });
}
