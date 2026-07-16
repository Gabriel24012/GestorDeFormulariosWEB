import { Router } from 'express';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { serviceDb } from '../lib/supabase.js';
import { env } from '../config/env.js';
import { accountPatchSchema, accountSchema, idParam, recordPatchSchema, recordSchema, sessionSchema, toIsoDate } from '../lib/validation.js';

const router = Router();
router.use(authenticate);

router.get('/auth/me', (req, res) => res.json({ data: req.auth!.profile }));
router.post('/auth/complete-onboarding', async (req, res, next) => {
  try {
    const { data, error } = await serviceDb.from('profiles')
      .update({ is_active: true, onboarding_completed_at: new Date().toISOString() })
      .eq('id', req.auth!.profile.id)
      .select('id,email,full_name,role,parent_user_id,is_active,onboarding_completed_at')
      .single();
    if (error) throw error;
    await audit(req.auth!.profile.id, 'profile', req.auth!.profile.id, 'complete_onboarding');
    res.json({ data });
  } catch (e) { next(e); }
});

router.get('/gestores', authorize('admin'), async (_req, res, next) => {
  try { const { data, error } = await serviceDb.from('profiles').select('*').eq('role', 'gestor').order('full_name'); if (error) throw error; res.json({ data }); } catch (e) { next(e); }
});

router.post('/gestores', authorize('admin'), async (req, res, next) => {
  try {
    const body = accountSchema.parse(req.body); const actor = req.auth!.profile;
    const { data: invited, error: inviteError } = await serviceDb.auth.admin.inviteUserByEmail(body.email, { redirectTo: `${process.env.APP_URL}/auth/confirm` });
    if (inviteError || !invited.user) throw inviteError ?? new Error('No se pudo invitar al usuario.');
    const { data, error } = await serviceDb.from('profiles').insert({ id: invited.user.id, email: body.email.toLowerCase(), full_name: body.full_name, role: 'gestor', parent_user_id: actor.id, is_active: false }).select().single();
    if (error) throw error; await audit(actor.id, 'profile', data.id, 'invite_gestor'); res.status(201).json({ data });
  } catch (e) { next(e); }
});

router.patch('/gestores/:id', authorize('admin'), async (req, res, next) => {
  try { const { id } = idParam.parse(req.params); const body = accountPatchSchema.parse(req.body); const { data, error } = await serviceDb.from('profiles').update(body).eq('id', id).eq('role', 'gestor').select().single(); if (error) throw error; await audit(req.auth!.profile.id, 'profile', id, 'update_gestor'); res.json({ data }); } catch (e) { next(e); }
});
router.post('/gestores/:id/resend-invitation', authorize('admin'), async (req, res, next) => {
  try { const { id } = idParam.parse(req.params); const { data, error } = await serviceDb.from('profiles').select('email,onboarding_completed_at').eq('id', id).eq('role', 'gestor').single(); if (error) throw error; if (data.onboarding_completed_at) return res.status(422).json({ error: 'La cuenta ya fue creada.' }); await sendActivationLink(data.email); await audit(req.auth!.profile.id, 'profile', id, 'resend_invitation'); res.status(204).end(); } catch (e) { next(e); }
});

router.get('/capturadores', authorize('admin', 'gestor'), async (req, res, next) => {
  try { let query = serviceDb.from('profiles').select('*').eq('role', 'capturador').order('full_name'); if (req.auth!.profile.role === 'gestor') query = query.eq('parent_user_id', req.auth!.profile.id); const { data, error } = await query; if (error) throw error; res.json({ data }); } catch (e) { next(e); }
});

