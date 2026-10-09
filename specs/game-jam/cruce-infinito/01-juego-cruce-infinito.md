# Game Jam — Juego real de CRUCE INFINITO (CRUCE-INFINITO)

**Estado:** Draft
**Depende de:** SPEC 07 (motor genérico y registro de juegos), SPEC 06 (catálogo en Supabase)
**Fecha:** 2026-10-07
**Objetivo:** crear un cruce de peligros sin fin con cámara que avanza como motor real `lib/games/cruce-infinito.ts`, registrado bajo el `id` `cruce-infinito`.

## Contexto

Tema de la jam: "Frogger: cruza la carretera y el río sin convertirte en papilla". Este juego toma el ángulo del "cruce que nunca termina": no hay orilla de destino, el mundo se genera hacia adelante en franjas (hierba, carretera, río, vía de tren) y la cámara sube sola. Quedarse quieto también mata, porque la cámara te alcanza por detrás. Es una entrada nueva del catálogo, diseñada desde cero.

Se distingue de `ranaria` (Frogger clásico, tablero fijo con 5 metas) en tres cosas: mundo procedural infinito, cámara con desplazamiento automático y un nuevo peligro, el tren, que avisa con una señal roja. Hay árboles que bloquean el paso y monedas que dan puntos extra.

Hallazgos de diseño:

- El mundo se indexa por filas enteras (`row`, 0 = salida, crece hacia arriba); la cámara es un número real `camRow` y la fila `r` se dibuja en `y = 550 − (r − camRow) · 50`.
- La rana salta por celdas de 50 px en un tablero de 16 columnas visibles; en un tronco su `x` es continua y al aterrizar en tierra se ajusta a la columna más cercana.
- Todo el arte son primitivas de canvas; no se declaran assets.

## Alcance

**Incluye:**

- `lib/games/cruce-infinito.ts`: clase `CruceInfinitoGame implements GameEngine`, con los tipos `GameEngine`/`GameState` de `lib/games/types.ts` (spec 07), sin redefinirlos.
  - Lienzo lógico 800×600; 16 columnas de 50 px y 12 filas visibles. Rana de 36×36 px que empieza en la columna 8, fila 0.
  - Teclas: `←`/`→`/`↑`/`↓` y `A`/`D`/`W`/`S`, con `preventDefault()` en `keydown`/`keyup`. Un salto de una celda por pulsación (`e.repeat` se ignora). Retroceder está permitido pero no puntúa. Saltar contra un árbol o fuera de las columnas 0–15 se ignora.
  - Generación: filas 0–2 siempre hierba; después, cada fila nueva se sortea: hierba 30 %, carretera 35 %, río 20 %, vía 15 %, con la regla de que nunca haya más de 3 ríos o 4 carreteras seguidos. Se mantienen generadas 14 filas por delante de `camRow` y se descartan las que quedan 2 filas por debajo.
  - Hierba: 2–4 árboles (1 celda) en columnas al azar, sin cubrir la columna donde se aterriza desde la fila inferior (siempre queda al menos una columna libre contigua) y con 25 % de probabilidad de una moneda en una celda libre.
  - Carretera: dirección al azar; vehículos de 50 px (70 %) o 100 px (30 %), separación al azar de 200–400 px por fila, velocidad 80–220 px/s × multiplicador de nivel. Contacto de la caja 30×30 de la rana con el vehículo = muerte.
  - Río: troncos de 100–200 px con separación 250–350 px, velocidad 50–120 px/s, dirección al azar. Mismo criterio que `ranaria`: el centro de la rana debe estar dentro de un tronco o muere ahogada; sobre el tronco se desplaza con él; si su centro sale de [0, 800] muere.
  - Vía: cada 3–5 s la señal parpadea en rojo 1 s y después pasa un tren de 900 px a 1 000 px/s en dirección al azar; tocarlo mata. En la vía no hay otros obstáculos.
  - Cámara: `camRow` solo sube. Tras 3 s de gracia deriva a `0,35 + 0,03 · (level − 1)` filas/s (tope 0,8). Además, `camRow` se acerca con suavizado a `frog.row − 6` cuando la rana lo supera (`camRow += (obj − camRow) · min(1, 6 · dt)`), de modo que la rana nunca queda más arriba que la fila 6 de pantalla. Si `frog.row + 1 ≤ camRow` (la rana sale por abajo) la partida termina.
  - Puntuación: +10 por cada fila nueva alcanzada (`maxRow`), +25 por moneda. `level` = 1 + ⌊`maxRow` / 25⌋, sin tope; multiplica la velocidad de vehículos, troncos y la deriva de cámara como se indicó, con multiplicador `1 + 0,1 · (level − 1)` tope 2,0.
  - `dt` acotado a 0,05 s; `resume()` reinicia `lastTime`; la pausa congela `update()` y `draw()`; el overlay "EN PAUSA" lo dibuja la página.
  - `GameState`: `{ score, lives: null, level, gameOver }`; no hay vidas, una muerte termina la partida. `reportState()` solo emite cuando cambia `score`, `level` o `gameOver`.
  - Un único camino de fin de partida (`endGame()`): atropello, ahogo, tren, salir por los lados en un tronco, ser alcanzado por la cámara y `forceGameOver()` ponen `gameOver = true`, emiten el estado una vez y detienen el loop; después se ignoran teclas y no corre `update()`.
  - `constructor(canvas)`: crea su contexto 2D y agrega `keydown`/`keyup` en `document`. `destroy()` los remueve y cancela el `requestAnimationFrame`. Sin estado a nivel de módulo; probabilidades y velocidades son constantes de solo lectura.
  - Dibujo: hierba verde con árboles redondos, carretera gris con líneas, río azul, vía oscura con travesaños y señal roja; rana verde, monedas amarillas. Una franja semitransparente rojiza en el borde inferior sirve de aviso de la cámara (parte del mundo, no HUD). Sin textos en el canvas.
