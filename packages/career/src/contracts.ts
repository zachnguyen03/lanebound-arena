import type { CareerContract } from "./world.js";

/**
 * Years tick down by 1 at season end. A contract that would hit 0 renews for
 * 1 year at the stored wage (C-R-9). Wage is not changed here.
 */
export function tickContract(contract: CareerContract): CareerContract {
  const next = contract.years_left - 1;
  if (next <= 0) {
    return { ...contract, years_left: 1, wage: contract.wage, auto_renewed: true };
  }
  return { ...contract, years_left: next, wage: contract.wage, auto_renewed: false };
}

export function tickContracts(contracts: readonly CareerContract[]): CareerContract[] {
  return contracts.map((contract) => tickContract(contract));
}
