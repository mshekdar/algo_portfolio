import { TestBed } from '@angular/core/testing';
import { RebalanceService, RebalanceInput } from './rebalance.service';
import { PortfolioAllocation } from '../models';

// Import a real allocation JSON for a realistic baseline. The JSON lives under
// "public/data/Allocation/..." but a copy is also bundled in the compiled assets.
// For the test we can require it directly (Angular CLI makes JSON imports work).
// Adjust the path if the JSON location changes.
import allocationJson from '../../../public/data/Allocation/balanced_portfolio_30_lakh.json';

describe('RebalanceService', () => {
  let service: RebalanceService;
  const baseAlloc = allocationJson as unknown as PortfolioAllocation;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RebalanceService);
  });

  it('should return unchanged allocation when input matches original percentages', () => {
    const input: RebalanceInput = {
      totalCapital: baseAlloc.total_capital_inr,
      cashReservePct: baseAlloc.cash_reserve_percent,
      optionBuyingPct: baseAlloc.option_buying_percent_of_total,
      optionSellingPct: baseAlloc.option_selling_percent_of_total,
      strategyAllocPct: baseAlloc.strategies.reduce((acc, it) => {
        const deployed =
          baseAlloc.allocated_to_option_buying_inr +
          baseAlloc.allocated_to_option_selling_inr;
        const pct = deployed ? (it.allocated_capital_inr / deployed) * 100 : 0;
        acc[it.strategy_info.name] = pct;
        return acc;
      }, {} as Record<string, number>),
    };

    const result = service.rebalance(baseAlloc, input);
    expect(result.allocation.total_capital_inr).toBe(baseAlloc.total_capital_inr);
    // Spot‑check one strategy – values should be nearly identical
    const origFirst = baseAlloc.strategies[0];
    const newFirst = result.allocation.strategies[0];
    expect(newFirst.allocated_capital_inr).toBeCloseTo(origFirst.allocated_capital_inr, 2);
    expect(newFirst.number_of_lots).toBe(origFirst.number_of_lots);
  });

  it('should scale allocation when total capital changes', () => {
    const input: RebalanceInput = {
      totalCapital: 50_000_000, // 5 crore
      cashReservePct: 10,
      optionBuyingPct: 45,
      optionSellingPct: 45,
      strategyAllocPct: {
        // Allocate 60% to the first strategy and 40% to the second; others 0.
        [baseAlloc.strategies[0].strategy_info.name]: 60,
        [baseAlloc.strategies[1].strategy_info.name]: 40,
      },
    };

    const result = service.rebalance(baseAlloc, input);
    expect(result.allocation.total_capital_inr).toBe(50_000_000);
    // cash reserve must be 10%
    expect(result.allocation.cash_reserve_inr).toBeCloseTo(5_000_000);
    // Deployed capital should be 90% of total
    expect(result.allocation.total_strategy_allocation_inr).toBeCloseTo(45_000_000);
    // The two selected strategies should receive capital proportional to 60/40 of deployed
    const first = result.allocation.strategies.find(
      (s) => s.strategy_info.name === baseAlloc.strategies[0].strategy_info.name
    )!;
    const second = result.allocation.strategies.find(
      (s) => s.strategy_info.name === baseAlloc.strategies[1].strategy_info.name
    )!;
    expect(first.allocated_capital_inr).toBeCloseTo(45_000_000 * 0.6);
    expect(second.allocated_capital_inr).toBeCloseTo(45_000_000 * 0.4);
  });

  it('should throw when top‑level percentages do not sum to 100', () => {
    const input: RebalanceInput = {
      totalCapital: baseAlloc.total_capital_inr,
      cashReservePct: 30,
      optionBuyingPct: 30,
      optionSellingPct: 30, // sums to 90
      strategyAllocPct: { Test: 100 },
    };
    expect(() => service.rebalance(baseAlloc, input)).toThrowError();
  });
});
