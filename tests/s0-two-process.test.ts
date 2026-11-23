import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEED = 20261122;

function digestFromChildProcess(seed: number): { digest: string; constants_hash: string } {
  const r = spawnSync(
    process.execPath,
    ["--import", "tsx", path.join(root, "apps/lab/digest.ts"), "--seed", String(seed)],
    { encoding: "utf8", cwd: root, env: process.env },
  );
  if (r.status !== 0) {
    throw new Error(`child digest failed (status=${r.status}): ${r.stderr || r.stdout}`);
  }
  const out = r.stdout;
  const digest = /^digest=(.+)$/m.exec(out)?.[1]?.trim();
  const constants_hash = /^constants_hash=(.+)$/m.exec(out)?.[1]?.trim();
  if (!digest || !constants_hash) {
    throw new Error(`child digest missing fields:\n${out}`);
  }
  return { digest, constants_hash };
}

describe("M0.1 two-process determinism", () => {
  it("seed 20261122 digest matches across two separate Node processes", () => {
    const a = digestFromChildProcess(SEED);
    const b = digestFromChildProcess(SEED);
    expect(a.digest).toBe(b.digest);
    expect(a.constants_hash).toBe(b.constants_hash);
  }, 60_000);
});
