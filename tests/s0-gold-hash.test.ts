import { describe, expect, it } from "vitest";
import { DEFAULT_CONSTANTS, constantsHash, defaultEvenConfig, simulate } from "../sim/index.js";

/**
 * Published S0 gold digests / constants_hash.
 * Update only with a before→after report in lab/s0/REPORT.md.
 */
export const GOLD = {
  seed_20261122: {
    // Updated by G2 phase-10 XP order (kill/assist → time → level-ups). See REPORT.md.
    digest: "2202014ebe26f2667b1cc23d9bbd55fa150d592a32741d95721d733ecadabe00",
    constants_hash: "55713b35526c584698d4f8fb2068495da98a83c4c86ea118b5498fdce8358204",
  },
  seed_20261123: {
    digest: "d9d438aade560fabebcb3cb0f1c1afa35c91e672b1279319cf83e8a787beac7f",
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
