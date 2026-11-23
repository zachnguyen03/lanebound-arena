/**
 * Deterministic geometry helpers.
 * Allowed Math: + - * / sqrt floor ceil round trunc abs min max sign.
 * Banned: sin cos atan2 exp log pow, Date, performance, random.
 */

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function abs(v: number): number {
  return Math.abs(v);
}

export function hypot(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy);
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return hypot(ax - bx, ay - by);
}

/** Unit vector; if length ~0 return (0,0). */
export function normalize(dx: number, dy: number): { x: number; y: number; len: number } {
  const len = hypot(dx, dy);
  if (len === 0) return { x: 0, y: 0, len: 0 };
  return { x: dx / len, y: dy / len, len };
}

/**
 * Invention INV-ATAN2: approximate atan2 via normalize + quadrant flags is not needed
 * for S0 steering (we steer with dx/dy directly). Kept as a note that we avoid atan2.
 */
export function floor(v: number): number {
  return Math.floor(v);
}

export function ceil(v: number): number {
  return Math.ceil(v);
}

export function round(v: number): number {
  return Math.round(v);
}

export function trunc(v: number): number {
  return Math.trunc(v);
}

export function sign(v: number): number {
  return Math.sign(v);
}

export function min(a: number, b: number): number {
  return Math.min(a, b);
}

export function max(a: number, b: number): number {
  return Math.max(a, b);
}

export function sqrt(v: number): number {
  return Math.sqrt(v);
}
