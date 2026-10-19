# Game Jam — Juego real de PONG (DUELO PIXEL)

**Estado:** Draft
**Depende de:** SPEC 07 (motor genérico y registro de juegos), SPEC 06 (catálogo en Supabase)
**Fecha:** 2026-10-19
**Objetivo:** crear Pong desde cero, contra una CPU, como motor real `lib/games/duelo-pixel.ts`, registrado bajo el `id` `duelo-pixel` y reemplazando la arena decorativa de esa entrada del catálogo.

## Contexto

Tema de la jam: "Bajo tierra, sobre ruedas y contra el reloj: duelos y carreras de ritmo arcade". Duelo Pixel es la lectura "duelo": un enfrentamiento directo, partido a partido, con una CPU que mejora tras cada victoria.

La entrada `duelo-pixel` (VERSUS, `cover-duelo`, `cyan`, `best` 24, `sort_order` 8) es hoy decorativa: `/jugar/duelo-pixel` muestra la arena simulada. No hay Pong en `references/started-games/`, así que se diseña desde cero y se registra sobre esa fila (mismo criterio que las specs 08, 09 y 10). Hallazgos de diseño:

- **El puntaje del leaderboard**: el `best` 24 del catálogo no describe nada real. Se define el puntaje como una racha: el jugador juega partidos a 5 puntos contra una CPU cada vez más fuerte y la racha termina al perder un partido. El score acumula puntos ganados y un bono por partido ganado, así que ordena bien la tabla.
- **Física de pelota de Bloque Buster**: se reutiliza el modelo de pelota rectangular con `vx`/`vy`, rebote por inversión de signo contra paredes y colisión AABB contra paletas. Se agrega lo que Bloque Buster no tiene: ángulo de rebote según el punto de impacto y aceleración por golpe. Se reescribe en el nuevo motor; no se comparte código entre motores.
- **Un solo jugador**: no hay modo local a 2 jugadores (ver Decisiones).

## Alcance

**Incluye:**

- `supabase/migrations/0008_juego_duelo_pixel.sql`: `UPDATE` de la fila `duelo-pixel` (spec 02 de esta carpeta); conserva `id`, `title`, `cat`, `cover`, `color`, `plays` y `sort_order`, y cambia `short`, `long` y `best`.
- `lib/games/duelo-pixel.ts`: clase `DueloPixelGame implements GameEngine` con los tipos de `lib/games/types.ts`, sin redefinirlos.
  - Lienzo lógico 800×600. Paletas de 14×90 px: la del jugador a la izquierda (x = 30) y la de la CPU a la derecha (x = 756). Pelota cuadrada de 14×14. Área de juego completa del lienzo, con paredes arriba y abajo.
  - Partido a 5 puntos. La pelota se saca desde el centro tras 0,8 s de espera (la pelota parpadea quieta), hacia quien acaba de perder el punto, con un ángulo vertical aleatorio de ±20°. Velocidad inicial 360 px/s.
  - Rebote en paletas: AABB pelota–paleta; la pelota sale invirtiendo `vx` y con un ángulo de `hit · 55°`, donde `hit` ∈ [−1, 1] es la distancia del centro de la pelota al centro de la paleta dividida por la mitad de su alto. Cada golpe de paleta multiplica la velocidad por 1,05 hasta un máximo de 720 px/s. La pelota se recoloca justo fuera de la paleta para no quedar atrapada. Rebote en techo/suelo invirtiendo `vy`.
  - Jugador: `↑`/`↓` o `W`/`S` mueven la paleta a 420 px/s; además la paleta sigue al mouse (coordenada `y` escalada con `getBoundingClientRect()` + `canvas.height / rect.height` en `mousemove` sobre el canvas); la última entrada usada manda. La paleta se acota al lienzo. Las teclas llaman a `preventDefault()` en `keydown`/`keyup`; en pausa o terminado se ignoran, y el estado de teclas se actualiza en `keyup` para no dejar una tecla "pegada".
  - CPU: solo reacciona cuando la pelota va hacia ella; entonces persigue `objetivo = pelota.y + error`, con `error` sorteado en ±`max(8, 60 − 6 · (nivel − 1))` px cada vez que la pelota cambia de sentido hacia la CPU. Velocidad máxima `min(260 + 30 · (nivel − 1), 440)` px/s (siempre menor que la del jugador a nivel alto, para que los ángulos del jugador la superen), con una zona muerta de 8 px. Cuando la pelota se aleja vuelve despacio al centro a 120 px/s. No ve el futuro: nunca calcula trayectorias con rebotes.
  - Puntuación: +10 por cada punto que anota el jugador, y +100 · nivel al ganar un partido (de 5 puntos); perder un punto no resta. `level` = 1 + partidos ganados, sin tope. Tras ganar un partido el marcador interno se pone en 0–0 y empieza un partido más difícil (nivel + 1).
  - Fin de partida: la racha termina cuando la CPU llega a 5 puntos (se pierde el partido). `lives` es `null`. Un único camino `endGame()`: perder el partido y `forceGameOver()` ponen `gameOver = true`, emiten el estado una sola vez y detienen el loop.
  - Marcador del partido: como la racha es el `score` y el marcador 0–5 no está en `GameState`, se dibuja en el canvas como cifras grandes y tenues a ambos lados de la línea central (parte del campo de juego, como en el Pong original), sin overlays de texto ni mensajes de fin.
  - Loop con `requestAnimationFrame`, `dt` acotado a 0,05 s; `resume()` reinicia `lastTime`; la pausa congela `update()` y `draw()`; el overlay "EN PAUSA" lo dibuja la página.
  - `GameState`: `{ score, lives: null, level, gameOver }`. `reportState()` solo emite cuando cambia `score`, `level` o `gameOver`.
  - `constructor(canvas)`: contexto 2D, `keydown`/`keyup` en `document` y `mousemove` en `canvas`; `destroy()` remueve los tres y cancela el `requestAnimationFrame` pendiente.
  - Dibujo: fondo `#0a0a18`, línea central discontinua `#ffffff` al 40 %, paleta del jugador cyan (`#00f5ff`), paleta de la CPU magenta (`#ff006e`), pelota amarilla (`#f5ff00`) con una estela corta de 3 posiciones, marcador en `#ffffff` al 30 %.
