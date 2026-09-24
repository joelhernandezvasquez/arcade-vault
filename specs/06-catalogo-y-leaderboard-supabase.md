# 06 — Catálogo de juegos y leaderboard en Supabase

**Estado:** implementado
**Depende de:** SPEC 04
**Fecha:** 2026-09-23
**Objetivo:** Migrar el catálogo de juegos y las puntuaciones (`lib/data.ts` estático + `lib/scores.ts` en localStorage) a dos tablas reales de Supabase (`games` y `scores`), y conectar todas las pantallas que hoy leen esos datos falsos/locales para que lean y escriban contra la base de datos.

## Contexto

Hoy `lib/data.ts` exporta un array estático `GAMES` (8 juegos hardcodeados) y una función `seededScores(seed, count)` que genera filas de leaderboard falsas con una semilla determinística — no hay ninguna puntuación real salvo las de `asteroids`, que se guardan en `localStorage` vía `lib/scores.ts` (`saveScore`/`ScoreEntry`). Seis archivos consumen `GAMES` de forma síncrona (`app/page.tsx`, `app/biblioteca/page.tsx`, `app/juego/[id]/page.tsx`, `app/jugar/[id]/page.tsx`, `components/GameCard.tsx`, `app/salon/page.tsx`), y `app/salon/page.tsx` además usa `seededScores` para el Salón de la Fama. El spec 04 dejó los clientes de Supabase (`lib/supabase/client.ts`, `lib/supabase/server.ts`) listos y verificados, pero el proyecto sigue sin ninguna tabla. Este spec crea `games` y `scores`, siembra `games` con el catálogo actual, y hace que todo el frontend pase de leer datos estáticos/falsos a leer y escribir contra Supabase.

## Alcance

**Incluye:**

- Tabla `games` en Supabase: se convierte en la fuente de verdad del catálogo. Se siembra con los 8 juegos que hoy están en `lib/data.ts`, con los mismos valores (`id`, `title`, `short`, `long`, `cat`, `cover`, `color`, `best`, `plays`) y un `sort_order` que preserva el orden actual de aparición (bloque-buster, caida, serpentina, gloton, invasores, asteroids, ranaria, duelo-pixel).
- Tabla `scores`: guarda cada partida terminada, con `game_id` como FK a `games.id` (texto, ej. `"asteroids"`), `name`, `score`, `id` (uuid, PK) y `created_at` (timestamptz, default `now()`, generado por el servidor).
- RLS en ambas tablas: `games` permite `SELECT` público (anon) y no permite `INSERT`/`UPDATE`/`DELETE` vía anon key (el catálogo solo se modifica por migración). `scores` permite `SELECT` e `INSERT` públicos (anon) — igual que hoy, cualquiera termina una partida y guarda con iniciales de texto libre sin necesitar sesión — y no permite `UPDATE`/`DELETE`.
- `lib/supabase/games.ts` (nuevo): `getGames(): Promise<Game[]>`, usando el cliente de browser (`lib/supabase/client.ts`) del spec 04, `SELECT * FROM games ORDER BY sort_order`. La interfaz `Game` se mueve aquí (o se re-exporta desde aquí) para que sea el único punto de verdad del tipo.
- `lib/supabase/scores.ts` (nuevo, reemplaza a `lib/scores.ts`): `saveScore({ gameId, score, name }): Promise<void>` (INSERT), `getTopScores(gameId, limit): Promise<ScoreRow[]>` (SELECT ordenado por `score DESC`), `getBestScore(gameId, name): Promise<ScoreRow | null>` (mejor puntuación de un jugador para un juego, usado por "TU MEJOR MARCA" en `/salon`).
- `lib/scores.ts` se elimina (su `ScoreEntry`/`saveScore` en localStorage quedan reemplazados por `lib/supabase/scores.ts`).
- `lib/data.ts` pierde `GAMES` y `seededScores`; conserva `CATS` (taxonomía fija de categorías, no pasa a ser tabla) y las interfaces que sigan haciendo falta (`ScoreRow` se mueve a `lib/supabase/scores.ts`).
- Todas las pantallas que hoy importan `GAMES` de forma síncrona (`app/page.tsx`, `app/biblioteca/page.tsx`, `app/juego/[id]/page.tsx`, `app/jugar/[id]/page.tsx`, `app/salon/page.tsx`) pasan a cargarlo de forma asíncrona con `getGames()` en un `useEffect`, mostrando un estado de carga simple (texto `pixel` "CARGANDO...") mientras se resuelve. `components/GameCard.tsx` no cambia su lógica, solo el tipo `Game` que recibe por props (mismo shape).
- `app/juego/[id]/page.tsx`: la vista previa de leaderboard que hoy usa `seededScores(...)` pasa a usar `getTopScores(game.id, N)` (mismo `N` que hoy, mismo componente visual); si no hay puntuaciones reales para ese juego, se muestra la tabla vacía con el mensaje `SIN PUNTUACIONES TODAVÍA` en vez de filas falsas.
- `app/salon/page.tsx`: el podio y la tabla por pestaña pasan a usar `getTopScores(tab, 12)` en vez de `seededScores`; mismo mensaje de vacío que arriba cuando un juego no tiene puntuaciones aún. El bloque destacado "TU MEJOR MARCA EN {juego}" se calcula con `getBestScore(tab, user.name)` cuando hay sesión de `UserProvider`; si el usuario no tiene ninguna puntuación guardada para ese juego, el bloque no se muestra (en vez del valor inventado `rows[5]?.score - 2400` actual).
- `app/jugar/[id]/page.tsx`: el botón "GUARDAR PUNTUACIÓN" del modal de fin de partida pasa a llamar a `saveScore({ gameId: game.id, score, name })` de `lib/supabase/scores.ts` en vez de `saveScore` de `lib/scores.ts`; se agrega un estado de error simple (texto `mono` en rojo/magenta) si el INSERT falla, sin bloquear la posibilidad de reintentar.
- Archivo de migración SQL versionado en `supabase/migrations/0001_games_and_scores.sql` con el DDL completo (`CREATE TABLE`, políticas RLS, `INSERT` de seed de los 8 juegos).

