# Game Jam — Juego real de DIG DUG (CAVERNAS)

**Estado:** Draft
**Depende de:** SPEC 07 (motor genérico y registro de juegos), SPEC 06 (catálogo en Supabase)
**Fecha:** 2026-10-19
**Objetivo:** crear un juego de excavación y monstruos al estilo Dig Dug desde cero como motor real `lib/games/cavernas.ts`, registrado bajo el `id` `cavernas`.

## Contexto

Tema de la jam: "Bajo tierra, sobre ruedas y contra el reloj: duelos y carreras de ritmo arcade". Cavernas es la lectura "bajo tierra": un excavador abre túneles en un subsuelo sólido, infla monstruos con una bomba de aire hasta reventarlos y tira rocas sobre ellos. El "reloj" es el propio subsuelo: si un monstruo tarda en alcanzarte, se vuelve fantasma y atraviesa la tierra para ir por ti.

Es una entrada nueva del catálogo (ARCADE, `magenta`, `cover-cavernas`); no reemplaza ninguna arena decorativa. Se diseña desde cero. Hallazgos de diseño:

- **La tierra es estado mutable.** Cada celda excavada cambia el mapa para siempre en esa partida. El mapa vive en un `Uint8Array` de la instancia, nunca en el módulo, y se regenera en `reset()` y en cada nivel nuevo.
- **Rejilla como Serpentina**: 20×15 celdas de 40 px = 800×600 (4:3, sin paneles). Todas las entidades se mueven de celda a celda con interpolación visual, así que colisiones, IA y excavación se resuelven sobre enteros.
- **Todo en un solo archivo**: jugador, monstruos, rocas y bomba son tipos internos; sin assets (todo con primitivas de canvas).

## Alcance

**Incluye:**

- `supabase/migrations/0006_juego_cavernas.sql`: `INSERT` de la fila nueva (ver spec 02 de esta carpeta).
- `lib/games/cavernas.ts`: clase `CavernasGame implements GameEngine` con los tipos de `lib/games/types.ts`, sin redefinirlos.
  - Mapa: fila 0 es la superficie (abierta, el jugador empieza en la celda (10, 0)); filas 1–14 son tierra. `dirt[y * 20 + x]` vale 1 (tierra) o 0 (túnel). Cada nivel abre además seis bolsillos de 2 celdas para monstruos: celdas (17,4), (2,8), (17,12), (2,4), (17,8), (2,12) más su vecina horizontal hacia el centro.
  - Movimiento por celdas: el jugador toma la última dirección pulsada que siga presionada y avanza a la celda adyacente. Tarda 0,18 s si la celda destino es tierra (la abre al llegar) y 0,12 s si ya es túnel. Hacia un borde del tablero o hacia una roca no avanza. Excavar no da puntos.
  - Teclas: `←`/`→`/`↑`/`↓` y `W`/`A`/`S`/`D` mueven; `Espacio` dispara la bomba. Todas llaman a `preventDefault()` en `keydown`/`keyup`. En pausa o terminado, las teclas se ignoran sin encolar nada; el estado de teclas se sigue actualizando en `keyup` para no dejar una dirección "pegada" al reanudar.
  - Bomba: `Espacio` lanza un arpón en la dirección en que mira el jugador; avanza 480 px/s por celdas de túnel hasta un máximo de 3 celdas y se detiene ante tierra, roca o el borde. Si toca un monstruo, queda enganchado y el jugador no puede moverse. Cada nueva pulsación de `Espacio` (ignorando `event.repeat`) infla al monstruo una etapa (1 a 4); la etapa 4 lo revienta. Si pasan 0,8 s sin bombear, se desinfla una etapa (y la bomba se suelta al llegar a 0). Un monstruo inflado (etapa ≥ 1) está aturdido: no se mueve ni mata al tocarlo.
  - Monstruos: 2 + nivel (máximo 6). Se mueven por celdas de túnel con un tiempo de paso de `max(0.18, 0.32 − 0.02 · (nivel − 1))` s. En cada celda eligen entre las vecinas abiertas (sin dar media vuelta salvo callejón sin salida): con 70 % la que minimiza la distancia Manhattan al jugador y con 30 % una al azar. Modo fantasma: cada monstruo tiene un temporizador de `max(2.5, 5 + azar(0–3) − 0.5 · (nivel − 1))` s; al agotarse se vuelve fantasma (se dibuja como un par de ojos) y avanza hacia el jugador a través de la tierra al mismo ritmo. Vuelve a ser sólido al llegar a una celda de túnel tras al menos 1,5 s de fantasma y reinicia su temporizador.
  - Rocas: 4 por nivel, en celdas de tierra de las filas 2–12 con otra tierra debajo, nunca dos apiladas. Una roca es obstáculo para jugador y monstruos. Cuando la celda de abajo queda abierta (tú o un fantasma la excavan), tiembla 0,6 s y cae a 360 px/s hasta chocar con tierra, otra roca o el fondo, y se desvanece. Mata al jugador o a todo monstruo que toque al caer (+1000 por monstruo aplastado).
  - Puntuación por monstruo reventado según la fila de la celda donde estaba: filas 1–4: 200; 5–8: 300; 9–11: 400; 12–14: 500. Limpiar el nivel (cero monstruos vivos): +500.
  - Vidas: 3. Tocar a un monstruo con etapa 0 o ser aplastado quita una vida: el jugador reaparece en (10, 0) con 1,5 s de parpadeo invulnerable; el mapa y los monstruos se conservan. Con 0 vidas llama a `endGame()`.
  - `GameState`: `{ score, lives, level, gameOver }` con `lives` de 3 a 0 y `level` = 1 + niveles limpiados, sin tope. `reportState()` solo emite al cambiar alguno de esos campos.
  - Loop con `requestAnimationFrame`, `dt` acotado a 0,05 s; `resume()` reinicia `lastTime`; la pausa congela `update()` y `draw()`; el overlay "EN PAUSA" lo dibuja la página.
  - Un único camino de fin de partida (`endGame()`): perder la última vida y `forceGameOver()` ponen `gameOver = true`, emiten el estado una sola vez y detienen el loop; después se ignoran teclas y no corre más `update()`.
  - `constructor(canvas)`: crea el contexto 2D y agrega `keydown`/`keyup` en `document`. `destroy()` los remueve y cancela el `requestAnimationFrame` pendiente.
  - Dibujo: cielo `#0a0a18` en la fila 0, tierra en franjas por profundidad (`#4a1d3a`, `#3a1550`, `#2a0f40`, `#1c0a30`), túneles `#0a0a18`, excavador magenta (`#ff006e`) con casco amarillo, monstruos verdes (`#00ff88`) con ojos blancos que se hinchan según la etapa, rocas grises (`#8a7a9a`) y arpón blanco. Sin HUD ni overlays en el canvas.
