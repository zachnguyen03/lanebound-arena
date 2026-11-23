import { describe, expect, it } from "vitest";
import { DEFAULT_CONSTANTS, constantsHash, dataHash, defaultEvenConfig, simulate } from "../sim/index.js";

/**
 * Gold digests / hashes. Update only with before→after in the agent report / lab REPORT.
 * Tile-centre ruling (Appendix R) moved spawn/buff pads to centres → constants_hash + digests.
 */
export const GOLD = {
  seed_20261122: {
    digest: "dadc07b7462ff4d963357c5d7f1c1dd4966f2fb2326c02c49c96aea536b8de12",
    constants_hash: "c25f7a1779f6115a2b6f27cd118e57a4a83c6dec20ebec599b7a5430ef4a7364",
    data_hash: "6204e101a81bce7a25cb09130740015b687407d89313cf14e32fca88cffae633",
  },
  seed_20261123: {
    digest: "b80189c4c69b38802de139bf0ba8a5b0c1e9135c2744e1abebfdc5aca51cf79a",
    constants_hash: "c25f7a1779f6115a2b6f27cd118e57a4a83c6dec20ebec599b7a5430ef4a7364",
    data_hash: "6204e101a81bce7a25cb09130740015b687407d89313cf14e32fca88cffae633",
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
