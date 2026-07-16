import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import type { AppRole } from './models';

export const authGuard: CanActivateFn = () => inject(AuthService).profile() ? true : inject(Router).createUrlTree(['/login']);
export const roleGuard = (...roles: AppRole[]): CanActivateFn => () => { const profile = inject(AuthService).profile(); return profile && roles.includes(profile.role) ? true : inject(Router).createUrlTree(['/']); };
