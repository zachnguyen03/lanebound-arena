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
import { defaultEvenConfig, digestEvents, simulate } from "../../../sim/index.js";
import { PIT, cluster, runAi, type UId } from "./_harness.js";

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

  it("R #3 S2-7 L1917: intent is emitted only when it changes, not every tick", () => {
    const mid = "blue:mid" as UId;
    const r = runAi({
      T: 2.0,
      pos: true,
      motor: { [mid]: { to: [[8, 7.5]], arrive_r: 0.3, hold_at_end: true } },
    });
    const intents = r.of("intent", (e) => e.unit_id === mid);
    expect(intents.length).toBeGreaterThan(0);
    for (let i = 1; i < intents.length; i++) {
      const a = intents[i - 1]!;
      const b = intents[i]!;
      const same = a.intent === b.intent && a.target_id === b.target_id;
      expect(same, `intent repeated at t=${b.t} (only-on-change, L165 / R #3 S2-7)`).toBe(false);
    }
  });

  it("R #3 S2-7 L1917: intent is a first-class digest event; move and pos stay out", () => {
    const mid = "blue:mid" as UId;
    const r = runAi({
      T: 2.0,
      pos: true,
      motor: { [mid]: { to: [[8, 7.5]], arrive_r: 0.3, hold_at_end: true } },
    });
    const intents = r.of("intent");
    expect(intents.length).toBeGreaterThan(0);
    expect(digestEvents(r.events)).toBe(r.digest);
    const withoutPosMove = r.events.filter((e) => e.type !== "pos" && e.type !== "move");
    expect(digestEvents(withoutPosMove)).toBe(r.digest);
    const withoutIntent = r.events.filter((e) => e.type !== "intent");
    expect(digestEvents(withoutIntent)).not.toBe(r.digest);
  });

  it("R #3 S2-7 L1917: in a real AI fight (no scripted motor), a unit's intent events appear only on change", () => {
    const BM = "blue:mid" as UId;
    const r = runAi({
      T: 4.0,
      tactics: { blue: { preset: "hunt" }, red: { preset: "hunt" } },
      units: cluster(PIT, [
        { id: "blue:mid" as UId, champ: "kerrig", auto: true },
        { id: "blue:jungle" as UId, champ: "kerrig" },
        { id: "blue:adc" as UId, champ: "huntress", auto: true },
        { id: "red:mid" as UId, champ: "maelis" },
        { id: "red:jungle" as UId, champ: "kerrig" },
        { id: "red:adc" as UId, champ: "huntress" },
      ]),
    });
    expect(r.fightCalls().length).toBeGreaterThan(0);
    const intents = r.of("intent", (e) => e.unit_id === BM);
    expect(intents.length).toBeGreaterThan(0);
    for (let i = 1; i < intents.length; i++) {
      const a = intents[i - 1]!;
      const b = intents[i]!;
      const same = a.intent === b.intent && a.target_id === b.target_id;
      expect(same, `AI intent repeated at t=${b.t} (${String(a.intent)} → ${String(b.intent)}, only-on-change, L165 / R #3 S2-7)`).toBe(false);
    }
  });
});
