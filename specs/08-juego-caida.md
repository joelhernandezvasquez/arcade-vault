# 08 — Juego real de Tetris (CAÍDA)

**Estado:** Implemented
**Depende de:** SPEC 07 (motor genérico y registro de juegos), SPEC 06 (catálogo en Supabase)
**Fecha:** 2026-09-29
**Objetivo:** Portar el Tetris de `references/started-games/03-tetris/` como motor real `lib/games/caida.ts`, registrado bajo el `id` `caida`, reemplazando la arena decorativa de esa entrada del catálogo.

## Contexto

La entrada `caida` del catálogo (PUZZLE, `cover-tetro`, `sort_order` 2) ya es la entrada decorativa de Tetris: su descripción habla de piezas que descienden, líneas y "velocidad que aumenta cada 10 líneas". Hoy `/jugar/caida` muestra la arena decorativa de la spec 01. En paralelo existe un Tetris completo en canvas puro (`references/started-games/03-tetris/game.js`, ~333 líneas, JS vanilla sin módulos) con tablero 10×20, ghost piece, wall kicks, hard/soft drop, puntuación por líneas × nivel y vista previa de la siguiente pieza.

Esta spec porta ese juego como una clase que `implements GameEngine` y la registra en `lib/games/registry.ts`, siguiendo el patrón de la spec 07 y el precedente de la spec 05 (Asteroids). Como `caida` ya es la fila de Tetris, no se agrega una entrada nueva ni una clase `cover-*` nueva.

Hallazgos de la checklist de portado sobre el original:

- **DOM**: usa `getElementById` para `board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn` y `theme-toggle` (con `localStorage 'tetris-theme'`). `drawGrid` lee `--grid-line` con `getComputedStyle(document.body)`.
- **Listeners**: un único `document.addEventListener('keydown', ...)` a nivel de módulo, sin cleanup. Teclas: `ArrowLeft/Right/Down/Up`, `KeyX`, `Space`, `KeyP`. Solo `Space` hace `preventDefault`.
- **Canvas**: tablero 300×600 (10×20 celdas de 30 px), vertical, no 4:3; más un `next-canvas` de 120×120 aparte.
- **Entrada**: solo teclado.
- **Vidas**: no tiene. El fin de partida ocurre cuando `spawn()` genera una pieza que ya colisiona.
- **Assets**: ninguno, todo son primitivas de canvas.
- **Estado de módulo**: `board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `lastTime`, `dropAccum`, `dropInterval`, `animId` y las referencias DOM/contexto.
- **Piezas**: el README dice 7, pero `randomPiece()` sortea `Math.floor(Math.random() * 8) + 1`, es decir las 7 clásicas más una pieza `N` (tuerca 3×3 en anillo, gris `#9e9e9e`).

## Alcance

**Incluye:**

- `lib/games/caida.ts`: clase `CaidaGame implements GameEngine`, con los tipos `GameEngine`/`GameState` de `lib/games/types.ts` (spec 07), sin redefinirlos.
  - Porta tal cual: `COLS`/`ROWS`/`BLOCK`, `PIECES` (8 piezas, incluida `N`), `COLORS` (paleta original), `LINE_SCORES = [0, 100, 300, 500, 800]` × nivel, `level = floor(lines / 10) + 1`, `dropInterval = max(100, 1000 - (level - 1) * 90)`, soft drop +1 punto por fila, hard drop +2 por celda, `rotateCW`, wall kicks `[0, -1, 1, -2, 2]`, ghost piece (`globalAlpha` 0.2), highlight de bloque, `clearLines`, `collide`, `merge`, `spawn`.
  - `constructor(canvas)`: crea su contexto 2D y agrega el listener de `keydown` en `document`; `destroy()` lo remueve y cancela el `requestAnimationFrame` pendiente.
  - `start()`, `pause()`, `resume()`, `reset()`, `forceGameOver()`, `destroy()`, `onStateChange(cb)` según el contrato.
  - Teclas: `←`/`→` mover, `↑`/`X` rotar, `↓` soft drop, `Espacio` hard drop. Todas llaman a `preventDefault()`.
  - `dt` acotado (equivalente a 0.05 s) para evitar saltos tras un tab en segundo plano; `resume()` reinicia `lastTime` para no acumular el tiempo pausado en `dropAccum`.
  - La pausa congela `update()` y `draw()`; el overlay "EN PAUSA" lo dibuja la página.
  - `GameState`: `{ score, lives: null, level, gameOver }`. `reportState()` solo emite cuando cambia alguno de esos campos, no en cada frame ni en cada tecla.
  - Un único camino de fin de partida: la colisión al `spawn()` y `forceGameOver()` ponen `gameOver = true`, emiten el estado una sola vez y detienen el loop; después de eso el motor ignora teclas y no ejecuta `lockPiece`/`draw` adicionales. (El original sigue ejecutando código tras `endGame()` desde `hardDrop`/`softDrop`/`loop`.)
