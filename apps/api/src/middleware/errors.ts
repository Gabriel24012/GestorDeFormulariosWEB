import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export function notFound(_req: Request, res: Response) { res.status(404).json({ error: 'Recurso no encontrado.' }); }
export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) return res.status(422).json({ error: 'Datos inválidos.', details: error.flatten() });
  console.error(error);
  return res.status(500).json({ error: 'Error interno del servidor.' });
}
