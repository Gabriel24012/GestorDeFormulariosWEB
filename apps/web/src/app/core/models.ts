export type AppRole = 'admin' | 'gestor' | 'capturador';
export interface Profile { id: string; email: string; full_name: string; role: AppRole; parent_user_id: string | null; is_active: boolean; onboarding_completed_at?: string | null; }
export interface CaptureSession { id: string; leadership_name: string; section_code: string; status: 'open' | 'closed'; created_at: string; }
export interface RecordItem { id: string; capture_session_id: string; leadership_name: string; section_code: string; first_name: string; paternal_surname: string; phone: string; electoral_key: string; [key: string]: unknown; }
