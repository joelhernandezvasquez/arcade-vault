# Game Jam — Juego real de PASO CONTADO (PASO-CONTADO)

**Estado:** Draft
**Depende de:** SPEC 07 (motor genérico y registro de juegos), SPEC 06 (catálogo en Supabase)
**Fecha:** 2026-10-07
**Objetivo:** crear un rompecabezas de cruce por turnos como motor real `lib/games/paso-contado.ts`, registrado bajo el `id` `paso-contado`.

## Contexto

Tema de la jam: "Frogger: cruza la carretera y el río sin convertirte en papilla". Este juego lo lee como un puzle: el tiempo no corre, solo avanza cuando la rana se mueve o espera. Cada acción del jugador mueve a la vez todos los coches y troncos una celda, de modo que el tráfico es determinista y se puede planificar. Gana quien cruza el tablero en el menor número de turnos.

Es una entrada nueva del catálogo (PUZZLE), diseñada desde cero. Se distingue de `ranaria` (reflejos en tiempo real) y de `cruce-infinito` (endless con cámara) en que no exige reflejos: exige leer patrones. Hallazgo clave: para que cada tablero sea resoluble, el generador lo comprueba con una búsqueda en anchura (BFS) sobre estados `(columna, fila, turno mod 32)` antes de mostrarlo.

## Alcance

**Incluye:**

- `lib/games/paso-contado.ts`: clase `PasoContadoGame implements GameEngine`, con los tipos `GameEngine`/`GameState` de `lib/games/types.ts` (spec 07), sin redefinirlos.
  - Tablero de 16 columnas × 12 filas de celdas de 50 px (800×600). Fila 11 = salida (segura, la rana empieza en la columna 8); fila 0 = meta (segura, cualquier columna); filas 1–10 = carriles generados.
  - Tipos de carril: hierba (segura), carretera (coches) o río (troncos). La fila 10 es siempre carretera o hierba y la fila 1 siempre río o hierba para mantener la lectura del tema. Nunca hay más de 3 ríos seguidos.
  - Cada carril de carretera/río tiene dirección al azar y velocidad 1 celda por turno ("rápido") o 1 celda cada 2 turnos ("lento"). Todos los carriles se envuelven en 16 celdas, así que el tablero es periódico con periodo `T = 32` turnos.
  - Densidad por nivel: coches por carril = `min(2 + ⌊level / 2⌋, 6)` repartidos al azar sin solaparse; troncos por carril = `max(4 − ⌊level / 3⌋, 2)` de longitud 3 celdas. La proporción de carriles lentos es de 40 %.
  - Turno: (1) la rana se mueve una celda con `←`/`→`/`↑`/`↓` o `A`/`D`/`W`/`S`, o espera con `Espacio`; un movimiento fuera del tablero se ignora sin consumir turno. (2) El mundo avanza un paso: cada carril cuya velocidad le toca en ese turno desplaza sus objetos una celda; si la rana está sobre un tronco que se mueve, se desplaza con él. (3) Se comprueba la rana: en carretera sobre un coche = muerte; en río sin tronco = muerte; fuera de [0, 15] arrastrada por un tronco = muerte. Cruzarse con un coche en sentido contrario sin acabar en la misma celda no mata (regla única y simple, también usada por el BFS).
  - Alcanzar la fila 0 completa el tablero. `Espacio` llama a `preventDefault()`, igual que las flechas y `WASD`, en `keydown`/`keyup`; `e.repeat` se ignora.
  - Animación: los objetos y la rana se interpolan 120 ms hacia su celda nueva solo a nivel visual; la lógica se resuelve al instante y las entradas durante la interpolación se aceptan. La muerte congela 0,7 s (entradas ignoradas) y reinicia el mismo tablero (misma disposición, turno 0).
  - Generador y garantía de solución: tras crear un tablero, el BFS busca un camino de la salida a la meta; guarda `par` = turnos mínimos. Si no hay solución, se vuelve a sortear (hasta 30 intentos; el último recurso es reducir a la mitad los coches). Un tablero no se muestra sin `par` válido.
  - Puntuación al completar: `100 · level + 20 · max(0, par + 8 − turnos)`. Con los turnos mínimos se obtienen `100 · level + 160`. Morir no resta puntos, solo una vida. `level` = 1 + tableros completados, sin tope.
  - Vidas: `lives` de 3 a 0, una por muerte; el tablero se repite tras cada muerte y se genera uno nuevo al completarlo.
  - `dt` acotado a 0,05 s en el loop de dibujo; `resume()` reinicia `lastTime`. La pausa congela `update()` y `draw()`; el overlay "EN PAUSA" lo dibuja la página.
  - `GameState`: `{ score, lives, level, gameOver }`. `reportState()` solo emite al cambiar alguno.
  - Un único camino de fin de partida (`endGame()`): perder la última vida y `forceGameOver()` ponen `gameOver = true`, emiten el estado una vez y detienen el loop; después se ignoran teclas.
  - `constructor(canvas)`: crea su contexto 2D, genera el primer tablero y agrega `keydown`/`keyup` en `document`. `destroy()` los remueve y cancela el `requestAnimationFrame`. Sin estado a nivel de módulo.
  - Dibujo: cuadrícula tenue magenta sobre el fondo oscuro, carreteras gris-violeta, ríos azul oscuro, hierba verde; coches con una flecha pequeña que indica su dirección y un punto (rápido) o un guion (lento); troncos marrones; rana verde; meta con franja amarilla. Sin textos ni contador de turnos dibujado en el canvas.
