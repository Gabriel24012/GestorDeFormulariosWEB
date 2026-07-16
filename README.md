# Gestion de Captura Web

Monorepo TypeScript para captura de formularios y gestion jerarquica de equipos.

## Requisitos

- Node.js 24 LTS. Node 22+ funciona para desarrollo.
- Docker Desktop y Supabase CLI para pruebas locales de RLS.
- Un proyecto Supabase y cuentas en Render, Cloudflare Pages y Resend para produccion.

## Inicio rapido

1. Copia `.env.example` a `.env` y configura las claves del API.
2. Configura las claves publicas de Supabase y la URL del API en:
   - `apps/web/src/environments/environment.ts`
   - `apps/web/src/environments/environment.prod.ts`
3. Ejecuta `npm.cmd install`.
4. Inicializa Supabase local: `npx.cmd supabase start`.
5. Aplica las migraciones locales: `npx.cmd supabase db reset`.
6. Ejecuta el API: `npm.cmd run dev -w @gestion-captura/api`.
7. Ejecuta la web: `npm.cmd run start -w @gestion-captura/web`.

La clave `SUPABASE_SERVICE_ROLE_KEY` se usa exclusivamente en el API. Nunca debe anadirse a Angular.

## Despliegue

La preparacion para produccion esta documentada en `docs/deployment.md`.