- `lib/games/registry.ts`: nueva entrada `cavernas: { width: 800, height: 600, controlesTactiles: [flecha("Up", "▲"), flecha("Left", "◀"), flecha("Right", "▶"), flecha("Down", "▼"), { etiqueta: "BOMBA", ...ESPACIO, zona: "derecha" }], create: (canvas) => new CavernasGame(canvas) }`.
- `app/globals.css`: la clase `cover-cavernas` (ver spec 02).

**No incluye (explícitamente fuera de esta spec):**

- Ningún cambio a otros juegos del catálogo ni a `app/jugar/[id]/page.tsx`, `components/games/GameCanvas.tsx` o `lib/games/types.ts`.
- Skins (`skins` en el registro), sonido, gamepad físico y tecla de pausa propia.
- Segundo tipo de monstruo (dragón que escupe fuego), frutas bonus, animaciones de reventón y niveles con mapas distintos.
- Tests automatizados (el proyecto no tiene test runner configurado).
- Validación anti-trampa de puntuaciones (mismo riesgo aceptado que la spec 06).

## Modelo de datos

No hay modelo persistente nuevo salvo la fila del catálogo (spec 02). Se reutilizan `GameState`, `GameEngine` y `GameDefinition` de `lib/games/types.ts` (spec 07) y `saveScore` (spec 06) con `gameId: "cavernas"`.

Tipos internos de `lib/games/cavernas.ts` (no exportados): `Cell { x, y }`, `Mover { cell, target, t, dur }` (interpolación entre celdas), `Monster { mover, stage, ghost, ghostTimer, ghostTime, dead }`, `Rock { cell, state: "quieta" | "tiembla" | "cae", t, py }`, `Harpoon { dir, len, hit }`. Campos privados: `dirt`, `player`, `monsters`, `rocks`, `harpoon`, `keys`, `score`, `lives`, `level`, `invuln`, `paused`, `over`, `lastTime`. Las constantes de rejilla, tiempos y puntos son constantes del módulo de solo lectura.

## Plan de implementación