- `lib/games/registry.ts`: nueva entrada `"cruce-infinito": { width: 800, height: 600, create: (canvas) => new CruceInfinitoGame(canvas) }`.

**No incluye (explícitamente fuera de esta spec):**

- La migración, la clase `cover-*` y el QA de catálogo (spec `02-catalogo-cruce-infinito.md`).
- Cambios a otros juegos, a `app/jugar/[id]/page.tsx`, `components/games/GameCanvas.tsx` o `lib/games/types.ts`.
- Skins de personaje, coleccionables persistentes, sonido, gamepad o táctil.
- Tecla de pausa propia, overlays propios y HUD en el canvas.
- Semillas reproducibles del mundo.
- Tests automatizados y validación anti-trampa de puntuaciones (spec 06).

## Modelo de datos

No hay modelo persistente nuevo. Se reutilizan sin cambios `GameState`, `GameEngine` y `GameDefinition` (spec 07) y `saveScore` (spec 06) con `gameId: "cruce-infinito"`.

Tipos internos no exportados: `RowKind = "grass" | "road" | "river" | "rail"`, `Row { kind, objs, trees, coin, dir, speed, timer }`, `Obj { x, w }`. Estado privado de la clase: `rows: Map<number, Row>`, `frog { x, row }`, `camRow`, `maxRow`, `score`, `elapsed`, `paused`, `over` y `lastTime`.

## Plan de implementación

