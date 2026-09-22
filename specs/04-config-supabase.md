# 04 — Configuración base de Supabase

**Estado:** Implementado
**Depende de:** —
**Fecha:** 2026-09-18
**Objetivo:** Conectar Arcade Vault a un proyecto Supabase real instalando y configurando los clientes oficiales (`@supabase/supabase-js` + `@supabase/ssr`) para browser y servidor, sin migrar todavía auth ni scores a Supabase.

## Contexto

Hoy todo el proyecto es client-side puro: la sesión de usuario (`components/UserProvider.tsx`) y las puntuaciones (`lib/scores.ts`) viven en `localStorage`, y no existe ninguna conexión a una base de datos real (la única pieza de backend existente es el endpoint de contacto vía Resend del spec 03). El usuario ya tiene un proyecto Supabase activo y vacío (`vgppkjxuqdhjstprzotw`, región `us-east-2`, sin tablas) creado el 2026-09-16. Este spec deja la infraestructura de conexión lista y verificada para que specs futuros (auth real, scores/leaderboard en Postgres) puedan construir sobre ella sin repetir la configuración base.

## Alcance

**Incluye:**

- Dependencias nuevas en `package.json`: `@supabase/supabase-js` y `@supabase/ssr`.
- `lib/supabase/client.ts`: cliente de Supabase para Client Components, creado con `createBrowserClient` de `@supabase/ssr`, leyendo `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `lib/supabase/server.ts`: cliente de Supabase para Server Components y Route Handlers, creado con `createServerClient` de `@supabase/ssr`, usando `cookies()` de `next/headers` para lectura/escritura de cookies de sesión.
- `.env.local` (no commiteado) con los valores reales del proyecto existente: `NEXT_PUBLIC_SUPABASE_URL=https://vgppkjxuqdhjstprzotw.supabase.co` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` con la publishable key del proyecto.
- `.env.local.example` actualizado (se suma a la línea existente de `RESEND_API_KEY`) documentando `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` sin valores reales.
- Endpoint de diagnóstico `app/api/supabase-health/route.ts` (Route Handler, `GET`): instancia el cliente de servidor, ejecuta `supabase.auth.getSession()` (llamada trivial que no requiere ninguna tabla) y devuelve `{ ok: true }` si no hay error de conexión/configuración, o `{ ok: false, error: string }` con status `500` si falla.

**No incluye (explícitamente fuera de este spec):**

- Reemplazar el login/registro simulado de `/auth` (`UserProvider`) por Supabase Auth real — queda para un spec futuro (`auth-supabase`).
- Migrar `lib/scores.ts` o el Salón de la Fama (`app/salon/page.tsx`) a tablas de Supabase — queda para un spec futuro (`scores-supabase`).
- Crear ninguna tabla, política RLS, migración SQL o esquema en la base de datos — el proyecto queda sin tablas al terminar este spec.
- `middleware.ts` para refresco automático de sesión (patrón estándar de `@supabase/ssr` para auth) — no aplica todavía porque no hay auth real que mantener viva; se agrega en el spec de auth.
- Crear un proyecto Supabase nuevo — se reutiliza el proyecto existente (`vgppkjxuqdhjstprzotw`).

## Modelo de datos

No se introduce modelo de datos ni tablas. Este spec solo establece la conexión (clientes + variables de entorno) hacia un proyecto Supabase que hoy no tiene tablas.

## Plan de implementación

