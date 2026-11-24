/**
 * Cast-policy / K-2 acceptance gate.
 *
 * Default `npm test` stays green on bb4cb63 (no cast policy / no K-2 yet).
 * Opt in with LB_M2=1:
 *
 *   LB_M2=1 npx vitest run tests/acceptance/m1-19c-disabled-skillshot.test.ts
 *   LB_M2=1 npx vitest run tests/acceptance/m2-cast-policy.test.ts
 *   LB_M2=1 npm test
 */
export const LB_M2 = process.env.LB_M2 === "1";
