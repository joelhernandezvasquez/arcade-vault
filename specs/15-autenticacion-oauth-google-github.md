# 15 — Inicio de sesión con Google y GitHub

**Estado:** implemented
**Depende de:** SPEC 14 (autenticación con email y contraseña)
**Fecha:** 2026-10-20
**Objetivo:** Activar los botones GOOGLE y GITHUB de `/auth` con OAuth de Supabase y pedir un alias la primera vez que entra un jugador que no tiene perfil.

## Alcance

**Incluye:**

- Configuración manual documentada: app OAuth en Google Cloud y OAuth App en GitHub, ambas con callback `https://<proyecto>.supabase.co/auth/v1/callback`; activar ambos proveedores en Supabase con su client id/secret.
- `lib/supabase/auth.ts`: `iniciarConProveedor('google' | 'github', next)` con `signInWithOAuth` y `redirectTo = ${location.origin}/auth/confirmar?next=<next>`.
- `app/auth/confirmar/route.ts`: además de `token_hash`, acepta `code` y llama a `exchangeCodeForSession(code)`. Error del proveedor (`?error=`) → `/auth?error=proveedor`.
- `app/auth/page.tsx`: GOOGLE y GITHUB habilitados (se quita `disabled` y "PRÓXIMAMENTE"); mensaje para `?error=proveedor`: "NO SE PUDO ENTRAR CON ESE PROVEEDOR".
- Migración `supabase/migrations/0005_perfil_propio.sql`: política `profiles_insert_own` (insert to authenticated with check `id = auth.uid()`).
- `app/auth/alias/page.tsx` (nuevo): formulario de alias (mismas reglas que SPEC 14), inserta en `profiles` y vuelve a `next`. Sin sesión → `/auth`. Con perfil ya creado → `/biblioteca`.
- `components/UserProvider.tsx`: expone `sinAlias: boolean` (sesión válida sin fila en `profiles`). Mientras sea `true`, cualquier página distinta de `/auth/alias` redirige ahí con `next` = ruta actual.
- `app/jugar/[id]/page.tsx`: un usuario `sinAlias` se trata como invitado para guardar puntaje.

**No incluye (fuera de esta spec):**

- Otros proveedores (Discord, Apple, etc.).
- Vincular o desvincular proveedores desde una página de cuenta.
- Avatar del proveedor.
- Usar el nombre del proveedor como alias automático.

## Modelo de datos

Reutiliza `profiles` de la SPEC 14. Solo añade la política `profiles_insert_own`. `UserContextValue` suma `sinAlias: boolean`.

## Plan de implementación

1. Configurar Google, GitHub y los proveedores en Supabase.
2. Migración `0005_perfil_propio.sql`.
3. Rama `code` en `/auth/confirmar` e `iniciarConProveedor` en `lib/supabase/auth.ts`.
4. `sinAlias` en `UserProvider` y `app/auth/alias/page.tsx`.
5. Habilitar los botones y el error `proveedor` en `app/auth/page.tsx`.
6. Tratar `sinAlias` como invitado en el reproductor y actualizar `CLAUDE.md`.

## Guía de configuración manual (paso 1)

Callback de Supabase para ambos proveedores: `https://vgppkjxuqdhjstprzotw.supabase.co/auth/v1/callback`

**Google Cloud Console**

1. Crear (o elegir) un proyecto en <https://console.cloud.google.com>.
2. _APIs y servicios → Pantalla de consentimiento de OAuth_: tipo Externo, nombre "Arcade Vault", correo de soporte. Scopes por defecto (`email`, `profile`, `openid`).
3. _Credenciales → Crear credenciales → ID de cliente de OAuth_: tipo "Aplicación web".
4. _URI de redirección autorizados_: el callback de Supabase de arriba. (_Orígenes de JavaScript autorizados_ no hace falta.)
5. Copiar el **Client ID** y el **Client Secret**.

**GitHub**

1. <https://github.com/settings/developers> → _OAuth Apps → New OAuth App_.
2. _Application name_: Arcade Vault. _Homepage URL_: la URL de producción (o `http://localhost:3000` mientras tanto).
3. _Authorization callback URL_: el callback de Supabase de arriba.
4. Registrar la app, generar un **Client Secret** y copiar también el **Client ID**.

**Dashboard de Supabase**

1. _Authentication → Sign In / Providers → Google_: activar, pegar Client ID y Client Secret, guardar.
2. _Authentication → Sign In / Providers → GitHub_: activar, pegar Client ID y Client Secret, guardar.
3. _Authentication → URL Configuration_: confirmar que _Redirect URLs_ incluye `http://localhost:3000/**` y la URL de producción (`https://<dominio>/**`).
4. Dejar activa la vinculación automática de identidades con el mismo correo verificado (valor por defecto).

**Verificación:** con el servidor local, abrir `http://localhost:3000/auth` una vez hecho el paso 3 del plan; hasta entonces los botones siguen deshabilitados.

## Criterios de aceptación

- [x] GOOGLE abre el consentimiento de Google y, con una cuenta nueva, termina en `/auth/alias`.
- [x] GITHUB hace lo mismo con GitHub.
- [x] Elegir un alias libre crea el perfil, `Nav` lo muestra y se vuelve a la página de origen.
- [x] Un alias ocupado en `/auth/alias` muestra "ESE ALIAS YA ESTÁ EN USO".
- [x] Con una cuenta OAuth que ya tiene alias, se entra directo sin pasar por `/auth/alias`.
- [x] Cancelar en el proveedor lleva a `/auth?error=proveedor` con su mensaje.
- [x] Mientras falta el alias, navegar a `/biblioteca` redirige a `/auth/alias`.
- [x] Un usuario sin alias no puede guardar puntaje.
- [x] Un `insert` en `profiles` con un `id` ajeno es rechazado por RLS.
- [x] `npm run build` y `npm run lint` pasan.

## Decisiones

- **Sí:** pedir alias en `/auth/alias`. Mantiene el alias único y elegido por el jugador.
- **No:** alias automático desde Google/GitHub. Choca con la unicidad y el formato `A-Z0-9_`.
- **Sí:** reutilizar `/auth/confirmar` para el `code` de OAuth. Un solo punto de entrada de sesión.
- **Sí:** vinculación automática de identidades de Supabase con el mismo correo verificado. No requiere código.
- **No:** página para gestionar proveedores vinculados.

## Riesgos

| Riesgo                                                                       | Mitigación                                                                        |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| La URL de redirección no está en "Redirect URLs" de Supabase.                | El paso 1 incluye `http://localhost:3000/**` y la de producción.                  |
| Redirección en bucle a `/auth/alias`.                                        | La redirección se omite en `/auth/alias` y en `/auth/confirmar`.                  |
| El `code` PKCE falla si el flujo empieza y termina en navegadores distintos. | En OAuth siempre es el mismo navegador; el error lleva a `/auth?error=proveedor`. |

## Lo que **no** entra en esta spec

- Otros proveedores, gestión de identidades vinculadas y avatares.
