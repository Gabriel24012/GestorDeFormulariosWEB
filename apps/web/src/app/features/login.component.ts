import { Component, OnInit, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ApiService } from '../core/api.service';
import { apiErrorMessage } from '../core/api-errors';

const accountLabels: Record<string, string> = {
  full_name: 'nombre completo',
  email: 'correo',
  password: 'contrasena'
};

@Component({
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `<section class="card login"><h1>Acceso al sistema</h1><p>Ingresa con tu cuenta asignada.</p><form [formGroup]="form" (ngSubmit)="submit()"><label>Correo<input type="email" formControlName="email">@if(issue('email')){<small class="field-error">{{issue('email')}}</small>}</label><label>Contrasena<input type="password" formControlName="password">@if(issue('password')){<small class="field-error">{{issue('password')}}</small>}</label>@if(form.invalid){<p class="form-hint">Completa correo y contrasena para entrar.</p>}@if(error()){<p class="error">{{error()}}</p>}<button>Entrar</button></form></section>`
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  error = signal('');
  form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  });

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Revisa los campos marcados antes de iniciar sesion.');
      return;
    }
    try {
      await this.auth.signIn(this.form.value.email!, this.form.value.password!);
      const role = this.auth.profile()?.role;
      await this.router.navigateByUrl(role === 'admin' ? '/admin' : role === 'gestor' ? '/gestor' : '/captura');
    } catch {
      this.error.set('No fue posible iniciar sesion. Verifica tus credenciales.');
    }
  }

  issue(field: string) {
    const control = this.form.get(field);
    if (!control?.invalid || (!control.touched && !control.dirty)) return '';
    if (control.errors?.['required']) return `${accountLabels[field]} es obligatorio.`;
    if (control.errors?.['email']) return 'Escribe un correo valido.';
    return `Revisa ${accountLabels[field]}.`;
  }
}

@Component({
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `<section class="card login"><h1>Crea tu contrasena</h1><p>Define una contrasena para activar tu cuenta.</p><form [formGroup]="form" (ngSubmit)="submit()"><label>Nueva contrasena<input type="password" formControlName="password" autocomplete="new-password">@if(issue('password')){<small class="field-error">{{issue('password')}}</small>}</label><label>Confirmar contrasena<input type="password" formControlName="confirm" autocomplete="new-password">@if(issue('confirm')){<small class="field-error">{{issue('confirm')}}</small>}</label>@if(form.invalid){<p class="form-hint">Completa y confirma tu contrasena.</p>}@if(error()){<p class="error">{{error()}}</p>}<button>Activar cuenta</button></form></section>`
})
export class ConfirmAccountComponent {
  private auth = inject(AuthService);
  private api = inject(ApiService);
  private router = inject(Router);
  error = signal('');
  form = new FormGroup({
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
    confirm: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  });

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Revisa los campos marcados para activar tu cuenta.');
      return;
    }
    if (this.form.value.password !== this.form.value.confirm) {
      this.error.set('Las contrasenas no coinciden.');
      return;
    }
    const { data: session } = await this.auth.supabase.auth.getSession();
    if (!session.session) {
      this.error.set('El enlace ya no es valido. Solicita una nueva invitacion.');
      return;
    }
    const { error } = await this.auth.supabase.auth.updateUser({ password: this.form.value.password! });
    if (error) {
      this.error.set(error.message);
      return;
    }
    this.api.post<{data: {role: string}}>('/auth/complete-onboarding', {}).subscribe({
      next: async (response) => {
        await this.auth.restore();
        await this.router.navigateByUrl(response.data.role === 'gestor' ? '/gestor' : response.data.role === 'admin' ? '/admin' : '/captura');
      },
      error: (e) => this.error.set(apiErrorMessage(e, accountLabels))
    });
  }

  issue(field: string) {
    const control = this.form.get(field);
    if (!control?.invalid || (!control.touched && !control.dirty)) return '';
    if (control.errors?.['required']) return `${field === 'confirm' ? 'confirmacion' : accountLabels[field]} es obligatoria.`;
    if (control.errors?.['minlength']) return 'La contrasena debe tener al menos 8 caracteres.';
    return `Revisa ${field}.`;
  }
}

@Component({
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="card login">
      <h1>Completa tu perfil</h1>
      @if(inviteInfo()) {<p>Alta para {{inviteInfo()!.manager_name || 'tu liderazgo'}}. Identificador: {{inviteInfo()!.placeholder_name}}</p>}
      <form [formGroup]="form" (ngSubmit)="submit()">
        <label>Nombre completo<input formControlName="full_name">@if(issue('full_name')){<small class="field-error">{{issue('full_name')}}</small>}</label>
        <label>Correo<input type="email" formControlName="email">@if(issue('email')){<small class="field-error">{{issue('email')}}</small>}</label>
        <label>Contrasena<input type="password" formControlName="password" autocomplete="new-password">@if(issue('password')){<small class="field-error">{{issue('password')}}</small>}</label>
        <label>Confirmar contrasena<input type="password" formControlName="confirm" autocomplete="new-password">@if(issue('confirm')){<small class="field-error">{{issue('confirm')}}</small>}</label>
        @if(form.invalid){<p class="form-hint">Completa nombre, correo y contrasena para crear la cuenta.</p>}
        @if(error()){<p class="error">{{error()}}</p>}
        <button>Crear cuenta</button>
      </form>
    </section>
  `
})
export class InviteSignupComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);
  error = signal('');
  inviteInfo = signal<{placeholder_name: string; manager_name: string | null} | null>(null);
  form = new FormGroup({
    full_name: new FormControl('', { nonNullable: true, validators: Validators.required }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
    confirm: new FormControl('', { nonNullable: true, validators: Validators.required })
  });

  ngOnInit() {
    const token = this.token();
    this.api.get<{data: {placeholder_name: string; manager_name: string | null}}>(`/invites/${token}`).subscribe({
      next: (response) => this.inviteInfo.set(response.data),
      error: (e) => this.error.set(apiErrorMessage(e, accountLabels))
    });
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Revisa los campos marcados para crear tu cuenta.');
      return;
    }
    if (this.form.value.password !== this.form.value.confirm) {
      this.error.set('Las contrasenas no coinciden.');
      return;
    }
    const { confirm: _confirm, ...body } = this.form.getRawValue();
    this.api.post(`/invites/${this.token()}/complete`, body).subscribe({
      next: async () => {
        await this.auth.signIn(body.email, body.password);
        await this.router.navigateByUrl('/captura');
      },
      error: (e) => this.error.set(apiErrorMessage(e, accountLabels))
    });
  }

  private token() {
    return this.route.snapshot.paramMap.get('token') ?? '';
  }

  issue(field: string) {
    const control = this.form.get(field);
    if (!control?.invalid || (!control.touched && !control.dirty)) return '';
    if (control.errors?.['required']) return `${field === 'confirm' ? 'confirmacion' : accountLabels[field]} es obligatorio.`;
    if (control.errors?.['email']) return 'Escribe un correo valido.';
    if (control.errors?.['minlength']) return 'La contrasena debe tener al menos 8 caracteres.';
    return `Revisa ${field}.`;
  }
}
