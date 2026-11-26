// Saves (IndexedDB: 3 slots + autosave, each with a .bak copy; export/import as .json) and global settings.
import { SAVE_VERSION } from '../career.js';

export const SLOTS = ['slot1', 'slot2', 'slot3', 'auto'];
export const SLOT_LABEL = { slot1: 'Slot 1', slot2: 'Slot 2', slot3: 'Slot 3', auto: 'Autosave' };
const LEGACY_KEY = 'lanebreak-career'; // v0.3 single save

// ---------- Settings ----------
const SETTINGS_KEY = 'lanebreak-settings';
export const DEFAULT_SETTINGS = { speed: 2, simDetail: 'top', confirmContinue: false, pauseOffers: true, pauseScouting: false, autosave: 'weekly' };
export function loadSettings() { try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) }; } catch { return { ...DEFAULT_SETTINGS }; } }
export function saveSettings(s) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* settings stay in memory */ } }

// ---------- IndexedDB ----------
let dbp = null;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') return rej(new Error('IndexedDB unavailable'));
    const r = indexedDB.open('lanebreak', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('saves');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('saves', mode), st = t.objectStore('saves'), out = fn(st); t.oncomplete = () => res(out.result); t.onerror = () => rej(t.error); }); };

// gzip when the browser supports it (saves are ~5 MB of JSON, ~1 MB compressed).
async function pack(W) {
  const json = JSON.stringify(W);
  if (typeof CompressionStream === 'undefined') return json;
  return new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
}
async function unpack(data) {
  if (typeof data === 'string') return JSON.parse(data);
  return JSON.parse(await new Response(data.stream().pipeThrough(new DecompressionStream('gzip'))).text());
}
const metaOf = (W, club) => ({ v: W.v, club: club?.name ?? '—', color: club?.color, year: W.year, day: W.day, savedAt: Date.now() });

export async function writeSave(slot, W, club) {
  const rec = { meta: metaOf(W, club), data: await pack(W) };
  try {
    const old = await tx('readonly', st => st.get(slot));
    await tx('readwrite', st => { if (old) st.put(old, `${slot}.bak`); return st.put(rec, slot); });
  } catch (e) { throw new Error(`Could not write the save (${e.message}). Storage may be full or blocked.`); }
}
export async function listSaves() {
  const out = {};
  for (const slot of SLOTS) {
    try { const r = await tx('readonly', st => st.get(slot)); if (r) out[slot] = r.meta; } catch { /* none */ }
  }
  return out;
}
// Returns { W } or { error } ; tries the .bak copy if the main record is unreadable.
export async function readSave(slot) {
  for (const key of [slot, `${slot}.bak`]) {
    try {
      let r = null;
      try { r = await tx('readonly', st => st.get(key)); } catch { /* idb unavailable */ }
      if (!r) continue;
      const W = migrate(await unpack(r.data));
      if (W) return { W, fromBackup: key !== slot };
      return { error: 'This save is from an older version of Lanebreak and cannot be loaded. Start a new career.' };
    } catch { /* try backup */ }
  }
  return { error: 'Save not found or unreadable.' };
}
export async function deleteSave(slot) {
  try { await tx('readwrite', st => { st.delete(`${slot}.bak`); return st.delete(slot); }); } catch { /* ignore */ }
}
// Schema migrations: add `[from]: W => W'` steps as the save format changes. v4 and older (pre-Lanebound engine) can't be converted.
const MIGRATIONS = {};
// Import a downloaded .json save; returns { W } or { error }.
export function importSave(text) {
  try { const W = migrate(JSON.parse(text)); return W ? { W } : { error: 'That save is too old to load.' }; } catch { return { error: 'Not a Lanebreak save file.' }; }
}
export function migrate(W) {
  if (!W || typeof W.v !== 'number' || W.v < 5) return null;
  while (W.v < SAVE_VERSION) { const m = MIGRATIONS[W.v]; if (!m) return null; W = m(W); }
  return W;
}
export const hasLegacySave = () => { try { return !!localStorage.getItem(LEGACY_KEY); } catch { return false; } };
export const clearLegacySave = () => { try { localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ } };
