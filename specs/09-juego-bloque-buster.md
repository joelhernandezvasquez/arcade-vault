# 09 — Juego real de Arkanoid (BLOQUE BUSTER)

**Estado:** Approved
**Depende de:** SPEC 07 (motor genérico y registro de juegos), SPEC 06 (catálogo en Supabase)
**Fecha:** 2026-09-29
**Objetivo:** Portar el Arkanoid de `references/started-games/04-arkanoid/` como motor real `lib/games/bloque-buster.ts`, registrado bajo el `id` `bloque-buster`, reemplazando la arena decorativa de esa entrada del catálogo.

## Contexto

La entrada `bloque-buster` del catálogo (ARCADE, `cover-bricks`, `cyan`, `sort_order` 1) es la entrada decorativa de Arkanoid: su descripción habla de rebotar un núcleo con una paleta para pulverizar muros de bloques y de niveles que reorganizan la grilla. Hoy `/jugar/bloque-buster` muestra la arena decorativa de la spec 01. En paralelo existe un Arkanoid completo en canvas puro (`references/started-games/04-arkanoid/`: `game.js` 268 líneas, `levels.js` 50 líneas, `assets/spritesheet.js` 66 líneas, JS vanilla sin módulos) con 5 niveles de patrones distintos, 3 vidas, velocidad creciente por nivel, animación de explosión de bloques y sonidos.

Esta spec porta ese juego como una clase que `implements GameEngine` y la registra en `lib/games/registry.ts`, siguiendo la spec 07 y los precedentes de las specs 05 (Asteroids) y 08 (Caída). Como `bloque-buster` ya es la fila de Arkanoid, no se agrega una entrada nueva ni una clase `cover-*` nueva.

Hallazgos de la checklist de portado sobre el original:

- **DOM**: `document.getElementById('game')` para el canvas, y `new Audio(...)` para dos efectos. No hay HUD HTML, botón de reinicio ni toggle de tema; todo el HUD, el overlay de GAME OVER/victoria y el de pausa se dibujan en el canvas.
- **Listeners**: `click` y `mousemove` en `canvas`, `keydown` y `keyup` en `document`, todos a nivel de módulo y sin cleanup. El bucle `requestAnimationFrame` nunca se cancela. Ninguna tecla hace `preventDefault`.
- **Canvas**: 800×600 fijo, ya 4:3; no requiere paneles laterales.
- **Entrada**: mouse (`mousemove` con coordenadas ya escaladas con `getBoundingClientRect`) y teclado (`ArrowLeft`/`ArrowRight`). `P`/`Escape` alternan pausa; `click` sobre el overlay de pausa salta de nivel.
- **Pausa/overlays propios**: overlay de pausa con selector de nivel 1–5, overlay `GAME OVER` y `¡Completaste el juego!` (todo se remueve del motor).
- **Vidas**: sí, 3 (`GameState.lives: number`).
- **Assets**: `assets/spritesheet-breakout.png` (30 KB) y dos mp3 (`ball-bounce.mp3`, `break-sound.mp3`). `assets/spritesheet.js` define `SPRITES`, `EXPLOSION_FRAMES` y `EXPLOSION_DURATION` (150 ms) y copia la imagen a un canvas offscreen.
- **Estado de módulo**: `paddle`, `ball`, `blocks`, `explosions`, `lives`, `score`, `gameState`, `currentLevel`, `isPaused`, `keys`, `lastTime`, más `ssImg`/`ssLoaded` del spritesheet y la constante global `LEVELS`.
- **Detalles del original a conservar**: la paleta mide 81 px en pantalla aunque el sprite fuente es de 162×14 (se dibuja escalado a la mitad); un bloque por frame; el rebote contra bloque siempre invierte `vy` (sin distinguir lado); cada nivel nuevo y cada vida perdida recolocan la pelota sobre la paleta y la lanzan de inmediato (sin estado "pegada"); el rebote contra la paleta no depende de dónde golpea (siempre `-|vy|`).

## Alcance

**Incluye:**

- `lib/games/bloque-buster.ts`: clase `BloqueBusterGame implements GameEngine`, con los tipos `GameEngine`/`GameState` de `lib/games/types.ts` (spec 07), sin redefinirlos.
  - Porta tal cual: `PADDLE_SPEED` 400, `BLOCK_COLS`/`BLOCK_ROWS`/`BLOCK_W`/`BLOCK_H`, `BLOCKS_ORIGIN_X`/`BLOCKS_ORIGIN_Y`, `BASE_BALL_VX`/`BASE_BALL_VY`, tamaños de paleta (81×14, y=560) y pelota (16×16), los 5 niveles de `levels.js` (parrilla, pirámide, ajedrez, filas con huecos, marco + cruz) con sus multiplicadores de velocidad ×1.0/1.1/1.21/1.33/1.46, +10 puntos por bloque, colisión AABB pelota–bloque, rebotes contra paredes/techo/paleta y la animación de explosión de 4 frames (`EXPLOSION_FRAMES`, `EXPLOSION_DURATION` 150 ms). `SPRITES`, `EXPLOSION_FRAMES` y `LEVELS` se declaran como constantes del módulo de solo lectura (datos inmutables, no estado mutable), sin variables globales de estado.
  - `constructor(canvas)`: crea su contexto 2D, empieza a cargar el spritesheet desde `/games/bloque-buster/spritesheet-breakout.png` con `new Image()` y agrega los listeners: `mousemove` en `canvas` (coordenadas escaladas con `getBoundingClientRect()` + `canvas.width / rect.width`) y `keydown`/`keyup` en `document`. `destroy()` remueve los tres listeners y cancela el `requestAnimationFrame` pendiente. Si `destroy()` ocurre antes de que cargue la imagen, el `onload` no arranca el loop.
  - `start()`, `pause()`, `resume()`, `reset()`, `forceGameOver()`, `destroy()`, `onStateChange(cb)` según el contrato. El loop arranca cuando la imagen ya cargó (el original espera a `loadSpritesheet`).
  - Teclas: `←`/`→` mueven la paleta y llaman a `preventDefault()` en `keydown`/`keyup`; el mouse también la mueve. El estado de teclas se actualiza también en pausa, para que soltar una flecha durante la pausa no deje la paleta "pegada" al reanudar.
  - `dt` acotado a 0.05 s; `resume()` reinicia `lastTime` para no acumular el tiempo pausado.
  - La pausa congela `update()` y `draw()`; el overlay "EN PAUSA" lo dibuja la página.
  - `GameState`: `{ score, lives, level, gameOver }` con `lives` de 3 a 0 y `level` de 1 a 5. `reportState()` solo emite cuando cambia alguno de esos campos, no en cada frame ni en cada movimiento.
  - Un único camino de fin de partida (`endGame()`): perder la última vida, completar el nivel 5 (victoria) y `forceGameOver()` ponen `gameOver = true`, emiten el estado una sola vez y detienen el loop. Después de eso el motor ignora teclas/mouse y no ejecuta más `update()`. La puntuación es la acumulada; no hay bonificación por victoria.
  - Se remueve del original: `drawOverlay`, `drawPauseOverlay`, selector de nivel y su listener de `click`, tecla `P`/`Escape`, y el HUD dibujado (`Score`, `Nivel`, bolitas de vidas), porque lo cubre el HUD del reproductor. El canvas dibuja solo fondo negro, bloques, explosiones, paleta y pelota.
- `public/games/bloque-buster/spritesheet-breakout.png`: copia de `references/started-games/04-arkanoid/assets/spritesheet-breakout.png`.
- `lib/games/registry.ts`: nueva entrada `"bloque-buster": { width: 800, height: 600, create: (canvas) => new BloqueBusterGame(canvas) }`, junto a las de `asteroids` y `caida`.
- Sin migración SQL: la fila `bloque-buster` ya tiene `id`, `title`, `short`, `long`, `cat`, `cover`, `color`, `best`, `plays` y `sort_order` que describen correctamente el juego real (ver Decisiones). Se conserva tal cual.

**No incluye (explícitamente fuera de esta spec):**

- Ningún cambio a otros juegos del catálogo.
- Cambios a `app/jugar/[id]/page.tsx`, `components/games/GameCanvas.tsx`, `lib/games/types.ts` o `app/globals.css` (ya son genéricos desde la spec 07; no hay clase `cover-*` nueva).
- Sonido: no se copian `ball-bounce.mp3` ni `break-sound.mp3` ni se usa `Audio`.
- Tecla `P`/`Escape` para pausar y selector visual de nivel ("Saltar al nivel"): la pausa la cubre solo el botón `PAUSA` del reproductor.
- Overlays propios de PAUSA, GAME OVER y victoria, y el HUD dibujado en el canvas.
- Recolorear sprites o bloques al color de acento `cyan` del catálogo.
- Gamepad o controles táctiles; ángulo de rebote según el punto de impacto en la paleta, power-ups, bloques de varios golpes o cualquier mecánica que el original no tenga.
- Corregir el rebote de bloques (siempre invierte `vy`): se conserva el comportamiento del original.
- Tests automatizados (el proyecto no tiene test runner configurado).
- Validación anti-trampa de puntuaciones (mismo riesgo aceptado que documenta la spec 06).