1. Instalar las dependencias `@supabase/supabase-js` y `@supabase/ssr` (`npm install @supabase/supabase-js @supabase/ssr`).
2. Crear `.env.local` con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` con los valores reales del proyecto `vgppkjxuqdhjstprzotw` (ya obtenidos), y agregar las mismas dos claves (vacías) a `.env.local.example`.
3. Crear `lib/supabase/client.ts` con `createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)`.
4. Crear `lib/supabase/server.ts` con `createServerClient(...)` usando `cookies()` de `next/headers` según el patrón oficial de `@supabase/ssr` para Server Components/Route Handlers.
5. Crear `app/api/supabase-health/route.ts`: importa el cliente de servidor, llama a `supabase.auth.getSession()`, devuelve `NextResponse.json({ ok: true })` en éxito o `NextResponse.json({ ok: false, error }, { status: 500 })` si lanza excepción o si `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` no están configuradas.
6. Correr `npm run lint` y `npm run build`, confirmar que no hay errores y que `/api/supabase-health` aparece entre las rutas generadas.
7. Probar manualmente: con `npm run dev`, visitar `/api/supabase-health` y confirmar que responde `{ "ok": true }` (conexión real al proyecto Supabase funcionando).

## Criterios de aceptación

- [x] `package.json` incluye `@supabase/supabase-js` y `@supabase/ssr` como dependencias.
- [x] `lib/supabase/client.ts` y `lib/supabase/server.ts` existen y exportan una función que crea el cliente correspondiente (browser / server).
- [x] `.env.local.example` documenta `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` sin exponer valores reales; `.env.local` con los valores reales no se commitea (ya cubierto por `.gitignore`, que ignora `.env*` salvo `.env.local.example`).
- [x] Visitar `/api/supabase-health` con el servidor de desarrollo corriendo devuelve `{ "ok": true }`.
- [x] Si se borran o corrompen las variables de entorno, `/api/supabase-health` devuelve `{ "ok": false, "error": "..." }` con status `500` en vez de tirar el servidor abajo.
- [x] `npm run lint` y `npm run build` terminan sin errores.
- [x] No se crea ninguna tabla ni migración SQL en el proyecto Supabase como parte de este spec.

## Decisiones tomadas y descartadas

- **Reusar el proyecto Supabase existente (`vgppkjxuqdhjstprzotw`)** — ya está activo y vacío; crear uno nuevo sería trabajo redundante sin ningún beneficio.
- **`@supabase/ssr` + `@supabase/supabase-js` en vez de solo `@supabase/supabase-js`** — es el paquete oficial recomendado por Supabase para Next.js App Router; da soporte correcto de cookies de sesión en Server Components y Route Handlers, necesario para cuando se implemente auth real en un spec futuro.
- **Clientes en `lib/supabase/client.ts` y `lib/supabase/server.ts` (subcarpeta) en vez de archivos sueltos en `lib/`** — sigue el patrón oficial de la documentación de Supabase para SSR, que separa explícitamente cliente de browser y cliente de servidor.
- **`.env.local` con valores reales escrito directamente en este spec** — a diferencia del spec 03 (Resend, donde el usuario debía crear su propia API key), aquí ya existe un proyecto con URL y anon key disponibles vía Supabase MCP; escribirlos directamente evita un paso manual innecesario. Se usa la `anon`/`publishable` key, que es segura de exponer en el cliente (`NEXT_PUBLIC_*`) por diseño de Supabase.
- **Endpoint `/api/supabase-health` como verificación en vez de solo un build limpio** — un build exitoso no prueba que la URL/key sean correctas ni que haya conectividad real con el proyecto; el endpoint hace una llamada real a Supabase y es la única forma de confirmar la conexión de punta a punta.
- **Sin `middleware.ts` de refresco de sesión** — ese patrón solo tiene sentido una vez que existan sesiones de Supabase Auth reales que mantener vivas; agregarlo ahora sería código sin uso. Se deja documentado como parte del futuro spec de auth.
- **Sin tablas ni RLS en este spec** — el pedido fue "implementar Supabase", que se interpretó como dejar la conexión lista; el modelo de datos (tablas de auth/scores) depende de decisiones que aún no se tomaron y merece su propio spec.

## Riesgos identificados

- La anon/publishable key queda en `.env.local` en texto plano; al ser una key pública por diseño de Supabase (protegida por RLS, hoy inexistente porque no hay tablas) el riesgo es bajo, pero cualquier tabla que se cree en specs futuros debe llevar políticas RLS antes de exponerse a través de este cliente.
- Si el proyecto Supabase se pausa por inactividad (comportamiento normal del free tier) o cambia de estado, `/api/supabase-health` empezará a devolver `{ ok: false }`; es el comportamiento esperado y sirve como señal temprana para el usuario.
