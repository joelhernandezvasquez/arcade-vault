# 16 — Medidas de seguridad básicas

**Estado:** implemented
**Depende de:** SPEC 04 (config Supabase), SPEC 06 (catálogo y leaderboard), SPEC 14 (autenticación con email y contraseña)
**Fecha:** 2026-10-23
**Objetivo:** Aplicar el checklist de [references/security/security-checklist.md](../references/security/security-checklist.md): verificar RLS, endurecer las contraseñas y los registros en Supabase Auth, añadir cabeceras de seguridad en Next.js y eliminar los warnings de seguridad de los advisors de Supabase.

## Contexto

- RLS ya está habilitado en `games` y `scores` (`0001_games_and_scores.sql`) y en `profiles` (`0004_auth_perfiles.sql`). Falta **verificarlo** contra la base real, no volver a crearlo.
- La contraseña mínima de 8 ya se valida en el cliente (`PASSWORD_MIN` en [lib/supabase/auth.ts](../lib/supabase/auth.ts)) y la SPEC 14 la pidió en el dashboard, pero no hay evidencia de que el servidor la imponga.
- [next.config.ts](../next.config.ts) no define cabeceras.
- El advisor de Supabase reporta tres warnings (2026-10-23):
  - `anon_security_definer_function_executable` y `authenticated_security_definer_function_executable`: `public.alias_disponible(p_alias text)` es `SECURITY DEFINER` y ejecutable vía `/rest/v1/rpc/alias_disponible`.
  - `auth_leaked_password_protection`: protección contra contraseñas filtradas desactivada.

## Alcance

**Incluye:**

- **RLS (verificación):** consulta a `pg_tables`/`pg_policies` que confirma `rowsecurity = true` en `games`, `scores` y `profiles` y que las políticas son las esperadas. Si alguna tabla no lo cumple, la migración 0006 lo corrige.
- **Migración `supabase/migrations/0006_seguridad_alias_disponible.sql`:** recrea `public.alias_disponible(p_alias text)` como `SECURITY INVOKER` (`create or replace`, mismo nombre, argumentos y resultado) y mantiene `execute` para `anon` y `authenticated`. Funciona sin privilegios elevados porque solo lee `profiles`, que ya tiene `select` público por RLS.
- **Dashboard de Supabase (manual, documentado aquí):**
  - _Authentication → Sign In / Providers → Email_: contraseña mínima de **8** caracteres (confirmar el valor; subirlo si estuviera en 6).
  - Misma pantalla: activar **Prevent use of leaked passwords** (HaveIBeenPwned).
  - _Authentication → Rate Limits_: limitar los registros por IP para que un mismo origen no pueda crear más de **5 cuentas por hora** (anti-bot). Anotar el valor exacto configurado y su unidad, porque el dashboard puede expresarlo por ventana de 5 minutos.
- **`next.config.ts`:** `headers()` con `source: '/(.*)'` y estas cabeceras:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`

  Se conserva `allowedDevOrigins`.

proxy de next js: https://nextjs.org/docs/app/getting-started/proxy

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// This function can be marked `async` if using `await` inside
export function proxy(request: NextRequest) {
return NextResponse.redirect(new URL('/home', request.url))
}

// Alternatively, you can use a default export:
// export default function proxy(request: NextRequest) { ... }

export const config = {
matcher: '/about/:path*',
}

- **Traducción del error de contraseña filtrada:** `getErrorMessage` en [lib/supabase/auth.ts](../lib/supabase/auth.ts) traduce el error `weak_password` (con `reasons` que incluye `pwned`) a "ESA CONTRASEÑA APARECE EN FILTRACIONES, ELIGE OTRA". Cualquier otro `weak_password` usa el mensaje de longitud mínima existente.
- **Traducción del error de límite de registros:** el error `over_request_rate_limit` / HTTP 429 se muestra como "DEMASIADOS INTENTOS, ESPERA UN MOMENTO".
- **`CLAUDE.md`:** sección "Data and auth" con las cabeceras, la función `alias_disponible` como `INVOKER` y la configuración de seguridad de Auth.

**No incluye (fuera de esta spec):**

- `Content-Security-Policy`: requiere nonces para los scripts inline de Next, y permitir fuentes de Google y Supabase; merece su propia spec con QA extensa.
- CAPTCHA (Turnstile/hCaptcha) en el registro.
- Límite de tasa propio en `POST /api/contact` o en rutas de la app.
- MFA, cambio de contraseña obligatorio a usuarios existentes, auditoría de sesiones.
- Revisión de claves/secretos (`RESEND_API_KEY`, claves de Supabase) y de las políticas RLS de otras tablas futuras.
- Tests automatizados (no hay test runner).

## Modelo de datos

No introduce datos nuevos. Solo cambia el modo de seguridad de una función existente:

```sql
-- 0006_seguridad_alias_disponible.sql (resumen)
create or replace function public.alias_disponible(p_alias text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles where alias = upper(p_alias)
  );
$$;

