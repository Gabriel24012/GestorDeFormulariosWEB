import { Component, HostListener, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
<header>
  <div class="header-main">
    <a routerLink="/" class="brand" (click)="closeMenu()">
      <img src="/pan-logo.png" alt="PAN">
      <span>Gestion de Captura</span>
    </a>
    @if (auth.profile()) {
      <button
        type="button"
        class="menu-toggle"
        [class.open]="menuOpen()"
        [attr.aria-expanded]="menuOpen()"
        aria-controls="main-navigation"
        aria-label="Abrir menu de navegacion"
        (click)="toggleMenu($event)"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>
    }
  </div>
  @if (auth.profile(); as p) {
    <div class="header-panel" [class.open]="menuOpen()">
      <p class="welcome">Bienvenido de nuevo {{p.full_name}}</p>
      <nav id="main-navigation">
        @if (p.role === 'capturador') {<a routerLink="/captura" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" (click)="closeMenu()">Captura</a>}
        @if (p.role === 'admin') {<a routerLink="/admin" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" (click)="closeMenu()">Gestores</a><a routerLink="/admin/registros" routerLinkActive="active" (click)="closeMenu()">Registros</a><a routerLink="/admin/metas" routerLinkActive="active" (click)="closeMenu()">Metas</a>}
        @if (p.role === 'gestor') {<a routerLink="/gestor" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" (click)="closeMenu()">Panel</a><a routerLink="/gestor/capturadores" routerLinkActive="active" (click)="closeMenu()">Capturadores</a><a routerLink="/gestor/registros" routerLinkActive="active" (click)="closeMenu()">Registros</a><a routerLink="/gestor/metas" routerLinkActive="active" (click)="closeMenu()">Metas</a>}
        @if (p.role === 'admin') {<a routerLink="/equipo" routerLinkActive="active" (click)="closeMenu()">Equipo</a>}
        <button (click)="logout()">Salir</button>
      </nav>
    </div>
  }
</header>
@if (auth.sessionWarningVisible() && auth.profile()) {
  <section class="session-alert">
    <span>Tu sesion vence en {{auth.sessionMinutesRemaining()}} min.</span>
    <button (click)="extendSession()">Alargar sesion</button>
  </section>
}
<main><router-outlet/></main>
<footer class="site-footer">
  <div>
    <strong>Gestion de Captura</strong>
    <span>Sistema interno de seguimiento y registros.</span>
  </div>
  <div>
    <span>© 2026</span>
    <span>Soporte: contacta a tu administrador.</span>
  </div>
</footer>`
})
export class AppComponent {
  readonly auth = inject(AuthService);
  readonly menuOpen = signal(false);

  @HostListener('document:click')
  closeMenu() {
    this.menuOpen.set(false);
  }

  toggleMenu(event: MouseEvent) {
    event.stopPropagation();
    this.menuOpen.update((open) => !open);
  }

  async logout() {
    this.closeMenu();
    await this.auth.signOut();
    location.assign('/login');
  }

  async extendSession() {
    if (!(await this.auth.extendSession())) location.assign('/login');
  }
}
