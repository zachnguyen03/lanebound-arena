// Background match runner: keeps the UI responsive while the rest of the world plays.
import { runPayload } from './fastsim.js';

self.onmessage = ({ data: { id, payload } }) => self.postMessage({ id, summary: runPayload(payload) });