- Layout dentro del lienzo lógico 800×600 (4:3, `.crt-screen`): el tablero de 300×600 se dibuja centrado (desplazamiento x = 250) y el espacio sobrante son dos paneles dibujados en el propio canvas, con fondo oscuro fijo (sin depender del DOM ni de `getComputedStyle`):
  - Panel izquierdo (x 0–250): **NEXT**, vista previa de la siguiente pieza en una cuadrícula de 4×4 celdas de 30 px, centrada.
  - Panel derecho (x 550–800): **leyenda de controles** dibujada como texto: `← →` mover, `↑ / X` rotar, `↓` bajar, `ESPACIO` caída. No lista `P`.
  - La cuadrícula, el fondo del tablero y los textos de los paneles usan colores fijos oscuros coherentes con el tema Arcade Vault.
- `lib/games/registry.ts`: nueva entrada `caida: { width: 800, height: 600, create: (canvas) => new CaidaGame(canvas) }`, junto a la de `asteroids`.
- Sin migración SQL: la fila `caida` ya tiene `id`, `title`, `short`, `long`, `cat`, `cover`, `color`, `best`, `plays` y `sort_order` que describen correctamente el juego real (ver Decisiones). Se conserva tal cual.

**No incluye (explícitamente fuera de esta spec):**

- Ningún cambio a otros juegos del catálogo.
- Cambios a `app/jugar/[id]/page.tsx`, `components/games/GameCanvas.tsx`, `lib/games/types.ts` o `app/globals.css` (ya son genéricos desde la spec 07; no hay clase `cover-*` nueva).
- Tecla `P` para pausar: la pausa la cubre solo el botón `PAUSA` del reproductor.
- Toggle de tema claro/oscuro, overlay propio de PAUSA/GAME OVER, botón de reinicio y HUD HTML del original.
- Contador de `LINES` dibujado en el canvas: el HUD del reproductor muestra puntuación y nivel, y las líneas quedan solo como estado interno.
- Recolorear las piezas al color de acento del catálogo.
- Sonido, mouse, gamepad o controles táctiles; hold piece, rotación anti-horaria, randomizador 7-bag (se mantiene el sorteo uniforme del original).
- Tests automatizados (el proyecto no tiene test runner configurado).
- Validación anti-trampa de puntuaciones (mismo riesgo aceptado que documenta la spec 06).

## Modelo de datos

No se introduce ningún modelo persistente nuevo. Se reutilizan sin cambios `GameState`, `GameEngine` y `GameDefinition` de `lib/games/types.ts` (spec 07), y `saveScore` de la spec 06 con `gameId: "caida"`.

Tipos internos de `lib/games/caida.ts` (detalle de implementación, no exportados): la forma de una pieza `{ type: number; shape: number[][]; x: number; y: number }`, el tablero `number[][]` de `ROWS × COLS` (0 = vacío, 1–8 = índice de color) y las constantes del juego. Los campos `lines`, `dropAccum`, `dropInterval` y `paused` son estado privado de la clase.