- `lib/games/registry.ts`: nueva entrada `"paso-contado": { width: 800, height: 600, create: (canvas) => new PasoContadoGame(canvas) }`.

**No incluye (explícitamente fuera de esta spec):**

- La migración, la clase `cover-*` y el QA de catálogo (spec `02-catalogo-paso-contado.md`).
- Cambios a otros juegos, a `app/jugar/[id]/page.tsx`, `components/games/GameCanvas.tsx` o `lib/games/types.ts`.
- Deshacer movimientos, mostrar la solución, contador de turnos en pantalla, editor de niveles, sonido, mouse, gamepad o táctil.
- Overlays propios y tecla de pausa propia.
- Tests automatizados y validación anti-trampa (spec 06).

## Modelo de datos

Sin modelo persistente nuevo. Se reutilizan `GameState`, `GameEngine` y `GameDefinition` (spec 07) y `saveScore` (spec 06) con `gameId: "paso-contado"`.

Tipos internos no exportados: `LaneKind = "grass" | "road" | "river"`, `Lane { kind, dir, slow, objs: number[], len }`, `Board { lanes: Lane[], par: number }`, y las funciones puras `stepWorld(board, turn)` y `isSafe(board, col, row, turn)`, que usan tanto el juego como el BFS. Estado privado: `board`, `turn`, `frog { col, row }`, `turnsUsed`, `deadTimer`, `score`, `lives`, `completed`, `paused`, `over`, `tween`.

## Plan de implementación

1. Migración SQL y `cover-paso` (spec 02 de esta carpeta); aplicar con el MCP de `supabase`.
2. Crear `lib/games/paso-contado.ts` con `PasoContadoGame implements GameEngine`: primero el generador y el BFS como funciones puras, luego el loop de dibujo.
3. Agregar la entrada en `lib/games/registry.ts`.
4. `npm run lint` y `npm run build`.
5. Probar manualmente con `npm run dev` en `/jugar/paso-contado`:
   - Cada pulsación de flecha o `Espacio` hace avanzar todos los carriles exactamente una celda (los lentos, una de cada dos).
   - Moverse hacia un borde del tablero no consume turno ni mueve el mundo.
   - Un coche que llega a la celda de la rana la mata; esperar en una celda segura es posible con `Espacio`.
   - Un tronco lleva a la rana; salir por un lado o pisar el agua mata.
   - La muerte quita una vida y repite el mismo tablero; el HUD muestra vidas 3 → 0.
   - Completar un tablero suma `100 · level + 20 · max(0, par + 8 − turnos)` y sube Nivel.
   - Jugar 10 tableros seguidos sin ver uno irresoluble; la generación no congela la pantalla.
   - `FIN` abre el modal; las teclas dejan de funcionar.
   - `PAUSA`/`REANUDAR` y `JUGAR DE NUEVO` funcionan.
   - Flechas y `Espacio` no hacen scroll; `SALIR` no deja listeners ni loop.
   - Guardar con `saveScore` y verificar `/salon`; los demás juegos no cambian.

