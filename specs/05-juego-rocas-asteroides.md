# 05 — Juego real de ASTEROIDS

**Estado:** implemented
**Depende de:** SPEC 01
**Fecha:** 2026-09-22
**Objetivo:** Renombrar la entrada del catálogo `rocas` a `asteroids` y reemplazar su arena decorativa por el juego real de Asteroids ya construido en `references/started-games/02-asteroids/game.js`, adaptado a un componente de canvas dentro del reproductor de Next.js existente.

## Contexto

El catálogo (`lib/data.ts`) ya tiene la entrada `rocas` ("Pulveriza asteroides en gravedad cero"), pero como todo el resto del catálogo (spec 01) su pantalla de juego en `/jugar/[id]` es puramente decorativa: la puntuación sube sola por temporizador y no hay mecánica real. En paralelo existe un clon completo y funcional de Asteroids en canvas puro (`references/started-games/02-asteroids/game.js`, ~510 líneas, sin dependencias) con nave, disparo, asteroides que se dividen, vidas, niveles, partículas de explosión y un power-up de disparo triple. El usuario pidió explícitamente que el `id`/título del juego sea "asteroids", no "rocas". Este spec renombra la entrada del catálogo y porta ese juego para que sea la implementación real detrás de ella, sin tocar ningún otro juego del catálogo.

## Alcance

**Incluye:**

- `lib/data.ts`: renombrar la entrada del catálogo `id: "rocas"` → `id: "asteroids"`, `title: "ROCAS"` → `title: "ASTEROIDS"`. El campo `cover: "cover-rocas"` (y su clase CSS asociada en `app/globals.css`) **no se renombra** — es solo un nombre de clase decorativo sin relación funcional con el `id`, renombrarlo no aporta nada y agrega riesgo de romper el estilo de la portada por una discrepancia de nombres. El resto de los campos (`short`, `long`, `cat`, `color`, `best`, `plays`) no cambian.
- `lib/games/asteroids.ts`: motor del juego, agnóstico de React, portado de `game.js` (clases `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp`, constantes `RADII`/`SPEEDS`/`POINTS`/`POWERUP_*`/`TRIPLE_SPREAD`, funciones `wrap`/`dist`/`rand`/`randInt`, el loop `update(dt)`/`draw()`). Se encapsula todo el estado mutable de módulo (`ship`, `bullets`, `asteroids`, `particles`, `powerUps`, `score`, `lives`, `level`, `state`, `deadTimer`, `powerUpSpawned`, `killsSinceSpawn`) dentro de una clase `AsteroidsGame` con:
  - `constructor(canvas: HTMLCanvasElement)`: crea su propio contexto 2D y listeners de teclado **propios** (no globales en `window` sin cleanup como el original) — se agregan en el constructor y se quitan en `destroy()`.
  - `start()`: arranca el loop de `requestAnimationFrame`.
  - `pause()` / `resume()`: detiene/reanuda el loop congelando `dt` (no se llama `update()` mientras está pausado; `draw()` tampoco corre, el último frame queda estático).
  - `forceGameOver()`: fuerza el fin de partida inmediato (usado por el botón "FIN"), reutilizando el mismo camino que cuando las vidas llegan a 0 de forma natural.
  - `reset()`: reinicia el estado (equivalente a `initGame()`), para "JUGAR DE NUEVO".
  - `destroy()`: cancela el `requestAnimationFrame` pendiente y remueve los listeners de teclado — se llama al desmontar el componente para no dejar listeners huérfanos al navegar a otra pantalla (bug que sí tiene el original, pensado para correr standalone en su propio `index.html`).
  - `onStateChange(cb)`: callback que se invoca **solo cuando cambian** `score`, `lives`, `level` o `gameOver` (no en cada frame), para que el HUD de React se actualice sin re-renderizar a 60fps.
  - El HUD propio del canvas (`drawHUD`, `drawOverlay` de `GAME OVER`) y el "pulsa espacio para reiniciar" en estado `gameover` de `game.js` se eliminan del motor: el HUD y el reinicio los controla el reproductor de Arcade Vault (ver más abajo). El resto del render (nave, asteroides, balas, partículas, power-up) se mantiene igual, monocromo blanco sobre negro, sin recolorear.
  - Resolución lógica interna fija en 800×600 (igual que el original), igual que su `RADII`/velocidades/física — no se reescala la física, solo el tamaño en pantalla del `<canvas>`.
- `components/games/AsteroidsGame.tsx` ("use client"): componente wrapper que crea el `<canvas width={800} height={600}>` con CSS `width: 100%; height: 100%` (se ajusta al contenedor `.crt-screen`, que ya tiene `aspect-ratio: 4/3`, igual que 800×600, así que no hay distorsión), instancia `AsteroidsGame` en un `useEffect` sobre un `ref`, llama a `destroy()` en el cleanup, y expone vía props: `paused: boolean`, `onStateChange({score, lives, level, gameOver})`, y un método imperativo (`ref` con `useImperativeHandle` o prop `resetSignal`) para `reset()` y `forceGameOver()` invocados desde la página contenedora.
- `app/jugar/[id]/page.tsx`: para `game.id === "asteroids"` se renderiza `<AsteroidsGame>` en vez del `div.game-arena` decorativo, dentro del mismo `.crt-screen`/`.crt` existente. El HUD superior (`Jugador`/`Puntuación`/`Vidas`/`Nivel`) y los botones (`PAUSA`/`FIN`/`SALIR`) se mantienen visualmente idénticos pero para `asteroids` pasan a leer `score`/`lives`/`level` reales del motor (vía `onStateChange`) en vez del contador simulado por `setInterval`; "Vidas" se muestra igual (`"♥ ".repeat(lives)`) usando el valor real (0–3); `PAUSA` llama a `pause()`/`resume()` del motor; `FIN` llama a `forceGameOver()`; cuando el motor reporta `gameOver: true` (ya sea por vidas a 0 o por `forceGameOver()`) se abre el mismo modal existente de fin de partida con la puntuación real, reutilizando `saveScore({ game: "asteroids", score, name })` sin cambios; "JUGAR DE NUEVO" llama a `reset()` del motor además del `restart()` ya existente de la página. El overlay `EN PAUSA` que ya existe en la página se reutiliza tal cual, mostrándose sobre el canvas congelado.
- Para cualquier otro `id` del catálogo, `/jugar/[id]` sigue mostrando exactamente la arena decorativa actual, sin ningún cambio de comportamiento.
- Los `keydown`/`keyup` del motor llaman a `preventDefault()` en `ArrowLeft`/`ArrowRight`/`ArrowUp`/`Space` para que no hagan scroll de la página mientras se juega (el original no lo necesita porque corre en un `index.html` standalone sin más contenido scrolleable).

**No incluye (explícitamente fuera de este spec):**

- Ningún cambio a otros juegos del catálogo (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, etc.) — siguen con la arena decorativa del spec 01.
- Recolorear el juego al color de acento (`yellow`) de `asteroids` en `lib/data.ts` — se mantiene monocromo blanco/negro tal como el original.
- Guardar el progreso de una partida en curso (nivel/vidas/puntuación) entre sesiones — el estado del motor vive solo en memoria mientras la pestaña está en `/jugar/asteroids`, igual que el resto del reproductor.
- Sonido/música — el original no tiene audio y este port tampoco lo agrega.
- Soporte táctil o de gamepad — solo teclado (`←` `→` `↑` `Espacio`), igual que el original.
- Cambiar la portada, descripción o metadata de `asteroids` en `lib/data.ts` o en `app/juego/[id]/page.tsx` (detalle del juego) — esas pantallas ya describen correctamente el juego y no requieren cambios.
- Tests automatizados (el proyecto no tiene test runner configurado, igual que specs anteriores).

## Modelo de datos

