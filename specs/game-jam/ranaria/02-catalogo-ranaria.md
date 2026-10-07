# Game Jam — Catálogo y puesta en producción de RANARIA

**Estado:** Draft
**Depende de:** `01-juego-ranaria.md` (esta carpeta), SPEC 06 (catálogo en Supabase)
**Fecha:** 2026-10-07
**Objetivo:** actualizar la fila existente `ranaria` del catálogo para que describa el Frogger real, reutilizando su portada `cover-rana`, y verificar la integración completa en la plataforma.

## Contexto

`ranaria` es una de las 8 entradas sembradas por la migración `0001` (ARCADE, `cover-rana`, `green`, `best` 18900, `plays` `6.4K`, `sort_order` 7). Hasta hoy abre la arena decorativa. Al registrarse el motor, la tarjeta de `/biblioteca`, la ficha `/juego/ranaria` y el reproductor deben presentar el juego real: cuatro carriles de tráfico, el río con troncos y tortugas, cinco nenúfares y 30 s por rana. Se sigue el precedente de la spec 10 (`UPDATE` de `short`/`long` sobre una fila decorativa) y no se agrega una fila nueva.

## Alcance

**Incluye:**

- `supabase/migrations/0003_juego_ranaria.sql`:

```sql
-- Game Jam: Frogger real en la entrada 'ranaria'.
-- Solo cambian short/long; id, title, cat, cover, color, best, plays y sort_order se conservan.
update games
set
  short = 'Cruza la carretera y el río sin acabar aplastado.',
  long  = 'Cuatro carriles de tráfico, cinco de río y solo 30 segundos por salto. Esquiva coches y camiones, viaja en troncos y tortugas que se hunden y llena los cinco nenúfares para subir de nivel.'
where id = 'ranaria';
```

Valores resultantes de la fila: `id` `ranaria`, `title` `RANARIA`, `cat` `ARCADE`, `cover` `cover-rana`, `color` `green`, `best` 18900, `plays` `6.4K`, `sort_order` 7.

- Ninguna clase CSS nueva: `app/globals.css` ya define `.cover-rana` (degradado `#001f2a`→`#0a0a18` con franjas cyan y un punto `--green` brillante) y se conserva como está.
- Sin assets: no hay nada que copiar a `public/games/ranaria/`.
- La línea de `registry.ts` y el motor pertenecen a la spec `01-juego-ranaria.md`.

**No incluye:**

- Cambios a otras filas, a `lib/data.ts` o a páginas.
- Una portada nueva (la actual ya representa franjas y una rana).
- Cambiar `best` o `plays`: son datos de muestra del catálogo.
- Tests automatizados.

## Modelo de datos

Se actualiza la fila `ranaria` de `games` (columnas `id`, `title`, `short`, `long`, `cat`, `cover`, `color`, `best`, `plays`, `sort_order`). El motor guarda con `saveScore({ gameId: "ranaria", score, name })`, que inserta en `scores (game_id → games.id)`; como el `id` ya existe, no hay cambio de esquema ni de RLS. `best` es un valor de muestra del catálogo y no se recalcula con las partidas.

## Plan de implementación

1. Crear la migración `0003_juego_ranaria.sql` (si `0003` está ocupado al implementar, usar el siguiente número libre) y aplicarla con el MCP de `supabase`. Verificar con `select short, long from games where id = 'ranaria'`.
2. Cover: no hay cambios.
3. Implementar el motor según la spec 01.
4. Registrar `ranaria` en `lib/games/registry.ts`.
5. `npm run lint` y `npm run build`.

## Plan de pruebas / QA

- [ ] `/biblioteca` muestra la tarjeta RANARIA con el `short` nuevo y aparece en los filtros `TODOS` y `ARCADE` (y no en `PUZZLE`, `SHOOTER` ni `VERSUS`).
- [ ] `/juego/ranaria` muestra el `long` nuevo y la portada `cover-rana` sin cambios.
- [ ] `/jugar/ranaria` carga el Frogger real, con HUD de puntuación, vidas 3 y nivel 1.
- [ ] Tras perder las 3 vidas se guarda una puntuación con un nombre y con `INVITADO`.
- [ ] La puntuación aparece en `/salon` bajo RANARIA y en el top 10 de `/juego/ranaria`.
- [ ] `/jugar/serpentina`, `/jugar/caida`, `/jugar/bloque-buster` y `/jugar/asteroids` se comportan igual que antes.
- [ ] Un juego sin motor (`gloton`) sigue abriendo la arena simulada.

## Criterios de aceptación

- [ ] La fila `ranaria` tiene el `short` y `long` nuevos y conserva el resto de columnas.
- [ ] No se crea ninguna fila ni clase CSS nueva.
- [ ] Todos los puntos de QA anteriores pasan.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones tomadas y descartadas

- **`UPDATE` de la fila existente en vez de `INSERT`** — `ranaria` ya es el Frogger del catálogo; una fila `frogger` dejaría dos entradas iguales. Descartado: insertar una fila nueva.
- **Conservar `cover-rana`, `green`, `ARCADE` y `sort_order` 7** — el verde rana ya existe en el catálogo y la portada actual encaja con el juego. Descartado: rediseñar la portada.
- **Copy con el tono de las filas existentes** — frases cortas, en segunda persona, con datos concretos del juego (4 + 5 carriles, 30 s, 5 nenúfares).
- **No tocar `best` ni `plays`** — son muestras; cambiarlos no aporta nada.

## Riesgos identificados

- **Numeración de migraciones:** esta jam asigna `0003`, `0004` y `0005`. Si se implementan en otro orden o ya existe otra migración, usar el siguiente número libre y renombrar el archivo.
- **`sort_order`:** no cambia (7); el resto de juegos de la jam usa 9 y 10 (el 8 es `duelo-pixel`).
- **Contraste de la portada:** el punto verde sobre azul oscuro ya está en producción; sin riesgo nuevo.
- **Texto del `UPDATE`:** si el juego se implementa con otros tiempos o carriles, el `long` debe ajustarse antes de aplicar la migración.
