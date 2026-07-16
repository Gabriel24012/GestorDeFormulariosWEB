import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiService } from '../core/api.service';
import type { GoalPeriod, ManagerRecordsResponse, RecordItem } from '../core/models';
import { apiErrorMessage } from '../core/api-errors';

const periodLabels: Record<GoalPeriod, string> = { daily: 'Diaria', weekly: 'Semanal', monthly: 'Mensual' };

interface AdminManagerRow {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  total_capturadores: number;
  capturadores_activos: number;
  total_records: number;
  active_goals: number;
  active_goals_list?: AdminGoal[];
  main_goal?: AdminGoal | null;
  last_activity_at: string | null;
}

interface AdminGoal {
  id: string;
  period_type: GoalPeriod;
  target_count: number;
  starts_on: string;
  ends_on: string;
  created_by_role?: 'admin' | 'gestor';
  progress?: { count: number; target: number; percentage: number; status: string };
}

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="page-title"><h1>Gestores</h1><a routerLink="/equipo">Agregar gestor</a></div>
    @if(loading()) {
      <section class="card"><div class="request-placeholder"><span class="skeleton-line"></span><span class="skeleton-line skeleton-short"></span></div></section>
    } @else {
      <div class="stats manager-stats">
        <article><strong>{{totalRecords()}}</strong><span>Registros activos</span></article>
        <article><strong>{{managers().length}}</strong><span>Gestores</span></article>
        <article><strong>{{activeManagers()}}</strong><span>Gestores activos</span></article>
      </div>
      <section class="card table-card">
        <table>
          <thead><tr><th>Gestor</th><th>Capturadores</th><th>Registros</th><th>Meta principal</th><th>Ultimo movimiento</th><th></th></tr></thead>
          <tbody>
            @for(manager of managers(); track manager.id) {
              <tr>
                <td><strong>{{manager.full_name}}</strong><br><small class="muted">{{manager.email}}</small></td>
                <td>{{manager.capturadores_activos}} / {{manager.total_capturadores}}</td>
                <td>{{manager.total_records}}</td>
                <td>
                  @if(manager.main_goal; as goal) {
                    <span class="goal-pill" [class.admin-goal]="goal.created_by_role === 'admin'">{{goal.progress?.count || 0}} / {{goal.target_count}}</span>
                    <div class="progress"><span [style.width.%]="barWidth(goal.progress?.percentage || 0)"></span></div>
                  } @else { <span class="muted">Sin meta</span> }
                </td>
                <td>{{dateTimeText(manager.last_activity_at)}}</td>
                <td><a class="button-link" [routerLink]="['/admin/gestores', manager.id]">Ver detalle</a></td>
              </tr>
            } @empty { <tr><td colspan="6">No hay gestores registrados.</td></tr> }
          </tbody>
        </table>
      </section>
    }
  `
})
export class AdminDashboardComponent implements OnInit {
  private api = inject(ApiService);
  managers = signal<AdminManagerRow[]>([]);
  loading = signal(true);
  totalRecords = computed(() => this.managers().reduce((sum, manager) => sum + manager.total_records, 0));
  activeManagers = computed(() => this.managers().filter((manager) => manager.is_active).length);
  ngOnInit() {
    this.api.get<{data: AdminManagerRow[]}>('/admin/managers').pipe(finalize(() => this.loading.set(false))).subscribe((response) => this.managers.set(response.data));
  }
  barWidth(value: number) { return Math.min(value, 100); }
  dateTimeText(value: unknown) { return formatDateTimeText(value); }
}

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <a routerLink="/admin">Volver a gestores</a>
    @if(detail(); as d) {
      <section class="card">
        <div class="page-title">
          <div><h1>{{d.manager.full_name}}</h1><p class="muted">{{d.manager.email}}</p></div>
          <a routerLink="/admin/registros" [queryParams]="{manager_id: d.manager.id}">Ver registros</a>
        </div>
        <div class="stats manager-stats">
          <article><strong>{{d.total_records}}</strong><span>Registros</span></article>
          <article><strong>{{d.total_capturadores}}</strong><span>Capturadores</span></article>
          <article><strong>{{d.active_goals}}</strong><span>Metas activas</span></article>
        </div>
      </section>
      <section class="card table-card goals-list-card">
        <div class="page-title"><h2>Metas del gestor</h2></div>
        @if(editingGoalId()) {
          <form class="filters goal-form" [formGroup]="goalForm" (ngSubmit)="saveGoal()">
            <label>Periodo<select formControlName="period_type"><option value="daily">Diaria</option><option value="weekly">Semanal</option><option value="monthly">Mensual</option></select></label>
            <label>Meta de registros<input type="number" min="1" formControlName="target_count"></label>
            <label>Inicio<input type="date" formControlName="starts_on"></label>
            <label>Final<input type="date" formControlName="ends_on"></label>
            <div class="form-actions goal-actions"><button [disabled]="goalSaving()">{{goalSaving() ? 'Guardando...' : 'Guardar cambios'}}</button><button type="button" class="secondary" (click)="cancelGoalEdit()">Cancelar</button></div>
          </form>
        }
        @if(goalMessage()) {<p class="success">{{goalMessage()}}</p>}
        @if(goalError()) {<p class="error">{{goalError()}}</p>}
        <table>
          <thead><tr><th>Origen</th><th>Periodo</th><th>Vigencia</th><th>Avance</th><th></th></tr></thead>
          <tbody>
            @for(goal of d.active_goals_list || []; track goal.id) {
              <tr [class.admin-goal-row]="goal.created_by_role === 'admin'">
                <td><span class="goal-pill" [class.admin-goal]="goal.created_by_role === 'admin'">{{goal.created_by_role === 'admin' ? 'Admin' : 'Gestor'}}</span></td>
                <td>{{periodLabel(goal.period_type)}} - {{goal.target_count}} registros</td>
                <td><span class="date-range">{{dateText(goal.starts_on)}}<small>a</small>{{dateText(goal.ends_on)}}</span></td>
                <td><div class="progress"><span [style.width.%]="barWidth(goal.progress?.percentage || 0)"></span></div><small>{{goal.progress?.count || 0}} / {{goal.target_count}} - {{goal.progress?.percentage || 0}}%</small></td>
                <td><div class="row-actions"><button class="secondary action-button" (click)="editGoal(goal)">Editar</button><button class="danger action-button" (click)="deleteGoal(goal)">Eliminar</button></div></td>
              </tr>
            } @empty {<tr><td colspan="5">Sin metas activas.</td></tr>}
          </tbody>
        </table>
      </section>
      <section class="split-grid">
        <article class="card">
          <h2>Ranking de capturadores</h2>
          <table><thead><tr><th>Capturador</th><th>Registros</th><th>Última captura</th></tr></thead><tbody>
            @for(item of d.ranking; track item.id) {
              <tr><td>{{item.full_name}}</td><td>{{item.total_records}}</td><td>{{dateTimeText(item.last_record_at)}}</td></tr>
            } @empty { <tr><td colspan="3">Sin capturadores.</td></tr> }
          </tbody></table>
        </article>
        <article class="card">
          <h2>Zonas principales</h2>
          <table><thead><tr><th>Zona</th><th>Registros</th></tr></thead><tbody>
            @for(zone of d.top_zones; track zone.zone) {<tr><td>{{zone.zone}}</td><td>{{zone.total}}</td></tr>}
            @empty {<tr><td colspan="2">Sin zonas.</td></tr>}
          </tbody></table>
        </article>
      </section>
    }
  `
})
export class AdminManagerDetailComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  detail = signal<any>(null);
  editingGoalId = signal('');
  goalSaving = signal(false);
  goalMessage = signal('');
  goalError = signal('');
  goalForm = new FormGroup({
    period_type: new FormControl<GoalPeriod>('weekly', { nonNullable: true, validators: Validators.required }),
    target_count: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    starts_on: new FormControl(localDateInputValue(), { nonNullable: true, validators: Validators.required }),
    ends_on: new FormControl('', { nonNullable: true, validators: Validators.required })
  });
  ngOnInit() {
    this.load();
  }
  periodLabel(period: GoalPeriod) { return periodLabels[period]; }
  barWidth(value: number) { return Math.min(value, 100); }
  dateText(value: string | null | undefined) { return formatDateText(value); }
  dateTimeText(value: string | null | undefined) { return formatDateTimeText(value); }
  editGoal(goal: AdminGoal) {
    this.editingGoalId.set(goal.id);
    this.goalError.set('');
    this.goalMessage.set('');
    this.goalForm.reset({ period_type: goal.period_type, target_count: goal.target_count, starts_on: goal.starts_on, ends_on: goal.ends_on });
  }
  cancelGoalEdit() {
    this.editingGoalId.set('');
    this.goalForm.reset({ period_type: 'weekly', target_count: 1, starts_on: localDateInputValue(), ends_on: '' });
  }
  saveGoal() {
    if (this.goalForm.invalid) {
      this.goalForm.markAllAsTouched();
      this.goalError.set('Completa periodo, meta, inicio y final.');
      return;
    }
    this.goalSaving.set(true);
    this.api.patch(`/admin/manager-goals/${this.editingGoalId()}`, this.goalForm.getRawValue()).pipe(finalize(() => this.goalSaving.set(false))).subscribe({
      next: () => { this.goalMessage.set('Meta actualizada correctamente.'); this.cancelGoalEdit(); this.load(); },
      error: (e) => this.goalError.set(apiErrorMessage(e))
    });
  }
  deleteGoal(goal: AdminGoal) {
    if (!window.confirm('Eliminar esta meta?')) return;
    this.api.delete(`/admin/manager-goals/${goal.id}`).subscribe({
      next: () => { this.goalMessage.set('Meta eliminada correctamente.'); this.load(); },
      error: (e) => this.goalError.set(apiErrorMessage(e))
    });
  }
  private load() {
    this.api.get<{data: any}>(`/admin/managers/${this.route.snapshot.paramMap.get('id')}`).subscribe((response) => this.detail.set(response.data));
  }
}

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page-title"><h1>Registros globales</h1><div><button (click)="download('csv')" [disabled]="!total()">CSV filtrado</button><button class="secondary" (click)="download('xlsx')" [disabled]="!total()">Excel filtrado</button></div></div>
    <section class="card records-filter-card">
      <form class="filters records-filters" [formGroup]="filters" (ngSubmit)="search()">
        <label>Buscar<input formControlName="q" placeholder="Nombre, teléfono, Clave Electoral o domicilio..."></label>
        <label>Gestor<select formControlName="manager_id"><option value="">Todos</option>@for(manager of managers(); track manager.id) {<option [value]="manager.id">{{manager.full_name}}</option>}</select></label>
        <label>Desde<input type="date" formControlName="date_from"></label>
        <label>Hasta<input type="date" formControlName="date_to"></label>
        <label>Domicilio<select formControlName="address"><option value="">{{filterOptionsLoading() ? 'Cargando domicilios...' : 'Todos'}}</option>@for(option of filterOptions().addresses; track option) {<option [value]="option">{{option}}</option>}</select></label>
        <label>Distrito<select formControlName="district"><option value="">{{filterOptionsLoading() ? 'Cargando distritos...' : 'Todos'}}</option>@for(option of filterOptions().districts; track option) {<option [value]="option">{{option}}</option>}</select></label>
        <label>Fraccionamiento<select formControlName="neighborhood"><option value="">{{filterOptionsLoading() ? 'Cargando fraccionamientos...' : 'Todos'}}</option>@for(option of filterOptions().neighborhoods; track option) {<option [value]="option">{{option}}</option>}</select></label>
        <label>C.P.<select formControlName="postal_code"><option value="">{{filterOptionsLoading() ? 'Cargando C.P....' : 'Todos'}}</option>@for(option of filterOptions().postal_codes; track option) {<option [value]="option">{{option}}</option>}</select></label>
        <label>Mostrar<select [value]="pageSize()" (change)="changePageSize($any($event.target).value)"><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></label>
        <button>Filtrar</button><button type="button" class="secondary" (click)="clear()">Limpiar</button>
      </form>
    </section>
    <section class="card table-card records-table-card">
      <p class="muted">{{total()}} registros encontrados. Página {{currentPage()}} de {{totalPages()}}</p>
      <div class="records-table-scroll">
        <table class="records-table">
          <thead><tr><th>Fecha</th><th>Gestor</th><th>Capturador</th><th>Nombre</th><th>Teléfono</th><th>Clave Electoral</th><th>Fracc.</th><th>Distrito</th><th>C.P.</th></tr></thead>
          <tbody>
            @for(record of records(); track record.id) {
              <tr><td>{{dateTimeText(record.created_at)}}</td><td>{{record.manager?.full_name || '-'}}</td><td>{{record.capturer?.full_name || '-'}}</td><td>{{record.first_name}} {{record.paternal_surname}} {{record.maternal_surname || ''}}</td><td>{{record.phone}}</td><td>{{record.electoral_key}}</td><td>{{record.neighborhood || '-'}}</td><td>{{record.district || '-'}}</td><td>{{record.postal_code || '-'}}</td></tr>
            } @empty {<tr><td colspan="9">No hay registros con esos filtros.</td></tr>}
          </tbody>
        </table>
      </div>
      <div class="pagination"><button class="secondary" (click)="previousPage()" [disabled]="currentPage() === 1">Anterior</button><button class="secondary" (click)="nextPage()" [disabled]="currentPage() >= totalPages()">Siguiente</button></div>
    </section>
  `
})
export class AdminRecordsComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  managers = signal<AdminManagerRow[]>([]);
  records = signal<RecordItem[]>([]);
  filterOptionsLoading = signal(true);
  filterOptions = signal<{addresses: string[]; districts: string[]; neighborhoods: string[]; postal_codes: string[]}>({ addresses: [], districts: [], neighborhoods: [], postal_codes: [] });
  total = signal(0);
  currentPage = signal(1);
  pageSize = signal(10);
  totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  filters = new FormGroup({
    q: new FormControl(''), manager_id: new FormControl(''), date_from: new FormControl(''), date_to: new FormControl(''),
    address: new FormControl(''), district: new FormControl(''), neighborhood: new FormControl(''), postal_code: new FormControl('')
  });
  ngOnInit() {
    this.api.get<{data: AdminManagerRow[]}>('/admin/managers').subscribe((response) => this.managers.set(response.data));
    this.loadFilterOptions();
    const managerId = this.route.snapshot.queryParamMap.get('manager_id');
    if (managerId) this.filters.patchValue({ manager_id: managerId });
    this.load();
  }
  search() { this.currentPage.set(1); this.load(); }
  clear() { this.filters.reset(); this.currentPage.set(1); this.load(); }
  changePageSize(value: string) { this.pageSize.set(Number(value)); this.currentPage.set(1); this.load(); }
  previousPage() { if (this.currentPage() > 1) { this.currentPage.update((page) => page - 1); this.load(); } }
  nextPage() { if (this.currentPage() < this.totalPages()) { this.currentPage.update((page) => page + 1); this.load(); } }
  download(format: 'csv'|'xlsx') {
    this.api.download(`/exports/records?${queryString(cleanParams({ ...this.filters.getRawValue(), format }))}`).subscribe((blob) => saveBlob(blob, `registros-globales.${format}`));
  }
  dateTimeText(value: unknown) { return formatDateTimeText(value); }
  private loadFilterOptions() {
    this.filterOptionsLoading.set(true);
    this.api.get<{data: {addresses: string[]; districts: string[]; neighborhoods: string[]; postal_codes: string[]}}>('/admin/record-filter-options').pipe(finalize(() => this.filterOptionsLoading.set(false))).subscribe((response) => this.filterOptions.set(response.data));
  }
  private load() {
    this.api.get<ManagerRecordsResponse>('/admin/records', cleanParams({ ...this.filters.getRawValue(), page: this.currentPage(), limit: this.pageSize() })).subscribe((response) => {
      this.records.set(response.data);
      this.total.set(response.meta.total);
    });
  }
}

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page-title"><h1>Metas de gestores</h1></div>
    <section class="card">
      <h2>{{editingGoalId() ? 'Editar meta' : 'Nueva meta'}}</h2>
      <form class="filters goal-form" [formGroup]="form" (ngSubmit)="save()">
        <label>Gestor<select formControlName="capturer_id" [disabled]="!!editingGoalId()"><option value="">Selecciona gestor</option>@for(manager of managers(); track manager.id) {<option [value]="manager.id">{{manager.full_name}}</option>}</select></label>
        <label>Periodo<select formControlName="period_type"><option value="daily">Diaria</option><option value="weekly">Semanal</option><option value="monthly">Mensual</option></select></label>
        <label>Meta de registros<input type="number" min="1" formControlName="target_count"></label>
        <label>Inicio<input type="date" formControlName="starts_on"></label>
        <label>Final<input type="date" formControlName="ends_on"></label>
        <div class="form-actions goal-actions"><button [disabled]="saving()">{{saving() ? 'Guardando...' : editingGoalId() ? 'Guardar cambios' : 'Guardar meta'}}</button>@if(editingGoalId()) {<button type="button" class="secondary" (click)="cancelEdit()">Cancelar</button>}</div>
      </form>
      @if(message()) {<p class="success">{{message()}}</p>}
      @if(error()) {<p class="error">{{error()}}</p>}
    </section>
    <section class="card table-card goals-list-card">
      <h2>Metas activas</h2>
      <table>
        <thead><tr><th>Gestor</th><th>Origen</th><th>Periodo</th><th>Vigencia</th><th>Avance</th><th></th></tr></thead>
        <tbody>
          @for(manager of managers(); track manager.id) {
            @for(goal of manager.active_goals_list || []; track goal.id) {
              <tr [class.admin-goal-row]="goal.created_by_role === 'admin'">
                <td>{{manager.full_name}}</td>
                <td><span class="goal-pill" [class.admin-goal]="goal.created_by_role === 'admin'">{{goal.created_by_role === 'admin' ? 'Admin' : 'Gestor'}}</span></td>
                <td>{{periodLabel(goal.period_type)}} - {{goal.target_count}} registros</td>
                <td><span class="date-range">{{dateText(goal.starts_on)}}<small>a</small>{{dateText(goal.ends_on)}}</span></td>
                <td><div class="progress"><span [style.width.%]="barWidth(goal.progress?.percentage || 0)"></span></div><small>{{goal.progress?.count || 0}} / {{goal.target_count}} - {{goal.progress?.percentage || 0}}%</small></td>
                <td><div class="row-actions"><button class="secondary action-button" (click)="editGoal(manager.id, goal)">Editar</button><button class="danger action-button" (click)="deleteGoal(goal)">Eliminar</button></div></td>
              </tr>
            }
          } @empty {<tr><td colspan="6">No hay gestores.</td></tr>}
        </tbody>
      </table>
    </section>
  `
})
export class AdminManagerGoalsComponent implements OnInit {
  private api = inject(ApiService);
  managers = signal<AdminManagerRow[]>([]);
  saving = signal(false);
  editingGoalId = signal('');
  message = signal('');
  error = signal('');
  form = new FormGroup({
    capturer_id: new FormControl('', { nonNullable: true, validators: Validators.required }),
    period_type: new FormControl<GoalPeriod>('weekly', { nonNullable: true, validators: Validators.required }),
    target_count: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    starts_on: new FormControl(localDateInputValue(), { nonNullable: true, validators: Validators.required }),
    ends_on: new FormControl('', { nonNullable: true, validators: Validators.required })
  });
  ngOnInit() { this.loadManagers(); }
  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Selecciona gestor, meta, inicio y final.');
      return;
    }
    this.saving.set(true);
    this.message.set('');
    this.error.set('');
    const request = this.editingGoalId()
      ? this.api.patch(`/admin/manager-goals/${this.editingGoalId()}`, this.form.getRawValue())
      : this.api.post('/admin/manager-goals', this.form.getRawValue());
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.message.set(this.editingGoalId() ? 'Meta actualizada correctamente.' : 'Meta guardada correctamente.');
        this.cancelEdit();
        this.loadManagers();
      },
      error: (e) => this.error.set(apiErrorMessage(e))
    });
  }
  editGoal(managerId: string, goal: AdminGoal) {
    this.editingGoalId.set(goal.id);
    this.message.set('');
    this.error.set('');
    this.form.reset({ capturer_id: managerId, period_type: goal.period_type, target_count: goal.target_count, starts_on: goal.starts_on, ends_on: goal.ends_on });
  }
  cancelEdit() {
    this.editingGoalId.set('');
    this.form.reset({ capturer_id: '', period_type: 'weekly', target_count: 1, starts_on: localDateInputValue(), ends_on: '' });
  }
  deleteGoal(goal: AdminGoal) {
    if (!window.confirm('Eliminar esta meta?')) return;
    this.api.delete(`/admin/manager-goals/${goal.id}`).subscribe({
      next: () => { this.message.set('Meta eliminada correctamente.'); this.loadManagers(); },
      error: (e) => this.error.set(apiErrorMessage(e))
    });
  }
  private loadManagers() {
    this.api.get<{data: AdminManagerRow[]}>('/admin/managers').subscribe((response) => this.managers.set(response.data));
  }
  periodLabel(period: GoalPeriod) { return periodLabels[period]; }
  barWidth(value: number) { return Math.min(value, 100); }
  dateText(value: string | null | undefined) { return formatDateText(value); }
}

function cleanParams(values: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== null && value !== undefined && value !== '')) as Record<string, string | number>;
}

function queryString(values: Record<string, string | number>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => params.set(key, String(value)));
  return params.toString();
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function localDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateText(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return compactDateText(date);
}

function formatDateTimeText(value: unknown) {
  if (!value) return 'Sin registros';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  const time = new Intl.DateTimeFormat('es-MX', { hour: 'numeric', minute: '2-digit' }).format(date);
  return `${compactDateText(date)}, ${time}`;
}

function compactDateText(date: Date) {
  const parts = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).formatToParts(date);
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  return `${day}/${month}/${year}`;
}
