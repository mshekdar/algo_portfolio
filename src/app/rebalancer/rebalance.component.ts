import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableDataSource } from '@angular/material/table';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, DoughnutController, ArcElement, Tooltip, Legend, Title } from 'chart.js';

import { DataService } from '../data.service';
import { RebalanceService, RebalanceInput } from './rebalance.service';
import { PortfolioAllocation, Strategy } from '../models';

Chart.register(DoughnutController, ArcElement, Tooltip, Legend, Title);

interface StrategyRow {
  name: string;
  allocationPct: number;
}

@Component({
  selector: 'app-rebalance',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatTableModule,
    MatSortModule,
    MatProgressBarModule,
    BaseChartDirective,
  ],
  templateUrl: './rebalance.component.html',
  styleUrl: './rebalance.component.scss',
})
export class RebalanceComponent implements OnInit, AfterViewInit {
  // ----- Original static data -----
  originalAllocation!: PortfolioAllocation;
  strategies: Strategy[] = [];

  // ----- Current displayed allocation (original or simulated) -----
  allocation!: PortfolioAllocation;

  // ----- UI state -----
  loading = true;
  error: string | null = null;

  // ----- Form model -----
  totalCapital = 0;
  cashReservePct = 0;
  optionBuyingPct = 0;
  optionSellingPct = 0;

  // ----- Table for per‑strategy percentages -----
  strategyRows: StrategyRow[] = [];
  displayedColumns: string[] = ['name', 'allocationPct'];
  dataSource = new MatTableDataSource<StrategyRow>([]);

  @ViewChild(MatSort) sort!: MatSort;

  // Chart data (same shape as AllocationsComponent uses)
  allocationChartData: any = { labels: [], datasets: [] };
  allocationChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right' },
      title: { display: true, text: 'Capital Allocation Split' },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const raw = ctx.raw as number;
            const total = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const pct = ((raw / total) * 100).toFixed(2);
            return `${ctx.label}: ₹${raw.toLocaleString('en-IN')} (${pct}%)`;
          },
        },
      },
    },
  };

  categoryChartData: any = { labels: [], datasets: [] };
  categoryChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'right' } },
  };

  // Summary cards – built on the fly (same structure as AllocationsComponent)
  summaryCards: any[] = [];

  constructor(
    private dataSvc: DataService,
    private rebalanceSvc: RebalanceService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Load original allocation JSON once
    this.dataSvc.getAllocation().subscribe({
      next: (alloc) => {
        this.originalAllocation = alloc;
        // If a previous simulation is stored, restore it; otherwise start with original
        const persisted = localStorage.getItem('rebalanceResult');
        if (persisted) {
          try {
            const parsed = JSON.parse(persisted) as { allocation: PortfolioAllocation };
            this.allocation = parsed.allocation;
          } catch {
            this.allocation = alloc;
          }
        } else {
          this.allocation = alloc;
        }
        this.initFormFromAllocation(this.allocation);
        this.buildSummaryCards();
        this.buildCharts();
        this.loadStrategies();
      },
      error: (e) => (this.error = `Failed to load allocation: ${e}`),
      complete: () => (this.loading = false),
    });
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
  }

  /** Populate UI controls from the supplied allocation */
  private initFormFromAllocation(alloc: PortfolioAllocation): void {
    this.totalCapital = alloc.total_capital_inr;
    this.cashReservePct = alloc.cash_reserve_percent;
    this.optionBuyingPct = alloc.option_buying_percent_of_total;
    this.optionSellingPct = alloc.option_selling_percent_of_total;

    // Build strategy rows based on the *deployed* capital portion
    const deployed =
      alloc.allocated_to_option_buying_inr + alloc.allocated_to_option_selling_inr;
    this.strategyRows = alloc.strategies.map((it) => ({
      name: it.strategy_info.name,
      allocationPct: deployed
        ? (it.allocated_capital_inr / deployed) * 100
        : 0,
    }));
    this.dataSource.data = this.strategyRows;
  }

  private loadStrategies(): void {
    this.dataSvc.getStrategies().subscribe((strats) => (this.strategies = strats));
  }

  /** Trigger re‑balancing using current UI values */
  onRebalance(): void {
    const input: RebalanceInput = {
      totalCapital: this.totalCapital,
      cashReservePct: this.cashReservePct,
      optionBuyingPct: this.optionBuyingPct,
      optionSellingPct: this.optionSellingPct,
      strategyAllocPct: this.strategyRows.reduce((acc, row) => {
        acc[row.name] = row.allocationPct;
        return acc;
      }, {} as Record<string, number>),
    };

    try {
      const result = this.rebalanceSvc.rebalance(this.originalAllocation, input);
      this.allocation = result.allocation;
      // Persist for page reloads
      localStorage.setItem('rebalanceResult', JSON.stringify(result));
      // Refresh UI helpers
      this.buildSummaryCards();
      this.buildCharts();
    } catch (e: any) {
      this.error = e.message;
    }
    this.cd.detectChanges();
  }

  // -----------------------------------------------------------------
  // Helper methods – copied/adapted from AllocationsComponent to keep UI
  // consistent. In a real code‑base we would extract these to a shared
  // service, but for this feature we duplicate them for simplicity.
  // -----------------------------------------------------------------
  private inr(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  }

  private buildSummaryCards(): void {
    const a = this.allocation;
    this.summaryCards = [
      {
        label: 'Total Capital',
        value: this.inr(a.total_capital_inr),
        subtext: 'Portfolio corpus',
        icon: 'account_balance_wallet',
        color: 'primary',
      },
      {
        label: 'Deployed Capital',
        value: this.inr(a.total_strategy_allocation_inr),
        subtext: `${a.deployed_percent_of_total}% of total`,
        icon: 'trending_up',
        color: 'accent',
      },
      {
        label: 'Cash Reserve',
        value: this.inr(a.cash_reserve_inr),
        subtext: `${a.cash_reserve_percent}% of total`,
        icon: 'savings',
        color: 'warn',
      },
      {
        label: 'Total Lots',
        value: a.total_lots_across_strategies.toString(),
        subtext: 'Across all strategies',
        icon: 'layers',
        color: 'primary',
      },
    ];
  }

  private buildCharts(): void {
    const a = this.allocation;
    // Capital split doughnut
    this.allocationChartData = {
      labels: ['Option Buying', 'Option Selling', 'Cash Reserve'],
      datasets: [
        {
          data: [a.allocated_to_option_buying_inr, a.allocated_to_option_selling_inr, a.cash_reserve_inr],
          backgroundColor: [
            'rgba(54, 162, 235, 0.8)',
            'rgba(75, 192, 192, 0.8)',
            'rgba(255, 206, 86, 0.8)',
          ],
          borderColor: [
            'rgba(54, 162, 235, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(255, 206, 86, 1)',
          ],
          borderWidth: 1,
        },
      ],
    };

    // Category pie chart – aggregate allocated capital by category
    const catMap = new Map<string, number>();
    a.strategies.forEach((it) => {
      const cur = catMap.get(it.strategy_info.category) ?? 0;
      catMap.set(it.strategy_info.category, cur + it.allocated_capital_inr);
    });
    const labels = Array.from(catMap.keys());
    const data = Array.from(catMap.values());
    this.categoryChartData = {
      labels,
      datasets: [
        {
          data,
          backgroundColor: labels.map((l) =>
            l.toLowerCase().includes('selling')
              ? 'rgba(75, 192, 192, 0.8)'
              : 'rgba(54, 162, 235, 0.8)'
          ),
          borderWidth: 1,
        },
      ],
    };
  }
}
