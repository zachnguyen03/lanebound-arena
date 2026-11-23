import { describe, expect, it } from "vitest";
import { DEFAULT_CONSTANTS, constantsHash, defaultEvenConfig, simulate } from "../sim/index.js";

/**
 * Published S0 gold digests / constants_hash.
 * Update only with a before→after report in lab/s0/REPORT.md.
 */
export const GOLD = {
  seed_20261122: {
    // Updated by AUTO_WINDUP (§15) + G2 XP order. See lab/s0/REPORT.md before/after.
    digest: "07a8be5079bc66d6c5460a9b0ca4044ddada6158658cbf32476d05ab500d083a",
    constants_hash: "08a57092e523021c6e5ed0ce354b1668bf4f11fe4d3c4f3fa05f5d40052caffb",
  },
  seed_20261123: {
    digest: "be36ec904ceb38fcdb2f32c752cda188655fd54b65b8d6ca1442b391783922f3",
    constants_hash: "08a57092e523021c6e5ed0ce354b1668bf4f11fe4d3c4f3fa05f5d40052caffb",
  },
} as const;

describe("S0 gold-hash regression", () => {
  it("constants_hash matches published gold", () => {
    expect(constantsHash(DEFAULT_CONSTANTS)).toBe(GOLD.seed_20261122.constants_hash);
  });

  it("seed 20261122 digest matches published gold", () => {
    const r = simulate(defaultEvenConfig(20261122));
    expect(r.constants_hash).toBe(GOLD.seed_20261122.constants_hash);
    expect(r.digest).toBe(GOLD.seed_20261122.digest);
  });

  it("seed 20261123 digest matches published gold", () => {
    const r = simulate(defaultEvenConfig(20261123));
    expect(r.constants_hash).toBe(GOLD.seed_20261123.constants_hash);
    expect(r.digest).toBe(GOLD.seed_20261123.digest);
  });
});
