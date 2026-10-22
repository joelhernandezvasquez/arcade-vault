# 14 — Autenticación con email y contraseña (Supabase Auth)

**Estado:** implemented
**Depende de:** SPEC 01 (pantallas, `/auth`), SPEC 04 (config Supabase), SPEC 06 (catálogo y leaderboard)
**Fecha:** 2026-10-20
**Objetivo:** Reemplazar el login falso por Supabase Auth con registro, confirmación por correo, inicio de sesión y recuperación de contraseña, y hacer que solo los jugadores con cuenta guarden puntajes bajo su alias.

## Contexto

- `components/UserProvider.tsx` guarda `{ name }` en `localStorage` (`av_user`); `login()` lo escribe `app/auth/page.tsx` sin validar nada.
- `scores` acepta `insert` de `anon` con cualquier `name`; el reproductor deja escribir el nombre a mano (`INVITADO` por defecto).
- Las políticas de `select` de `games` y `scores` son solo `to anon`: con una sesión real las peticiones van como `authenticated` y dejarían de ver datos. Esta spec lo corrige.
- Next 16 renombra `middleware.ts` a `proxy.ts` (`node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`).

## Alcance

**Incluye:**

- Migración `supabase/migrations/0004_auth_perfiles.sql`: tabla `profiles`, trigger `handle_new_user`, función `alias_disponible`, columna `scores.user_id`, nuevas políticas RLS.
- Configuración manual del dashboard de Supabase, documentada aquí: "Confirm email" activo, contraseña mínima de 8, Site URL y Redirect URLs (`http://localhost:3000/**` y la de producción), SMTP custom de Resend (`smtp.resend.com`, puerto 465, usuario `resend`, contraseña = `RESEND_API_KEY`, remitente de un dominio verificado), y plantillas en español de "Confirm signup" y "Reset password" que apuntan a `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=email` y `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=recovery&next=/auth/nueva-clave`.
- `proxy.ts` (nuevo, raíz): refresca la sesión de Supabase en cada petición (patrón `@supabase/ssr` con `createServerClient` y `getUser()`), con `matcher` que excluye `_next/static`, `_next/image`, imágenes y `public/games`. No protege rutas.
- `app/auth/confirmar/route.ts` (nuevo, `GET`): `verifyOtp({ type, token_hash })` con el cliente de servidor. Éxito → redirige a `next` (solo si empieza por `/`, si no `/biblioteca`). Fallo → `/auth?error=link`.
- `lib/supabase/auth.ts` (nuevo): `signUp({ alias, email, password })`, `signIn({ email, password })`, `requestPasswordReset(email)`, `changePassword(password)`, `isAliasAvailable(alias)` y `getErrorMessage(error)`, que traduce errores de Supabase a texto en español.
- `components/UserProvider.tsx` reescrito sobre Supabase: `user: { id, email, alias } | null`, `cargando: boolean`, `signOut()` (async, `supabase.auth.signOut()`). Escucha `onAuthStateChange` y lee el alias de `profiles`. Al montar borra `av_user` de `localStorage`. Se elimina `login()`. `useUser()` mantiene su nombre.
- `app/auth/page.tsx` real, manteniendo el diseño actual (`auth-card`, `auth-tabs`, `field`):
  - Pestaña **INICIAR SESIÓN**: correo + contraseña. Enlace "¿OLVIDASTE TU CONTRASEÑA?".
  - Pestaña **CREAR CUENTA**: alias + correo + contraseña. El campo "Usuario" pasa a llamarse "Alias".
  - Modo **RECUPERAR**: solo correo; tras enviar muestra "SI EXISTE UNA CUENTA, TE ENVIAMOS UN ENLACE".
  - Tras registrarse: panel "REVISA TU CORREO PARA ACTIVAR TU CUENTA" en lugar del formulario.
  - Botón en estado `ENVIANDO...` y deshabilitado mientras hay petición; errores en una línea sobre el botón.
  - `?error=link` muestra "EL ENLACE NO ES VÁLIDO O YA EXPIRÓ".
  - `?next=/ruta` se respeta tras iniciar sesión (solo rutas que empiezan por `/`); por defecto `/biblioteca`.
  - Con sesión activa, `/auth` redirige a `/biblioteca`.
  - **JUGAR COMO INVITADO** solo navega a `/biblioteca`.
  - Botones GOOGLE y GITHUB: `disabled` con `title="PRÓXIMAMENTE"` (los activa la SPEC 15).
