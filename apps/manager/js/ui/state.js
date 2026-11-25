// Shared UI state: the world, settings, the worker pool, saving and navigation.
import { userTeam, CFG } from '../career.js';
import { runPayload } from '../fastsim.js';
import { loadSettings, saveSettings, writeSave } from './store.js';
import { modal, download, toast } from './dom.js';

export const state = { W: null, slot: 'slot1', settings: loadSettings(), busy: false, stop: false, rerender: () => {} };
export const applySettings = () => { CFG.simDetail = state.settings.simDetail; CFG.fearless = state.settings.fearless; saveSettings(state.settings); };
applySettings();

export const go = hash => { if (location.hash === hash) state.rerender(); else location.hash = hash; };

// ---------- Worker pool ----------
const workers = [];
let seq = 0;
const waiting = new Map();
function pool() {
  if (workers.length || typeof Worker === 'undefined') return workers;
  const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
  for (let i = 0; i < n; i++) {
    try {
      const w = new Worker(new URL('../worker.js', import.meta.url), { type: 'module' });
      w.onmessage = ({ data }) => { waiting.get(data.id)?.(data.summary); waiting.delete(data.id); };
      workers.push(w);
    } catch { break; }
  }
  return workers;
}
// Fast-engine jobs are cheap: run them inline. Full-engine jobs go to the workers.
export function run(payloads) {
  const ws = pool();
  return Promise.all(payloads.map((p, i) => {
    if (p.fast || !ws.length) return Promise.resolve(runPayload(p));
    return new Promise(res => { const id = ++seq; waiting.set(id, res); ws[i % ws.length].postMessage({ id, payload: p }); });
  }));
}

// ---------- Saving ----------
export async function save(slot = state.slot, { quiet = true } = {}) {
  if (!state.W) return;
  try {
    await writeSave(slot, state.W, userTeam(state.W));
    if (!quiet) toast('Game saved.');
  } catch (e) {
    saveError(e, slot);
  }
}
export const autosave = () => save('auto');
function saveError(e, slot) {
  modal(`<div class="ch"><h3>Couldn't save</h3></div>
    <div class="mbody"><p>${e.message}</p><p class="dim">Your career is still running in this tab. Try again, download a copy of the save, or keep playing and save later.</p></div>
    <div class="mfoot"><button class="btn btn-ghost" data-close>Keep playing</button><button class="btn btn-secondary" id="dl">Download save</button><button class="btn btn-primary" id="retry">Try again</button></div>`,
  (m, close) => {
    m.querySelector('#dl').onclick = () => download(`lanebreak-${state.W.year}.json`, JSON.stringify(state.W), 'application/json');
    m.querySelector('#retry').onclick = () => { close(); save(slot, { quiet: false }); };
  });
}
