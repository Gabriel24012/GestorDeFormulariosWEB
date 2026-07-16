import { describe, expect, it } from 'vitest';
import { recordSchema } from './validation.js';

const valid = { capture_session_id: '00000000-0000-4000-8000-000000000001', first_name: 'Ana', paternal_surname: 'López', address: 'Calle Uno', birth_date: '15/07/1990', phone: '5512345678', electoral_key: 'ABCDEF12345678H001' };
describe('recordSchema', () => { it('acepta datos válidos y normaliza clave', () => expect(recordSchema.parse({...valid, electoral_key: valid.electoral_key.toLowerCase()}).electoral_key).toBe(valid.electoral_key)); it('rechaza teléfono inválido', () => expect(() => recordSchema.parse({...valid, phone:'123'})).toThrow()); });
