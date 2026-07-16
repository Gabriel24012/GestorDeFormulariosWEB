import { Injectable, signal } from '@angular/core';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import type { Profile } from './models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly supabase = createClient(environment.supabaseUrl, environment.supabasePublishableKey);
  readonly profile = signal<Profile | null>(null);
  readonly ready = signal(false);

  constructor() { void this.restore(); this.supabase.auth.onAuthStateChange(() => void this.restore()); }
  async restore() { const { data } = await this.supabase.auth.getSession(); if (!data.session) { this.profile.set(null); this.ready.set(true); return; } try { const response = await fetch(`${environment.apiUrl}/auth/me`, { headers: { Authorization: `Bearer ${data.session.access_token}` } }); this.profile.set(response.ok ? (await response.json()).data : null); } finally { this.ready.set(true); } }
  async signIn(email: string, password: string) { const { error } = await this.supabase.auth.signInWithPassword({ email, password }); if (error) throw error; await this.restore(); }
  async signOut() { await this.supabase.auth.signOut(); this.profile.set(null); }
  async accessToken() { const { data } = await this.supabase.auth.getSession(); return data.session?.access_token ?? null; }
}