## Criterios de aceptación

- [ ] `/jugar/paso-contado` muestra el tablero real y avanza solo con acciones de la rana.
- [ ] El HUD refleja `Puntuación`, `Vidas` (3) y `Nivel` reales.
- [ ] Todo tablero mostrado tiene solución (BFS) y se genera sin congelar la página.
- [ ] La fórmula de puntuación se cumple con los turnos usados y el `par`.
- [ ] Perder la última vida abre el modal y permite guardar con `saveScore({ gameId: "paso-contado", score, name })`.
- [ ] `FIN` fuerza el mismo modal y `gameOver` no se emite más de una vez.
- [ ] `PAUSA`/`REANUDAR` y `JUGAR DE NUEVO` funcionan.
- [ ] `SALIR` no deja listeners ni `requestAnimationFrame` activos.
- [ ] Flechas, `WASD` y `Espacio` no hacen scroll.
- [ ] Ningún otro juego cambia de comportamiento.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones tomadas y descartadas

- **Turnos en vez de tiempo real** — el ángulo puzzle distingue este juego de los otros dos. Descartado: tiempo real con tráfico determinista (sería otro Frogger).
- **Periodo fijo de 32 turnos** — con carriles de 16 celdas y velocidades de 1 o 1/2 celda por turno todo el tablero se repite cada 32 turnos, lo que acota el BFS a 16 × 12 × 32 = 6 144 estados. Descartado: velocidades arbitrarias (estado no acotado).
- **BFS en el generador, no en pruebas** — la solubilidad es una garantía de jugabilidad. Descartado: confiar en el azar.
- **Pasar junto a un coche en sentido contrario no mata** — regla simple y predecible (solo cuenta la celda final) y la misma que usa el BFS. Descartado: colisión por barrido (más compleja).
- **Misma disposición tras morir** — es un puzle: reintentar el mismo tablero es el aprendizaje. Descartado: un tablero nuevo por vida.
- **`par` oculto, solo en la fórmula** — no se dibuja contador de turnos (regla de no HUD en canvas); el bonus lo percibe el jugador por el score. Descartado: ampliar el HUD del reproductor.
- **`Espacio` para esperar** — necesario para sincronizar con el tráfico; lleva `preventDefault()`.
- **Tres vidas** — consistente con el HUD y con la tolerancia de un puzle.

## Riesgos identificados

- El BFS con 30 reintentos puede tardar unos milisegundos por tablero; con 6 144 estados es despreciable, pero se vigila si baja el rendimiento en niveles altos con muchos coches.
- A densidades altas (6 coches/carril) puede que casi no haya tableros resolubles; el último recurso de reducir coches evita el bucle, pero el nivel dejaría de endurecerse y se ajusta jugando.
- Que cada carril rápido y lento se pueda desincronizar con la fase `turn mod 32` si se actualiza el contador en dos sitios; el contador debe ser único y avanzar solo en el paso del mundo.
- Falta de feedback del número de turnos: si resulta confuso, una spec futura puede añadirlo al HUD genérico.
- `endGame()` debe cortar el flujo antes del siguiente frame para no emitir `gameOver` dos veces.