1. Migración `supabase/migrations/0006_juego_cavernas.sql` (ver spec 02). Si el número estuviera ocupado, usar el siguiente libre. Aplicarla con el MCP de `supabase` y verificar con `select id, sort_order from games where id = 'cavernas'`.
2. Clase `cover-cavernas` en `app/globals.css`.
3. Crear `lib/games/cavernas.ts`: mapa y generación de nivel, movimiento por celdas, bomba, monstruos y fantasma, rocas, vidas, dibujo.
4. Agregar la entrada `cavernas` en `lib/games/registry.ts`.
5. Correr `npm run lint` y `npm run build`.
6. Probar manualmente con `npm run dev` en `/jugar/cavernas`:
   - Flechas y `WASD` mueven y abren túnel; el túnel abierto persiste y se recorre más rápido; no se atraviesa el borde ni una roca.
   - `Espacio` lanza el arpón (máx. 3 celdas, se frena ante tierra); al engancharse, 4 pulsaciones revientan al monstruo y suman 200–500 según la profundidad; sin bombear, se desinfla.
   - Un monstruo inflado no mata al tocarlo; uno sin inflar quita una vida y el jugador reaparece parpadeando.
   - Tras unos segundos un monstruo se vuelve fantasma y cruza la tierra; al llegar a un túnel vuelve a ser sólido.
   - Excavar bajo una roca la hace temblar y caer; aplasta monstruos (+1000) y al jugador si está debajo.
   - Limpiar los monstruos suma 500 y sube el Nivel con un mapa nuevo y más monstruos.
   - Con 0 vidas se abre el modal con la puntuación real y se guarda con `saveScore`; `FIN` abre el mismo modal y luego las teclas no hacen nada.
   - `PAUSA`/`REANUDAR` sin salto de tiempo; `JUGAR DE NUEVO` regenera la tierra completa, 3 vidas, nivel 1, score 0.
   - Las flechas y `Espacio` no hacen scroll; `SALIR` no deja listeners ni loop.
   - La puntuación aparece en `/salon` y `/juego/cavernas`; los demás juegos no cambian.

## Criterios de aceptación

- [ ] `/jugar/cavernas` muestra el juego real (subsuelo, excavador, monstruos, rocas).
- [ ] El HUD refleja `Puntuación`, `Vidas` (3 a 0) y `Nivel` reales.
- [ ] La tierra excavada persiste durante la partida y se regenera al reiniciar y en cada nivel.
- [ ] La bomba infla en 4 pulsaciones, se desinfla sin bombear y la puntuación depende de la profundidad.
- [ ] Los monstruos persiguen por los túneles y pasan a fantasma tras su temporizador.
- [ ] Las rocas caen al quedar sin apoyo y aplastan jugador y monstruos.
- [ ] Perder la última vida abre el modal y `saveScore({ gameId: "cavernas", score, name })` guarda la puntuación.
- [ ] `FIN` fuerza el mismo modal; el motor no emite `gameOver` dos veces ni acepta entrada después.
- [ ] `PAUSA`/`REANUDAR` congela y reanuda; `JUGAR DE NUEVO` reinicia a un estado limpio.
- [ ] Las teclas de juego no hacen scroll de la página y `SALIR` no deja listeners ni `requestAnimationFrame`.
- [ ] `cavernas` aparece en `/salon`, en `/juego/cavernas` y ningún otro juego cambia.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones tomadas y descartadas

- **Movimiento de celda a celda con interpolación, no libre en píxeles** — la IA, las rocas y la excavación quedan como lógica entera, igual que Serpentina. Descartado: movimiento continuo con alineación a la rejilla, que añade casos de esquina difíciles de depurar.
- **El mapa en un `Uint8Array` de la instancia** — cumple "sin estado de módulo" y permite regenerarlo en `reset()`. Descartado: un mapa global o un canvas offscreen de tierra, más caro y con estado compartido.
- **Fantasma por temporizador, no por "atascado"** — es el reloj del tema y evita detectar bloqueos. Descartado: pathfinding BFS para atravesar túneles (fuera de la IA simple del alcance M).
- **Bomba que infla por pulsaciones, no por mantener** — da un ritmo de golpeteo propio del arcade y evita depender de `keydown` repetido. Descartado: inflado automático mientras se mantiene `Espacio`.
- **Rocas incluidas, segundo monstruo y frutas fuera** — la roca es la identidad del género; lo demás solo añade contenido, no sistemas.
- **Puntuación por profundidad como en el original** — da motivo para excavar hondo. Descartado: puntos planos por monstruo.
- **Sin tecla de pausa propia** — el contrato no notifica pausas a la página (mismo criterio que las specs 08–10).

## Riesgos identificados

- La IA greedy por distancia Manhattan puede dejar a un monstruo oscilando en un túnel sin salida; el temporizador de fantasma es la salida de emergencia y debe verificarse en la prueba manual.
- Resolver cuándo una roca "pierde su apoyo" durante el movimiento (la celda de abajo se abre justo al llegar) puede dispararla dos veces; la roca debe pasar a `tiembla` una sola vez.
- Balance: con 6 monstruos y fantasmas a ritmo del jugador el nivel 5+ puede ser injusto; los tiempos viven en constantes fáciles de ajustar.
- Dos monstruos y el jugador entrando a la misma celda en el mismo paso exigen un orden de actualización fijo (jugador, luego monstruos) para que el choque sea determinista.
