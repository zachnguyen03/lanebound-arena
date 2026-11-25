// Small DOM helpers shared by every screen: escaping, formatting, crests, pixel sprites, tables, modals, toasts.
import { ROLES } from '../data.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
export const on = (root, sel, ev, fn) => $$(sel, root).forEach(el => el.addEventListener(ev, e => fn(el, e)));
export const money = n => { const a = Math.abs(n), s = n < 0 ? '−' : ''; return a >= 1e6 ? `${s}$${(a / 1e6).toFixed(2)}M` : a >= 1000 ? `${s}$${Math.round(a / 1000)}k` : `${s}$${Math.round(a)}`; };
export const pct = (v, d = 0) => `${(v * 100).toFixed(d)}%`;
export const num = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '–');
export const kfmt = v => `${(v / 1000).toFixed(1)}k`;
export const ROLE_SHORT = { Top: 'TOP', Jungle: 'JGL', Mid: 'MID', Carry: 'ADC', Support: 'SUP' };
export { ROLES };

// ---------- Crest: shield in the club colour with its tag ----------
export function crest(t, size = 24) {
  if (!t) return `<span class="crest" style="width:${size}px;height:${size}px;display:inline-block"></span>`;
  const fs = size >= 40 ? 13 : size >= 28 ? 9 : 6;
  return `<svg class="crest" width="${size}" height="${size * 1.1}" viewBox="0 0 40 44" aria-hidden="true"><path d="M20 1 38 7v15c0 11-8 18-18 21C10 40 2 33 2 22V7Z" fill="${t.color}"/><path d="M20 1 38 7v15c0 11-8 18-18 21Z" fill="#000" opacity=".18"/>${size >= 20 ? `<text x="20" y="27" text-anchor="middle" font-family="Saira Semi Condensed,sans-serif" font-weight="800" font-size="${fs * 40 / size * (size >= 40 ? 1 : 1.4)}" fill="#fff">${esc(t.tag)}</text>` : ''}</svg>`;
}

// ---------- Pixel portrait sprites (generated, cached) ----------
const SKIN = ['#f1c9a5', '#e0ac7e', '#c68a5a', '#8d5a3b', '#5f3b26', '#f7dcc4'];
const HAIR = ['#1b1b1f', '#4a2e1b', '#8a5a2b', '#d8b45a', '#c0c4cc', '#7b2f2f', '#2f4f7b', '#e7e7ea'];
const spriteCache = new Map();
const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
export function spriteURL(id, color = '#4DA3FF') {
  const key = `${id}|${color}`;
  if (spriteCache.has(key)) return spriteCache.get(key);
  const c = document.createElement('canvas'); c.width = 12; c.height = 12;
  const g = c.getContext('2d'), h = hash(id);
  const skin = SKIN[h % SKIN.length], hair = HAIR[(h >>> 3) % HAIR.length], style = (h >>> 6) % 4;
  const px = (x, y, w, hh, col) => { g.fillStyle = col; g.fillRect(x, y, w, hh); };
  px(2, 9, 8, 3, color); px(5, 9, 2, 3, '#ffffff33');                    // shoulders + collar
  px(3, 3, 6, 6, skin); px(5, 8, 2, 1, skin);                           // head + neck
  px(4, 5, 1, 1, '#111'); px(7, 5, 1, 1, '#111'); px(5, 7, 2, 1, '#00000055'); // eyes, mouth
  if (style === 0) px(3, 2, 6, 2, hair);
  else if (style === 1) { px(2, 2, 8, 2, hair); px(2, 4, 1, 3, hair); px(9, 4, 1, 3, hair); }
  else if (style === 2) { px(3, 1, 6, 2, hair); px(3, 3, 1, 1, hair); }
  else { px(2, 2, 8, 1, color); px(3, 1, 6, 1, color); px(3, 3, 6, 1, hair); }  // cap
  if ((h >>> 9) % 5 === 0) px(3, 5, 6, 1, '#22283a');                   // visor / glasses
  const url = c.toDataURL();
  spriteCache.set(key, url);
  return url;
}
export const sprite = (id, color, size = 40) => `<span class="sprite" style="width:${size}px;height:${size}px"><img class="px" src="${spriteURL(id, color)}" alt=""></span>`;

