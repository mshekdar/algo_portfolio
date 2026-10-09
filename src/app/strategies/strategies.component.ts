import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Subject, takeUntil } from 'rxjs';
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  ScatterController,
  PointElement,
} from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { Strategy } from '../models';
import { DataService } from '../data.service';

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  ScatterController,
  PointElement
);

interface StrategyRow {
  name: string;
  provider: string;
  instrument: string;
  category: string;
  marketBias: string;
  riskLevel: string;
  recommendedCapital: number;
  deployedUsers: number;
  grossReturn: number;
  maxDrawdown: number;
  profitFactor: number;
  winRate: number;
  totalTrades: number;
  avgMonthlyReturn: number;
  strategy: Strategy;
}

@Component({
  selector: 'app-strategies',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressBarModule,
    BaseChartDirective,
  ],
  templateUrl: './strategies.component.html',
  styleUrl: './strategies.component.scss',
})
export class StrategiesComponent implements OnInit, AfterViewInit, OnDestroy {
  displayedColumns: string[] = [
    'name',
    'instrument',
    'category',
    'marketBias',
    'riskLevel',
    'recommendedCapital',
    'deployedUsers',
    'grossReturn',
    'maxDrawdown',
  ];

  dataSource = new MatTableDataSource<StrategyRow>([]);
  strategies: Strategy[] = [];
  loading = true;
  error: string | null = null;

  categoryFilter = '';
  riskFilter = '';
  biasFilter = '';
  searchTerm = '';

  categories: string[] = [];
  riskLevels: string[] = [];
  marketBiases: string[] = [];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  private destroy$ = new Subject<void>();

  returnChartData: any = { labels: [], datasets: [] };
  returnChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Gross Return % by Strategy' },
      tooltip: {
        callbacks: {
          label: (ctx: any) => `${ctx.raw}%`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Gross Return %' },
      },
    },
  };

  riskReturnChartData: any = { datasets: [] };
  riskReturnChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: 'Return % vs Max Drawdown %',
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) =>
            `${ctx.raw.strategy}: Return ${ctx.raw.x}%, Drawdown ${ctx.raw.y}%`,
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'Gross Return %' },
      },
      y: {
        title: { display: true, text: 'Max Drawdown %' },
      },
    },
  };

  constructor(
    private dataService: DataService,
    private changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.dataService
      .getStrategies()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (strategies) => {
          this.strategies = strategies;
          this.categories = this.uniqueValues(
            strategies.map((s) => s.strategy_info.category)
          );
          this.riskLevels = this.uniqueValues(
            strategies.map((s) => s.strategy_info.risk_level)
          );
          this.marketBiases = this.uniqueValues(
            strategies.map((s) => s.strategy_info.market_bias)
          );
          this.dataSource.data = strategies.map((s) => this.toRow(s));
          this.updateCharts();
          this.loading = false;
          this.changeDetector.detectChanges();
          this.linkTableHelpers();
        },
        error: (err) => {
          this.error = 'Failed to load strategies. ' + err.message;
          this.loading = false;
          this.changeDetector.detectChanges();
          this.linkTableHelpers();
        },
      });

    this.dataSource.filterPredicate = (row, filter) => {
      const filters = JSON.parse(filter);
      const matchesSearch = !filters.search
        ? true
        : row.name.toLowerCase().includes(filters.search.toLowerCase()) ||
          row.instrument.toLowerCase().includes(filters.search.toLowerCase());
      const matchesCategory = !filters.category
        ? true
        : row.category === filters.category;
      const matchesRisk = !filters.risk ? true : row.riskLevel === filters.risk;
      const matchesBias = !filters.bias
        ? true
        : row.marketBias === filters.bias;
      return matchesSearch && matchesCategory && matchesRisk && matchesBias;
    };

    this.dataSource.sortingDataAccessor = (row, sortHeaderId) => {
      const value = (row as any)[sortHeaderId];
      return typeof value === 'string' ? value.toLowerCase() : value;
    };
  }

  ngAfterViewInit(): void {
    this.linkTableHelpers();
  }

  private linkTableHelpers(): void {
    if (this.paginator && !this.dataSource.paginator) {
      this.dataSource.paginator = this.paginator;
    }
    if (this.sort && !this.dataSource.sort) {
      this.dataSource.sort = this.sort;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  applyFilters(): void {
    this.dataSource.filter = JSON.stringify({
      search: this.searchTerm,
      category: this.categoryFilter,
      risk: this.riskFilter,
      bias: this.biasFilter,
    });
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.categoryFilter = '';
    this.riskFilter = '';
    this.biasFilter = '';
    this.applyFilters();
  }

  private toRow(strategy: Strategy): StrategyRow {
    const info = strategy.strategy_info;
    const backtest = strategy.backtest_overview;
    const trade = strategy.trade_performance;
    return {
      name: info.name,
      provider: info.provider,
      instrument: info.instrument,
      category: info.category,
      marketBias: info.market_bias,
      riskLevel: info.risk_level,
      recommendedCapital: info.recommended_capital_inr,
      deployedUsers: info.deployed_users,
      grossReturn: backtest.gross_return_percent,
      maxDrawdown: backtest.risk_metrics.max_drawdown_percent,
      profitFactor: backtest.risk_metrics.profit_factor,
      winRate: trade.win_rate_percent,
      totalTrades: trade.total_trades,
      avgMonthlyReturn: backtest.average_monthly_return_percent,
      strategy,
    };
  }

  private uniqueValues(values: string[]): string[] {
    return Array.from(new Set(values)).sort();
  }

  private updateCharts(): void {
    const sorted = [...this.dataSource.filteredData].sort(
      (a, b) => b.grossReturn - a.grossReturn
    );

    this.returnChartData = {
      labels: sorted.map((r) => r.name),
      datasets: [
        {
          label: 'Gross Return %',
          data: sorted.map((r) => r.grossReturn),
          backgroundColor: sorted.map((r) =>
            r.category.includes('Selling')
              ? 'rgba(75, 192, 192, 0.7)'
              : 'rgba(54, 162, 235, 0.7)'
          ),
          borderColor: sorted.map((r) =>
            r.category.includes('Selling')
              ? 'rgba(75, 192, 192, 1)'
              : 'rgba(54, 162, 235, 1)'
          ),
          borderWidth: 1,
        },
      ],
    };

    this.riskReturnChartData = {
      datasets: [
        {
          label: 'Strategies',
          data: this.strategies.map((s) => ({
            x: s.backtest_overview.gross_return_percent,
            y: s.backtest_overview.risk_metrics.max_drawdown_percent,
            strategy: s.strategy_info.name,
            category: s.strategy_info.category,
          })),
          backgroundColor: this.strategies.map((s) =>
            s.strategy_info.category.includes('Selling')
              ? 'rgba(75, 192, 192, 0.7)'
              : 'rgba(255, 99, 132, 0.7)'
          ),
          pointRadius: 6,
        },
      ],
    };
  }
}

