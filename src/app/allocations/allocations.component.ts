import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import {
  MatTableDataSource,
  MatTableModule,
} from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Subject, takeUntil } from 'rxjs';
import {
  Chart,
  DoughnutController,
  ArcElement,
  Tooltip,
  Legend,
  Title,
} from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { PortfolioAllocation, Strategy } from '../models';
import { DataService } from '../data.service';

Chart.register(DoughnutController, ArcElement, Tooltip, Legend, Title);

interface SummaryCard {
  label: string;
  value: string;
  subtext: string;
  icon: string;
  color: string;
}

interface AllocationRow {
  name: string;
  category: string;
  instrument: string;
  lots: number;
  capitalPerLot: number;
  allocatedCapital: number;
  allocationPercent: number;
  grossReturn: number;
  maxDrawdown: number;
  winRate: number;
  riskLevel: string;
}

@Component({
  selector: 'app-allocations',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatSortModule,
    MatIconModule,
    MatChipsModule,
    MatDividerModule,
    MatExpansionModule,
    MatProgressBarModule,
    BaseChartDirective,
  ],
  templateUrl: './allocations.component.html',
  styleUrl: './allocations.component.scss',
})
export class AllocationsComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  allocation: PortfolioAllocation | null = null;
  strategies: Strategy[] = [];
  loading = true;
  error: string | null = null;
  summaryCards: SummaryCard[] = [];

  displayedColumns: string[] = [
    'name',
    'category',
    'instrument',
    'lots',
    'capitalPerLot',
    'allocatedCapital',
    'allocationPercent',
    'grossReturn',
    'maxDrawdown',
    'winRate',
    'riskLevel',
  ];

  dataSource = new MatTableDataSource<AllocationRow>([]);

  @ViewChild(MatSort) sort!: MatSort;

  allocationChartData: any = { labels: [], datasets: [] };
  allocationChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right' },
      title: {
        display: true,
        text: 'Capital Allocation Split',
      },
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
    plugins: {
      legend: { position: 'right' },
      title: {
        display: true,
        text: 'Allocation by Strategy Category',
      },
    },
  };

  private destroy$ = new Subject<void>();

  constructor(
    private dataService: DataService,
    private changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.dataService
      .getEnrichedAllocation()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ allocation, strategyMap }) => {
          this.allocation = allocation;
          this.strategies = Array.from(strategyMap.values());
          this.buildSummaryCards(allocation);
          this.buildAllocationRows(allocation);
          this.buildCharts(allocation);
          this.loading = false;
          this.changeDetector.detectChanges();
          this.linkSort();
        },
        error: (err) => {
          this.error = 'Failed to load allocation data. ' + err.message;
          this.loading = false;
          this.changeDetector.detectChanges();
          this.linkSort();
        },
      });

    this.dataSource.sortingDataAccessor = (row, sortHeaderId) => {
      const value = (row as any)[sortHeaderId];
      return typeof value === 'string' ? value.toLowerCase() : value;
    };
  }

  ngAfterViewInit(): void {
    this.linkSort();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private linkSort(): void {
    if (this.sort && !this.dataSource.sort) {
      this.dataSource.sort = this.sort;
    }
  }

  private buildSummaryCards(allocation: PortfolioAllocation): void {
    this.summaryCards = [
      {
        label: 'Total Capital',
        value: this.inr(allocation.total_capital_inr),
        subtext: 'Portfolio corpus',
        icon: 'account_balance_wallet',
        color: 'primary',
      },
      {
        label: 'Deployed Capital',
        value: this.inr(allocation.total_strategy_allocation_inr),
        subtext: `${allocation.deployed_percent_of_total}% of total`,
        icon: 'trending_up',
        color: 'accent',
      },
      {
        label: 'Cash Reserve',
        value: this.inr(allocation.cash_reserve_inr),
        subtext: `${allocation.cash_reserve_percent}% of total`,
        icon: 'savings',
        color: 'warn',
      },
      {
        label: 'Total Lots',
        value: allocation.total_lots_across_strategies.toString(),
        subtext: 'Across all strategies',
        icon: 'layers',
        color: 'primary',
      },
    ];
  }

  private buildAllocationRows(allocation: PortfolioAllocation): void {
    const rows = allocation.strategies.map((item) => ({
      name: item.strategy_info.name,
      category: item.strategy_info.category,
      instrument: item.strategy_info.instrument,
      lots: item.number_of_lots,
      capitalPerLot: item.capital_per_lot_inr,
      allocatedCapital: item.allocated_capital_inr,
      allocationPercent: item.allocation_percent_of_total,
      grossReturn: item.historical_metrics_reference.gross_return_percent,
      maxDrawdown: item.historical_metrics_reference.max_drawdown_percent,
      winRate: item.historical_metrics_reference.win_rate_percent,
      riskLevel: item.strategy_info.risk_level,
    }));
    this.dataSource.data = rows;
  }

  private buildCharts(allocation: PortfolioAllocation): void {
    this.allocationChartData = {
      labels: [
        'Option Buying',
        'Option Selling',
        'Cash Reserve',
      ],
      datasets: [
        {
          data: [
            allocation.allocated_to_option_buying_inr,
            allocation.allocated_to_option_selling_inr,
            allocation.cash_reserve_inr,
          ],
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

    const categoryMap = new Map<string, number>();
    allocation.strategies.forEach((item) => {
      const current = categoryMap.get(item.strategy_info.category) || 0;
      categoryMap.set(
        item.strategy_info.category,
        current + item.allocated_capital_inr
      );
    });

    const labels = Array.from(categoryMap.keys());
    const data = Array.from(categoryMap.values());

    this.categoryChartData = {
      labels,
      datasets: [
        {
          data,
          backgroundColor: labels.map((l) =>
            l.includes('Selling')
              ? 'rgba(75, 192, 192, 0.8)'
              : 'rgba(54, 162, 235, 0.8)'
          ),
          borderWidth: 1,
        },
      ],
    };
  }

  private inr(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  }
}

