// Arena geometry + navigation (design handoff §6). 108 x 62 units, Blue (side 0) left, Red (side 1) right.
// Three lanes: octagonal top and bottom lanes and a straight mid lane through a central plaza ring.
// Titan pit top-centre, Shrine pit bottom-centre, four big and four small terrain clusters.
// Everything is authored for Blue and mirrored left-right for Red (x -> W - x); the top half mirrors to the bottom (y -> H - y).
export const W = 108, H = 62;
export const SIZE = W; // legacy alias
const mx = ([x, y]) => [W - x, y];
const my = ([x, y]) => [x, H - y];

export const FOUNTAIN = [{ x: 2.5, y: 31 }, { x: W - 2.5, y: 31 }];
export const LANES = ['top', 'mid', 'bot'];
export const PLAZA = { x: W / 2, y: H / 2, r: 6 };

// ---- Terrain: flat-top hexagons {x, y, r} ----
const BLUE_TERRAIN = [{ x: 31, y: 19, r: 7 }, { x: 45, y: 12.5, r: 2.6 }, { x: 25, y: 26.5, r: 1.6 }];
const blueTerrain = [...BLUE_TERRAIN, ...BLUE_TERRAIN.map(h => ({ ...h, y: H - h.y }))];
export const TERRAIN = [...blueTerrain, ...blueTerrain.map(h => ({ ...h, x: W - h.x }))];
const inHex = (h, x, y) => { const dx = Math.abs(x - h.x), dy = Math.abs(y - h.y), s3 = Math.sqrt(3); return dy <= h.r * s3 / 2 && s3 * dx + dy <= s3 * h.r; };

// ---- Lane paths, Blue -> Red ----
const TOP = [[12, 28], [19, 7], [W - 19, 7], [W - 12, 28]];
export const LANE_PATH = {
  top: TOP.map(([x, y]) => ({ x, y })),
  mid: [[13, 31], [W - 13, 31]].map(([x, y]) => ({ x, y })),
  bot: TOP.map(my).map(([x, y]) => ({ x, y })),
};

// ---- Structures: 2 towers per lane + 1 base tower + Core per side ----
// tier 1 = outer, 2 = inner, 3 = base tower, 4 = Core.
const BLUE_STRUCTS = [
  { kind: 'tower', lane: 'top', tier: 1, p: [39, 7] }, { kind: 'tower', lane: 'top', tier: 2, p: [24, 7] },
  { kind: 'tower', lane: 'mid', tier: 1, p: [36, 31] }, { kind: 'tower', lane: 'mid', tier: 2, p: [25, 31] },
  { kind: 'tower', lane: 'bot', tier: 1, p: [39, 55] }, { kind: 'tower', lane: 'bot', tier: 2, p: [24, 55] },
  { kind: 'tower', lane: null, tier: 3, p: [17, 31] },
  { kind: 'core', lane: null, tier: 4, p: [11, 31] },
];
const HP = { 1: 1500, 2: 2000, 3: 2200, 4: 2500 };
export function makeStructures() {
  const out = [];
  for (const side of [0, 1]) for (const st of BLUE_STRUCTS) {
    const [x, y] = side ? mx(st.p) : st.p;
    out.push({ kind: st.kind, side, lane: st.lane, tier: st.tier, x, y, hp: HP[st.tier], maxHp: HP[st.tier] });
  }
  return out;
}

// ---- Neutral camps and objective pits ----
const BLUE_CAMPS = [[21, 17], [40, 24]];
const blueCamps = [...BLUE_CAMPS, ...BLUE_CAMPS.map(my)];
export const CAMPS = [...blueCamps.map(p => ({ side: 0, p })), ...blueCamps.map(p => ({ side: 1, p: mx(p) }))]
  .map(({ side, p: [x, y] }) => ({ side, x, y }));
export const TITAN_PIT = { x: W / 2, y: 18 };
export const SHRINE_PIT = { x: W / 2, y: H - 18 };

// ---- Navigation ----
const blocked = new Uint8Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (TERRAIN.some(h => inHex(h, x + 0.5, y + 0.5))) blocked[y * W + x] = 1;

export const isBlocked = (x, y) => x < 0 || y < 0 || x >= W || y >= H || blocked[(y | 0) * W + (x | 0)] === 1;

export function los(x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 0.5);
  for (let i = 1; i < n; i++) if (isBlocked(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n)) return false;
  return true;
}

// Waypoint graph: nodes every 4 units on open ground (1 unit clearance), edges between visible neighbours.
// All-pairs next-hop table (Floyd-Warshall) makes each path query a lookup.
const STEP = 4;
const nx = [], ny = [];
const clear = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (isBlocked(x + dx, y + dy)) return false; return true; };
for (let y = 1; y < H; y += STEP) for (let x = 2; x < W; x += STEP) if (clear(x, y)) { nx.push(x); ny.push(y); }
const N = nx.length;
const dist = new Float32Array(N * N).fill(Infinity);
const next = new Int16Array(N * N).fill(-1);
for (let i = 0; i < N; i++) {
  dist[i * N + i] = 0; next[i * N + i] = i;
  for (let j = 0; j < N; j++) {
    if (i === j) continue;
    const d = Math.hypot(nx[i] - nx[j], ny[i] - ny[j]);
    if (d <= STEP * 1.5 && los(nx[i], ny[i], nx[j], ny[j])) { dist[i * N + j] = d; next[i * N + j] = j; }
  }
}
for (let k = 0; k < N; k++) for (let i = 0; i < N; i++) {
  const ik = dist[i * N + k];
  if (ik === Infinity) continue;
  for (let j = 0; j < N; j++) {
    const v = ik + dist[k * N + j];
    if (v < dist[i * N + j]) { dist[i * N + j] = v; next[i * N + j] = next[i * N + k]; }
  }
}
// Nearest visible node for every 1-unit cell.
const cellNode = new Int16Array(W * H).fill(-1);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (blocked[y * W + x]) continue;
  let best = -1, bd = Infinity;
  for (let i = 0; i < N; i++) {
    const d = Math.hypot(nx[i] - x - 0.5, ny[i] - y - 0.5);
    if (d < bd && d < 10 && los(x + 0.5, y + 0.5, nx[i], ny[i])) { bd = d; best = i; }
  }
  cellNode[y * W + x] = best;
}
const nodeAt = (x, y) => cellNode[Math.min(H - 1, Math.max(0, y | 0)) * W + Math.min(W - 1, Math.max(0, x | 0))];

// Next point to walk toward on the way from (fx,fy) to (tx,ty).
export function steer(fx, fy, tx, ty) {
  if (los(fx, fy, tx, ty)) return { x: tx, y: ty };
  const a = nodeAt(fx, fy), b = nodeAt(tx, ty);
  if (a < 0 || b < 0) return { x: tx, y: ty };
  if (a === b) return { x: nx[a], y: ny[a] };
  let best = a, n = a;
  for (let k = 0; k < 6 && n !== b; k++) { // skip ahead to the furthest visible node on the route
    n = next[n * N + b];
    if (n < 0 || !los(fx, fy, nx[n], ny[n])) break;
    best = n;
  }
  return { x: nx[best], y: ny[best] };
}

export const NAV_NODES = N;