- `lib/games/registry.ts`: nueva entrada `"duelo-pixel": { width: 800, height: 600, controlesTactiles: [flecha("Up", "▲"), flecha("Down", "▼")], create: (canvas) => new DueloPixelGame(canvas) }`.
- Sin `cover-*` nueva: se conserva `cover-duelo`.

**No incluye (explícitamente fuera de esta spec):**

- Modo local a dos jugadores, selector de dificultad y partidas a otro número de puntos.
- Ningún cambio a otros juegos ni a `app/jugar/[id]/page.tsx`, `components/games/GameCanvas.tsx`, `lib/games/types.ts` o `app/globals.css`.
- Skins, sonido, gamepad físico y tecla de pausa propia.
- Mejoras de Pong (power-ups, giro/efecto, obstáculos centrales).
- Tests automatizados y validación anti-trampa (riesgo aceptado en la spec 06).

## Modelo de datos

No hay modelo persistente nuevo. Se reutilizan `GameState`, `GameEngine` y `GameDefinition` de `lib/games/types.ts` (spec 07) y `saveScore` (spec 06) con `gameId: "duelo-pixel"`. Tipos internos (no exportados): `Paleta { y, vy }`, `Pelota { x, y, vx, vy }` y las constantes de dimensiones y velocidades como valores del módulo de solo lectura. Estado privado: `player`, `cpu`, `ball`, `puntosJugador`, `puntosCpu`, `espera`, `cpuError`, `keys`, `mouseY`, `score`, `level`, `paused`, `over`, `lastTime`.

## Plan de implementación