No se introduce ningún modelo persistente nuevo (`saveScore`/`ScoreEntry` de `lib/scores.ts` se reutilizan sin cambios). Se introducen tipos internos del motor, no persistidos:

- `AsteroidsState` (en `lib/games/asteroids.ts`): `{ score: number; lives: number; level: number; gameOver: boolean }` — lo que recibe el callback `onStateChange`.
- Las clases internas del motor (`Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp`) son detalle de implementación de `AsteroidsGame`, no se exportan ni se persisten.

## Plan de implementación

1. Crear `lib/games/asteroids.ts` portando la lógica de `references/started-games/02-asteroids/game.js` (utils, constantes, clases `Bullet`/`Asteroid`/`Ship`/`Particle`/`PowerUp`) dentro de una clase `AsteroidsGame` con los métodos `start`/`pause`/`resume`/`reset`/`forceGameOver`/`destroy`/`onStateChange` descritos en Alcance; sin el HUD ni los overlays de texto propios (`drawHUD`, `drawOverlay`, el "pulsa espacio para reiniciar" en `gameover`).
2. Crear `components/games/AsteroidsGame.tsx`: canvas 800×600 con CSS responsivo, ciclo de vida vía `useEffect` (`instancia.start()` al montar, `instancia.destroy()` al desmontar), props `paused`/`onStateChange`, y una forma de invocar `reset()`/`forceGameOver()` desde el padre (`useImperativeHandle` con `forwardRef`).
3. Modificar `app/jugar/[id]/page.tsx`: cuando `game.id === "asteroids"`, renderizar `<AsteroidsGame>` en vez de `div.game-arena`, conectar `score`/`lives`/`level` del HUD y el flujo de `over`/`saved`/`restart` al estado real del motor en vez del `setInterval` decorativo; para el resto de `id` no cambia nada.
4. Correr `npm run lint` y `npm run build`, confirmar que no hay errores y que la ruta `/jugar/[id]` sigue generándose igual que antes.
5. Probar manualmente en el navegador (`npm run dev`) en `/jugar/asteroids`: mover/rotar con `←`/`→`, propulsar con `↑`, disparar con `Espacio`; destruir asteroides grandes y ver que se dividen en medianos y luego pequeños; perder las 3 vidas y confirmar que se abre el modal de fin de partida con la puntuación real y que se puede guardar con iniciales (`saveScore`); recoger el power-up de disparo triple y confirmar el disparo en abanico durante su duración; usar `PAUSA`/`REANUDAR` y confirmar que el juego se congela y reanuda; usar `FIN` a mitad de partida y confirmar que abre el mismo modal; usar `SALIR` y confirmar que vuelve a `/juego/asteroids` sin dejar el juego corriendo de fondo (listeners removidos); navegar a `/jugar/serpentina` (u otro id) y confirmar que sigue mostrando la arena decorativa sin cambios.

## Criterios de aceptación

- [ ] `/jugar/asteroids` muestra el juego real (nave, asteroides, disparo, división de asteroides, partículas de explosión, power-up de disparo triple) en vez de la arena decorativa.
- [ ] El HUD superior (`Puntuación`, `Vidas`, `Nivel`) de `/jugar/asteroids` refleja el estado real del motor, no un contador simulado.
- [ ] Perder las 3 vidas abre el modal de fin de partida existente con la puntuación real y permite guardarla con iniciales vía `saveScore({ game: "asteroids", ... })`.
- [ ] El botón `FIN` fuerza el mismo modal de fin de partida con la puntuación alcanzada hasta ese momento.
- [ ] El botón `PAUSA`/`REANUDAR` congela y reanuda el juego real (nave, asteroides y balas dejan de moverse mientras está en pausa).
- [ ] `JUGAR DE NUEVO` reinicia el motor a un estado limpio (score 0, 3 vidas, nivel 1).
- [ ] Al navegar fuera de `/jugar/asteroids` (botón `SALIR` u otra navegación) no quedan listeners de teclado activos ni un loop de `requestAnimationFrame` corriendo en segundo plano.
- [ ] Ningún otro juego del catálogo (`/jugar/serpentina`, `/jugar/caida`, etc.) cambia de comportamiento respecto al estado actual.
- [ ] Usar las flechas o espacio mientras se juega no hace scroll de la página.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones tomadas y descartadas

