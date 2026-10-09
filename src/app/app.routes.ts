import { Routes } from '@angular/router';
import { AllocationsComponent } from './allocations/allocations.component';
import { StrategiesComponent } from './strategies/strategies.component';

export const routes: Routes = [
  { path: '', redirectTo: '/allocations', pathMatch: 'full' },
  { path: 'allocations', component: AllocationsComponent },
  { path: 'strategies', component: StrategiesComponent },
  { path: '**', redirectTo: '/allocations' },
];
