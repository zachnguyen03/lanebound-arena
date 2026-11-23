import type { StreamId } from "./types.js";

/**
 * Counter-based PRNG: splitmix64 over BigInt, named streams.
 * rand = hash(seed, stream_id, unit_key, counter++) → [0, 1) via 53-bit extract.
 */

const STREAM_CODES: Record<StreamId, number> = {
  combat: 1,
  skillshot: 2,
  ai: 3,
  cards: 4,
  draft: 5,
  tiebreak: 6,
  player: 7,
  cosmetic: 8,
};

function splitmix64(z: bigint): bigint {
  z = (z + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
  return z ^ (z >> 31n);
}

function mixSeed(seed: number, stream: StreamId, unitKey: number, counter: number): bigint {
  let z = BigInt(seed >>> 0);
  z = splitmix64(z ^ (BigInt(STREAM_CODES[stream]) << 32n));
  z = splitmix64(z ^ BigInt(unitKey >>> 0));
  z = splitmix64(z ^ BigInt(counter >>> 0));
  return z;
}

/** Map u64 → [0, 1) using top 53 bits (IEEE binary64 mantissa width). */
function toUnitInterval(z: bigint): number {
  const top53 = Number(z >> 11n);
  return top53 / 9007199254740992; // 2^53
}

export class RngBank {
  private counters = new Map<string, number>();

  constructor(readonly seed: number) {}

  private key(stream: StreamId, unitKey: number): string {
    return `${stream}:${unitKey}`;
  }

  /** Draw U[0,1). unitKey 0 = stream-global. */
  next(stream: StreamId, unitKey = 0): number {
    if (stream === "cosmetic") {
      throw new Error("cosmetic stream must never be read by the sim core");
    }
    const k = this.key(stream, unitKey);
    const c = this.counters.get(k) ?? 0;
    this.counters.set(k, c + 1);
    return toUnitInterval(mixSeed(this.seed, stream, unitKey, c));
  }

  /** Bernoulli: true iff next() < p. */
  chance(stream: StreamId, p: number, unitKey = 0): boolean {
    return this.next(stream, unitKey) < p;
  }
}

export function unitKeyFromId(unitId: string): number {
  // Stable small int from unit id for per-unit streams.
  let h = 0;
  for (let i = 0; i < unitId.length; i++) {
    h = ((h << 5) - h + unitId.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}
