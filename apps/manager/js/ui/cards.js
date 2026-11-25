// Tactic Card rendering: pixel art drawn on a canvas, frame and text in HTML/CSS. Dev gallery at #/dev/cards.
import { cardView, GLOSSARY } from '../cards.js';
import { esc } from './dom.js';

// ---------- Pixel art: a night scene per card plus a hand-drawn icon ----------
const SKY = {
  teal: ['#0b1626', '#10263a', '#17384c', '#1f4a5a', '#123a44'],
  moss: ['#0d1a14', '#132a1d', '#1c3b26', '#2a4d2c', '#22331b'],
  dusk: ['#1a0f22', '#2a1630', '#3e1f3a', '#5a2a40', '#2a1a26'],
  olive: ['#17150b', '#252210', '#353015', '#4a4119', '#33290f'],
  ember: ['#1c0b0e', '#2e1015', '#46161b', '#6a2420', '#341214'],
  forest: ['#0b1a17', '#10291f', '#173a29', '#21503a', '#18301f'],
};
// Icons: one string per row, '.' is transparent; each other character maps to a colour.
const ICONS = {
  ward: { pal: { a: '#8a96aa', '#': '#c9d3e0', y: '#7fd6ff', Y: '#e6fbff' }, rows: [
    '.....aaaa.....', '....a####a....', '....#yyyy#....', '....#yYYy#....', '....#yYYy#....', '....#yyyy#....', '.....####.....',
    '......##......', '......##......', '......##......', '......##......', '......##......', '....######....'] },
  boot: { pal: { w: '#e8e2c8', f: '#f4efd8', k: '#2a2a2a', b: '#a0683a', B: '#c4844c', d: '#5a3a22' }, rows: [
    '.........wwww...', '........wffffw..', '.......wffkfffw.', '.......wffkfffw.', '.......wffkkkfw.', '........wffffw..', '..bbb....wwww...',
    '..bBb...........', '..bBb...........', '..bBbb..........', '..bBBbbbb.......', '..bbbbbbbbb.....', '..ddddddddd.....'] },
  crosshair: { pal: { r: '#f0e6e6', W: '#ff5c6c' }, rows: [
    '......r......', '....rrrrr....', '...r..r..r...', '..r...r...r..', '.r.........r.', '.r....W....r.', 'rrrr.WWW.rrrr',
    '.r....W....r.', '.r.........r.', '..r...r...r..', '...r..r..r...', '....rrrrr....', '......r......'] },
  bounty: { pal: { g: '#9a6a34', G: '#b9824a', n: '#c9a15a', $: '#f2c14e', h: '#d8d0b0', s: '#f2c14e' }, rows: [
    '...nn.....hhhhh', '..n..n....h...h', '...nn......hsh.', '..gggg......h..', '.gGggGg....hsh.', 'gggg$ggg..h.s.h',
    'ggg$$$gg..hhhhh', 'gGgg$ggg.......', 'ggg$$$gg.......', '.gggggg........', '..gggg.........'] },
  shield: { pal: { s: '#5d6a80', L: '#9fb0c8', o: '#ff8a3d', O: '#ffd166' }, rows: [
    '.ssssssssss.', '.sLLLLLLLLs.', '.sLLLoLLLLs.', '.sLLooLLLLs.', '.sLLoOoLLLs.', '.sLooOOoLLs.', '..sLoOOoLs..',
    '..sLLooLLs..', '...sLLLLs...', '....sLLs....', '.....ss.....'] },
  holder: { pal: { g: '#3f7a4a', G: '#5fa86a', S: '#e0b48c', k: '#1b1b1b', b: '#c9a15a', x: '#e8e8e8' }, rows: [
    '.....gggg......b.', '....gGGGGg.....bb', '....gSSSSg.....b.b', '....gSkSkg.....b..b', '....gSSSSg.....b..b', '.....gSSg......b..b',
    '...gggggggg..xxbxxb', '..ggGggggGgg...b..b', '..gg.gggg.gg...b.b', '..gg.gggg.gg...bb.', '.....gggg......b..', '.....g..g.........', '.....g..g.........'] },
};
const hash = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const artCache = new Map();
export function cardArt(id, sky, icon) {
  const key = `${id}|${sky}|${icon}`;
  if (artCache.has(key)) return artCache.get(key);
  const W = 48, H = 30, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), P = SKY[sky] ?? SKY.teal;
  const px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  [0, 6, 12, 18].forEach((y, i) => px(0, y, W, 6, P[i]));                 // sky bands
  for (let y = 5; y < 24; y += 6) for (let x = (y / 6) % 2; x < W; x += 2) px(x, y, 1, 1, P[Math.min(3, Math.floor(y / 6) + 1)]); // dither between bands
  let h = hash(id);
  for (let i = 0; i < 14; i++) { h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; px(h % W, (h >>> 8) % 16, 1, 1, i % 4 ? '#ffffff66' : '#ffffffcc'); } // stars
  px(0, 24, W, 6, P[4]); for (let x = 1; x < W; x += 5) px(x, 26 + (x % 3), 2, 1, '#ffffff1f');      // ground
  const ic = ICONS[icon];
  if (ic) {
    const w = Math.max(...ic.rows.map(r => r.length)), top = 27 - ic.rows.length, left = Math.floor((W - w) / 2);
    ic.rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ic.pal[ch]) px(left + x, top + y, 1, 1, ic.pal[ch]); }));
  }
  const url = c.toDataURL();
  artCache.set(key, url);
  return url;
}