- `app/auth/nueva-clave/page.tsx` (nuevo): nueva contraseña + repetir. Requiere sesión (la crea el enlace de recuperación); sin sesión muestra "ABRE EL ENLACE DE TU CORREO" y un enlace a `/auth`. Éxito → `/biblioteca`.
- `lib/supabase/scores.ts`: `saveScore({ gameId, score, userId, name })` inserta también `user_id`.
- `app/jugar/[id]/page.tsx`: se quita el campo de nombre del modal de fin de partida. Con sesión: guarda bajo `user.alias` y `user.id`. Invitado: no guarda; muestra "INICIA SESIÓN PARA GUARDAR TU PUNTAJE" con enlace a `/auth?next=/jugar/<id>`.
- `app/salon/page.tsx`: `getBestScore(tab, user.alias)`.
- `components/Nav.tsx`: muestra `user.alias`; el botón llama al nuevo `signOut()`. Mientras `cargando` no muestra ni "ENTRAR" ni el alias.
- `CLAUDE.md`: actualizar la sección "Data and auth" (Supabase Auth, `profiles`, `proxy.ts`, invitados no guardan).

**No incluye (fuera de esta spec):**

- Google y GitHub → SPEC 15.
- Página de perfil, cambiar alias o email, borrar cuenta.
- Menú desplegable de usuario en `Nav`.
- Proteger rutas en `proxy.ts` (todas siguen siendo públicas).
- Migrar puntajes viejos a cuentas: las filas antiguas quedan con `user_id = null`.
- Roles o administración.
- Tests automatizados (no hay test runner).

## Modelo de datos

```sql
-- 0004_auth_perfiles.sql (resumen)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  alias text not null unique check (alias ~ '^[A-Z0-9_]{3,10}$'),
  created_at timestamptz not null default now()
);
-- RLS: select para anon y authenticated; sin insert/update desde el cliente.

-- handle_new_user(): trigger after insert on auth.users, security definer.
--   Si raw_user_meta_data->>'alias' existe, inserta profiles(id, upper(alias)).
-- alias_disponible(p_alias text) returns boolean, security definer,
--   execute para anon y authenticated.

alter table scores add column user_id uuid references auth.users(id) on delete set null;
-- drop policy scores_insert_public;
-- scores_insert_own: insert to authenticated
--   with check (user_id = auth.uid()
--     and name = (select alias from profiles where id = auth.uid()));
-- games_select_public y scores_select_public: to anon, authenticated.
```

```ts
// components/UserProvider.tsx
export interface User {
  id: string;
  email: string;
  alias: string;
}
interface UserContextValue {
  user: User | null;
  cargando: boolean;
  signOut: () => Promise<void>;
}
```

Reglas: alias de 3 a 10 caracteres `A-Z 0-9 _`, se convierte a mayúsculas al escribir. Contraseña mínima de 8. `signUp` envía el alias en `options.data.alias`.

## Plan de implementación

1. Configurar el dashboard de Supabase (Confirm email, SMTP de Resend, URLs, plantillas). Prueba manual: "Send test email" llega.
2. Migración `0004_auth_perfiles.sql` aplicada. El sitio sigue funcionando: los puntajes de invitado dejan de guardarse (falla controlada en el modal, se arregla en el paso 7).
3. `proxy.ts` con refresco de sesión. El sitio carga igual que antes.
4. `lib/supabase/auth.ts` y `app/auth/confirmar/route.ts`.
5. Reescribir `UserProvider.tsx` y adaptar `Nav.tsx`, `app/salon/page.tsx` y la llamada de `/auth` (sin `login`).
6. Formularios reales en `app/auth/page.tsx` (iniciar sesión, crear cuenta, recuperar, estados y errores) y `app/auth/nueva-clave/page.tsx`.
7. `saveScore` con `userId` y el modal de fin de partida en `app/jugar/[id]/page.tsx`.
8. Actualizar `CLAUDE.md`.

## Criterios de aceptación

