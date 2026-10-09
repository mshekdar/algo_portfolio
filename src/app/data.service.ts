import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, map, Observable, switchMap } from 'rxjs';
import {
  AllocationItem,
  EnrichedAllocationItem,
  PortfolioAllocation,
  Strategy,
  StrategiesIndex,
} from './models';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private readonly dataBase = 'data';

  constructor(private http: HttpClient) {}

  getStrategies(): Observable<Strategy[]> {
    return this.http
      .get<StrategiesIndex>(`${this.dataBase}/strategies-index.json`)
      .pipe(
        switchMap((index) =>
          forkJoin(
            index.files.map((path) =>
              this.http.get<Strategy>(`${path}?_=${Date.now()}`)
            )
          )
        ),
        map((strategies) =>
          strategies.sort((a, b) =>
            a.strategy_info.name.localeCompare(b.strategy_info.name)
          )
        )
      );
  }

  getAllocation(): Observable<PortfolioAllocation> {
    return this.http.get<PortfolioAllocation>(
      `${this.dataBase}/Allocation/balanced_portfolio_30_lakh.json`
    );
  }

  getEnrichedAllocation(): Observable<{
    allocation: PortfolioAllocation;
    strategyMap: Map<string, Strategy>;
  }> {
    return forkJoin([this.getAllocation(), this.getStrategies()]).pipe(
      map(([allocation, strategies]) => {
        const strategyMap = new Map<string, Strategy>();
        strategies.forEach((s) =>
          strategyMap.set(s.strategy_info.name, s)
        );
        return { allocation, strategyMap };
      })
    );
  }

  enrichAllocationItems(
    items: AllocationItem[],
    strategyMap: Map<string, Strategy>
  ): EnrichedAllocationItem[] {
    return items.map((item) => ({
      ...item,
      full_strategy: strategyMap.get(item.strategy_info.name),
    }));
  }
}