1. Migración SQL (ver la spec 02 de esta carpeta) y aplicarla con el MCP de `supabase`.
2. Añadir la clase `cover-cruce` en `app/globals.css` (spec 02).
3. Crear `lib/games/cruce-infinito.ts` con `CruceInfinitoGame implements GameEngine`.
4. Agregar la entrada en `lib/games/registry.ts`.
5. `npm run lint` y `npm run build`.
6. Probar manualmente con `npm run dev` en `/jugar/cruce-infinito`:
   - Salto de una celda con flechas y `WASD`; los árboles bloquean y el borde no deja salir.
   - Durante los primeros 3 s la cámara no avanza sola; después sube; quedarse quieto termina la partida al ser alcanzado.
   - Cada fila nueva suma 10 una sola vez; retroceder no resta ni suma; una moneda suma 25.
   - Coches, troncos y tren se comportan como se describe; la señal roja avisa 1 s antes del tren.
   - Sobre un tronco la rana viaja y al saltar a la hierba cae en una columna exacta.
   - El HUD muestra `—` en vidas y Nivel sube cada 25 filas, con tráfico y cámara más rápidos.
   - Cada causa de muerte abre el modal con la puntuación real y permite guardar con `saveScore`.
   - `FIN` abre el mismo modal y desactiva las teclas.
   - `PAUSA`/`REANUDAR` congela y reanuda sin salto de la cámara.
   - `JUGAR DE NUEVO` regenera un mundo limpio (score 0, nivel 1).
   - Las flechas no hacen scroll; `SALIR` no deja listeners ni loop.
   - Jugar 150 filas sin que el mapa de filas crezca sin límite (se descartan las inferiores).
   - Los demás juegos no cambian.

## Criterios de aceptación

- [ ] `/jugar/cruce-infinito` muestra el cruce infinito real con mundo generado.
- [ ] El HUD refleja `Puntuación`, `Vidas` como `—` y `Nivel` del motor.
- [ ] Cada fila nueva suma 10, cada moneda 25 y `level` = 1 + ⌊filas / 25⌋.
- [ ] Atropello, ahogo, tren, salir por un lado y ser alcanzado por la cámara terminan la partida por el mismo `endGame()`.
- [ ] El modal permite guardar con `saveScore({ gameId: "cruce-infinito", score, name })`.
- [ ] `FIN` fuerza el mismo modal y `gameOver` no se emite más de una vez.
- [ ] `PAUSA`/`REANUDAR` y `JUGAR DE NUEVO` funcionan.
- [ ] `SALIR` no deja listeners ni `requestAnimationFrame` activos.
- [ ] Las flechas y `WASD` no hacen scroll.
- [ ] Ningún otro juego cambia de comportamiento.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones tomadas y descartadas

- **Entrada nueva con `lives: null`** — una muerte = fin de partida, como en los juegos de "una sola vida" (Serpentina). Descartadas las 3 vidas: la cámara que reaparece complica el reinicio de tramo.
- **Cámara que deriva sola tras 3 s de gracia** — da el ritmo del género endless sin un temporizador. Descartado: cámara que solo sigue a la rana (se puede jugar eternamente sin riesgo).
- **Tren con señal de 1 s** — peligro rápido pero legible. Descartado: tren sin aviso (injusto).
- **Fila mínima libre alrededor de los árboles** — garantiza que el mundo no se bloquea. Descartado: un solucionador de caminos (excesivo para S/M).
- **Mundo con `Math.random` sin semilla** — el leaderboard no depende de reproducibilidad. Descartado: semilla diaria.
- **Puntuación por fila y monedas** — fórmula corta y verificable. Descartada la puntuación por tiempo.
- **Aviso de cámara dibujado como franja del mundo** — sin HUD en el canvas pero con indicación visual del peligro.
- **Sin tecla de pausa propia** — el contrato no notifica pausas a la página.

## Riesgos identificados

- Una combinación de filas puede dar tramos injugables (3 ríos seguidos con troncos lentos); los límites de repetición y la separación máxima de 350 px lo acotan, pero conviene jugar 100 filas para verlo.
- Si no se descartan las filas viejas, el `Map` crece sin límite en partidas largas.
- La mezcla de la deriva y el avance de cámara con `dt` variable puede dar saltos visuales; el `dt` acotado a 0,05 s y el suavizado lo evitan.
- El `x` continuo de la rana sobre un tronco debe redondearse al salir a tierra o los árboles y monedas no coincidirán con su celda.
- `endGame()` debe cortar el flujo antes del siguiente frame para no emitir `gameOver` dos veces.
