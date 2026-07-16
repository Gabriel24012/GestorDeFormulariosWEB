import { z } from 'zod';

const requiredText = (max: number, label = 'Este campo') => z.string()
  .trim()
  .min(1, `${label} es obligatorio.`)
  .max(max, `${label} no puede tener mas de ${max} caracteres.`);
const optionalText = (max: number, label = 'Este campo') => z.string()
  .trim()
  .max(max, `${label} no puede tener mas de ${max} caracteres.`)
  .optional()
  .nullable()
  .transform((v) => v || null);
const optionalPattern = (pattern: RegExp, message: string) => z.string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => v || null)
  .refine((v) => v === null || pattern.test(v), message);

export const idParam = z.object({ id: z.string().uuid('Identificador invalido.') });
export const inviteTokenParam = z.object({ token: z.string().trim().min(24, 'El enlace esta incompleto.').max(256, 'El enlace no es valido.') });

const personSchema = z.object({
  first_name: requiredText(80, 'Nombre'),
  paternal_surname: requiredText(80, 'Apellido paterno'),
  maternal_surname: optionalText(80, 'Apellido materno'),
  address: requiredText(250, 'Domicilio'),
  exterior_number: optionalText(20, 'No. EXT'),
  neighborhood: optionalText(120, 'Fraccionamiento'),
  district: optionalText(120, 'Distrito'),
  postal_code: optionalPattern(/^\d{5}$/, 'C.P. debe tener 5 digitos.'),
  birth_date: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Usa el formato dd/MM/aaaa.'),
  phone: z.string().regex(/^\d{10}$/, 'El telefono debe tener 10 digitos.'),
  electoral_key: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{18}$/, 'La clave electoral debe contener 18 caracteres alfanumericos.'),
  observations: optionalText(2000, 'Observaciones')
});

export const recordSchema = personSchema;
export const recordPatchSchema = personSchema.partial().extend({ status: z.enum(['active', 'voided']).optional() }).refine((v) => Object.keys(v).length > 0, 'Envia al menos un cambio.');

export const inviteLinkSchema = z.object({
  placeholder_name: requiredText(120, 'Nombre para identificar capturador')
});

export const completeInviteSchema = z.object({
  full_name: requiredText(120, 'Nombre completo'),
  email: z.string().trim().email('Escribe un correo valido.').max(255, 'Correo no puede tener mas de 255 caracteres.'),
  password: z.string().min(8, 'La contrasena debe tener al menos 8 caracteres.').max(128, 'La contrasena no puede tener mas de 128 caracteres.')
});

export const accountSchema = z.object({
  email: z.string().trim().email('Escribe un correo valido.').max(255, 'Correo no puede tener mas de 255 caracteres.'),
  full_name: requiredText(120, 'Nombre completo'),
  manager_id: z.string().uuid('Gestor invalido.').optional()
});
export const accountPatchSchema = z.object({
  full_name: requiredText(120, 'Nombre completo').optional(),
  is_active: z.boolean().optional()
}).refine((v) => Object.keys(v).length > 0, 'Envia al menos un cambio.');

export function toIsoDate(value: string) {
  const [day, month, year] = value.split('/');
  return `${year}-${month}-${day}`;
}