router.post('/capturadores', authorize('admin', 'gestor'), async (req, res, next) => {
  try {
    const body = accountSchema.parse(req.body); const actor = req.auth!.profile; const managerId = actor.role === 'gestor' ? actor.id : body.manager_id;
    if (!managerId) return res.status(422).json({ error: 'Un Admin debe indicar el Gestor responsable.' });
    const { data: manager, error: managerError } = await serviceDb.from('profiles').select('id').eq('id', managerId).eq('role', 'gestor').eq('is_active', true).single();
    if (managerError || !manager) return res.status(422).json({ error: 'Gestor responsable inválido.' });
    const { data: invited, error: inviteError } = await serviceDb.auth.admin.inviteUserByEmail(body.email, { redirectTo: `${process.env.APP_URL}/auth/confirm` });
    if (inviteError || !invited.user) throw inviteError ?? new Error('No se pudo invitar al usuario.');
    const { data, error } = await serviceDb.from('profiles').insert({ id: invited.user.id, email: body.email.toLowerCase(), full_name: body.full_name, role: 'capturador', parent_user_id: managerId, is_active: false }).select().single();
    if (error) throw error; await audit(actor.id, 'profile', data.id, 'invite_capturador'); res.status(201).json({ data });
  } catch (e) { next(e); }
});

router.patch('/capturadores/:id', authorize('admin', 'gestor'), async (req, res, next) => {
  try { const { id } = idParam.parse(req.params); const body = accountPatchSchema.parse(req.body); const actor = req.auth!.profile; let query = serviceDb.from('profiles').update(body).eq('id', id).eq('role', 'capturador'); if (actor.role === 'gestor') query = query.eq('parent_user_id', actor.id); const { data, error } = await query.select().single(); if (error) throw error; await audit(actor.id, 'profile', id, 'update_capturador'); res.json({ data }); } catch (e) { next(e); }
});
router.post('/capturadores/:id/resend-invitation', authorize('admin', 'gestor'), async (req, res, next) => {
  try { const { id } = idParam.parse(req.params); let query = serviceDb.from('profiles').select('email,onboarding_completed_at').eq('id', id).eq('role', 'capturador'); if (req.auth!.profile.role === 'gestor') query = query.eq('parent_user_id', req.auth!.profile.id); const { data, error } = await query.single(); if (error) throw error; if (data.onboarding_completed_at) return res.status(422).json({ error: 'La cuenta ya fue creada.' }); await sendActivationLink(data.email); await audit(req.auth!.profile.id, 'profile', id, 'resend_invitation'); res.status(204).end(); } catch (e) { next(e); }
});

router.get('/capture-sessions', authorize('capturador', 'admin', 'gestor'), async (req, res, next) => {
  try { const { data, error } = await req.auth!.db.from('capture_sessions').select('*').order('created_at', { ascending: false }); if (error) throw error; res.json({ data }); } catch (e) { next(e); }
});
router.post('/capture-sessions', authorize('capturador'), async (req, res, next) => {
  try { const body = sessionSchema.parse(req.body); const { data, error } = await req.auth!.db.from('capture_sessions').insert({ ...body, capturer_id: req.auth!.profile.id }).select().single(); if (error) throw error; res.status(201).json({ data }); } catch (e) { next(e); }
});
router.patch('/capture-sessions/:id', authorize('capturador'), async (req, res, next) => {
  try { const { id } = idParam.parse(req.params); const body = sessionSchema.partial().extend({ status: z.enum(['open', 'closed']).optional() }).parse(req.body); const { data, error } = await req.auth!.db.from('capture_sessions').update(body).eq('id', id).select().single(); if (error) throw error; res.json({ data }); } catch (e) { next(e); }
});