revoke execute on function public.alias_disponible(text) from public;
grant execute on function public.alias_disponible(text) to anon, authenticated;
```

El cuerpo exacto se copia de la definición vigente en `0004_auth_perfiles.sql`; solo cambian `security invoker` y el `set search_path`.

```ts
// next.config.ts
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];
```

## Plan de implementación

1. Verificar RLS en la base real (`pg_tables` y `pg_policies` con la Supabase MCP) y anotar el resultado. Sin cambios en el sitio.
2. Migración `0006_seguridad_alias_disponible.sql` aplicada. Comprobar que el registro sigue validando alias libres/ocupados sin sesión.
3. Cabeceras en `next.config.ts`. Comprobar con `curl -I` y que todas las pantallas (incluido el reproductor con sus juegos) cargan igual.
4. Configurar el dashboard: contraseña mínima de 8, contraseñas filtradas y límite de registros por IP.
5. Traducir `weak_password` y el límite de tasa en `getErrorMessage`.
6. Ejecutar `get_advisors` (security) y comprobar que los tres warnings desaparecieron.
7. Actualizar `CLAUDE.md` y marcar los criterios de esta spec.

## Criterios de aceptación

- [x] `pg_tables` muestra `rowsecurity = true` en `games`, `scores` y `profiles`.
- [x] Con la clave anon, un `insert` en `games` y un `insert` en `scores` son rechazados por RLS; un `select` en ambas funciona.
- [x] `alias_disponible` es `SECURITY INVOKER` (`prosecdef = false` en `pg_proc`) y el registro sigue devolviendo "ESE ALIAS YA ESTÁ EN USO" para un alias ocupado y deja continuar con uno libre, sin sesión.
- [ ] `get_advisors` (tipo security) ya no reporta `anon_security_definer_function_executable`, `authenticated_security_definer_function_executable` ni `auth_leaked_password_protection`.
- [ ] Registrarse con una contraseña de 7 caracteres es rechazado (cliente y, llamando a la API de Auth directamente, también por el servidor).
- [ ] Registrarse con una contraseña filtrada conocida (p. ej. `password123`) muestra "ESA CONTRASEÑA APARECE EN FILTRACIONES, ELIGE OTRA" y no crea la cuenta.
- [ ] Superado el límite de registros por IP, el siguiente intento muestra "DEMASIADOS INTENTOS, ESPERA UN MOMENTO".
- [x] `curl -I http://localhost:3000/` devuelve las cinco cabeceras definidas, con los valores indicados.
- [ ] `/`, `/biblioteca`, `/juego/[id]`, `/jugar/[id]` (con un juego jugable), `/salon`, `/auth` y `/acerca-de` cargan sin errores nuevos en consola.
- [ ] El inicio de sesión con correo, el flujo de recuperación y GOOGLE/GITHUB siguen funcionando.
- [x] `npm run build` y `npm run lint` pasan.

## Decisiones

- **Sí:** `alias_disponible` como `SECURITY INVOKER`. Solo lee `profiles` (select público por RLS), así que no necesita privilegios elevados y el warning se elimina sin cambiar el flujo de registro.
- **No:** mantener `DEFINER` y aceptar el warning, ni mover la comprobación a un route handler. Lo primero deja deuda; lo segundo añade código y cambia el flujo sin necesidad.
- **Sí:** cabeceras = las 3 del checklist + HSTS + Permissions-Policy. Son de bajo riesgo y el juego no usa cámara, micrófono ni geolocalización.
- **No:** CSP en esta spec. Puede romper Next y los recursos externos; va aparte.
- **Sí:** HSTS sin `preload`. Entrar en la lista de preload es difícil de revertir.
- **Sí:** límite de 5 registros por hora por IP. Deja margen a uso humano y frena bots.
- **Sí:** criterio de aceptación con `get_advisors`. Es la misma fuente que generó el checklist.
- **Aplazado (2026-10-23):** activar _Prevent use of leaked passwords_ en el dashboard queda pendiente por decisión del usuario; el warning `auth_leaked_password_protection` sigue activo y la traducción del error ya está en el código.
- **Sí (2026-10-23):** el dashboard de Auth ya exige minúscula, mayúscula, número y símbolo (`weak_password` con `reasons: ["characters"]`). `getErrorMessage` lo traduce a "LA CONTRASEÑA NECESITA MINÚSCULA, MAYÚSCULA, NÚMERO Y SÍMBOLO". Los formularios no validan esta regla en el cliente; la impone el servidor.
- **Sí:** `alias_disponible` conserva `set search_path = ''` (el de `0004`) en lugar de `public`; el cuerpo ya usa `public.profiles` calificado.
- **Sí:** RLS solo se verifica, no se rehace. Ya está habilitado desde la migración 0001.

## Riesgos

| Riesgo                                                                                                                       | Mitigación                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Prevent use of leaked passwords" puede requerir un plan de pago de Supabase (Pro o superior).                               | Comprobarlo en el paso 4. Si el plan no lo permite, dejar el warning documentado como riesgo aceptado y marcar ese criterio como no aplicable en esta spec. |
| El dashboard expresa el límite de registros por IP en otra unidad (p. ej. por 5 minutos) y no por hora.                      | Usar el valor equivalente más cercano a 5 por hora y anotarlo en la spec al implementar.                                                                    |
| Varias personas tras la misma IP (colegio, casa) agotan el límite de registros.                                              | Es el costo asumido del límite; el mensaje pide esperar un momento.                                                                                         |
| `X-Frame-Options: DENY` impide incrustar el sitio en un `iframe`.                                                            | El sitio no se incrusta en ningún lado; el reproductor es una página propia, no un iframe.                                                                  |
| HSTS fija HTTPS durante 2 años: si el dominio de producción no sirviera HTTPS, quedaría inaccesible para quien ya lo visitó. | Aplica solo sobre HTTPS (el navegador lo ignora en `http://localhost`); confirmar que producción sirve HTTPS antes de desplegar.                            |
| `create or replace` con `security invoker` falla si `profiles` pierde el `select` público.                                   | La verificación del paso 1 revisa la política `profiles_select_public` y hay criterio de aceptación sobre el registro.                                      |

## Lo que **no** entra en esta spec

- `Content-Security-Policy`.
- CAPTCHA, límite de tasa propio en la app, MFA.
- Auditoría de secretos y de tablas futuras.
