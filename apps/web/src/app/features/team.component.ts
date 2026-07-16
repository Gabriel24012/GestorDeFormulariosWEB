import { Component, OnInit, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import type { CapturerMember } from '../core/models';
import { apiErrorMessage } from '../core/api-errors';

const teamLabels: Record<string, string> = {
  full_name: 'nombre completo',
  email: 'correo',
  placeholder_name: 'nombre para identificar capturador'
};

@Component({
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <h1>Gestion de equipo</h1>

    @if (auth.profile()?.role === 'admin') {
      <section class="card">
        <h2>Nuevo Gestor</h2>
        <form [formGroup]="adminForm" (ngSubmit)="createManager()">
          <label>Nombre completo<input formControlName="full_name">@if(issue(adminForm, 'full_name')){<small class="field-error">{{issue(adminForm, 'full_name')}}</small>}</label>
          <label>Correo<input type="email" formControlName="email">@if(issue(adminForm, 'email')){<small class="field-error">{{issue(adminForm, 'email')}}</small>}</label>
          @if (adminForm.invalid) {<p class="form-hint">Completa: {{missingText(adminForm, ['full_name', 'email'])}}</p>}
          <button>Enviar invitacion</button>
        </form>
      </section>
    } @else {
      <section class="card">
        <h2>Nuevo Capturador</h2>
        <form [formGroup]="inviteForm" (ngSubmit)="createInviteLink()">
          <label>Nombre para identificar capturador<input formControlName="placeholder_name">@if(issue(inviteForm, 'placeholder_name')){<small class="field-error">{{issue(inviteForm, 'placeholder_name')}}</small>}</label>
          @if (inviteForm.invalid) {<p class="form-hint">Completa: {{missingText(inviteForm, ['placeholder_name'])}}</p>}
          <button>Generar link</button>
        </form>
        @if (generatedLink()) {
          <div class="copy-box">
            <input [value]="generatedLink()" readonly>
            <button type="button" class="secondary" (click)="copy(generatedLink())">Copiar link</button>
          </div>
        }
      </section>
    }

    @if (message()) {<p class="success">{{message()}}</p>}
    @if (error()) {<p class="error">{{error()}}</p>}

    <section class="card">
      <h2>Miembros</h2>
      <table>
        <thead><tr><th>Identificador</th><th>Nombre real</th><th>Correo</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          @for(item of members(); track item.id) {
            <tr>
              <td>{{item.placeholder_name || item.full_name || '-'}}</td>
              <td>{{item.kind === 'profile' ? item.full_name : '-'}}</td>
              <td>{{item.email || '-'}}</td>
              <td>{{item.status_label}}</td>
              <td>
                @if(item.kind === 'invite') {
                  <button class="secondary" (click)="copyPendingLink(item.id)">Copiar link</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </section>
  `
})
export class TeamComponent implements OnInit {
  readonly auth = inject(AuthService);
  private api = inject(ApiService);

  members = signal<CapturerMember[]>([]);
  generatedLink = signal('');
  message = signal('');
  error = signal('');

  inviteForm = new FormGroup({
    placeholder_name: new FormControl('', { nonNullable: true, validators: Validators.required })
  });

  adminForm = new FormGroup({
    full_name: new FormControl('', { nonNullable: true, validators: Validators.required }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] })
  });

  ngOnInit() {
    this.load();
  }

  load() {
    this.api.get<{data: CapturerMember[]}>(this.auth.profile()?.role === 'admin' ? '/gestores' : '/capturadores').subscribe({
      next: (response) => this.members.set(response.data),
      error: (e) => this.error.set(apiErrorMessage(e, teamLabels))
    });
  }

  createManager() {
    if (this.adminForm.invalid) {
      this.adminForm.markAllAsTouched();
      this.error.set('Revisa los campos marcados antes de enviar la invitacion.');
      return;
    }
    this.api.post('/gestores', this.adminForm.getRawValue()).subscribe({
      next: () => {
        this.error.set('');
        this.message.set('Invitacion enviada correctamente.');
        this.adminForm.reset();
        this.load();
      },
      error: (e) => this.error.set(apiErrorMessage(e, teamLabels))
    });
  }

  createInviteLink() {
    if (this.inviteForm.invalid) {
      this.inviteForm.markAllAsTouched();
      this.error.set('Escribe un nombre para identificar al capturador.');
      return;
    }
    this.api.post<{data: {link: string}}>('/capturadores/invite-links', this.inviteForm.getRawValue()).subscribe({
      next: (response) => {
        this.error.set('');
        this.generatedLink.set(response.data.link);
        this.message.set('Link generado correctamente.');
        this.inviteForm.reset();
        this.load();
      },
      error: (e) => this.error.set(apiErrorMessage(e, teamLabels))
    });
  }

  copyPendingLink(id: string) {
    this.api.post<{data: {link: string}}>(`/capturadores/${id}/resend-or-copy`, {}).subscribe({
      next: (response) => {
        this.error.set('');
        this.generatedLink.set(response.data.link);
        this.copy(response.data.link);
        this.message.set('Link copiado.');
      },
      error: (e) => this.error.set(apiErrorMessage(e, teamLabels))
    });
  }

  copy(value: string) {
    void navigator.clipboard?.writeText(value);
  }

  issue(form: FormGroup, field: string) {
    const control = form.get(field);
    if (!control?.invalid || (!control.touched && !control.dirty)) return '';
    if (control.errors?.['required']) return `${teamLabels[field]} es obligatorio.`;
    if (control.errors?.['email']) return 'Escribe un correo valido.';
    return `Revisa ${teamLabels[field] ?? field}.`;
  }

  missingText(form: FormGroup, fields: string[]) {
    return fields
      .filter((field) => form.get(field)?.invalid)
      .map((field) => teamLabels[field] ?? field)
      .join(', ');
  }
}