## Plan de implementación

1. Crear `lib/games/caida.ts` portando la lógica de `references/started-games/03-tetris/game.js` dentro de `CaidaGame implements GameEngine`, con todo el estado como campos de instancia, listener de teclado en el constructor y removido en `destroy()`, y sin ninguna dependencia de `document.getElementById`, `localStorage` ni `getComputedStyle`.
2. Implementar el render completo en el canvas 800×600: fondo, tablero con cuadrícula (desplazado 250 px), bloques, ghost, pieza actual, panel NEXT a la izquierda y leyenda de controles a la derecha.
3. Agregar la entrada `caida` en `lib/games/registry.ts`.
4. Correr `npm run lint` y `npm run build`, y confirmar que no hay errores.
5. Probar manualmente con `npm run dev` en `/jugar/caida`:
   - Mover y rotar, incluida la rotación pegada a ambas paredes (wall kicks).
   - Soft drop (+1 por fila) y hard drop (+2 por celda) con sus puntuaciones en el HUD.
   - El ghost piece coincide con la posición final.
   - Limpiar 1, 2, 3 y 4 líneas y verificar 100/300/500/800 × nivel.
   - Subir de nivel cada 10 líneas y comprobar que la caída se acelera.
   - El panel NEXT muestra la pieza que efectivamente aparece después; aparece la pieza `N`.
   - Apilar hasta el techo: se abre el modal de fin de partida con la puntuación real y se puede guardar con `saveScore`; después de eso las teclas ya no mueven nada.
   - `FIN` a mitad de partida abre el mismo modal.
   - `PAUSA`/`REANUDAR` congela y reanuda sin salto de caída al reanudar.
   - `JUGAR DE NUEVO` deja el tablero vacío, puntuación 0 y nivel 1.
   - El HUD muestra Vidas `"—"`.
   - `↑`, `↓`, `Espacio` y las flechas no hacen scroll de la página.
   - `SALIR` no deja listeners de teclado ni loop de `requestAnimationFrame` (comprobar que las teclas no siguen afectando nada al volver a `/juego/caida`).
   - La puntuación guardada aparece en `/salon` y en la vista previa de `/juego/caida`.
   - Navegar a `/jugar/asteroids` y confirmar que no cambió su comportamiento.

## Criterios de aceptación

- [ ] `/jugar/caida` muestra el Tetris real (tablero, piezas, ghost, panel NEXT y leyenda de controles) en vez de la arena decorativa.
- [ ] El tablero se ve centrado en el `.crt-screen` sin distorsión, con los paneles laterales dibujados en el canvas.
- [ ] El HUD superior (`Puntuación`, `Vidas` como `—`, `Nivel`) refleja el estado real del motor.
- [ ] Las 8 piezas (7 clásicas + `N`) aparecen con su paleta original.
- [ ] La puntuación y el nivel siguen las reglas del original (líneas × nivel, soft/hard drop, nivel cada 10 líneas).
- [ ] Apilar hasta el techo abre el modal existente con la puntuación real y permite guardarla con `saveScore({ gameId: "caida", score, name })`.
- [ ] El botón `FIN` fuerza el mismo modal de fin de partida.
- [ ] Tras el fin de partida el motor deja de aceptar teclas y no emite `gameOver` más de una vez.
- [ ] `PAUSA`/`REANUDAR` congela y reanuda el juego real.
- [ ] `JUGAR DE NUEVO` reinicia el motor a un estado limpio.
- [ ] `SALIR` u otra navegación no deja listeners de teclado activos ni un loop de `requestAnimationFrame` en segundo plano.
- [ ] `caida` aparece en `/salon` bajo su pestaña y en la vista previa de leaderboard de `/juego/caida` tras guardar una puntuación real.
- [ ] Ningún otro juego del catálogo cambia de comportamiento.
- [ ] Usar las teclas del juego no hace scroll de la página.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones tomadas y descartadas

