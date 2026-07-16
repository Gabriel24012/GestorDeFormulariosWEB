import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';

@Component({ selector: 'app-root', standalone: true, imports: [RouterOutlet, RouterLink], template: `
<header><a routerLink="/" class="brand">Gestión de Captura</a>@if (auth.profile(); as p) { <nav>@if (p.role === 'capturador') {<a routerLink="/captura">Captura</a>} @if (p.role === 'admin') {<a routerLink="/admin">Panel</a>} @if (p.role === 'gestor') {<a routerLink="/gestor">Panel</a>} @if (p.role !== 'capturador') {<a routerLink="/equipo">Equipo</a><a routerLink="/exportar">Exportar</a>} <button (click)="logout()">Salir</button></nav>}</header><main><router-outlet/></main>` })
export class AppComponent { readonly auth = inject(AuthService); async logout() { await this.auth.signOut(); location.assign('/login'); } }