**No incluye (explícitamente fuera de este spec):**

- Autenticación real con Supabase Auth — sigue usándose el `UserProvider` simulado de localStorage (spec de `auth-supabase` futuro, mencionado en spec 04).
- Validación anti-trampa de puntuaciones (nada impide hoy, ni después de este spec, que alguien inserte un `score` arbitrario vía la anon key) — riesgo documentado más abajo, no un bloqueante de este spec.
- Columna `playable` u otra forma de que la base de datos decida qué juegos tienen motor real vs. arena decorativa — eso lo sigue decidiendo `app/jugar/[id]/page.tsx` con el `if (game.id === "asteroids")` existente.
- Recalcular `best`/`plays` de `games` a partir de datos reales de `scores` — quedan como columnas estáticas copiadas tal cual del catálogo actual (igual que hoy son valores de muestra, no agregados reales).
- Un panel de administración para crear/editar/borrar juegos — el catálogo se siembra una sola vez por migración SQL, sin CRUD desde la app.
- Paginación del Salón de la Fama más allá de las 12 filas que ya muestra hoy `seededScores`.
- Borrar o editar una puntuación ya guardada (ni desde la app ni RLS lo permite).
- Correr la migración automáticamente como parte de este spec — se asume que, para cuando se ejecute `/spec-impl`, el MCP de `supabase` ya está autorizado (vía `/mcp`) y se usa para aplicar el archivo `supabase/migrations/0001_games_and_scores.sql` contra el proyecto `vgppkjxuqdhjstprzotw`; si no lo está, el paso se hace manualmente desde el SQL Editor de Supabase.

## Modelo de datos

```sql
create table games (
  id text primary key,
  title text not null,
  short text not null,
  long text not null,
  cat text not null,
  cover text not null,
  color text not null,
  best bigint not null default 0,
  plays text not null default '0',
  sort_order integer not null
);

create table scores (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references games(id),
  name text not null,
  score bigint not null,
  created_at timestamptz not null default now()
);
```

Tipos TypeScript (`lib/supabase/games.ts` / `lib/supabase/scores.ts`):

```ts
export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: string;
  cover: string;
  color: string;
  best: number;
  plays: string;
}

export interface ScoreRow {
  id: string;
  gameId: string;
  name: string;
  score: number;
  createdAt: string;
}
```

`sort_order` no se expone en `Game` (es de solo-ordenamiento en la query); `CATS` sigue siendo el array estático `["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"]` en `lib/data.ts`, sin tabla propia.