1. Migración `supabase/migrations/0008_juego_duelo_pixel.sql` (spec 02). Si el número estuviera ocupado, usar el siguiente libre. Aplicarla con el MCP de `supabase` y verificar `select short, best from games where id = 'duelo-pixel'`.
2. Crear `lib/games/duelo-pixel.ts`: física de la pelota, paletas, IA de la CPU, marcador, puntaje y dibujo.
3. Agregar la entrada `duelo-pixel` en `lib/games/registry.ts`.
4. Correr `npm run lint` y `npm run build`.
5. Probar manualmente con `npm run dev` en `/jugar/duelo-pixel`:
   - La paleta responde a `↑`/`↓`, `W`/`S` y al mouse, y no sale del lienzo.
   - La pelota se saca tras 0,8 s hacia quien perdió el punto; rebota en techo, suelo y paletas, con un ángulo según el punto de impacto y más rápida en cada golpe.
   - Anotar suma 10; al llegar a 5 puntos sube el Nivel, suma 100 · nivel y la CPU es más rápida y precisa.
   - Si la CPU llega a 5 se abre el modal con la puntuación real y se guarda con `saveScore`; `FIN` abre el mismo modal y después no hay entrada.
   - La CPU falla de forma creíble en el nivel 1 y es difícil, pero no imbatible, en el nivel 8.
   - `PAUSA`/`REANUDAR` sin salto; `JUGAR DE NUEVO` deja score 0, nivel 1 y marcador 0–0.
   - Las flechas no hacen scroll; `SALIR` no deja listeners ni loop.
   - La puntuación aparece en `/salon` y `/juego/duelo-pixel`; los demás juegos no cambian.

## Criterios de aceptación

- [ ] `/jugar/duelo-pixel` muestra el Pong real, no la arena decorativa.
- [ ] El HUD refleja `Puntuación`, `Vidas` como `—` y `Nivel` reales.
- [ ] Cada punto del jugador suma 10 y cada partido ganado suma `100 · nivel` y sube el nivel.
- [ ] Perder un partido (CPU a 5) abre el modal y `saveScore({ gameId: "duelo-pixel", score, name })` guarda la racha.
- [ ] La CPU se vuelve más rápida y precisa por nivel, con tope de velocidad 440 px/s.
- [ ] `FIN` fuerza el mismo modal y el motor no emite `gameOver` dos veces ni acepta entrada después.
- [ ] `PAUSA`/`REANUDAR` y `JUGAR DE NUEVO` funcionan sin saltos ni estado residual.
- [ ] Las teclas de juego no hacen scroll y `SALIR` no deja listeners ni `requestAnimationFrame`.
- [ ] `duelo-pixel` aparece en `/salon` y `/juego/duelo-pixel`; ningún otro juego cambia.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones tomadas y descartadas

- **Reemplazar la entrada decorativa en vez de crear otra** — `duelo-pixel` ya es la fila de Pong y es la única VERSUS. Mismo criterio que las specs 05, 08, 09 y 10.
- **Puntaje = racha de partidos contra la CPU** — da un leaderboard con sentido y una dificultad creciente. Descartados: puntos de un solo partido (tope de 5, sin ranking útil) y tiempo de supervivencia (no es un duelo).
- **Un solo jugador, sin modo local a 2 jugadores** — con un único `score` el leaderboard no sabría a quién asignar el resultado, y dos jugadores con un teclado necesitan un mapeo de teclas propio. Queda como spec futura.
- **Ángulo según el punto de impacto** — sin él, el jugador no podría ganar la partida a una CPU rápida. Es la diferencia consciente con Bloque Buster, que siempre invierte `vy`.
- **CPU con error y tope de velocidad, no perfecta** — una CPU sin error es imbatible; el error por nivel y el tope de 440 px/s garantizan una derrota "justa". Descartado: predecir rebotes.
- **Marcador del partido dibujado en el canvas** — es parte del campo del Pong y no hay otro lugar en `GameState`. Descartado: ampliar `GameState`.
- **`best` de muestra de 24 a 1800** — el 24 correspondía a otro significado de puntaje; 1800 equivale a una racha de unos 4 partidos.
- **Sin tecla de pausa propia** — el contrato no notifica pausas a la página (specs 08–10).

## Riesgos identificados

- **Atravesar paletas:** a 720 px/s y `dt` de hasta 0,05 s la pelota avanza 36 px por frame, mayor que el grosor de la paleta (14 px); hay que subdividir el movimiento o comprobar el cruce de la paleta para no hacer túnel.
- **Rebotes en bucle horizontal:** un ángulo casi nulo puede producir intercambios infinitos; se evita con un ángulo mínimo de 10° al sacar y al golpear.
- **Balance de la CPU:** el nivel donde la CPU se vuelve imbatible debe verificarse jugando; las constantes están al principio del archivo.
- **Mouse y teclado a la vez:** si ambos están activos puede haber parpadeo de la paleta; el motor debe conservar una única fuente "activa" (la última usada).
- **Mensaje de catálogo:** el texto viejo mencionaba un modo a dos jugadores que no existe; la migración debe reemplazarlo.
