# Game Jam — Catálogo y puesta en producción de DUELO PIXEL

**Estado:** Draft
**Depende de:** `01-juego-duelo-pixel.md` (esta carpeta), SPEC 06 (catálogo en Supabase)
**Fecha:** 2026-10-19
**Objetivo:** actualizar la fila existente `duelo-pixel` para que describa el Pong real contra la CPU y verificar su integración en biblioteca, ficha, reproductor y salón.

## Contexto

`duelo-pixel` es una de las 8 entradas sembradas por la migración `0001` (VERSUS, `cover-duelo`, `cyan`, `best` 24, `plays` `4.2K`, `sort_order` 8): hasta hoy abre la arena decorativa. Su `long` promete "partida local a dos jugadores", que el juego real no ofrece, y su `best` 24 no representa el puntaje real. Se sigue el precedente de las specs 10 y de la jam de Ranaria (`UPDATE` sobre una fila decorativa) y no se agrega una fila nueva ni una clase `cover-*` nueva. Es el único juego de VERSUS jugable.

## Alcance

**Incluye:**

- `supabase/migrations/0008_juego_duelo_pixel.sql`:

```sql
-- Game Jam: juego real en la entrada 'duelo-pixel' (Pong contra la CPU).
-- Cambian short, long y best; id, title, cat, cover, color, plays y
-- sort_order se conservan.
update games
set
  short = 'Vence a la CPU y mantén la racha.',
  long  = 'Dos paletas, una pelota y una CPU que no perdona. Gana partidos a cinco puntos y cada victoria te enfrenta a un rival más rápido y más preciso. Golpea con el borde de la paleta para ángulos imposibles; la racha termina en cuanto la CPU gana un partido.',
  best  = 1800
where id = 'duelo-pixel';
```

- Valores resultantes de la fila: `id` `duelo-pixel`, `title` `DUELO PIXEL`, `cat` `VERSUS`, `cover` `cover-duelo`, `color` `cyan`, `best` 1800, `plays` `4.2K`, `sort_order` 8.
- Sin cambios en `app/globals.css`: se conserva `cover-duelo` (paletas cyan y magenta con pelota amarilla), que ya describe el juego.
- Sin assets: no se crea `public/games/duelo-pixel/`.

**No incluye (explícitamente fuera de esta spec):**

- Cambios a otras filas, al esquema, a RLS o a `lib/data.ts`.
- Cambios a `app/jugar/[id]/page.tsx`, `components/games/GameCanvas.tsx` o `lib/games/types.ts`.
- Modificar `plays` ni el `sort_order`.

## Modelo de datos

Se actualiza la fila `duelo-pixel` de `games` (columnas `id`, `title`, `short`, `long`, `cat`, `cover`, `color`, `best`, `plays`, `sort_order`). `saveScore({ gameId: "duelo-pixel", score, name })` inserta en `scores` con `game_id` apuntando a esa fila; como el `id` ya existe no hay cambio de esquema ni de RLS. `best` 1800 es un valor de muestra (no se recalcula con las partidas) coherente con la fórmula: un primer partido ganado 5–2 da `5 · 10 + 100 = 150`, y una racha de unos 4 partidos ronda los 1800.

## Plan de implementación

1. Migración `0008_juego_duelo_pixel.sql` con el `UPDATE`. Si `0008` estuviera ocupado, usar el siguiente número libre; `UPDATE` no depende del orden de las demás migraciones. Aplicarla con el MCP de `supabase` y verificar `select short, long, best from games where id = 'duelo-pixel'`.
2. Motor `lib/games/duelo-pixel.ts` (spec 01).
3. Entrada `duelo-pixel` en `lib/games/registry.ts`.
4. Correr `npm run lint` y `npm run build`.

## Plan de pruebas / QA

- [ ] `/biblioteca` muestra DUELO PIXEL con el nuevo `short`; el filtro `VERSUS` la incluye y es el único juego que aparece allí.
- [ ] La tarjeta conserva su posición (`sort_order` 8) y su portada `cover-duelo`.
- [ ] `/juego/duelo-pixel` muestra el nuevo `long` (sin mención a dos jugadores) y `best` 1800.
- [ ] `/jugar/duelo-pixel` carga el Pong real, no la arena simulada; el HUD muestra `—` en vidas.
- [ ] Al perder un partido se guarda la puntuación con el nombre del usuario o `INVITADO`.
- [ ] `/salon` muestra la pestaña DUELO PIXEL con la puntuación guardada.
- [ ] En pantalla táctil aparecen `▲` y `▼`.
- [ ] Los demás juegos se comportan igual.

## Criterios de aceptación

- [ ] La fila `duelo-pixel` tiene en Supabase el `short`, `long` y `best` de la migración, y el resto de columnas sin cambios.
- [ ] Todos los puntos de QA anteriores pasan.
- [ ] La puntuación guardada se lee en `/salon` y `/juego/duelo-pixel`.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones tomadas y descartadas

- **`UPDATE` y no `INSERT`** — la fila ya existe (migración `0001`); un `INSERT` fallaría por la clave primaria y duplicaría la entrada. Se conservan `id` y `sort_order` 8 para que los puntajes y el orden no cambien.
- **Cambiar `short`, `long` y `best`** — el `long` actual promete un modo de dos jugadores que no existe y `best` 24 no tiene sentido con la nueva fórmula. Descartado: dejar el texto viejo y añadir un segundo modo.
- **Conservar `cover-duelo`, `VERSUS` y `cyan`** — la portada ya muestra paletas y pelota. Descartado: rediseñar la portada.
- **Migración `0008`** — consecutiva con `0006` y `0007` de esta jam; el `UPDATE` es independiente del resto. Los números `0004` y `0005` están reservados por otras specs de jam.

## Riesgos identificados

- **Conflicto de números de migración:** si las migraciones de la jam se aplican en otro orden, usar el siguiente número libre; no hay dependencia entre ellas.
- **`best` de muestra desfasado:** es un valor del catálogo y no se recalcula; coherente con la fórmula al momento de escribir esta spec.
- **Texto del catálogo:** si la migración no se aplica, `/juego/duelo-pixel` seguirá prometiendo dos jugadores; verificarlo en el QA.
- **Contraste de la portada:** `cover-duelo` no cambia, pero debe seguir legible en la ficha tras el nuevo texto.
