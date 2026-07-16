import { Injectable, signal } from '@angular/core';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import type { Profile } from './models';

const SESSION_DURATION_MS = 2 * 60 * 60 * 1000;
const SESSION_WARNING_MS = 10 * 60 * 1000;
const SESSION_EXPIRES_AT_KEY = 'gestion-captura-session-expires-at';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly supabase = createClient(environment.supabaseUrl, environment.supabasePublishableKey);
  readonly profile = signal<Profile | null>(null);
  readonly ready = signal(false);
  readonly sessionWarningVisible = signal(false);
  readonly sessionExpiresAt = signal<number | null>(null);
  private warningTimer: ReturnType<typeof setTimeout> | null = null;
  private expirationTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() { void this.restore(); this.supabase.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') this.clearSessionState(); else void this.restore(); }); }
  async restore() {
    const { data } = await this.supabase.auth.getSession();
    if (!data.session) { this.clearSessionState(); this.ready.set(true); return; }
    if (!this.ensureSessionWindow()) { await this.signOut(); this.ready.set(true); return; }
    try {
      const response = await fetch(`${environment.apiUrl}/auth/me`, { headers: { Authorization: `Bearer ${data.session.access_token}` } });
      this.profile.set(response.ok ? (await response.json()).data : null);
    } catch {
      this.profile.set(null);
    } finally {
      this.ready.set(true);
    }
  }
  async signIn(email: string, password: string) { const { error } = await this.supabase.auth.signInWithPassword({ email, password }); if (error) throw error; this.extendLocalSession(); await this.restore(); }
  async signOut() { await this.supabase.auth.signOut(); this.clearSessionState(); }
  async accessToken() { const { data } = await this.supabase.auth.getSession(); return data.session?.access_token ?? null; }
  async extendSession() {
    const { data, error } = await this.supabase.auth.refreshSession();
    if (error || !data.session) { await this.signOut(); return false; }
    this.extendLocalSession();
    await this.restore();
    return true;
  }
  sessionMinutesRemaining() {
    const expiresAt = this.sessionExpiresAt();
    return expiresAt ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 60000)) : 0;
  }
  private ensureSessionWindow() {
    const stored = Number(localStorage.getItem(SESSION_EXPIRES_AT_KEY));
    if (!stored) { this.extendLocalSession(); return true; }
    if (stored <= Date.now()) return false;
    this.sessionExpiresAt.set(stored);
    this.scheduleSessionTimers(stored);
    return true;
  }
  private extendLocalSession() {
    const expiresAt = Date.now() + SESSION_DURATION_MS;
    localStorage.setItem(SESSION_EXPIRES_AT_KEY, String(expiresAt));
    this.sessionExpiresAt.set(expiresAt);
    this.sessionWarningVisible.set(false);
    this.scheduleSessionTimers(expiresAt);
  }
  private scheduleSessionTimers(expiresAt: number) {
    if (this.warningTimer) clearTimeout(this.warningTimer);
    if (this.expirationTimer) clearTimeout(this.expirationTimer);
    const warningDelay = Math.max(0, expiresAt - Date.now() - SESSION_WARNING_MS);
    const expirationDelay = Math.max(0, expiresAt - Date.now());
    this.warningTimer = setTimeout(() => this.sessionWarningVisible.set(true), warningDelay);
    this.expirationTimer = setTimeout(() => void this.signOut(), expirationDelay);
  }
  private clearSessionState() {
    if (this.warningTimer) clearTimeout(this.warningTimer);
    if (this.expirationTimer) clearTimeout(this.expirationTimer);
    this.warningTimer = null;
    this.expirationTimer = null;
    localStorage.removeItem(SESSION_EXPIRES_AT_KEY);
    this.profile.set(null);
    this.sessionExpiresAt.set(null);
    this.sessionWarningVisible.set(false);
  }
}