- **Reemplazar la entrada decorativa `caida` en vez de agregar una entrada nueva `tetris`** — `caida` ya es la entrada de Tetris (PUZZLE, `cover-tetro`, `sort_order` 2). Una entrada nueva dejaría `caida` decorativa y duplicada, y exigiría una clase `cover-*` nueva. Mismo criterio que la spec 05 con `rocas` → `asteroids`.
- **Sin migración SQL** — la descripción actual (piezas que descienden, rotar, limpiar líneas, velocidad cada 10 líneas), la categoría, el color y la portada ya describen el juego real, así que un `UPDATE` sería un no-op. Se evita una migración vacía. Si al revisar la spec se prefiere ajustar `short`/`long`, se agregaría entonces `supabase/migrations/0002_juego_caida.sql` con un `UPDATE ... where id = 'caida'`, conservando `id`, `cover` y `sort_order`.
- **Mantener las 8 piezas, incluida la tuerca `N`** — es el comportamiento real del código original aunque el README diga 7; el port debe ser fiel al `game.js`. Descartado: quitar `N` y volver a las 7 clásicas.
- **Mantener la paleta original de piezas, sin recolorear al magenta del catálogo** — los colores por tipo son parte de la identidad y la legibilidad de Tetris, igual que la spec 05 mantuvo Asteroids monocromo. Descartado: recolorear a magenta (se pierde la diferenciación entre piezas).
- **Tablero vertical centrado con paneles dibujados en el canvas, sin cambiar el aspecto del contenedor** — sigue lo indicado en `engine-contract.md`. Se aprovecha el espacio sobrante para NEXT y controles en vez de dejar franjas vacías.
- **Quitar la tecla `P`** — el contrato `GameEngine` no notifica pausas hacia la página, así que pausar con `P` congelaría el motor pero dejaría el botón `PAUSA` y el overlay "EN PAUSA" desincronizados. Descartado: hacer que `P` dispare el botón `PAUSA` de la página, porque tocaría `types.ts`, `page.tsx` y `GameCanvas.tsx` (spec 07) y afectaría a todos los juegos; podría ser una spec futura.
- **Sin panel `LINES`** — el HUD del reproductor ya muestra puntuación y nivel; las líneas se mantienen solo como estado interno necesario para calcular el nivel.
- **Un solo camino de fin de partida y `reportState()` solo ante cambios** — mismo criterio que las specs 05 y 07: `forceGameOver()` y la colisión al `spawn()` producen el mismo estado final, y el HUD de React no se re-renderiza a 60 fps.
- **Listeners y `requestAnimationFrame` con `destroy()` explícito, resolución lógica fija 800×600 con escalado por CSS** — el original nunca se desmonta; dentro de Arcade Vault el jugador puede navegar en cualquier momento.

## Riesgos identificados

- La pausa con `dt` acotado y `lastTime` reiniciado en `resume()` es la parte más fácil de romper: si `resume()` no reinicia `lastTime`, el tiempo pausado se acumula en `dropAccum` y la pieza cae de golpe al reanudar. Se cubre en la prueba manual de pausa.
- El original sigue ejecutando lógica tras `endGame()` (por ejemplo `hardDrop` llama a `lockPiece` → `spawn` → `endGame` y luego `draw`). Si el port no corta el flujo tras `gameOver`, podría emitir el estado de fin dos veces y abrir el modal duplicado. Se cubre con el criterio de aceptación de una sola emisión.
- La leyenda de controles y el panel NEXT viven dentro del canvas: al escalarse por CSS con el `.crt-screen`, el texto pequeño podría verse borroso en pantallas chicas; se elige un tamaño de fuente lo bastante grande en la resolución lógica para mitigarlo.
