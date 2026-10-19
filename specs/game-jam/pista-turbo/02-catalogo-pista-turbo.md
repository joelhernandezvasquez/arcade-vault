# Game Jam — Catálogo y puesta en producción de PISTA TURBO

**Estado:** Draft
**Depende de:** `01-juego-pista-turbo.md` (esta carpeta), SPEC 06 (catálogo en Supabase)
**Fecha:** 2026-10-19
**Objetivo:** agregar la fila `pista-turbo` al catálogo, su portada `cover-pista` y verificar su integración en biblioteca, ficha, reproductor y salón.

## Contexto

Pista Turbo entra como juego nuevo de ARCADE con acento `cyan`. En `/biblioteca` se presenta como "la carrera contra el reloj": la portada muestra una carretera que se estrecha hacia un horizonte azul. La ficha y el reproductor usan la fila sin cambios en las páginas; el reproductor muestra vidas como `—` porque la partida se acaba con el reloj.

## Alcance

**Incluye:**

- `supabase/migrations/0007_juego_pista_turbo.sql`:

```sql
-- Game Jam: juego nuevo 'pista-turbo' (Pole Position).
insert into games (id, title, short, long, cat, cover, color, best, plays, sort_order) values
  ('pista-turbo', 'PISTA TURBO', 'Pisa a fondo y gana segundos en cada vuelta.', 'Una carretera infinita de curvas se despliega hacia el horizonte. Esquiva a los rivales, mantén el coche en el asfalto y cruza cada punto de control antes de que el reloj llegue a cero. Cada vuelta es más rápida y más concurrida; tu puntuación es la distancia que recorras.', 'ARCADE', 'cover-pista', 'cyan', 31200, '5.3K', 12);
```

- `app/globals.css`: clase `cover-pista`, siguiendo el patrón de las `cover-*` existentes:
  - Fondo `linear-gradient(180deg, #001a3a 0 45%, #0a0a18 45% 100%)` (cielo azul sobre suelo oscuro).
  - `::after` con `position: absolute; inset: 0; clip-path: polygon(46% 45%, 54% 45%, 100% 100%, 0 100%)` y `background: repeating-linear-gradient(0deg, rgba(0,245,255,0.35) 0 14px, rgba(0,245,255,0.12) 14px 28px)` (la carretera en perspectiva con franjas en `--cyan`).
  - `::before` con las rayas centrales: `linear-gradient(var(--yellow), var(--yellow)) 50% 60% / 3px 30% no-repeat` y un coche `linear-gradient(var(--magenta), var(--magenta)) 50% 80% / 22px 12px no-repeat`.
  - `filter: drop-shadow(0 0 8px rgba(0,245,255,0.5))`.
- `lib/games/registry.ts` queda cubierto por la spec 01.
- Sin assets: no se crea `public/games/pista-turbo/`.

**No incluye (explícitamente fuera de esta spec):**

- Cambios a otras filas, al esquema, a RLS o a `lib/data.ts`.
- Cambios a `app/jugar/[id]/page.tsx`, `components/games/GameCanvas.tsx` o `lib/games/types.ts`.
- Recalcular `best` o `plays` con partidas reales.

## Modelo de datos

Una fila nueva en `games`: `id` `pista-turbo`, `title` `PISTA TURBO`, `cat` `ARCADE`, `cover` `cover-pista`, `color` `cyan`, `best` 31200, `plays` `5.3K`, `sort_order` 12. `saveScore({ gameId: "pista-turbo", score, name })` inserta en `scores` con `game_id` apuntando a esa fila (la FK exige que exista). `best` 31200 equivale a unos 260 s a velocidad máxima (120 pts/s) más los bonos de nivel, esto es, unas 10 vueltas.

## Plan de implementación

1. Migración `0007_juego_pista_turbo.sql`. Si `0007` o `sort_order` 12 estuvieran ocupados, usar el siguiente libre. Aplicarla con el MCP de `supabase` y verificar: `select id, cat, color, sort_order from games where id = 'pista-turbo'`.
2. Clase `cover-pista` en `app/globals.css`.
3. Motor `lib/games/pista-turbo.ts` (spec 01).
4. Entrada `pista-turbo` en `lib/games/registry.ts`.
5. Correr `npm run lint` y `npm run build`.

## Plan de pruebas / QA

- [ ] `/biblioteca` muestra PISTA TURBO con su portada y `short`; el filtro `ARCADE` la incluye y los otros filtros no.
- [ ] Aparece después de CAVERNAS si ambas están aplicadas (orden por `sort_order`).
- [ ] `/juego/pista-turbo` muestra título, `long`, `best` y `plays`.
- [ ] `/jugar/pista-turbo` carga el motor real, no la arena simulada; el HUD muestra `—` en vidas.
- [ ] Al terminar el reloj se guarda la puntuación con el nombre del usuario o `INVITADO`.
- [ ] `/salon` ofrece la pestaña PISTA TURBO con la puntuación guardada.
- [ ] En pantalla táctil aparecen `◀`, `▶`, `ACELERAR` y `FRENO`.
- [ ] Los demás juegos (`caida`, `serpentina`, `bloque-buster`, `asteroids`, `ranaria`) se comportan igual.

## Criterios de aceptación

- [ ] La fila `pista-turbo` existe en Supabase con los valores de la migración.
- [ ] `cover-pista` se ve completa y legible en la tarjeta y en la ficha.
- [ ] Todos los puntos de QA anteriores pasan.
- [ ] La puntuación guardada se lee en `/salon` y `/juego/pista-turbo`.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones tomadas y descartadas

- **ARCADE y `cyan`** — la carrera es arcade clásico; el cyan encaja con el cielo y la carretera. Descartado: crear una categoría nueva `CARRERAS`, porque tocaría `CATS` en `lib/data.ts` y los filtros de `/biblioteca`.
- **`sort_order` 12** — el máximo real es 8, pero las specs de jam `cruce-infinito` (9) y `paso-contado` (10) reservan esos valores y `cavernas` usa 11. Descartado: 9, por colisión.
- **Migración `0007`** — consecutiva con `0006` de `cavernas`, tras reservar `0004`/`0005` otras specs. Si se implementa en otro orden, usar el siguiente número libre.
- **`best` 31200 y `plays` `5.3K`** — coherentes con la fórmula del puntaje y con el rango del catálogo.
- **Portada con CSS y `clip-path`** — sin imágenes; el trapecio de la carretera comunica la perspectiva de un vistazo.

## Riesgos identificados

- **Conflicto de números de migración y `sort_order`** con las otras specs de jam; resolver al aplicar usando los siguientes libres.
- **Contraste de la portada:** las franjas cyan tenues sobre el suelo oscuro pueden desaparecer a tamaño de tarjeta; subir la opacidad a 0,5 si no se ven.
- **`clip-path` y `filter`:** `drop-shadow` se aplica antes del recorte en algunos navegadores y el brillo se corta; si pasa, mover el `filter` a `.cover-pista` en lugar de `::after`.
- **La FK de `scores`:** aplicar la migración antes de guardar puntuaciones.
