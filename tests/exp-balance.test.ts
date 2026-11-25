/**
 * exp/balance — sandbox kit patch (not build-spec acceptance).
 */
import { describe, expect, it } from "vitest";
import { dataHash, simulate } from "../sim/index.js";
import { evenOvrConfig } from "../sim/match_config.js";
import { SANDBOX_KIT_PATCH, withKitPatch } from "../sim/balance.js";
import { KITS } from "../data/champions/kits.js";
import { CHAMPIONS } from "../data/champions/defs.js";

describe("exp sandbox kit patch", () => {
  it("applies inside simulate only, changes the match, and restores the spec tables", () => {
    const base = evenOvrConfig(20261122);
    const h0 = dataHash();
    const spec = simulate(base).digest;
    const patched = simulate({ ...base, kit_patch: SANDBOX_KIT_PATCH });
    expect(patched.digest).not.toBe(spec);
    expect(simulate({ ...base, kit_patch: SANDBOX_KIT_PATCH }).digest).toBe(patched.digest);
    expect(dataHash()).toBe(h0);
    expect(simulate(base).digest).toBe(spec);
  });

  it("patches fields while running and removes added ones after", () => {
    withKitPatch({ kerrig: { l1: { hp: 1234 }, R: { CD_s: 1, self_test: 1 } as never } }, () => {
      expect(CHAMPIONS.kerrig!.l1.hp).toBe(1234);
      expect(KITS.kerrig!.R.CD_s).toBe(1);
    });
    expect(CHAMPIONS.kerrig!.l1.hp).toBe(870);
    expect(KITS.kerrig!.R.CD_s).toBe(42);
    expect("self_test" in KITS.kerrig!.R).toBe(false);
  });

  it("restores even when the run throws", () => {
    expect(() => withKitPatch({ calder: { Q: { CD_s: 99 } } }, () => { throw new Error("x"); })).toThrow("x");
    expect(KITS.calder!.Q.CD_s).toBe(6.5);
  });
});
