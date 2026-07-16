import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
<header>
  <a routerLink="/" class="brand">
    <img src="/pan-logo.png" alt="PAN">
    <span>Gestion de Captura</span>
  </a>
  @if (auth.profile(); as p) {
    <p class="welcome">Bienvenido de nuevo {{p.full_name}}</p>
    <nav>
      @if (p.role === 'capturador') {<a routerLink="/captura" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">Captura</a>}
      @if (p.role === 'admin') {<a routerLink="/admin" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">Gestores</a><a routerLink="/admin/registros" routerLinkActive="active">Registros</a><a routerLink="/admin/metas" routerLinkActive="active">Metas</a>}
      @if (p.role === 'gestor') {<a routerLink="/gestor" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">Panel</a><a routerLink="/gestor/capturadores" routerLinkActive="active">Capturadores</a><a routerLink="/gestor/registros" routerLinkActive="active">Registros</a><a routerLink="/gestor/metas" routerLinkActive="active">Metas</a>}
      @if (p.role === 'admin') {<a routerLink="/equipo" routerLinkActive="active">Equipo</a>}
      <button (click)="logout()">Salir</button>
    </nav>
  }
</header>
@if (auth.sessionWarningVisible() && auth.profile()) {
  <section class="session-alert">
    <span>Tu sesion vence en {{auth.sessionMinutesRemaining()}} min.</span>
    <button (click)="extendSession()">Alargar sesion</button>
  </section>
}
<main><router-outlet/></main>`
})
export class AppComponent {
  readonly auth = inject(AuthService);

  async logout() {
    await this.auth.signOut();
    location.assign('/login');
  }

  async extendSession() {
    if (!(await this.auth.extendSession())) location.assign('/login');
  }
}
