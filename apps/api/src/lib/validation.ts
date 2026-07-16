import { z } from 'zod';

const requiredText = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => v || null);
export const idParam = z.object({ id: z.string().uuid() });
export const sessionSchema = z.object({
  leadership_name: requiredText(120),
  section_code: requiredText(40)
});
export const recordSchema = z.object({
  capture_session_id: z.string().uuid(),
  first_name: requiredText(80),
  paternal_surname: requiredText(80),
  maternal_surname: optionalText(80),
  address: requiredText(250),
  exterior_number: optionalText(20),
  neighborhood: optionalText(120),
  district: optionalText(120),
  postal_code: z.string().regex(/^\d{5}$/).optional().nullable().transform((v) => v || null),
  birth_date: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Usa el formato dd/MM/aaaa.'),
  phone: z.string().regex(/^\d{10}$/, 'El teléfono debe tener 10 dígitos.'),
  electoral_key: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{18}$/, 'La clave electoral debe contener 18 caracteres alfanuméricos.'),
  observations: optionalText(2000),
  leadership_name: requiredText(120).optional(),
  section_code: requiredText(40).optional()
});
export const accountSchema = z.object({ email: z.string().email().max(255), full_name: requiredText(120), manager_id: z.string().uuid().optional() });
export const accountPatchSchema = z.object({ full_name: requiredText(120).optional(), is_active: z.boolean().optional() }).refine((v) => Object.keys(v).length > 0);
export const recordPatchSchema = recordSchema.partial().extend({ status: z.enum(['active', 'voided']).optional() }).refine((v) => Object.keys(v).length > 0);

export function toIsoDate(value: string) { const [day, month, year] = value.split('/'); return `${year}-${month}-${day}`; }
