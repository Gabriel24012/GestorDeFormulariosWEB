import { Component, OnInit, inject, signal } from '@angular/core';
import { ApiService } from '../core/api.service';

@Component({ standalone: true, template: `<h1>Panel de administración</h1>@if(data()){<div class="stats"><article><strong>{{data()!.total_records}}</strong><span>Registros activos</span></article><article><strong>{{data()!.total_gestores}}</strong><span>Gestores</span></article></div><section class="card"><h2>Rendimiento por Gestor</h2><table><thead><tr><th>Gestor</th><th>Registros</th></tr></thead><tbody>@for (item of data()!.performance; track item.id) {<tr><td>{{item.full_name}}</td><td>{{item.records?.[0]?.count ?? 0}}</td></tr>}</tbody></table></section>}` })
export class AdminDashboardComponent implements OnInit { private api = inject(ApiService); data = signal<any>(null); ngOnInit() { this.api.get<{data:any}>('/dashboard/admin').subscribe(r => this.data.set(r.data)); } }

@Component({ standalone: true, template: `<h1>Panel de Gestor</h1>@if(data()){<div class="stats"><article><strong>{{data()!.total_records}}</strong><span>Registros de mi equipo</span></article><article><strong>{{data()!.total_capturadores}}</strong><span>Capturadores activos</span></article></div>}` })
export class ManagerDashboardComponent implements OnInit { private api = inject(ApiService); data = signal<any>(null); ngOnInit() { this.api.get<{data:any}>('/dashboard/gestor').subscribe(r => this.data.set(r.data)); } }