// ---------- Small visual parts ----------
export const bar = (v, color = 'var(--c-good)', w = '100%') => `<span class="bar" style="max-width:${w}"><i style="width:${Math.max(0, Math.min(100, v))}%;background:${color}"></i></span>`;
export const condColor = c => (c >= 75 ? 'var(--c-good)' : c >= 55 ? 'var(--c-warn)' : 'var(--c-bad)');
export const ratingColor = r => (r >= 7 ? 'var(--c-good)' : r >= 6 ? 'var(--c-text)' : 'var(--c-bad)');
export function spark(vals, w = 48, h = 16) {
  if (!vals?.length) return `<span class="dim">–</span>`;
  const min = 3, max = 10, xs = i => (vals.length === 1 ? w / 2 : (i * w) / (vals.length - 1)), ys = v => h - ((v - min) / (max - min)) * h;
  const last = vals.at(-1), col = ratingColor(last);
  return `<svg width="${w + 4}" height="${h + 4}" viewBox="-2 -2 ${w + 4} ${h + 4}" aria-label="Form ${vals.join(', ')}"><polyline fill="none" stroke="${col}" stroke-width="1.5" points="${vals.map((v, i) => `${xs(i)},${ys(v)}`).join(' ')}"/><circle cx="${xs(vals.length - 1)}" cy="${ys(last)}" r="2" fill="${col}"/></svg>`;
}
export const wl = list => list.map(w => `<span class="f ${w ? 'w' : 'l'}">${w ? 'W' : 'L'}</span>`).join(' ');
export const seg = (name, opts, cur) => `<span class="seg" role="group">${opts.map(([v, l]) => `<span role="button" tabindex="0" data-${name}="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${l}</span>`).join('')}</span>`;
export const select = (name, opts, cur, attrs = '') => `<select data-${name} ${attrs}>${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(cur) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
export const empty = (title, body = '', action = '') => `<div class="empty"><b>${esc(title)}</b>${body ? `<span class="dim">${body}</span>` : ''}${action}</div>`;
export const card = (title, meta, body, cls = '') => `<section class="card ${cls}"><div class="ch"><h3>${title}</h3>${meta ? `<span class="meta">${meta}</span>` : ''}</div>${body}</section>`;

// ---------- Sortable table ----------
// cols: [{ key, label, n (numeric), fmt(row), w }]. Sort state lives in `sortState[id]`.
const sortState = {};
export function table(id, cols, rows, { me = () => false, link, defaultSort, limit = 400 } = {}) {
  const st = sortState[id] ??= defaultSort ?? { key: null, dir: -1 };
  const sorted = st.key ? [...rows].sort((a, b) => { const x = a[st.key], y = b[st.key]; return (typeof x === 'string' ? x.localeCompare(y) : (x ?? -1e9) - (y ?? -1e9)) * st.dir; }) : rows;
  return `<table data-table="${id}"><thead><tr>${cols.map(c => `<th class="${c.n ? 'n' : ''} ${st.key === c.key ? 'sort' : ''}" data-sort="${c.key}" ${c.title ? `title="${esc(c.title)}"` : ''} style="cursor:pointer">${c.label}</th>`).join('')}</tr></thead>
    <tbody>${sorted.slice(0, limit).map(r => `<tr class="${me(r) ? 'me' : ''} ${link ? 'link' : ''}" ${link ? `data-href="${link(r)}"` : ''}>${cols.map(c => `<td class="${c.n ? 'n' : ''}">${c.fmt ? c.fmt(r) : esc(r[c.key])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
// Wire sorting + row links for every table in root; rerender() redraws the screen.
export function wireTables(root, rerender) {
  on(root, 'th[data-sort]', 'click', th => {
    const id = th.closest('table').dataset.table, st = sortState[id] ??= { key: null, dir: -1 }, k = th.dataset.sort;
    if (st.key === k) st.dir *= -1; else { st.key = k; st.dir = -1; }
    rerender();
  });
  on(root, 'tr[data-href]', 'click', tr => { location.hash = tr.dataset.href; });
}

// ---------- Toast + modal ----------
export function toast(msg, bad = false) {
  const el = document.createElement('div');
  el.className = `toast${bad ? ' bad' : ''}`; el.setAttribute('role', 'status'); el.textContent = msg;
  document.body.append(el);
  setTimeout(() => el.remove(), 3800);
}
export function modal(html, mount, { wide = false, onClose } = {}) {
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  const close = () => { scrim.remove(); document.removeEventListener('keydown', key); onClose?.(); };
  const key = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', key);
  scrim.addEventListener('click', e => { if (e.target === scrim) close(); });
  document.body.append(scrim);
  on(scrim, '[data-close]', 'click', close);
  mount?.(scrim.firstElementChild, close);
  return close;
}
export function download(name, text, type = 'text/csv') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
