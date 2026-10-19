# Game Jam — Catálogo y puesta en producción de CAVERNAS

**Estado:** Draft
**Depende de:** `01-juego-cavernas.md` (esta carpeta), SPEC 06 (catálogo en Supabase)
**Fecha:** 2026-10-19
**Objetivo:** agregar la fila `cavernas` al catálogo, su portada `cover-cavernas` y verificar su integración en biblioteca, ficha, reproductor y salón.

## Contexto

Cavernas entra como juego nuevo de la categoría ARCADE, con acento `magenta` (el menos usado del catálogo: hoy solo lo lleva `caida`). En `/biblioteca` se presenta como "el juego de cavar túneles": una tarjeta con la portada de tierra violeta y un monstruo verde bajo la superficie. La ficha `/juego/cavernas` y el reproductor `/jugar/cavernas` usan la fila sin cambios de código en las páginas.

## Alcance

**Incluye:**

- `supabase/migrations/0006_juego_cavernas.sql`:

```sql
-- Game Jam: juego nuevo 'cavernas' (Dig Dug).
insert into games (id, title, short, long, cat, cover, color, best, plays, sort_order) values
  ('cavernas', 'CAVERNAS', 'Cava túneles, infla monstruos y aplástalos con rocas.', 'Excava el subsuelo con tu bomba de aire y abre túneles hacia los monstruos. Infla a cada uno hasta reventarlo o deja caer una roca sobre ellos, pero no te demores: si tardas, se vuelven fantasmas y atraviesan la tierra para ir por ti. Tres vidas y cada nivel trae más monstruos.', 'ARCADE', 'cover-cavernas', 'magenta', 14600, '3.7K', 11);
```

- `app/globals.css`: clase `cover-cavernas`, siguiendo el patrón de `cover-rana`/`cover-duelo`:
  - Fondo `linear-gradient(180deg, #0a0a18 0 18%, #2a0a24 18% 100%)` (cielo oscuro sobre tierra violeta).
  - `::after` con `position: absolute; inset: 0` y varios fondos apilados: un túnel horizontal `#0a0a18` (`linear-gradient` en `0 55% / 70% 14px no-repeat`), un túnel vertical (`30% 30% / 14px 40%`), un monstruo `radial-gradient(circle at 78% 56%, var(--green) 0 9px, transparent 10px)`, el excavador `radial-gradient(circle at 24% 56%, var(--magenta) 0 9px, transparent 10px)` y una roca `radial-gradient(circle at 60% 28%, #8a7a9a 0 10px, transparent 11px)`.
  - `filter: drop-shadow(0 0 8px rgba(255,0,110,0.5))`.
- `lib/games/registry.ts` queda cubierto por la spec 01 de esta carpeta.
- Sin assets: no se crea `public/games/cavernas/`.

**No incluye (explícitamente fuera de esta spec):**

- Cambios a otras filas del catálogo ni al esquema, RLS o `lib/data.ts` (la fila viene de Supabase).
- Cambios a `app/jugar/[id]/page.tsx`, `components/games/GameCanvas.tsx` o `lib/games/types.ts`.
- Recalcular `best` o `plays` con partidas reales.

## Modelo de datos

Una fila nueva en `games`: `id` `cavernas`, `title` `CAVERNAS`, `cat` `ARCADE`, `cover` `cover-cavernas`, `color` `magenta`, `best` 14600, `plays` `3.7K`, `sort_order` 11. `saveScore({ gameId: "cavernas", score, name })` inserta en `scores` con `game_id` apuntando a esa fila (la FK exige que exista antes de guardar). `best` 14600 es coherente con la puntuación del motor: unos 10 niveles de 6 monstruos a 300–500 puntos más 500 por nivel limpio.

## Plan de implementación

1. Migración `0006_juego_cavernas.sql`. Si `0006` o `sort_order` 11 estuvieran ocupados (ver Riesgos), usar el siguiente número y orden libres. Aplicarla con el MCP de `supabase` y verificar: `select id, cat, color, sort_order from games where id = 'cavernas'`.
2. Clase `cover-cavernas` en `app/globals.css`.
3. Motor `lib/games/cavernas.ts` (spec 01).
4. Entrada `cavernas` en `lib/games/registry.ts`.
5. Correr `npm run lint` y `npm run build`.

## Plan de pruebas / QA

- [ ] `/biblioteca` muestra la tarjeta CAVERNAS con su portada y el texto `short`; el filtro `ARCADE` la incluye y `PUZZLE`/`SHOOTER`/`VERSUS` no.
- [ ] La tarjeta aparece al final de la lista, por `sort_order`.
- [ ] `/juego/cavernas` muestra título, `long`, `best` y plays; el top-10 está vacío o con las partidas guardadas.
- [ ] `/jugar/cavernas` carga el motor real (no la arena simulada) y el HUD muestra vidas numéricas.
- [ ] Una partida terminada guarda con el nombre del usuario o `INVITADO`.
- [ ] `/salon` ofrece la pestaña CAVERNAS con la puntuación guardada.
- [ ] En pantalla táctil aparecen las flechas y el botón `BOMBA`.
- [ ] `/jugar/caida`, `/jugar/serpentina`, `/jugar/bloque-buster` y `/jugar/asteroids` se comportan igual que antes.

## Criterios de aceptación

- [ ] La fila `cavernas` existe en Supabase con los valores de la migración.
- [ ] `cover-cavernas` se ve completa y legible dentro de la tarjeta y en la ficha.
- [ ] Todos los puntos de QA anteriores pasan.
- [ ] La puntuación guardada se lee en `/salon` y `/juego/cavernas`.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones tomadas y descartadas

- **ARCADE y `magenta`** — la categoría coincide con la de Serpentina y Bloque Buster, pero el magenta equilibra la paleta (los últimos juegos usan `green` y `cyan`). Descartado: SHOOTER, porque disparar la bomba es secundario frente a excavar.
- **`sort_order` 11** — el máximo real en `supabase/migrations/` es 8, pero las specs de jam `cruce-infinito` (9) y `paso-contado` (10) ya reservan esos números; para que las tres filas puedan coexistir se usa 11 (y 12 para `pista-turbo`). Un hueco en el orden no afecta la lista. Descartado: usar 9 y arriesgar una colisión de orden.
- **Migración `0006`** — el último archivo es `0003`, pero `0004` y `0005` están reservados por esas mismas specs. Descartado: `0004`, por la misma colisión.
- **Texto en el tono de las filas existentes** — frases cortas, verbos de acción y una amenaza final.
- **`best` 14600 y `plays` `3.7K`** — en el rango de Serpentina (7820) y Glotón (96400), con un volumen de jugadas de juego recién llegado.
- **Portada con primitivas CSS** — mismo patrón que `cover-rana` y `cover-duelo`, sin imágenes.

## Riesgos identificados

- **Conflicto de números de migración y de `sort_order`:** otras specs de jam reservan `0004`/`0005` y 9/10. Si se implementan en otro orden, usar el siguiente número y `sort_order` libres al aplicar; no hay dependencia entre migraciones, solo el índice primario `id`.
- **Contraste de la portada:** el magenta y el verde sobre violeta oscuro deben leerse a tamaño de tarjeta; si el monstruo se pierde, subir su radio a 11 px.
- **La FK de `scores`:** guardar una puntuación antes de aplicar la migración falla; aplicar siempre la migración primero.
