/**
 * Determinism with AI on (M2 test 24; plan §8.4; sandbox §11 S2; G10 L1891).
 * Two runs of the same seed and config must match; seed+1 must differ.
 * This is not pinned to the S1 no-AI gold — turning the Unit Brain on is expected
 * to change the default-match digest. Identity across processes is the gate.
 *
 * Uses defaultEvenConfig as the "AI on" match (S2 will run the brain on that
 * config; on the S1 tip the test still checks determinism of whatever the sim does).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { defaultEvenConfig, simulate } from "../../../sim/index.js";

const SEED = 20261122;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("Digest still stable with AI on (M2-24 L1737, G10 L1891)", () => {
  it("two in-process simulate() calls on defaultEvenConfig(seed) have a byte-identical digest", () => {
    const a = simulate(defaultEvenConfig(SEED));
    const b = simulate(defaultEvenConfig(SEED));
    expect(a.digest).toBe(b.digest);
    expect(a.constants_hash).toBe(b.constants_hash);
    expect(a.digest.length).toBe(64);
  });

  it("seed+1 produces a different digest", () => {
    const a = simulate(defaultEvenConfig(SEED));
    const b = simulate(defaultEvenConfig(SEED + 1));
    expect(b.digest).not.toBe(a.digest);
  });

  it("two separate Node processes agree on the default-match digest for seed 20261122", () => {
    const run = () => {
      const r = spawnSync(
        process.execPath,
        ["--import", "tsx", path.join(root, "apps/lab/digest.ts"), "--seed", String(SEED)],
        { encoding: "utf8", cwd: root, env: process.env },
      );
      if (r.status !== 0) throw new Error(`digest.ts failed: ${r.stderr || r.stdout}`);
      const digest = /^digest=(.+)$/m.exec(r.stdout)?.[1]?.trim();
      if (!digest) throw new Error(`no digest in\n${r.stdout}`);
      return digest;
    };
    expect(run()).toBe(run());
  }, 60_000);
});
