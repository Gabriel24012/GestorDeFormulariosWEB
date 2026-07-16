import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards';
import { LoginComponent, ConfirmAccountComponent, InviteSignupComponent } from './features/login.component';
import { CaptureComponent } from './features/capture.component';
import { AdminDashboardComponent, ManagerDashboardComponent } from './features/dashboard.component';
import { TeamComponent } from './features/team.component';
import { ExportsComponent } from './features/exports.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'auth/confirm', component: ConfirmAccountComponent },
  { path: 'auth/invite/:token', component: InviteSignupComponent },
  { path: 'captura', component: CaptureComponent, canActivate: [authGuard, roleGuard('capturador')] },
  { path: 'admin', component: AdminDashboardComponent, canActivate: [authGuard, roleGuard('admin')] },
  { path: 'gestor', component: ManagerDashboardComponent, canActivate: [authGuard, roleGuard('gestor')] },
  { path: 'equipo', component: TeamComponent, canActivate: [authGuard, roleGuard('admin', 'gestor')] },
  { path: 'exportar', component: ExportsComponent, canActivate: [authGuard, roleGuard('admin', 'gestor')] },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' }
];
