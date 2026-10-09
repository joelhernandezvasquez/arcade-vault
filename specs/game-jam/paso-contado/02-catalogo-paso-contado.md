# Game Jam — Catálogo y puesta en producción de PASO CONTADO

**Estado:** Draft
**Depende de:** `01-juego-paso-contado.md` (esta carpeta), SPEC 06 (catálogo en Supabase)
**Fecha:** 2026-10-07
**Objetivo:** agregar la fila `paso-contado` al catálogo con su portada, y verificar su integración completa en la plataforma.

## Contexto

PASO CONTADO es el puzle del catálogo con tema de cruce: el tráfico solo avanza cuando tú te mueves. Entra como la entrada 10, en la categoría PUZZLE (hoy solo tiene a Caída) y con acento `magenta`, para no cargar el extremo ARCADE.

## Alcance

**Incluye:**

- `supabase/migrations/0005_juego_paso_contado.sql`:

```sql
-- Game Jam: nueva entrada 'paso-contado'.
insert into games (id, title, short, long, cat, cover, color, best, plays, sort_order) values
  ('paso-contado', 'PASO CONTADO', 'El tráfico solo avanza cuando tú te mueves.', 'Coches y troncos se desplazan una casilla cada vez que das un paso. Lee los patrones, espera el hueco justo y cruza el tablero en el menor número de turnos. Cada cruce nuevo es un puzle más cruel.', 'PUZZLE', 'cover-paso', 'magenta', 3200, '2.3K', 10);
```

El `sort_order` 10 es el siguiente libre tras el 9 de `cruce-infinito`.

- Clase `cover-paso` nueva para `app/globals.css`:

```css
.cover-paso {
  background: linear-gradient(135deg, #2a0030, #0a0a18);
}
.cover-paso::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    repeating-linear-gradient(
      0deg,
      rgba(255, 0, 170, 0.22) 0 1px,
      transparent 1px 24px
    ),
    repeating-linear-gradient(
      90deg,
      rgba(255, 0, 170, 0.22) 0 1px,
      transparent 1px 24px
    ),
    linear-gradient(var(--yellow), var(--yellow)) 30% 38%/12% 12% no-repeat,
    linear-gradient(var(--cyan), var(--cyan)) 62% 38%/12% 12% no-repeat,
    radial-gradient(circle at 50% 80%, var(--green) 0 11px, transparent 12px);
  filter: drop-shadow(0 0 8px rgba(255, 0, 170, 0.5));
}
```

Descripción visual: cuadrícula magenta fina, dos casillas (amarilla y cyan) a modo de coche y tronco, y un punto verde brillante abajo (la rana).

- Sin assets: no se copia nada a `public/games/paso-contado/`.

**No incluye:**

- Cambios a otras filas, a `lib/data.ts` (`CATS` ya contiene `PUZZLE`) ni a páginas.
- El motor y su registro (spec `01-juego-paso-contado.md`).
- Tests automatizados.

## Modelo de datos

Una fila nueva en `games`: `id` `paso-contado`, `title` `PASO CONTADO`, `cat` `PUZZLE`, `cover` `cover-paso`, `color` `magenta`, `best` 3200, `plays` `2.3K`, `sort_order` 10. `saveScore({ gameId: "paso-contado", score, name })` inserta en `scores` con `game_id` apuntando a esa fila (la FK exige que exista). `best` 3200 es coherente con la fórmula (`100 · level + hasta 160` por tablero) tras unos 15 tableros.

## Plan de implementación

1. Migración `0005_juego_paso_contado.sql` (si `0005` está ocupado, usar el siguiente número libre) y aplicarla con el MCP de `supabase`. Verificar con `select id, sort_order from games order by sort_order`.
2. Agregar `.cover-paso` en `app/globals.css`.
3. Implementar el motor (spec 01).
4. Registrar `"paso-contado"` en `lib/games/registry.ts`.
5. `npm run lint` y `npm run build`.

## Plan de pruebas / QA

- [ ] `/biblioteca` muestra la tarjeta PASO CONTADO con portada legible y aparece con los filtros `TODOS` y `PUZZLE` (junto a Caída), no con `ARCADE`.
- [ ] `/juego/paso-contado` muestra título, `long`, mejor 3200 y la portada.
- [ ] `/jugar/paso-contado` carga el motor real.
- [ ] Guardar una puntuación (con nombre y como `INVITADO`) y verla en `/salon` bajo su pestaña y en `/juego/paso-contado`.
- [ ] `/jugar/ranaria`, `/jugar/serpentina`, `/jugar/caida`, `/jugar/bloque-buster` y `/jugar/asteroids` no cambian.
- [ ] El orden de la biblioteca respeta `sort_order` (PASO CONTADO al final).

## Criterios de aceptación

- [ ] La fila existe con los valores exactos de esta spec.
- [ ] `.cover-paso` está en `app/globals.css` y se ve bien en biblioteca, detalle y home.
- [ ] Todos los puntos de QA pasan.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones tomadas y descartadas

- **PUZZLE + `magenta`** — Caída es el único puzle y también magenta, pero el catálogo tiene poco magenta y el cruce por turnos pide una portada distinta de los verdes de Serpentina y Ranaria. Descartado: `cyan` (ya en Bloque Buster y Cruce Infinito).
- **`sort_order` 10** — siguiente libre; no se reordenan filas existentes.
- **Portada de cuadrícula** — comunica "casillas y turnos" sin sprites, dentro del patrón de las `cover-*` actuales.
- **`best` 3200 y `plays` `2.3K`** — datos de muestra bajos por ser un puzle nuevo y de nicho.

## Riesgos identificados

- **Numeración de migraciones:** esta jam asigna `0003`–`0005`. Si se implementa en otro orden, usar el siguiente número libre y renombrar.
- **`sort_order`:** si `cruce-infinito` no se implementa, el 9 queda libre pero no se renumera; el orden relativo no cambia.
- **Contraste de la portada:** las líneas magenta con baja opacidad sobre fondo oscuro deben respetar la legibilidad del título; revisar en la tarjeta.
- **FK en `scores`:** aplicar siempre la migración antes de guardar puntuaciones.
