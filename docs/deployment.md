# Despliegue a produccion

Esta guia asume dos servicios:

- API: Render
- Web: Cloudflare Pages
- Base de datos y Auth: Supabase
- Correos transaccionales: Resend

## 1. Supabase

Antes del primer despliegue, aplica las migraciones al proyecto remoto:

```powershell
npx.cmd supabase link --project-ref TU_PROJECT_REF
npx.cmd supabase db push
```

En Supabase Auth configura:

- Site URL: la URL publica de Cloudflare Pages cuando exista.
- Redirect URLs:
  - `https://TU_FRONTEND.pages.dev/auth/confirm`
  - `https://TU_FRONTEND.pages.dev/auth/invite/*`

Mientras no haya dominio propio, usa la URL `*.pages.dev` de Cloudflare Pages.

## 2. Resend para correos

Para este proyecto, la ruta recomendada es conectar Resend como SMTP de Supabase Auth. Asi Supabase seguira enviando invitaciones, confirmaciones y reset de password, pero usando tu dominio verificado en Resend.

En Resend:

1. Agrega y verifica el dominio que usara la app.
2. Crea una API key para envio.

En Supabase Auth SMTP usa:

```text
Host=smtp.resend.com
Port=587
Username=resend
Password=TU_RESEND_API_KEY
Sender email=no-reply@TU_DOMINIO
Sender name=Gestion de Captura
```

Resend tambien acepta otros puertos SMTP, pero `587` con STARTTLS es el valor mas comun para este caso.

## 3. Render API

Crea un nuevo Web Service conectado al repositorio de GitHub.

Configuracion:

- Runtime: Node
- Root directory: raiz del repositorio
- Build command: `npm ci && npm run build -w @gestion-captura/api`
- Start command: `npm run start -w @gestion-captura/api`
- Health check path: `/health`

Variables de entorno:

```text
NODE_VERSION=24
SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=tu_publishable_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
CORS_ORIGINS=https://gestion-captura-web.pages.dev
APP_URL=https://gestion-captura-web.pages.dev
ENABLE_DEMO_DATA=false
```

Render define `PORT` automaticamente. El API ya lo acepta, asi que no necesitas configurar `API_PORT` en Render.

Cuando Render termine, prueba:

```text
https://gestion-captura-api.onrender.com/health
```

Debe responder:

```json
{ "status": "ok" }
```

## 4. Cloudflare Pages web

Crea un nuevo proyecto en Cloudflare Pages conectado al mismo repositorio de GitHub.

Configuracion:

- Build command: `npm run build -w @gestion-captura/web`
- Build output directory: `apps/web/dist/web/browser`
- Root directory: raiz del repositorio
- Production branch: `main`

Variables de entorno de build:

```text
NODE_VERSION=24
```

El archivo `apps/web/public/_redirects` mantiene funcionando las rutas internas de Angular al recargar paginas como `/auth/confirm` o `/dashboard`.

Antes de desplegar para usuarios reales, actualiza:

```text
apps/web/src/environments/environment.prod.ts
```

Cambia:

```ts
apiUrl: 'https://your-render-service.onrender.com/api/v1'
```

por la URL real del API de Render:

```ts
apiUrl: 'https://gestion-captura-api.onrender.com/api/v1'
```

## 5. Ajustes cruzados finales

Cuando ya tengas la URL de Cloudflare Pages:

1. En Render, actualiza `CORS_ORIGINS` y `APP_URL` con esa URL `*.pages.dev`.
2. En Supabase Auth, actualiza Site URL y Redirect URLs.
3. En Cloudflare Pages, redeploy del frontend si cambiaste `environment.prod.ts`.
4. Cuando haya dominio propio, repite esos tres valores con el dominio final.

## 6. Checklist antes de compartir

Ejecuta localmente:

```powershell
npm.cmd run lint
npm.cmd run test
npm.cmd run build
```

Despues prueba en produccion:

- `/health` del API responde `ok`.
- Login con Supabase.
- Invitacion de usuario.
- Confirmacion de correo.
- Reset de password.
- Carga de datos del dashboard.
- Exportaciones o descargas que use el API.
