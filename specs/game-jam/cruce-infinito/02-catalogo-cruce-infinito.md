# Game Jam — Catálogo y puesta en producción de CRUCE INFINITO

**Estado:** Draft
**Depende de:** `01-juego-cruce-infinito.md` (esta carpeta), SPEC 06 (catálogo en Supabase)
**Fecha:** 2026-10-07
**Objetivo:** agregar la fila `cruce-infinito` al catálogo con su portada, y verificar su integración completa en la plataforma.

## Contexto

CRUCE INFINITO se presenta como el hermano frenético de RANARIA: sin meta, con el mundo generándose hacia adelante y una cámara que te empuja. Entra al catálogo como la entrada 9, en ARCADE y con acento `cyan` (carretera y agua), para repartir colores: ARCADE ya tiene dos entradas verdes (Serpentina, Ranaria) y una cyan (Bloque Buster).

## Alcance

**Incluye:**

- `supabase/migrations/0004_juego_cruce_infinito.sql`:

```sql
-- Game Jam: nueva entrada 'cruce-infinito'.
insert into games (id, title, short, long, cat, cover, color, best, plays, sort_order) values
  ('cruce-infinito', 'CRUCE INFINITO', 'Cruza sin parar antes de que la cámara te alcance.', 'Hierba, autopistas, ríos y vías de tren se generan sin fin ante ti. Salta, esquiva y recoge monedas mientras la cámara avanza sola: quedarte quieto es tan mortal como un camión.', 'ARCADE', 'cover-cruce', 'cyan', 2460, '3.7K', 9);
```

El `sort_order` 9 es el siguiente libre (el 8 es `duelo-pixel`).

- Clase `cover-cruce` nueva para `app/globals.css`, con el patrón de las `cover-*` existentes:

```css
.cover-cruce {
  background: linear-gradient(180deg, #00243a, #0a0a18);
}
.cover-cruce::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    repeating-linear-gradient(
      0deg,
      rgba(0, 245, 255, 0.2) 0 18px,
      rgba(255, 255, 255, 0.06) 18px 36px
    ),
    linear-gradient(var(--yellow), var(--yellow)) 22% 38%/14% 8% no-repeat,
    linear-gradient(var(--magenta), var(--magenta)) 68% 62%/14% 8% no-repeat,
    radial-gradient(circle at 50% 82%, var(--green) 0 12px, transparent 13px);
  filter: drop-shadow(0 0 8px rgba(0, 245, 255, 0.5));
}
```

Descripción visual: franjas horizontales azul cian que sugieren carriles y río, dos bloques (amarillo y magenta) como vehículos y un punto verde brillante (la rana) abajo.

- Sin assets: no se copia nada a `public/games/cruce-infinito/`.

**No incluye:**

- Cambios a otras filas ni a `lib/data.ts` (`CATS` ya contiene `ARCADE`).
- El motor y su registro (spec `01-juego-cruce-infinito.md`).
- Tests automatizados.

## Modelo de datos

Una fila nueva en `games` con `id` `cruce-infinito`, `title` `CRUCE INFINITO`, `cat` `ARCADE`, `cover` `cover-cruce`, `color` `cyan`, `best` 2460, `plays` `3.7K`, `sort_order` 9. `saveScore({ gameId: "cruce-infinito", score, name })` inserta en `scores` con `game_id` apuntando a esa fila; sin la fila la FK rechazaría la inserción. `best` es un valor de muestra coherente con la fórmula (10 por fila + 25 por moneda).

## Plan de implementación

1. Migración `0004_juego_cruce_infinito.sql` (si `0004` está ocupado, usar el siguiente número libre) y aplicarla con el MCP de `supabase`. Verificar con `select id, sort_order from games order by sort_order`.
2. Agregar `.cover-cruce` en `app/globals.css`, junto a las demás `cover-*`.
3. Implementar el motor (spec 01).
4. Registrar `"cruce-infinito"` en `lib/games/registry.ts`.
5. Aplicar con el MCP, luego `npm run lint` y `npm run build`.

## Plan de pruebas / QA

- [ ] `/biblioteca` muestra la tarjeta CRUCE INFINITO con su portada legible y aparece con los filtros `TODOS` y `ARCADE`, no con `PUZZLE`.
- [ ] `/juego/cruce-infinito` muestra título, `long`, mejor puntuación 2460 y la portada.
- [ ] `/jugar/cruce-infinito` carga el motor real (no la arena simulada).
- [ ] Guardar una puntuación (con nombre y como `INVITADO`) y verla en `/salon` bajo su pestaña y en `/juego/cruce-infinito`.
- [ ] `/jugar/ranaria`, `/jugar/serpentina`, `/jugar/caida`, `/jugar/bloque-buster` y `/jugar/asteroids` no cambian.
- [ ] El orden de la biblioteca respeta `sort_order` (CRUCE INFINITO después de DUELO PIXEL).

## Criterios de aceptación

- [ ] La fila existe con los valores exactos de esta spec.
- [ ] `.cover-cruce` está en `app/globals.css` y se ve bien en biblioteca, detalle y home.
- [ ] Todos los puntos de QA pasan.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones tomadas y descartadas

- **ARCADE + `cyan`** — es endless de reflejos; cyan evoca carretera y río y equilibra los verdes. Descartado: `yellow`, que ya está en Glotón y Asteroids.
- **`sort_order` 9** — es el siguiente libre; no se reordenan filas existentes.
- **Portada con franjas y bloques, sin sprites** — mismo enfoque de las `cover-*` actuales, sin assets.
- **`best` 2460 y `plays` `3.7K`** — coherentes con una partida de ~200 filas y por debajo de los juegos más populares.

## Riesgos identificados

- **Numeración de migraciones:** esta jam asigna `0003`–`0005`. Si se implementa en otro orden, usar el siguiente número libre.
- **`sort_order` repetido:** si otro juego de la jam se implementa antes, los valores 9 y 10 no deben colisionar; ajustarlos al siguiente libre.
- **Contraste de la portada:** las franjas cian de baja opacidad sobre fondo oscuro deben seguir distinguiendo el título; verificar con el texto de la tarjeta.
- **FK en `scores`:** guardar puntuaciones antes de aplicar la migración falla; aplicar siempre primero la migración.
