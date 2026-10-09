import { Injectable } from '@angular/core';
import {
  AllocationItem,
  PortfolioAllocation,
} from '../models';

/**
 * Input values that drive a re‑balance simulation.
 */
export interface RebalanceInput {
  /** Desired total capital (INR) */
  totalCapital: number;
  /** Cash reserve percentage of total capital (0‑100) */
  cashReservePct: number;
  /** Option‑buying allocation percentage of total capital (0‑100) */
  optionBuyingPct: number;
  /** Option‑selling allocation percentage of total capital (0‑100) */
  optionSellingPct: number;
}

/** Result of a re‑balance operation. */
export interface RebalanceResult {
  /** New allocation object – matches the shape of the JSON file */
  allocation: PortfolioAllocation;
  /** Summary values used for cards and charts */
  summary: {
    totalCapital: number;
    cashReserve: number;
    optionBuying: number;
    optionSelling: number;
    deployedCapital: number;
    deployedPct: number;
    totalLots: number;
  };
}

/** Pure service that performs the calculation logic. */
@Injectable({ providedIn: 'root' })
export class RebalanceService {
  /**
   * Core re‑balancing algorithm.
   * It does **not** mutate the original allocation object.
   */
  rebalance(
    original: PortfolioAllocation,
    input: RebalanceInput
  ): RebalanceResult {
    // ----- Validate top‑level percentages -----
    const topTotal =
      input.cashReservePct + input.optionBuyingPct + input.optionSellingPct;
    if (Math.round(topTotal) !== 100) {
      throw new Error(
        'Cash, option buying and option selling percentages must sum to 100'
      );
    }

    // ----- Compute raw capital buckets -----
    const cashReserve = (input.cashReservePct / 100) * input.totalCapital;
    const optionBuying = (input.optionBuyingPct / 100) * input.totalCapital;
    const optionSelling = (input.optionSellingPct / 100) * input.totalCapital;
    const deployedCapital = optionBuying + optionSelling;
    const deployedPct = Number(((deployedCapital / input.totalCapital) * 100).toFixed(2));

    // ----- Build new strategy items preserving original allocation ratios -----
    const originalDeployed =
      original.allocated_to_option_buying_inr +
      original.allocated_to_option_selling_inr;
    const newStrategies: AllocationItem[] = original.strategies.map((item) => {
      // Ratio of this strategy's capital in the original deployed pool
      const ratio = originalDeployed ? item.allocated_capital_inr / originalDeployed : 0;
      const allocatedCap = ratio * deployedCapital;
      // Number of lots based on capital_per_lot_inr (kept constant)
      const newLots = Math.round(allocatedCap / item.capital_per_lot_inr);
      const allocationPercent = (allocatedCap / input.totalCapital) * 100;
      return {
        ...item,
        number_of_lots: newLots,
        allocated_capital_inr: allocatedCap,
        allocation_percent_of_total: allocationPercent,
      } as AllocationItem;
    });

    // ----- Assemble the new PortfolioAllocation -----
    const updated: PortfolioAllocation = {
      ...original,
      total_capital_inr: input.totalCapital,
      cash_reserve_inr: cashReserve,
      cash_reserve_percent: input.cashReservePct,
      allocated_to_option_buying_inr: optionBuying,
      allocated_to_option_selling_inr: optionSelling,
      option_buying_percent_of_total: input.optionBuyingPct,
      option_selling_percent_of_total: input.optionSellingPct,
      total_strategy_allocation_inr: deployedCapital,
      deployed_percent_of_total: deployedPct,
      strategies: newStrategies,
      total_lots_across_strategies: newStrategies.reduce(
        (a, s) => a + s.number_of_lots,
        0
      ),
    };

    return {
      allocation: updated,
      summary: {
        totalCapital: input.totalCapital,
        cashReserve,
        optionBuying,
        optionSelling,
        deployedCapital,
        deployedPct,
        totalLots: updated.total_lots_across_strategies,
      },
    };
  }
}
