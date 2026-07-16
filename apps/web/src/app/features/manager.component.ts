import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import type { CapturerGoal, GoalPeriod, ManagerCapturerRow, ManagerOverview, ManagerRecordsResponse, RecordItem } from '../core/models';
import { apiErrorMessage } from '../core/api-errors';

const periodLabels: Record<GoalPeriod, string> = { daily: 'Diaria', weekly: 'Semanal', monthly: 'Mensual' };

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page-title"><h1>Panel del Gestor</h1><a routerLink="/gestor/registros">Ver registros</a></div>
    @if(data(); as d) {
      <div class="stats manager-stats">
        <article><strong>{{d.total_records}}</strong><span>Registros del equipo</span></article>
        <article class="period-summary">
          <strong>{{d.records_today}}</strong>
          <span>Capturados hoy</span>
          <div>
            <small>Semana: {{d.records_week}}</small>
            <small>Mes: {{d.records_month}}</small>
          </div>
        </article>
        @if(d.team_goal?.progress; as progress) {
          <article class="team-goal-summary">
            <strong>{{progress.count}} / {{progress.target}}</strong>
            <span>Meta grupal {{periodLabel(d.team_goal!.period_type)}}</span>
            <div class="progress"><span [style.width.%]="barWidth(progress.percentage)"></span></div>
            <small>{{progress.percentage}}% - {{progress.status}}</small>
          </article>
        }
      </div>

      <section class="split-grid">
        <article class="card">
          <h2>Ranking de capturadores</h2>
          <table>
            <thead><tr><th>Capturador</th><th>Registros</th><th>Ultima captura</th></tr></thead>
            <tbody>
              @for(item of d.ranking; track item.id) {
                <tr><td>{{item.full_name}}</td><td>{{item.total_records}}</td><td>{{item.last_record_at ? (item.last_record_at | date:'short') : 'Sin registros'}}</td></tr>
              } @empty { <tr><td colspan="3">Sin capturadores todavia.</td></tr> }
            </tbody>
          </table>
        </article>

        <article class="card">
          <h2>Ranking por zonas</h2>
          <table>
            <thead><tr><th>Zona</th><th>Registros</th></tr></thead>
            <tbody>
              @for(zone of d.top_zones; track zone.zone) {
                <tr><td>{{zone.zone}}</td><td>{{zone.total}}</td></tr>
              } @empty { <tr><td colspan="2">Sin zonas todavia.</td></tr> }
            </tbody>
          </table>
        </article>

        <article class="card">
          <h2>Alertas de inactividad</h2>
          <div class="alert-list">
            @for(item of d.inactive_alerts; track item.id) {
              <a class="alert-row" [routerLink]="['/gestor/capturadores', item.id]">
                <strong>{{item.full_name}}</strong>
                <span>{{item.last_record_at ? ('Ultima captura: ' + (item.last_record_at | date:'short')) : 'Sin registros capturados'}}</span>
              </a>
            } @empty { <p class="muted">No hay alertas por inactividad.</p> }
          </div>
        </article>
      </section>
    }
  `
})
export class ManagerDashboardComponent implements OnInit {
  private api = inject(ApiService);
  data = signal<ManagerOverview | null>(null);
  ngOnInit() { this.api.get<{data: ManagerOverview}>('/dashboard/gestor').subscribe((response) => this.data.set(response.data)); }
  periodLabel(period: GoalPeriod) { return periodLabels[period]; }
  barWidth(value: number) { return Math.min(value, 100); }
}

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page-title">
      <h1>Capturadores</h1>
      <div class="page-actions">
        <a routerLink="/gestor/capturadores/agregar">Agregar capturador</a>
        <a routerLink="/gestor/metas">Gestionar metas</a>
      </div>
    </div>
    <section class="card table-card">
      <table>
        <thead><tr><th>Nombre</th><th>Total de registros</th><th>Avance de meta</th><th></th></tr></thead>
        <tbody>
          @for(item of capturers(); track item.id) {
            <tr>
              <td>{{item.full_name || item.placeholder_name || '-'}}</td>
              <td>{{item.total_records}}</td>
              <td>
                @if(item.progress) {
                  <div class="progress"><span [style.width.%]="barWidth(item.progress.percentage)"></span></div>
                  <small>{{progressText(item.progress)}}</small>
                } @else { <span class="muted">Sin meta</span> }
              </td>
              <td><a class="button-link" [routerLink]="['/gestor/capturadores', item.id]">Ver detalle</a></td>
            </tr>
          } @empty { <tr><td colspan="4">No hay capturadores registrados.</td></tr> }
        </tbody>
      </table>
    </section>
  `
})
export class ManagerCapturersComponent implements OnInit {
  private api = inject(ApiService);
  capturers = signal<ManagerCapturerRow[]>([]);
  ngOnInit() { this.api.get<{data: ManagerCapturerRow[]}>('/manager/capturers').subscribe((response) => this.capturers.set(response.data)); }
  barWidth(value: number) { return Math.min(value, 100); }
  progressText(progress: NonNullable<ManagerCapturerRow['progress']>) { return `${progress.count} / ${progress.target} - ${progress.percentage}% - ${progress.status}`; }
}

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page-title"><h1>Registros del equipo</h1><div><button (click)="download('csv')" [disabled]="!total()">CSV filtrado</button><button class="secondary" (click)="download('xlsx')" [disabled]="!total()">Excel filtrado</button></div></div>
    <section class="card records-filter-card">
      <form class="filters records-filters" [formGroup]="filters" (ngSubmit)="search()">
        <label>Buscar<input formControlName="q" placeholder="Nombre, telefono, clave..."></label>
        <label>Capturador<select formControlName="capturer_id"><option value="">Todos</option>@for(c of capturers(); track c.id) {@if(c.kind === 'profile') {<option [value]="c.id">{{c.full_name}}</option>}}</select></label>
        <label>Desde<input type="date" formControlName="date_from"></label>
        <label>Hasta<input type="date" formControlName="date_to"></label>
        <label>Distrito<input formControlName="district"></label>
        <label>Fraccionamiento<input formControlName="neighborhood"></label>
        <label>C.P.<input formControlName="postal_code"></label>
        <label>Seccion<input formControlName="section_code"></label>
        <label>Estatus<select formControlName="status"><option value="">Todos</option><option value="active">Activo</option><option value="voided">Anulado</option></select></label>
        <label>Mostrar<select [value]="pageSize()" (change)="changePageSize($any($event.target).value)"><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></label>
        <button>Filtrar</button><button type="button" class="secondary" (click)="clear()">Limpiar</button>
      </form>
    </section>
    @if(editingRecord(); as record) {
      <section class="card">
        <div class="page-title">
          <h2>Editar registro</h2>
          <button type="button" class="secondary" (click)="cancelEdit()">Cerrar</button>
        </div>
        <p class="muted">Editando registro de {{record.capturer?.full_name || 'capturador'}}</p>
        <form [formGroup]="recordForm" (ngSubmit)="saveRecord()">
          <div class="grid">
            @for(field of recordFields; track field.key) {
              <label>
                {{field.label}}
                <input [type]="field.type" [formControlName]="field.key" [placeholder]="field.placeholder" [attr.min]="field.min" [attr.max]="field.max">
                @if(recordIssue(field.key)) {<small class="field-error">{{recordIssue(field.key)}}</small>}
              </label>
            }
            <label>Observaciones<textarea formControlName="observations"></textarea></label>
          </div>
          @if(recordMessage()) {<p class="success">{{recordMessage()}}</p>}
          @if(recordError()) {<p class="error">{{recordError()}}</p>}
          <div class="form-actions"><button>Guardar cambios</button></div>
        </form>
      </section>
    }
    <section class="card table-card records-table-card">
      <p class="muted">{{total()}} registros encontrados. Pagina {{currentPage()}} de {{totalPages()}}</p>
      <div class="records-table-scroll">
        <table class="records-table">
          <thead><tr><th>Fecha</th><th>Capturador</th><th>Nombre</th><th>Telefono</th><th>Clave</th><th>Domicilio</th><th>No. EXT</th><th>Fracc.</th><th>Distrito</th><th>C.P.</th><th>Obs.</th></tr></thead>
          <tbody>
            @for(record of records(); track record.id) {
              <tr class="clickable-row" [class.active]="editingRecord()?.id === record.id" (click)="editRecord(record)">
                <td>{{record.created_at | date:'short'}}</td>
                <td>{{record.capturer?.full_name || '-'}}</td>
                <td>{{record.first_name}} {{record.paternal_surname}} {{record.maternal_surname || ''}}</td>
                <td>{{record.phone}}</td>
                <td>{{record.electoral_key}}</td>
                <td>{{record.address}}</td>
                <td>{{record.exterior_number || '-'}}</td>
                <td>{{record.neighborhood || '-'}}</td>
                <td>{{record.district || '-'}}</td>
                <td>{{record.postal_code || '-'}}</td>
                <td>{{record.observations || '-'}}</td>
              </tr>
            } @empty { <tr><td colspan="11">No hay registros con esos filtros.</td></tr> }
          </tbody>
        </table>
      </div>
      <div class="pagination"><button class="secondary" (click)="previousPage()" [disabled]="currentPage() === 1">Anterior</button><button class="secondary" (click)="nextPage()" [disabled]="currentPage() >= totalPages()">Siguiente</button></div>
    </section>
  `
})
export class ManagerRecordsComponent implements OnInit {
  private api = inject(ApiService);
  capturers = signal<ManagerCapturerRow[]>([]);
  records = signal<RecordItem[]>([]);
  editingRecord = signal<RecordItem | null>(null);
  recordMessage = signal('');
  recordError = signal('');
  total = signal(0);
  currentPage = signal(1);
  pageSize = signal(10);
  totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  filters = new FormGroup({
    q: new FormControl(''), capturer_id: new FormControl(''), date_from: new FormControl(''), date_to: new FormControl(''),
    district: new FormControl(''), neighborhood: new FormControl(''), postal_code: new FormControl(''), section_code: new FormControl(''), status: new FormControl('')
  });
  readonly minBirthDate = this.isoDateYearsAgo(120);
  readonly maxBirthDate = this.todayIsoDate();
  recordForm = new FormGroup({
    first_name: new FormControl('', { nonNullable: true, validators: Validators.required }),
    paternal_surname: new FormControl('', { nonNullable: true, validators: Validators.required }),
    maternal_surname: new FormControl(''),
    address: new FormControl('', { nonNullable: true, validators: Validators.required }),
    exterior_number: new FormControl(''),
    neighborhood: new FormControl(''),
    district: new FormControl(''),
    postal_code: new FormControl('', { nonNullable: true, validators: Validators.pattern(/^\d{5}$/) }),
    birth_date: new FormControl('', { nonNullable: true, validators: [Validators.required, this.birthDateValidator.bind(this)] }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^\d{10}$/)] }),
    electoral_key: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^[A-Za-z0-9]{18}$/)] }),
    observations: new FormControl('')
  });
  recordFields = [
    {key: 'first_name', label: 'Nombre', type: 'text', placeholder: ''},
    {key: 'paternal_surname', label: 'Apellido paterno', type: 'text', placeholder: ''},
    {key: 'maternal_surname', label: 'Apellido materno', type: 'text', placeholder: ''},
    {key: 'address', label: 'Domicilio', type: 'text', placeholder: ''},
    {key: 'exterior_number', label: 'No. EXT', type: 'text', placeholder: ''},
    {key: 'neighborhood', label: 'Fraccionamiento', type: 'text', placeholder: ''},
    {key: 'district', label: 'Distrito', type: 'text', placeholder: ''},
    {key: 'postal_code', label: 'C.P.', type: 'text', placeholder: '5 digitos'},
    {key: 'birth_date', label: 'Fecha de nacimiento', type: 'date', placeholder: '', min: this.minBirthDate, max: this.maxBirthDate},
    {key: 'phone', label: 'Telefono', type: 'tel', placeholder: '10 digitos'},
    {key: 'electoral_key', label: 'Clave electoral', type: 'text', placeholder: '18 caracteres'}
  ];
  private recordLabels: Record<string, string> = {
    first_name: 'nombre',
    paternal_surname: 'apellido paterno',
    address: 'domicilio',
    postal_code: 'C.P.',
    birth_date: 'fecha de nacimiento',
    phone: 'telefono',
    electoral_key: 'clave electoral'
  };
  ngOnInit() {
    this.api.get<{data: ManagerCapturerRow[]}>('/manager/capturers').subscribe((response) => this.capturers.set(response.data));
    this.load();
  }
  search() { this.currentPage.set(1); this.load(); }
  clear() { this.filters.reset(); this.currentPage.set(1); this.load(); }
  changePageSize(value: string) { this.pageSize.set(Number(value)); this.currentPage.set(1); this.load(); }
  previousPage() { if (this.currentPage() > 1) { this.currentPage.update((page) => page - 1); this.load(); } }
  nextPage() { if (this.currentPage() < this.totalPages()) { this.currentPage.update((page) => page + 1); this.load(); } }
  editRecord(record: RecordItem) {
    this.editingRecord.set(record);
    this.recordMessage.set('');
    this.recordError.set('');
    this.recordForm.reset({
      first_name: this.stringValue(record['first_name']),
      paternal_surname: this.stringValue(record['paternal_surname']),
      maternal_surname: this.stringValue(record['maternal_surname']),
      address: this.stringValue(record['address']),
      exterior_number: this.stringValue(record['exterior_number']),
      neighborhood: this.stringValue(record['neighborhood']),
      district: this.stringValue(record['district']),
      postal_code: this.stringValue(record['postal_code']),
      birth_date: this.inputDate(this.stringValue(record['birth_date'])),
      phone: this.stringValue(record['phone']),
      electoral_key: this.stringValue(record['electoral_key']),
      observations: this.stringValue(record['observations'])
    });
  }
  cancelEdit() {
    this.editingRecord.set(null);
    this.recordMessage.set('');
    this.recordError.set('');
  }
  saveRecord() {
    const current = this.editingRecord();
    if (!current) return;
    if (this.recordForm.invalid) {
      this.recordForm.markAllAsTouched();
      this.recordError.set('Revisa los campos marcados antes de guardar.');
      return;
    }
    const value = this.recordForm.getRawValue();
    this.api.patch<{data: RecordItem}>(`/records/${current.id}`, { ...value, electoral_key: value.electoral_key.toUpperCase() }).subscribe({
      next: (response) => {
        this.recordError.set('');
        this.recordMessage.set('Registro actualizado correctamente.');
        this.editingRecord.set(response.data);
        this.load();
      },
      error: (e) => this.recordError.set(apiErrorMessage(e, this.recordLabels))
    });
  }
  recordIssue(key: string) {
    const control = this.recordForm.get(key);
    if (!control?.invalid || (!control.touched && !control.dirty)) return '';
    const label = this.recordLabels[key] ?? key;
    if (control.errors?.['required']) return `${label} es obligatorio.`;
    if (control.errors?.['birthDateRange']) return `fecha debe estar entre ${this.displayDate(this.minBirthDate)} y ${this.displayDate(this.maxBirthDate)}.`;
    if (control.errors?.['pattern']) return this.patternMessage(key);
    return `Revisa ${label}.`;
  }
  download(format: 'csv'|'xlsx') {
    this.api.download(`/exports/records?${queryString(this.params({ format }))}`).subscribe((blob) => saveBlob(blob, `registros-equipo.${format}`));
  }
  private load() {
    this.api.get<ManagerRecordsResponse>('/manager/records', this.params({ page: this.currentPage(), limit: this.pageSize() })).subscribe((response) => {
      this.records.set(response.data);
      this.total.set(response.meta.total);
    });
  }
  private params(extra: Record<string, string | number> = {}) {
    return cleanParams({ ...this.filters.getRawValue(), ...extra });
  }
  private stringValue(value: unknown) { return value ? String(value) : ''; }
  private inputDate(value: string) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      const [day, month, year] = value.split('/');
      return `${year}-${month}-${day}`;
    }
    return value;
  }
  private displayDate(value: string) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-');
      return `${day}/${month}/${year}`;
    }
    return value;
  }
  private birthDateValidator(control: AbstractControl<string>): ValidationErrors | null {
    const value = control.value;
    if (!value) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { birthDateRange: true };
    if (!this.isRealIsoDate(value)) return { birthDateRange: true };
    return value >= this.minBirthDate && value <= this.maxBirthDate ? null : { birthDateRange: true };
  }
  private todayIsoDate() {
    const today = new Date();
    return this.formatIsoDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
  }
  private isoDateYearsAgo(years: number) {
    const today = new Date();
    return this.formatIsoDate(today.getFullYear() - years, today.getMonth() + 1, today.getDate());
  }
  private isRealIsoDate(value: string) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }
  private formatIsoDate(year: number, month: number, day: number) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  private patternMessage(key: string) {
    if (key === 'postal_code') return 'C.P. debe tener 5 digitos';
    if (key === 'phone') return 'telefono debe tener 10 digitos';
    if (key === 'electoral_key') return 'clave electoral debe tener 18 letras o numeros';
    return 'formato invalido';
  }
}

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page-title"><h1>Metas</h1></div>
    <section class="card">
      <h2>{{editingId() ? 'Actualizar meta' : 'Nueva meta'}}</h2>
      <form class="filters goal-form" [formGroup]="form" (ngSubmit)="save()">
        <label>Alcance<select formControlName="capturer_id"><option value="">Selecciona alcance</option><option value="team">Todo el equipo</option>@for(c of capturers(); track c.id) {@if(c.kind === 'profile') {<option [value]="c.id">{{c.full_name}}</option>}}</select></label>
        <label>Periodo<select formControlName="period_type"><option value="daily">Diaria</option><option value="weekly">Semanal</option><option value="monthly">Mensual</option></select></label>
        <label>Meta<input type="number" min="1" formControlName="target_count"></label>
        <label>Inicio<input type="date" formControlName="starts_on"></label>
        <label>Final<input type="date" formControlName="ends_on"></label>
        <div class="form-actions goal-actions">
          <button>{{editingId() ? 'Guardar nueva version' : 'Crear meta'}}</button>
          @if(editingId()) {<button type="button" class="secondary" (click)="cancelEdit()">Cancelar</button>}
        </div>
      </form>
      @if(message()) {<p class="success">{{message()}}</p>}
      @if(error()) {<p class="error">{{error()}}</p>}
    </section>
    <section class="goals-sections">
      <article class="card table-card goals-table-card"><h2>Metas vigentes</h2><ng-container *ngTemplateOutlet="goalsTable; context: {$implicit: active()}"></ng-container></article>
      <article class="card table-card goals-table-card"><h2>Historial</h2><ng-container *ngTemplateOutlet="goalsTable; context: {$implicit: history()}"></ng-container></article>
    </section>
    <ng-template #goalsTable let-items>
      <table class="goals-table"><thead><tr><th>Alcance</th><th>Periodo</th><th>Meta</th><th>Vigencia</th><th>Avance</th><th></th></tr></thead><tbody>
        @for(goal of items; track goal.id) {
          <tr><td>{{goalTargetText(goal)}}</td><td>{{periodLabel(goal.period_type)}}</td><td>{{goal.target_count}}</td><td><span class="date-range">{{goal.starts_on}}<small>a</small>{{goal.ends_on}}</span></td><td><div class="progress"><span [style.width.%]="barWidth(goal.progress?.percentage || 0)"></span></div><small>{{goalProgressText(goal)}}</small></td><td><div class="row-actions">@if(goal.status === 'active' && !goal.archived_at) {<button class="secondary" (click)="edit(goal)">Editar</button>}<button type="button" class="danger" (click)="deleteGoal(goal)">Eliminar</button></div></td></tr>
        } @empty { <tr><td colspan="6">Sin metas.</td></tr> }
      </tbody></table>
    </ng-template>
  `
})
export class ManagerGoalsComponent implements OnInit {
  private api = inject(ApiService);
  capturers = signal<ManagerCapturerRow[]>([]);
  active = signal<CapturerGoal[]>([]);
  history = signal<CapturerGoal[]>([]);
  editingId = signal('');
  message = signal('');
  error = signal('');
  form = new FormGroup({
    capturer_id: new FormControl('', { nonNullable: true, validators: Validators.required }),
    period_type: new FormControl<GoalPeriod>('weekly', { nonNullable: true, validators: Validators.required }),
    target_count: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    starts_on: new FormControl(localDateInputValue(), { nonNullable: true, validators: Validators.required }),
    ends_on: new FormControl('')
  });
  ngOnInit() {
    this.api.get<{data: ManagerCapturerRow[]}>('/manager/capturers').subscribe((response) => this.capturers.set(response.data));
    this.load();
  }
  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); this.error.set('Completa alcance, periodo, meta e inicio.'); return; }
    const request = this.editingId() ? this.api.patch(`/manager/goals/${this.editingId()}`, this.goalPayload()) : this.api.post('/manager/goals', this.goalPayload());
    request.subscribe({ next: () => { this.message.set('Meta guardada correctamente.'); this.error.set(''); this.cancelEdit(); this.load(); }, error: (e) => this.error.set(apiErrorMessage(e)) });
  }
  edit(goal: CapturerGoal) {
    this.editingId.set(goal.id);
    this.form.reset({ capturer_id: goal.capturer_id ?? 'team', period_type: goal.period_type, target_count: goal.target_count, starts_on: goal.starts_on, ends_on: goal.ends_on });
  }
  cancelEdit() { this.editingId.set(''); this.form.reset({ capturer_id: '', period_type: 'weekly', target_count: 1, starts_on: localDateInputValue(), ends_on: '' }); }
  deleteGoal(goal: CapturerGoal) {
    if (!window.confirm(`Eliminar la meta de ${this.goalTargetText(goal)}? Esta accion no se puede deshacer.`)) return;
    this.api.delete<void>(`/manager/goals/${goal.id}`).subscribe({
      next: () => { this.message.set('Meta eliminada correctamente.'); this.error.set(''); this.load(); },
      error: (e) => this.error.set(apiErrorMessage(e))
    });
  }
  load() { this.api.get<{data: {active: CapturerGoal[]; history: CapturerGoal[]}}>('/manager/goals').subscribe((response) => { this.active.set(response.data.active); this.history.set(response.data.history); }); }
  periodLabel(period: GoalPeriod) { return periodLabels[period]; }
  barWidth(value: number) { return Math.min(value, 100); }
  goalTargetText(goal: CapturerGoal) { return goal.capturer_id ? (goal.capturer?.full_name || '-') : 'Todo el equipo'; }
  goalProgressText(goal: CapturerGoal) {
    return goal.progress ? `${goal.progress.count} / ${goal.progress.target} - ${goal.progress.percentage}% - ${goal.progress.status}` : '0 / 0 - 0% - -';
  }
  private goalPayload() {
    const value = this.form.getRawValue();
    return { ...value, capturer_id: value.capturer_id === 'team' ? null : value.capturer_id };
  }
}

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <a routerLink="/gestor/capturadores">Volver a capturadores</a>
    @if(detail(); as d) {
      <section class="card">
        <div class="page-title">
          <div><h1>{{d.capturer?.full_name || d.invite?.placeholder_name}}</h1><p class="muted">{{d.capturer?.email || 'Invitacion pendiente'}}</p></div>
          @if(d.can_resend_invite && d.kind === 'invite') {<button (click)="copyPendingLink(d.invite.id)">Copiar enlace</button>}
        </div>
        <div class="stats">
          <article><strong>{{d.total_records}}</strong><span>Total capturado</span></article>
          <article><strong>{{d.current_goal?.progress?.count || 0}} / {{d.current_goal?.progress?.target || 0}}</strong><span>Meta individual</span></article>
          @if(d.team_goal?.progress; as teamProgress) {
            <article class="team-goal-summary">
              <strong>{{teamProgress.count}} / {{teamProgress.target}}</strong>
              <span>Aporte a meta grupal</span>
              <div class="progress"><span [style.width.%]="barWidth(teamProgress.percentage)"></span></div>
              <small>{{teamProgress.percentage}}% - {{teamProgress.status}}</small>
            </article>
          }
        </div>
      </section>
      <section class="split-grid">
        <article class="card"><h2>Registros recientes</h2><div class="record-list">@for(record of d.recent_records; track record.id) {<div class="record-row"><strong>{{record.first_name}} {{record.paternal_surname}}</strong><span>{{record.phone}}</span><small>{{record.created_at | date:'short'}}</small></div>} @empty {<p class="muted">Sin registros recientes.</p>}</div></article>
        <article class="card"><h2>Zonas principales</h2><table><thead><tr><th>Zona</th><th>Registros</th></tr></thead><tbody>@for(zone of d.top_zones; track zone.zone) {<tr><td>{{zone.zone}}</td><td>{{zone.total}}</td></tr>} @empty {<tr><td colspan="2">Sin zonas todavia.</td></tr>}</tbody></table></article>
      </section>
    }
    @if(message()) {<p class="success">{{message()}}</p>}
    @if(error()) {<p class="error">{{error()}}</p>}
  `
})
export class ManagerCapturerDetailComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  detail = signal<any>(null);
  message = signal('');
  error = signal('');
  ngOnInit() { this.load(); }
  barWidth(value: number) { return Math.min(value, 100); }
  load() {
    this.api.get<{data: any}>(`/manager/capturers/${this.route.snapshot.paramMap.get('id')}`).subscribe({ next: (response) => this.detail.set(response.data), error: (e) => this.error.set(apiErrorMessage(e)) });
  }
  copyPendingLink(id: string) {
    this.api.post<{data: {link: string}}>(`/capturadores/${id}/resend-or-copy`, {}).subscribe({ next: (response) => { void navigator.clipboard?.writeText(response.data.link); this.message.set('Link copiado.'); }, error: (e) => this.error.set(apiErrorMessage(e)) });
  }
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