## Modelo de datos

No se introduce ningún modelo persistente nuevo. Se reutilizan sin cambios `GameState`, `GameEngine` y `GameDefinition` de `lib/games/types.ts` (spec 07), y `saveScore` de la spec 06 con `gameId: "bloque-buster"`.

Tipos internos de `lib/games/bloque-buster.ts` (detalle de implementación, no exportados): `Block { x, y, w, h, color, alive }`, `Explosion { x, y, w, h, color, elapsed }`, la forma de un nivel `{ speed: number; blocks: { col, row, color }[] }` y `Frame { sx, sy, sw, sh }`. Los campos `paddle`, `ball`, `blocks`, `explosions`, `lives`, `score`, `currentLevel`, `keys`, `paused` y la imagen del spritesheet son estado privado de la clase.

## Plan de implementación

1. Copiar `spritesheet-breakout.png` a `public/games/bloque-buster/`.
2. Crear `lib/games/bloque-buster.ts` portando la lógica de `references/started-games/04-arkanoid/game.js`, `levels.js` y `assets/spritesheet.js` dentro de `BloqueBusterGame implements GameEngine`, con todo el estado como campos de instancia, listeners en el constructor y removidos en `destroy()`, sin `document.getElementById`, sin `Audio`, sin HUD ni overlays propios.
3. Agregar la entrada `bloque-buster` en `lib/games/registry.ts`.
4. Correr `npm run lint` y `npm run build`, y confirmar que no hay errores.
5. Probar manualmente con `npm run dev` en `/jugar/bloque-buster`:
   - La paleta responde a las flechas y al mouse, y el mouse sigue alineado cuando el `.crt-screen` se redimensiona (coordenadas escaladas).
   - La pelota rebota en paredes, techo y paleta, y rompe bloques (+10) con su animación de explosión.
   - Completar los niveles 1–4 carga el siguiente patrón con mayor velocidad y el HUD muestra Nivel 2, 3, 4, 5.
   - Perder una pelota descuenta una vida en el HUD y relanza la pelota; con 0 vidas se abre el modal de fin de partida con la puntuación real y se puede guardar con `saveScore`.
   - Completar el nivel 5 abre el mismo modal por el mismo camino; después de eso las teclas y el mouse ya no mueven nada.
   - `FIN` a mitad de partida abre el mismo modal.
   - `PAUSA`/`REANUDAR` congela y reanuda sin salto de física; soltar una flecha durante la pausa no deja la paleta moviéndose.
   - `JUGAR DE NUEVO` deja score 0, vidas 3, nivel 1, nivel 1 de bloques y la paleta centrada.
   - Las flechas no hacen scroll de la página.
   - `SALIR` no deja listeners ni loop de `requestAnimationFrame` (las teclas/mouse no afectan nada al volver a `/juego/bloque-buster`). Navegar rápido antes de que cargue la imagen no deja un loop huérfano.
   - La puntuación guardada aparece en `/salon` y en la vista previa de `/juego/bloque-buster`.
   - Navegar a `/jugar/caida` y `/jugar/asteroids` y confirmar que no cambió su comportamiento.

## Criterios de aceptación

- [ ] `/jugar/bloque-buster` muestra el Arkanoid real (bloques con sprites, paleta, pelota, explosiones) en vez de la arena decorativa.
- [ ] El HUD superior (`Puntuación`, `Vidas`, `Nivel`) refleja el estado real del motor: 3 vidas, niveles 1–5.
- [ ] Los 5 niveles tienen sus patrones y velocidades originales.
- [ ] La paleta se controla con flechas y con mouse, con las coordenadas del mouse correctamente escaladas.
- [ ] Perder la última vida o completar el nivel 5 abre el modal existente con la puntuación real y permite guardarla con `saveScore({ gameId: "bloque-buster", score, name })`.
- [ ] El botón `FIN` fuerza el mismo modal de fin de partida.
- [ ] Tras el fin de partida el motor deja de aceptar entrada y no emite `gameOver` más de una vez.
- [ ] `PAUSA`/`REANUDAR` congela y reanuda el juego real.
- [ ] `JUGAR DE NUEVO` reinicia el motor a un estado limpio.
- [ ] `SALIR` u otra navegación no deja listeners de teclado/mouse activos ni un loop de `requestAnimationFrame` en segundo plano.
- [ ] `bloque-buster` aparece en `/salon` bajo su pestaña y en la vista previa de leaderboard de `/juego/bloque-buster` tras guardar una puntuación real.
- [ ] Ningún otro juego del catálogo cambia de comportamiento.
- [ ] Usar las flechas no hace scroll de la página.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones tomadas y descartadas

