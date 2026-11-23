/**
 * Frozen C0 RNG. splitmix32 (Steele / Vigna mix constants).
 * Unit interval is (u32 + 0.5) / 2^32, so every draw is in (0, 1).
 * No Math.random.
 */

export class SplitMix32 {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  nextU32(): number {
    this.state = (this.state + 0x9e3779b9) >>> 0;
    let z = this.state;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  }

  /** Uniform in (0, 1). */
  nextUnit(): number {
    return (this.nextU32() + 0.5) / 4294967296;
  }
}

/** Avalanche mix of two u32s. Game and series seeds use this. */
export function mixU32(a: number, b: number): number {
  let z = (a + Math.imul(b >>> 0, 0x9e3779b9)) >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x7feb352d) >>> 0;
  z = Math.imul(z ^ (z >>> 15), 0x846ca68b) >>> 0;
  return (z ^ (z >>> 16)) >>> 0;
}

export function seriesSeed(careerSeed: number, fixtureOrdinal: number): number {
  return mixU32(careerSeed >>> 0, (fixtureOrdinal + 1) >>> 0);
}

export function gameSeed(seriesSeedValue: number, gameIndex: number): number {
  return mixU32(seriesSeedValue >>> 0, gameIndex >>> 0);
}