## Plan de implementación

1. Crear `supabase/migrations/0001_games_and_scores.sql` con las tablas `games`/`scores`, `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, las políticas (`games`: `SELECT` público; `scores`: `SELECT` e `INSERT` públicos) y el `INSERT INTO games` con los 8 juegos actuales de `lib/data.ts` y su `sort_order` (1 a 8).
2. Aplicar la migración contra el proyecto Supabase (`vgppkjxuqdhjstprzotw`) vía el MCP de `supabase` autorizado, o manualmente desde el SQL Editor si el MCP no está disponible. Verificar con una consulta simple (`select * from games`) que las 8 filas quedaron sembradas.
3. Crear `lib/supabase/games.ts` con la interfaz `Game` y `getGames()`.
4. Crear `lib/supabase/scores.ts` con `ScoreRow`, `saveScore`, `getTopScores`, `getBestScore`; borrar `lib/scores.ts`.
5. Actualizar `lib/data.ts`: quitar `GAMES`, `seededScores` y la interfaz `Game` (ahora vive en `lib/supabase/games.ts`); dejar `CATS` y `PLAYERS` solo si `PLAYERS` sigue en uso (si no, se borra junto con `seededScores`).
6. Migrar `app/page.tsx` y `app/biblioteca/page.tsx` a cargar `getGames()` en un `useEffect` con estado de carga; confirmar que la portada y el filtro por categoría siguen funcionando igual visualmente.
7. Migrar `app/juego/[id]/page.tsx`: `getGames()` para encontrar el juego por `id`, y `getTopScores(id, N)` para la vista previa de leaderboard con el estado vacío `SIN PUNTUACIONES TODAVÍA`.
8. Migrar `app/jugar/[id]/page.tsx`: `getGames()` para resolver el juego, y el botón "GUARDAR PUNTUACIÓN" para llamar a `saveScore` de `lib/supabase/scores.ts` con manejo de error simple.
9. Migrar `app/salon/page.tsx`: `getGames()` para las pestañas, `getTopScores(tab, 12)` para el podio/tabla, `getBestScore(tab, user.name)` para el bloque "TU MEJOR MARCA" (oculto si no hay resultado).
10. Correr `npm run lint` y `npm run build`, confirmar que no hay errores.
11. Probar manualmente con `npm run dev`: `/biblioteca` y `/` cargan el catálogo desde Supabase; `/juego/asteroids` muestra el leaderboard real (vacío si no hay partidas guardadas aún); jugar una partida en `/jugar/asteroids`, guardarla con iniciales, y confirmar que aparece en `/salon` bajo la pestaña `ASTEROIDS` y en la vista previa de `/juego/asteroids`; recargar la página (o abrir en otra pestaña/navegador) y confirmar que la puntuación persiste (a diferencia de localStorage, que era por navegador); simular sesión en `/auth` con un nombre que coincida con una puntuación guardada y confirmar que aparece "TU MEJOR MARCA" en `/salon`.

## Criterios de aceptación

- [ ] Las tablas `games` y `scores` existen en el proyecto Supabase con las columnas y políticas RLS descritas.
- [ ] `games` contiene exactamente los 8 juegos del catálogo actual, en el mismo orden de aparición que hoy.
- [ ] `/` y `/biblioteca` muestran el catálogo leyendo de Supabase (no de `lib/data.ts`, que ya no exporta `GAMES`).
- [ ] Guardar una puntuación en `/jugar/[id]` inserta una fila real en `scores` (verificable recargando la página o consultando la tabla).
- [ ] `/juego/[id]` muestra un leaderboard real basado en `scores`, con el mensaje `SIN PUNTUACIONES TODAVÍA` si el juego no tiene ninguna.
- [ ] `/salon` muestra el podio y la tabla por juego con datos reales de `scores`, con el mismo mensaje de vacío cuando corresponda.
- [ ] El bloque "TU MEJOR MARCA" en `/salon` solo aparece cuando el usuario logueado (`UserProvider`) tiene al menos una puntuación real guardada para el juego seleccionado, y muestra ese valor real.
- [ ] Una puntuación guardada persiste entre recargas de página y entre navegadores/dispositivos distintos (prueba de que ya no es `localStorage`).
- [ ] `lib/scores.ts` y `seededScores`/`GAMES` de `lib/data.ts` ya no existen en el código.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones tomadas y descartadas

- **Migrar el catálogo completo a la tabla `games` (no solo una tabla de referencia para la FK)** — evita mantener dos fuentes de verdad (`lib/data.ts` y la tabla) sincronizadas a mano; el catálogo cambia poco pero cuando cambie, cambia en un solo lugar.
- **`game_id` como texto (mismo `id` que ya usan las rutas y `lib/data.ts`, ej. `"asteroids"`) en vez de UUID autogenerado para `games`** — las rutas (`/juego/[id]`, `/jugar/[id]`) y todo el código existente ya usan esos strings como identificador; inventar un UUID solo agregaría una capa de mapeo sin beneficio.
- **INSERT público anónimo en `scores` vía RLS** — no hay Supabase Auth todavía (diferido a un spec futuro); mantiene el comportamiento actual (cualquiera termina una partida y guarda con iniciales) sin bloquear la funcionalidad por falta de auth real.
- **`/salon` migrado a datos reales, incluyendo el estado vacío** — mostrar leaderboards falsos ya no tiene sentido una vez que existe una tabla real; se prefiere un estado vacío honesto (`SIN PUNTUACIONES TODAVÍA`) a seguir inventando nombres de jugadores.
- **"TU MEJOR MARCA" calculado con `getBestScore(gameId, name)` filtrando por nombre, no por un `user_id` real** — como el `UserProvider` es simulado (solo un `name` en localStorage, sin id estable), filtrar por nombre es la única correlación posible hoy; es una limitación conocida que se resuelve cuando exista auth real.
- **Sin columna `playable` en `games`** — la distinción entre juego con motor real y arena decorativa sigue siendo un `if` en `app/jugar/[id]/page.tsx`; agregar la columna ahora sería especular sobre una necesidad futura sin un segundo juego real todavía.
- **`best`/`plays` se copian tal cual del catálogo actual y no se recalculan de `scores`** — son valores de muestra ya existentes en el diseño visual de las tarjetas; convertirlos en agregados reales (`MAX(score)`, `COUNT(*)`) es una mejora de datos independiente que no bloquea tener el catálogo y el leaderboard en la base de datos.
- **`lib/scores.ts` se borra en vez de mantenerse como fallback offline** — el objetivo explícito del spec es sacar las puntuaciones de `localStorage`; mantener el código muerto en paralelo solo generaría confusión sobre cuál es la fuente de verdad.
- **Migración versionada en `supabase/migrations/0001_games_and_scores.sql` en vez de solo ejecutarla ad-hoc** — deja un registro reproducible del esquema en el repo, consistente con cómo se documentó la conexión en el spec 04, y permite volver a aplicarla si el proyecto Supabase se recrea.
- **Estado de carga simple (texto `pixel` "CARGANDO...") en las pantallas migradas a fetch asíncrono** — antes `GAMES` era una constante síncrona; ahora depende de una llamada de red, y no mostrar nada mientras carga dejaría la pantalla en blanco de forma confusa.

## Riesgos identificados

- La política RLS de `INSERT` público en `scores` no valida el valor de `score` ni límites de frecuencia: cualquiera con la anon key puede insertar puntuaciones arbitrariamente altas o hacer spam de filas. Es el mismo nivel de "confianza en el cliente" que ya existía con `localStorage` (donde el usuario podía editar el valor directamente), así que no es una regresión, pero ahora es público en vez de local; mitigación (constraints de rango, rate limiting, o mover el guardado a un Route Handler con validación de servidor) queda para un spec futuro si se vuelve un problema real.
- Si el MCP de `supabase` no está autorizado al momento de ejecutar `/spec-impl`, el paso 2 del plan (aplicar la migración) requiere intervención manual del usuario en el SQL Editor de Supabase antes de continuar con el resto de los pasos.
- Las pantallas migradas a `useEffect` + fetch introducen una dependencia de red que no existía (los datos eran síncronos e instantáneos); si Supabase está lento o caído, `/`, `/biblioteca`, `/juego/[id]`, `/jugar/[id]` y `/salon` quedarán en el estado "CARGANDO..." sin un timeout ni reintento automático — aceptado como riesgo bajo dado que spec 04 ya verificó la conectividad del proyecto.