// ---------- Card HTML ----------
const TAG_ICON = {
  team: '<svg width="12" height="10" viewBox="0 0 12 10" fill="currentColor" aria-hidden="true"><circle cx="4" cy="3" r="2"/><circle cx="9" cy="3.5" r="1.6"/><path d="M0 10c0-2.5 1.8-4 4-4s4 1.5 4 4zM7.5 10c0-1.6.6-2.8 1.5-3.4 1.6.2 3 1.4 3 3.4z"/></svg>',
  enemy: '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><circle cx="5" cy="5" r="3.6"/><path d="M5 0v3M5 7v3M0 5h3M7 5h3"/></svg>',
  holder: '<svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><circle cx="5" cy="3" r="2.2"/><path d="M1 10c0-2.6 1.8-4.2 4-4.2s4 1.6 4 4.2z"/></svg>',
};
const TAG_LABEL = { team: 'Team', enemy: 'Enemy', holder: 'Holder' };
const rules = s => esc(s).replace(/\[\[(.+?)\]\]/g, (_, k) => `<u class="kw" title="${esc(GLOSSARY[k] ?? '')}">${k}</u>`);
const pips = (n, of = 3, on = '■', off = '□') => on.repeat(n) + off.repeat(of - n);

// size: 'full' | 'hand'. opts.foil forces the sheen (gallery); otherwise Epic and Signature show it on hover or focus.
export function cardHTML(held, size = 'full', opts = {}) {
  const v = cardView(held);
  const art = `<div class="tc-art"><img class="px" src="${cardArt(v.id, v.sky, v.art)}" alt=""><span class="tc-cost" title="Focus cost">${v.cost}</span><span class="tc-pips" aria-hidden="true">${pips(v.R.pips)}</span></div>`;
  const lv = `<span class="tc-lv">Lv ${v.lv} <span aria-hidden="true">${pips(v.lv, 3, '●', '○')}</span></span>`;
  const tags = v.targets.map(t => `<span class="tc-tag">${TAG_ICON[t]}${size === 'full' ? TAG_LABEL[t] : `<span class="sr">${TAG_LABEL[t]}</span>`}</span>`).join('');
  const label = `${v.name}, ${v.R.label}, ${v.cost} Focus. When ${v.when.replace(/\[\[|\]\]/g, '')}. Then ${v.then.replace(/\[\[|\]\]/g, '')}.`;
  return `<article class="tc tc-${v.rarity} tc-${size} ${opts.foil ? 'foil-on' : ''}" tabindex="0" aria-label="${esc(label)}">${art}
    <div class="tc-body"><h4 class="tc-name">${esc(v.name)}</h4><span class="tc-rar">${v.R.label}</span>
      ${size === 'full' ? `<p class="tc-rule"><b>When</b> ${rules(v.when)}</p><p class="tc-rule"><b>Then</b> ${rules(v.then)}</p>` : ''}</div>
    <footer class="tc-foot"><span class="tc-tags">${tags}</span>${lv}</footer></article>`;
}

// ---------- Dev gallery ----------
const SAMPLE = [
  { id: 'ward-river', rarity: 'common' }, { id: 'clear-speed', rarity: 'common' }, { id: 'called-shot', rarity: 'rare' },
  { id: 'bounty-hunter', rarity: 'epic' }, { id: 'never-say-die', rarity: 'epic' }, { id: 'huntress-specialist' },
];
export function devCards(el) {
  el.innerHTML = `<main class="pad tc-gallery">
    <header class="row between"><h1 class="disp xl">Tactic Cards</h1><span class="dim small">Dev gallery · design from CARD_PLAN.md · <a href="#/menu">Back</a></span></header>
    <h2 class="caps mt">Full card</h2><div class="tc-row">${SAMPLE.map(c => cardHTML(c)).join('')}</div>
    <h2 class="caps mt">Hand / loadout · 120 px</h2><div class="tc-row">${SAMPLE.map(c => cardHTML(c, 'hand')).join('')}</div>
    <h2 class="caps mt">Hover / focus · foil sheen (Epic and Signature only)</h2><div class="tc-row">${SAMPLE.slice(3).map(c => cardHTML(c, 'full', { foil: true })).join('')}</div>
  </main>`;
}