- [x] Registrarse con alias, correo y contraseña muestra "REVISA TU CORREO..." y llega un correo en español enviado por Resend.
- [x] Abrir el enlace del correo inicia sesión y lleva a `/biblioteca`; `Nav` muestra el alias.
- [x] Iniciar sesión antes de confirmar muestra "CONFIRMA TU CORREO ANTES DE ENTRAR".
- [x] Contraseña incorrecta muestra "CORREO O CONTRASEÑA INCORRECTOS".
- [x] Registrarse con un alias ya usado muestra "ESE ALIAS YA ESTÁ EN USO" y no crea la cuenta.
- [x] Un alias de 2 caracteres o con símbolos no se envía y muestra el error de formato.
- [x] Recargar la página mantiene la sesión.
- [x] Pulsar el alias en `Nav` cierra la sesión y `Nav` vuelve a mostrar "ENTRAR".
- [x] "¿OLVIDASTE TU CONTRASEÑA?" envía un correo; su enlace abre `/auth/nueva-clave` y la nueva contraseña sirve para entrar.
- [x] Un enlace usado o manipulado lleva a `/auth?error=link` con su mensaje.
- [x] Con sesión, fin de partida guarda el puntaje bajo el alias y aparece en `/salon` y en `/juego/[id]`.
- [x] Como invitado se puede jugar; el modal no guarda y ofrece iniciar sesión, y tras entrar vuelve a `/jugar/<id>`.
- [x] Un `insert` en `scores` con la clave anon (sin sesión) es rechazado por RLS.
- [x] Un `insert` autenticado con `user_id` o `name` de otro jugador es rechazado por RLS.
- [x] Los puntajes antiguos siguen visibles en `/salon`, con y sin sesión.
- [x] `av_user` ya no existe en `localStorage` tras cargar el sitio.
- [x] Con sesión, `/auth` redirige a `/biblioteca`.
- [x] `npm run build` y `npm run lint` pasan.

## Decisiones

- **Sí:** Supabase Auth. Ya usamos `@supabase/ssr` con cookies; da hash, sesión y `auth.uid()` para RLS.
- **No:** auth propia con bcrypt ni Auth.js. Más código y riesgo, y duplican lo que Supabase ya da.
- **Sí:** login con correo + contraseña y alias aparte en `profiles`. El alias es lo que se ve en el salón.
- **No:** login por alias. Obliga a resolver alias→correo en el servidor.
- **Sí:** alias único, creado por trigger desde `user_metadata`. Evita perfiles a medias si el cliente falla tras `signUp`.
- **Sí:** confirmar el correo, con enlaces `token_hash` + `verifyOtp` en `/auth/confirmar`. Funciona aunque el enlace se abra en otro navegador (no depende del verificador PKCE).
- **Sí:** SMTP de Resend. El SMTP por defecto de Supabase permite unos pocos correos por hora.
- **Sí:** invitados juegan pero no guardan. Acaba con los nombres inventados en el salón.
- **No:** `INVITADO` en el salón.
- **Sí:** `scores.user_id` nullable y conservar filas viejas. No se pierde el historial.
- **Sí:** `proxy.ts` solo refresca sesión. Next desaconseja lógica pesada en proxy; las páginas deciden.
- **No:** página de perfil ni menú de usuario en esta spec.
- **Sí:** dividir OAuth en la SPEC 15. Depende de configuración externa y no debe bloquear esta.

## Riesgos

| Riesgo                                                                                                          | Mitigación                                                                                                            |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Con "Confirm email" activo, signUp un correo existente devuelve éxito falso (protección contra enumeración). | Se muestra el mismo "REVISA TU CORREO"; es el comportamiento deseado.                                                 |
| Dos registros simultáneos con el mismo alias: `alias_disponible` dice sí a ambos.                               | El `unique` hace fallar el trigger; ese error se traduce a "ESE ALIAS YA ESTÁ EN USO".                                |
| Dominio de Resend sin verificar: los correos no salen.                                                          | El paso 1 exige el "Send test email" antes de seguir.                                                                 |
| Las políticas `to anon` ocultan datos a usuarios con sesión.                                                    | La migración las amplía a `authenticated`; hay criterio de aceptación.                                                |
| Usuario confirmado sin fila en `profiles` (alias perdido).                                                      | `UserProvider` trata la sesión sin perfil como sin alias; la SPEC 15 añade la pantalla `/auth/alias` que lo resuelve. |

## Lo que **no** entra en esta spec

- Google y GitHub (SPEC 15).
- Perfil, cambiar alias o correo, borrar cuenta.
- Rutas protegidas por `proxy.ts`.
- Asociar puntajes antiguos a cuentas.
