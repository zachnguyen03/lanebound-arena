import { describe, expect, it } from "vitest";
import { DEFAULT_CONSTANTS, constantsHash, defaultEvenConfig, simulate } from "../sim/index.js";

/**
 * Published S0 gold digests / constants_hash.
 * Update only with a before→after report in lab/s0/REPORT.md.
 */
export const GOLD = {
  seed_20261122: {
    digest: "cf8b9269579c4aae6203813a681a7d44c507493d7fdca4e1d3a7dd912ba39e1b",
    constants_hash: "55713b35526c584698d4f8fb2068495da98a83c4c86ea118b5498fdce8358204",
  },
  seed_20261123: {
    digest: "6860cbdeea1f1baa63d8511143353aee11b759c27d23d6196370c7dfa75c3274",
    constants_hash: "55713b35526c584698d4f8fb2068495da98a83c4c86ea118b5498fdce8358204",
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