router.get('/records', async (req, res, next) => {
  try { const page = z.coerce.number().int().min(1).default(1).parse(req.query.page); const limit = z.coerce.number().int().min(1).max(100).default(25).parse(req.query.limit); const { data, error, count } = await req.auth!.db.from('records').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1); if (error) throw error; res.json({ data, meta: { page, limit, total: count ?? 0 } }); } catch (e) { next(e); }
});
router.post('/records', authorize('capturador'), async (req, res, next) => {
  try { const body = recordSchema.parse(req.body); const { data: session, error: sessionError } = await req.auth!.db.from('capture_sessions').select('*').eq('id', body.capture_session_id).single(); if (sessionError || !session) return res.status(422).json({ error: 'Sesión de captura no válida.' }); const payload = { ...body, birth_date: toIsoDate(body.birth_date), capturer_id: req.auth!.profile.id, leadership_name: body.leadership_name ?? session.leadership_name, section_code: body.section_code ?? session.section_code }; const { data, error } = await req.auth!.db.from('records').insert(payload).select().single(); if (error) throw error; res.status(201).json({ data }); } catch (e) { next(e); }
});
router.patch('/records/:id', authorize('capturador', 'admin'), async (req, res, next) => {
  try { const { id } = idParam.parse(req.params); const raw = recordPatchSchema.parse(req.body); const body = raw.birth_date ? { ...raw, birth_date: toIsoDate(raw.birth_date) } : raw; const { data, error } = await req.auth!.db.from('records').update(body).eq('id', id).select().single(); if (error) throw error; res.json({ data }); } catch (e) { next(e); }
});

router.get('/dashboard/admin', authorize('admin'), async (_req, res, next) => {
  try {
    const [{ count: records }, { count: managers }, { data: performance, error }] = await Promise.all([serviceDb.from('records').select('*', { count: 'exact', head: true }).eq('status', 'active'), serviceDb.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'gestor'), serviceDb.from('profiles').select(`
  id,
  full_name,
  records!records_capturer_id_fkey(count)
`).eq('role', 'gestor').order('full_name')]); if (error) throw error; res.json({ data: { total_records: records ?? 0, total_gestores: managers ?? 0, performance } });
  } catch (e) { next(e); }
});
router.get('/dashboard/gestor', authorize('gestor'), async (req, res, next) => {
  try { const id = req.auth!.profile.id; const [{ count: records }, { count: capturers }] = await Promise.all([serviceDb.from('records').select('*', { count: 'exact', head: true }).eq('manager_id', id).eq('status', 'active'), serviceDb.from('profiles').select('*', { count: 'exact', head: true }).eq('parent_user_id', id).eq('role', 'capturador')]); res.json({ data: { total_records: records ?? 0, total_capturadores: capturers ?? 0 } }); } catch (e) { next(e); }
});

router.get('/exports/records', authorize('admin', 'gestor'), async (req, res, next) => {
  try { const format = z.enum(['csv', 'xlsx']).default('csv').parse(req.query.format); let query = serviceDb.from('records').select('id,leadership_name,section_code,first_name,paternal_surname,maternal_surname,address,exterior_number,neighborhood,district,postal_code,birth_date,phone,electoral_key,observations,status,created_at,manager_id'); if (req.auth!.profile.role === 'gestor') query = query.eq('manager_id', req.auth!.profile.id); const { data, error } = await query.order('created_at', { ascending: false }); if (error) throw error; await audit(req.auth!.profile.id, 'records', null, `export_${format}`); const rows = data ?? []; if (format === 'csv') { res.type('text/csv').attachment('registros.csv').send(toCsv(rows)); return; } const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('Registros'); sheet.columns = Object.keys(rows[0] ?? { id: '' }).map((key) => ({ header: key, key })); sheet.addRows(rows); res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); res.attachment('registros.xlsx'); await workbook.xlsx.write(res); res.end(); } catch (e) { next(e); }
});

async function audit(actorId: string, entity: string, entityId: string | null, action: string) { await serviceDb.from('audit_events').insert({ actor_id: actorId, entity, entity_id: entityId, action }); }
async function sendActivationLink(email: string) { const { error } = await serviceDb.auth.resetPasswordForEmail(email, { redirectTo: `${env.APP_URL}/auth/confirm` }); if (error) throw error; }
function toCsv(rows: Record<string, unknown>[]) { const keys = Object.keys(rows[0] ?? {}); const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`; return [keys.join(','), ...rows.map((row) => keys.map((key) => escape(row[key])).join(','))].join('\r\n'); }
export default router;
