import { describe, expect, it } from "vitest";
import { DEFAULT_CONSTANTS, constantsHash, dataHash, defaultEvenConfig, simulate } from "../sim/index.js";

/**
 * Gold digests / hashes. Update only with before→after in the agent report / lab REPORT.
 * Tile-centre ruling (Appendix R) moved spawn/buff pads to centres → constants_hash + digests.
 */
export const GOLD = {
  seed_20261122: {
    // S2: AI on by default; `intent` is a first-class digest event (was S1 quiet-match gold).
    digest: "0f7456370f500188fa4fddde922d9c55213e792819bb9b8614b370a1c5df2e26",
    constants_hash: "69f5b9e615f3e57f458c0dd40875d2cd178cc4ac728da2f9e5f4f51e8ff54fc1",
    data_hash: "af2cbafa03a1cea2485b6118b09232a7c511e682189102e486d3e2cd549a32f2",
  },
  seed_20261123: {
    digest: "612148a2e910c47c0cf5793153e3cd4d7023dbebb287caeed1797f883bb89760",
    constants_hash: "69f5b9e615f3e57f458c0dd40875d2cd178cc4ac728da2f9e5f4f51e8ff54fc1",
    data_hash: "af2cbafa03a1cea2485b6118b09232a7c511e682189102e486d3e2cd549a32f2",
  },
  /** Historical S0 tip (integer spawn/buff pads) — retained for before/after. */
  s0_before_tile_centre: {
    digest_20261122: "07a8be5079bc66d6c5460a9b0ca4044ddada6158658cbf32476d05ab500d083a",
    digest_20261123: "be36ec904ceb38fcdb2f32c752cda188655fd54b65b8d6ca1442b391783922f3",
    constants_hash: "08a57092e523021c6e5ed0ce354b1668bf4f11fe4d3c4f3fa05f5d40052caffb",
  },
  /** Tip immediately before tile-centre on this branch (S1 kits + SEP already in). */
  tip_before_tile_centre: {
    digest_20261122: "ed469ea246bea0fde61fce5a709555305dd1d587b00a9eafa631a37f4339f4f4",
    digest_20261123: "ba1d0dd9c8f03bb1ecdd04caef6ee1241e8263eb1ad34b92e9a8fb5a26e24506",
    constants_hash: "3e4a4c7789bfa750380c01101c8e8a55c87549cc092e635c80f011fd5853a84c",
  },
} as const;

describe("S0 gold-hash regression", () => {
  it("constants_hash matches published gold", () => {
    expect(constantsHash(DEFAULT_CONSTANTS)).toBe(GOLD.seed_20261122.constants_hash);
  });

  it("data_hash matches published gold (INV-DATA-HASH)", () => {
    expect(dataHash()).toBe(GOLD.seed_20261122.data_hash);
  });

  it("seed 20261122 digest matches published gold", () => {
    const r = simulate(defaultEvenConfig(20261122));
    expect(r.constants_hash).toBe(GOLD.seed_20261122.constants_hash);
    expect(r.data_hash).toBe(GOLD.seed_20261122.data_hash);
    expect(r.digest).toBe(GOLD.seed_20261122.digest);
  });

  it("seed 20261123 digest matches published gold", () => {
    const r = simulate(defaultEvenConfig(20261123));
    expect(r.constants_hash).toBe(GOLD.seed_20261123.constants_hash);
    expect(r.data_hash).toBe(GOLD.seed_20261123.data_hash);
    expect(r.digest).toBe(GOLD.seed_20261123.digest);
  });
});
