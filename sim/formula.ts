/**
 * Parse authored L7 formulas from kits.ts (e.g. "110 + 80% ATK").
 * Do not hardcode kit bases outside this parser + kits.ts.
 */
export interface ParsedFormula {
  base: number;
  atk_ratio: number;
  pow_ratio: number;
}

/** Parse strings like `330 + 140% ATK + 15% POW` or `none`. */
export function parseL7Formula(formula: string | undefined): ParsedFormula | null {
  if (!formula) return null;
  const s = formula.trim();
  if (!s || /^none\b/i.test(s)) return null;

  let base = 0;
  let atk_ratio = 0;
  let pow_ratio = 0;

  // Leading constant
  const baseM = s.match(/^(\d+(?:\.\d+)?)/);
  if (baseM) base = parseFloat(baseM[1]!);

  const atkM = s.match(/(\d+(?:\.\d+)?)%\s*ATK/i);
  if (atkM) atk_ratio = parseFloat(atkM[1]!) / 100;

  const powM = s.match(/(\d+(?:\.\d+)?)%\s*POW/i);
  if (powM) pow_ratio = parseFloat(powM[1]!) / 100;

  return { base, atk_ratio, pow_ratio };
}

export function evalL7Base(formula: string | undefined, atk: number, pow: number): number {
  const p = parseL7Formula(formula);
  if (!p) return 0;
  return p.base + p.atk_ratio * atk + p.pow_ratio * pow;
}
