/**
 * Glickman, "Example of the Glicko-2 system" (2013 / revised 22 Feb 2012 Illinois step).
 * Scale constant 173.7178. tau 0.5. One rating period is one series (C-R-8).
 * Clubs with no games are not passed here: C-R-8 leaves them unchanged and does
 * not apply Glickman's non-competitor RD inflation.
 */

export const GLICKO_SCALE = 173.7178;
export const GLICKO_TAU = 0.5;
export const GLICKO_EPSILON = 0.000001;

export interface GlickoState {
  mu: number;
  phi: number;
  sigma: number;
}

export interface GlickoGame {
  mu: number;
  phi: number;
  score: 0 | 1;
}

export function initialGlicko(): GlickoState {
  return { mu: 0, phi: 350 / GLICKO_SCALE, sigma: 0.06 };
}

export function glickoDisplay(state: GlickoState): { r: number; rd: number } {
  return { r: GLICKO_SCALE * state.mu + 1500, rd: GLICKO_SCALE * state.phi };
}

export function fromDisplay(r: number, rd: number, sigma: number): GlickoState {
  return { mu: (r - 1500) / GLICKO_SCALE, phi: rd / GLICKO_SCALE, sigma };
}

function gPhi(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

function expectScore(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-gPhi(phiJ) * (mu - muJ)));
}

export function glickoUpdate(state: GlickoState, games: readonly GlickoGame[], tau = GLICKO_TAU): GlickoState {
  if (games.length === 0) {
    throw new Error("idle Glicko is left unchanged; update requires a result");
  }
  const mu = state.mu;
  const phi = state.phi;
  let varianceSum = 0;
  let outcomeSum = 0;
  for (const game of games) {
    const gj = gPhi(game.phi);
    const ej = expectScore(mu, game.mu, game.phi);
    varianceSum += gj * gj * ej * (1 - ej);
    outcomeSum += gj * (game.score - ej);
  }
  const v = 1 / varianceSum;
  const delta = v * outcomeSum;
  const a = Math.log(state.sigma * state.sigma);
  const phi2 = phi * phi;
  const f = (x: number): number => {
    const ex = Math.exp(x);
    const num = ex * (delta * delta - phi2 - v - ex);
    const den = 2 * (phi2 + v + ex) * (phi2 + v + ex);
    return num / den - (x - a) / (tau * tau);
  };
  let A = a;
  let B: number;
  if (delta * delta > phi2 + v) {
    B = Math.log(delta * delta - phi2 - v);
  } else {
    let k = 1;
    while (f(a - k * tau) < 0) {
      k += 1;
      if (k > 100) throw new Error("glicko volatility bracket did not flip");
    }
    B = a - k * tau;
  }
  let fA = f(A);
  let fB = f(B);
  let guard = 0;
  while (Math.abs(B - A) > GLICKO_EPSILON) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    B = C;
    fB = fC;
    guard += 1;
    if (guard > 100) throw new Error("glicko volatility did not converge");
  }
  const sigma = Math.exp(A / 2);
  const phiStar = Math.sqrt(phi2 + sigma * sigma);
  const nextPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const nextMu = mu + nextPhi * nextPhi * outcomeSum;
  return { mu: nextMu, phi: nextPhi, sigma };
}

export function glickoSeries(state: GlickoState, opponent: GlickoState, score: 0 | 1, tau = GLICKO_TAU): GlickoState {
  return glickoUpdate(state, [{ mu: opponent.mu, phi: opponent.phi, score }], tau);
}
