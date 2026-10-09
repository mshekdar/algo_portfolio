export interface StrategyConditions {
  best_market_conditions: string;
  rationale: string;
  trade_frequency: string;
}

export interface StrategyInfo {
  name: string;
  provider: string;
  instrument: string;
  category: string;
  market_bias: string;
  risk_level: string;
  recommended_capital_inr: number;
  deployed_users: number;
  conditions: StrategyConditions;
}

export interface BacktestPeriod {
  start_date: string;
  end_date: string;
}

export interface MultiPeriodReturns {
  six_month_percent: number;
  one_year_percent: number;
  two_year_percent: number;
}

export interface RiskMetrics {
  max_drawdown_percent: number;
  profit_factor: number;
  reward_to_risk_ratio: number;
}

export interface BacktestOverview {
  period: BacktestPeriod;
  gross_pnl_inr: number;
  gross_return_percent: number;
  average_monthly_return_percent: number;
  multi_period_returns: MultiPeriodReturns;
  risk_metrics: RiskMetrics;
}

export interface TradePerformance {
  total_trades: number;
  win_rate_percent: number;
  average_win_inr: number;
  average_loss_inr: number;
  biggest_win_inr: number;
  biggest_loss_inr: number;
}

export interface MostProfitableTrade {
  contract: string;
  pnl_inr: number;
}

export interface BestMonth {
  month: string;
  win_rate_percent: number;
}

export interface CurrentMonthPnl {
  period: string;
  overall_pnl_inr: number;
}

export interface StrategyInsights {
  most_profitable_trade: MostProfitableTrade;
  best_month: BestMonth;
  current_month_pnl: CurrentMonthPnl;
}

export interface Strategy {
  strategy_info: StrategyInfo;
  backtest_overview: BacktestOverview;
  trade_performance: TradePerformance;
  insights: StrategyInsights;
}

export interface AllocationStrategyInfo extends StrategyInfo {}

export interface HistoricalMetricsReference {
  gross_return_percent: number;
  max_drawdown_percent: number;
  profit_factor: number;
  total_trades: number;
  win_rate_percent: number;
}

export interface AllocationItem {
  strategy_info: AllocationStrategyInfo;
  number_of_lots: number;
  capital_per_lot_inr: number;
  allocated_capital_inr: number;
  allocation_percent_of_total: number;
  historical_metrics_reference: HistoricalMetricsReference;
}

export interface PortfolioAllocation {
  portfolio_name: string;
  assumption: string;
  total_capital_inr: number;
  allocated_to_option_buying_inr: number;
  option_buying_percent_of_total: number;
  allocated_to_option_selling_inr: number;
  option_selling_percent_of_total: number;
  total_strategy_allocation_inr: number;
  deployed_percent_of_total: number;
  cash_reserve_inr: number;
  cash_reserve_percent: number;
  total_lots_across_strategies: number;
  strategies: AllocationItem[];
  risk_notes: string[];
}

export interface StrategiesIndex {
  files: string[];
}

export interface EnrichedAllocationItem extends AllocationItem {
  full_strategy?: Strategy;
}
