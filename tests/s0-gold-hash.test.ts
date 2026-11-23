import { describe, expect, it } from "vitest";
import { DEFAULT_CONSTANTS, constantsHash, dataHash, defaultEvenConfig, simulate } from "../sim/index.js";

/**
 * Gold digests / hashes. Update only with before→after in lab/s1/REPORT.md.
 * S1 tip: real champions in defaultEvenConfig + data_hash on match_start.
 */
export const GOLD = {
  seed_20261122: {
    digest: "e0c3d7b631b35e13f8420e0fa0711c8e7fb24678413d5568ce097bfc627fffe4",
    constants_hash: "08a57092e523021c6e5ed0ce354b1668bf4f11fe4d3c4f3fa05f5d40052caffb",
    data_hash: "82875d4c32712d11116f71eccca0997fcacea006c0997103ebc15603a3d1a06a",
  },
  seed_20261123: {
    digest: "d3df901fd5e5ed364fcb1bd8353532551a296570460b5b1b384be95da4b9d270",
    constants_hash: "08a57092e523021c6e5ed0ce354b1668bf4f11fe4d3c4f3fa05f5d40052caffb",
    data_hash: "82875d4c32712d11116f71eccca0997fcacea006c0997103ebc15603a3d1a06a",
  },
  /** S0 tip 1caa5eb (dummy lineups, no data_hash) — retained for before/after. */
  s0_before: {
    digest_20261122: "07a8be5079bc66d6c5460a9b0ca4044ddada6158658cbf32476d05ab500d083a",
    digest_20261123: "be36ec904ceb38fcdb2f32c752cda188655fd54b65b8d6ca1442b391783922f3",
    constants_hash: "08a57092e523021c6e5ed0ce354b1668bf4f11fe4d3c4f3fa05f5d40052caffb",
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
