# Gestión de Captura Web

Monorepo TypeScript para captura de formularios y gestión jerárquica de equipos.

## Requisitos

- Node.js 24 LTS (Node 22+ funciona para desarrollo)
- Docker Desktop y Supabase CLI para pruebas locales de RLS
- Un proyecto Supabase y una cuenta Render para producción

## Inicio rápido

1. Copia `.env.example` a `.env` y configura las claves del API. Configura las claves públicas de Supabase y la URL del API en `apps/web/src/environments/environment.ts` y `environment.prod.ts`.
2. Ejecuta `npm.cmd install`.
3. Inicializa Supabase local: `npx.cmd supabase start`.
4. Aplica las migraciones: `npx.cmd supabase db reset`.
5. Ejecuta `npm.cmd run dev -w @gestion-captura/api` y `npm.cmd run start -w @gestion-captura/web`.

La clave `SUPABASE_SERVICE_ROLE_KEY` se usa exclusivamente en el API. Nunca debe añadirse a Angular.