- **Reemplazar la entrada decorativa `bloque-buster` en vez de agregar una entrada nueva `arkanoid`** — `bloque-buster` ya es la entrada de Arkanoid (ARCADE, `cover-bricks`, `sort_order` 1). Una entrada nueva dejaría `bloque-buster` decorativa y duplicada, y exigiría una clase `cover-*` nueva. Mismo criterio que las specs 05 y 08.
- **Sin migración SQL** — la descripción actual (rebotar un núcleo, pulverizar muros de bloques, niveles con grillas distintas), la categoría, el color y la portada ya describen el juego real, así que un `UPDATE` sería un no-op. Descartado: `UPDATE` de `title`/`short`/`long`. Si al revisar se prefiere ajustar textos, se agregaría `supabase/migrations/0002_juego_bloque_buster.sql` con `UPDATE ... where id = 'bloque-buster'`, conservando `id`, `cover` y `sort_order`.
- **Sonido fuera de alcance** — Asteroids y Caída no tienen sonido y el reproductor no ofrece control de silencio, así que audio en un solo juego sería inconsistente y añadiría trabajo de pausa/`destroy()`. Descartado: copiar los mp3 a `public/games/bloque-buster/sounds/`. Puede ser una spec futura.
- **Ganar el nivel 5 = `gameOver: true`** — el contrato `GameState` solo conoce `gameOver`; completar el juego usa el mismo camino de cierre que perder la última vida, con un único modal de puntuación. Descartado: repetir niveles indefinidamente (se aparta del original) y un overlay propio de victoria (el contrato prohíbe overlays de texto propios).
- **Mantener sprites y paleta originales, sin recolorear al `cyan` del catálogo** — el spritesheet ya trae los colores de los bloques y sus frames de explosión; recolorear requeriría reemplazar el arte. Mismo criterio que la spec 05 (Asteroids monocromo) y la 08 (paleta de Caída). Descartado: dibujar con primitivas (se pierde la animación de explosión de 4 frames).
- **Lienzo lógico 800×600 sin paneles laterales** — el original ya es 4:3, así que no hace falta el layout centrado de la spec 08.
- **Quitar `P`/`Escape` y el selector de nivel** — el contrato `GameEngine` no notifica pausas hacia la página, así que pausar con `P` dejaría el botón `PAUSA` y el overlay "EN PAUSA" desincronizados (misma razón que la spec 08). El selector de nivel es un overlay propio del canvas y además permitiría saltarse niveles y afectar la puntuación guardada.
- **Copiar solo el PNG y portar `SPRITES`/`EXPLOSION_FRAMES` a TypeScript** — el `.js` original define globales y una caché del spritesheet a nivel de módulo, incompatibles con la regla "sin estado a nivel de módulo"; la imagen se carga por instancia y se dibuja directamente con `drawImage`, sin la copia a canvas offscreen.
- **Conservar las particularidades físicas del original** (rebote de bloque que siempre invierte `vy`, paleta sin ángulo variable, relanzamiento inmediato) — el objetivo es un port fiel; cambiarlas alteraría la jugabilidad y el balance de los 5 niveles.
- **Listeners y `requestAnimationFrame` con `destroy()` explícito, `reportState()` solo ante cambios, un solo camino de fin de partida** — mismo criterio que las specs 05, 07 y 08.

## Riesgos identificados

- La carga asíncrona del spritesheet añade una condición de carrera: si el usuario sale (`destroy()`) antes de que la imagen cargue, o llama a `pause()`/`reset()` antes del `onload`, el `onload` no debe arrancar un loop ni pisar el estado. Se cubre en la prueba manual de navegación rápida.
- Los listeners de `keyup` deben seguir activos en pausa; si solo se atienden con el juego corriendo, una flecha soltada durante la pausa dejaría la paleta desplazándose sola al reanudar.
- El original sigue ejecutando lógica tras `gameState = 'win'`/`'gameover'` (el loop no se detiene y `draw()` continúa). Si el port no corta el flujo tras `endGame()`, podría emitir el estado de fin dos veces y abrir el modal duplicado. Se cubre con el criterio de aceptación de una sola emisión.
- La detección de bloques rota como máximo un bloque por frame e invierte siempre `vy`; a velocidades de nivel 5 (×1.46) con `dt` acotado a 0.05 s la pelota puede atravesar visualmente un bloque en frames largos. Es el comportamiento del original y se acepta.
