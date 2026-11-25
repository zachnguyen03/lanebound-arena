/**
 * exp/balance (not build spec): champion kit + base-stat patch, off unless
 * MatchConfig.kit_patch is set. The spec tables in data/champions stay as
 * printed; the patch is applied only for the duration of one simulate().
 */
import { CHAMPIONS, type L1Stats } from "../data/champions/defs.js";
import { KITS, type AbilityDef } from "../data/champions/kits.js";

type Skill = "Q" | "W" | "R";
/** Per champion: base-stat overrides and per-skill field overrides (nested objects replaced whole). */
export type KitPatch = Record<string, { l1?: Partial<L1Stats> } & Partial<Record<Skill, Partial<AbilityDef>>>>;

/**
 * Sandbox balance pass 1 (lab/balance/REPORT.md). 900-game tuning rounds on
 * seeds 0–449, validated on fresh seeds 2000–2999 (2000 games): champion win
 * rates 32–66 % → 47–53 %.
 */
export const SANDBOX_KIT_PATCH: KitPatch = {
  brannoch: {
    Q: { pierce: "first", damage: { base: 105, atk: 0.65 }, slow: { pct: 0.35, duration_s: 1.0, school: "physical" } },
    W: { cc: [{ kind: "knockup", category: "Lock", duration_s: 0.5, school: "physical" }] },
    R: { cc: [{ kind: "stun", category: "Lock", duration_s: 1.3, school: "magic", petrify: true }] },
  },
  rhedan: {
    l1: { hp: 1200 },
    Q: { damage: { base: 105, atk: 0.75 } },
    W: { cc: [{ kind: "root", category: "Bind", duration_s: 0.9, school: "physical" }] },
  },
  calder: {
    Q: { range: 5.8, damage: { base: 105, pow: 0.95 }, CD_s: 8 },
    R: { cc: [{ kind: "fear", category: "Lock", duration_s: 1.2, school: "magic" }] },
  },
  isra: {
    Q: { range: 7.5 },
    R: { range: 9, radius: 2.8, damage: { base: 130, atk: 0.75 }, CD_s: 70 },
  },
  kerrig: {
    l1: { hp: 1020, pres: 30 },
    Q: { width: 0.6 },
    R: { CD_s: 36 },
  },
  maelis: {
    l1: { hp: 950 },
    Q: { damage: { base: 155, pow: 1.35 } },
    W: { shield: { base: 120, pow: 0.4, duration_s: 2.5 } },
    R: { CD_s: 42 },
  },
  tolle: {
    l1: { hp: 1450 },
    Q: { radius: 1.9, CD_s: 8, cc: [{ kind: "stun", category: "Lock", duration_s: 1.1, school: "magic" }] },
  },
  mirren: {
    W: { cc: [{ kind: "hex", category: "Lock", duration_s: 1.3, school: "magic" }] },
  },
};

/**
 * Run `fn` with the patch applied to the shared champion tables, then restore.
 * ponytail: mutates module tables because ~15 sim modules read KITS / CHAMPIONS
 * directly; safe while simulate() is synchronous. Thread a data context through
 * if simulate ever becomes async or concurrent.
 */
export function withKitPatch<T>(patch: KitPatch | undefined, fn: () => T): T {
  if (!patch) return fn();
  const undo: Array<() => void> = [];
  const assign = (target: Record<string, unknown>, over: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(over)) {
      const had = Object.prototype.hasOwnProperty.call(target, k);
      const old = target[k];
      undo.push(() => (had ? (target[k] = old) : delete target[k]));
      target[k] = v;
    }
  };
  try {
    for (const [champ, p] of Object.entries(patch)) {
      const def = CHAMPIONS[champ];
      const kit = KITS[champ];
      if (!def || !kit) throw new Error(`kit_patch: unknown champion ${champ}`);
      if (p.l1) assign(def.l1 as unknown as Record<string, unknown>, p.l1);
      for (const s of ["Q", "W", "R"] as const) {
        if (p[s]) assign(kit[s] as unknown as Record<string, unknown>, p[s]!);
      }
    }
    return fn();
  } finally {
    for (const u of undo.reverse()) u();
  }
}