- **Motor separado en `lib/games/asteroids.ts`, agnóstico de React, en vez de portar `game.js` directamente dentro del componente** — permite que la lógica del juego (clases, loop, física) sea independiente del ciclo de vida de React y se pueda razonar/testear por separado; el componente de React solo gestiona el `<canvas>` y el puente de estado.
- **`onStateChange` disparado solo cuando cambian `score`/`lives`/`level`/`gameOver`, no en cada frame** — evita forzar un re-render de React a 60fps solo para actualizar un HUD que en la práctica cambia con poca frecuencia (al destruir un asteroide, perder una vida o subir de nivel).
- **HUD y overlays de texto del canvas original (`drawHUD`, `drawOverlay`, reinicio con espacio en `gameover`) removidos del motor** — el reproductor de Arcade Vault ya tiene su propio HUD pixel-art y su propio modal de fin de partida con guardado de puntuación; mantener los dos HUDs sería redundante y visualmente inconsistente con el resto de la plataforma.
- **`FIN` y "vidas a 0" unificados en el mismo flujo de fin de partida** — desde la perspectiva del jugador ambos casos son "la partida terminó", y usar un solo camino (`forceGameOver()` internamente dispara el mismo `gameOver: true` que la pérdida natural de la última vida) evita mantener dos lógicas de cierre de partida distintas.
- **`PAUSA` congela el loop real (`update()` no corre) en vez de ocultarse para este juego** — el reproductor ya tenía un botón de pausa genérico; forzar el comportamiento esperado (el juego se detiene de verdad) es más simple que ocultarlo solo para `asteroids`.
- **Sin recoloreo al acento `yellow` de `asteroids`** — se prioriza portar el juego funcional 1:1 con el mínimo riesgo de introducir bugs visuales; recolorear queda como posible mejora futura si se decide alinear visualmente el juego con el resto del catálogo.
- **Se mantiene el power-up de disparo triple** aunque no está documentado en el README del juego de referencia — es parte del código ya funcional en `game.js`; quitarlo sería reescribir lógica que ya funciona sin ningún beneficio claro.
- **Listeners de teclado y `requestAnimationFrame` con `destroy()` explícito** — a diferencia del original (pensado para vivir solo en su propio `index.html`, nunca se desmonta), dentro de Arcade Vault el jugador puede navegar a otra pantalla en cualquier momento; sin un cleanup explícito quedarían listeners globales y un loop corriendo indefinidamente en segundo plano.
- **Resolución lógica fija en 800×600 con escalado por CSS** — evita reescribir la física/constantes de radios y velocidades (calibradas para ese tamaño); el `<canvas>` se escala visualmente al contenedor `.crt-screen` (que ya es 4:3) sin tocar las coordenadas internas del juego.

## Riesgos identificados

- Congelar `draw()` durante la pausa (no solo `update()`) significa que el último frame dibujado queda estático; si el navegador redimensiona la ventana mientras está en pausa, el canvas podría verse recortado hasta reanudar. Riesgo bajo y aceptado dado que el resto del reproductor tampoco es responsive en tiempo real.
- Si `AsteroidsGame.destroy()` no se invoca correctamente en algún camino de desmontaje (por ejemplo, un error de React antes de que corra el cleanup), podría quedar un listener de teclado huérfano hasta recargar la página. Se mitiga probando explícitamente la navegación de salida en el plan de implementación.
- El power-up y la dificultad (velocidad/cantidad de asteroides por nivel) quedan calibrados igual que el juego de referencia, sin ajuste de balance específico para Arcade Vault; si resulta demasiado fácil/difícil en el contexto del catálogo, es un ajuste de balance para un spec o iteración futura, no un bloqueante de este port.
