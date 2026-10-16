# SPEC — Ranaria (Frogger): motor del juego

> **Estado:** Implementado (pendiente: aplicar la migración 0003 y 3 verificaciones manuales; ver los criterios sin marcar)
> **Depende de:** 06 (catálogo y leaderboard en Supabase), 07 (motor genérico y registro de juegos), 12 (controles táctiles)
> **Fecha:** 2026-10-14 (adaptada al contrato `GameEngine`; borrador original 2026-05-20)
> **Objetivo:** Crear Frogger desde cero como motor real `lib/games/ranaria.ts`, registrado bajo el `id` `ranaria`, reemplazando la arena decorativa de esa entrada del catálogo, con carretera, río, 5 bocas destino, 3 vidas y temporizador de ronda.

---

## Contexto

La entrada `ranaria` del catálogo (ARCADE, `cover-rana`, `green`, `sort_order` 7) es la entrada decorativa de Frogger: hoy `/jugar/ranaria` muestra la arena decorativa de la spec 01. No hay Frogger en `references/started-games/`; el juego se diseña desde cero. Esta spec lo crea como una clase que `implements GameEngine`, siguiendo la spec 07 y los precedentes de las specs 05, 08, 09 y 10. Como `ranaria` ya es la fila de Frogger, no se añade entrada nueva ni clase `cover-*` nueva; sí se actualizan `short` y `long`.

El borrador original de esta spec asumía una arquitectura anterior (componente React `FroggerGame.tsx`, ruta `app/games/frogger/play/page.tsx`, HUD dentro del canvas, `av_player_name`, `INSERT` de una fila `frogger` con color `lime`). Se descartó todo eso a favor del contrato vigente: el reproductor `/jugar/[id]`, el HUD, la pausa y el modal de fin de partida ya existen y no se tocan.

---

## Alcance

**Incluye:**

- `supabase/migrations/0003_juego_ranaria.sql`: un `UPDATE` sobre la fila existente `ranaria`. Se conservan `id`, `title`, `cat`, `cover`, `color`, `best`, `plays` y `sort_order`; solo cambian `short` y `long`:
  - `short`: `Cruza la carretera y el río sin convertirte en papilla.`
  - `long`: `Guía a tu rana a través de una carretera repleta de coches y un río de troncos y tortugas flotantes. Llena las cinco bocas del otro lado para completar la ronda; cada nivel acelera el tráfico y acorta el tiempo. Tres vidas y mucho asfalto por delante.`
- `lib/games/ranaria.ts`: clase `RanariaGame implements GameEngine`, con los tipos de `lib/games/types.ts` sin redefinirlos.
  - **Lienzo lógico 800×600** = cuadrícula de 20 columnas × 15 filas de 40 px (4:3, sin paneles laterales). Filas (0 = arriba): `0` bocas destino, `1–6` río (6 carriles), `7` mediana segura, `8–12` carretera (5 carriles), `13` fila de inicio (segura), `14` franja de la barra de tiempo.
  - **Carretera:** coches (1 celda) y camiones (2–3 celdas) por carril, con velocidad y sentido propios (sentidos alternos); se mueven horizontalmente y reaparecen por el lado opuesto. Tocar uno es letal.
  - **Río:** troncos (2–4 celdas) y grupos de tortugas (2–3 celdas) por carril, también en loop. La rana solo sobrevive sobre un tronco o tortugas visibles y es arrastrada con ellos. Las tortugas ciclan 3 s visibles / 1.5 s sumergidas, con fase independiente por grupo; sumergidas no sostienen.
  - **Rana:** saltos discretos de 1 celda en 4 direcciones (animación de 120 ms). Teclas: `←` `→` `↑` `↓` y `A` `D` `W` `S`, con `preventDefault()` en `keydown`/`keyup`. Una pulsación se guarda como salto pendiente y se ejecuta al terminar el salto en curso. Sobre un tronco la columna de la rana es fraccionaria; al saltar en horizontal se parte de `round(col)`. No puede salir por los bordes laterales en tierra firme (el salto se ignora).
  - **Muerte (un solo camino `killFrog()`):** (a) atropello, (b) agua, (c) tortuga que se sumerge bajo la rana, (d) el río la arrastra fuera del lienzo por un borde, (e) tiempo agotado, (f) llegar a una boca ocupada o a un muro entre bocas.
  - **Bocas destino:** 5 bocas de 2 columnas (cols 1–2, 5–6, 9–10, 13–14, 17–18). El resto de la fila 0 es muro. Una boca ocupada no se reutiliza en la ronda. Al llenar las 5 se completa la ronda.
  - **Vidas:** `lives` arranca en 3. Cada muerte resta 1; con 0 vidas se llama a `endGame()`.
  - **Puntuación:** +10 por cada fila nueva alcanzada hacia arriba (la mejor fila se reinicia cada vez que aparece una rana nueva); +50 al ocupar una boca; +`segundosRestantes × 10` (entero) al ocupar una boca; +200 al completar la ronda.
  - **Temporizador:** 15 s en el nivel 1, −1 s por nivel, mínimo 8 s. Se muestra como barra horizontal en la fila 14 (verde → amarillo → rojo). Es un elemento del tablero, no un HUD: ningún otro valor se dibuja dentro del canvas.
  - **Niveles:** `level` empieza en 1 y sube al completar cada ronda. Las velocidades de todos los carriles se multiplican por `1.15^(level−1)`. Al subir de nivel se reconstruyen los carriles y se vacían las bocas.
  - **Velocidades** en celdas por segundo: carretera 1.8–4.5, río 1.2–3.0 (nivel 1). Todo el movimiento usa `dt` en segundos, acotado a 0.05 s.
  - **Loop:** `requestAnimationFrame`; `resume()` reinicia `lastTime`. La pausa congela `update()` y `draw()`; el overlay "EN PAUSA" lo dibuja la página.
  - **Estado:** `{ score, lives, level, gameOver }`. `reportState()` solo emite cuando cambia alguno de los cuatro campos.
  - **Fin de partida:** un único `endGame()` para quedarse sin vidas y para `forceGameOver()`. Emite el estado una sola vez, detiene el loop y desde ahí el motor ignora teclas.
  - `constructor(canvas)` agrega `keydown`/`keyup` en `document`; `destroy()` los remueve y cancela el `requestAnimationFrame`. Sin estado a nivel de módulo (las constantes de solo lectura sí pueden ir en el módulo).
  - **Dibujo con primitivas de canvas** y colores temáticos, sin imágenes: coches de colores con ruedas, camiones con cabina diferenciada, troncos marrones con vetas, tortugas verdes con caparazón (sumergidas: contorno semitransparente), rana verde con ojos y patas extendidas durante el salto, bocas con borde dorado y silueta de rana si están ocupadas. Zonas diferenciadas: asfalto oscuro, agua azul oscuro, verde oscuro para mediana e inicio. Sin HUD ni overlays de texto.
- `lib/games/registry.ts`: entrada `ranaria` con `width: 800`, `height: 600`, `create` y `controlesTactiles` con las cuatro flechas (`▲ ◀ ▶ ▼`, `key`/`code` `Arrow*`, sin repetición: un toque, un salto).

**No incluye:**

- Cambios a `app/jugar/[id]/page.tsx`, `components/games/GameCanvas.tsx`, `lib/games/types.ts` o `app/globals.css`.
- Una ruta de reproductor propia, un modal propio o `localStorage` propio: el nombre y el guardado los resuelve el reproductor con `useUser()` y `saveScore`.
- Skins (las añade `skin-designer` en el paso posterior de `/spec-imp-game`) y ajustes responsive (los hace `mobile-porter`).
- Sprites bitmap y sonido.
- Animaciones de muerte elaboradas o partículas.
- Power-ups, mosca bonus en las bocas, cocodrilos disfrazados de tronco.
- Tecla de pausa propia (`P`/`Esc`).
- Realtime o validación anti-trampa del leaderboard.
- Tests automatizados (el proyecto no tiene test runner).
- Cambios a las specs/carpetas `game-jam/ranaria` y otras propuestas.

---

## Modelo de datos

No se introduce ningún modelo persistente nuevo. Se reutilizan `GameState`, `GameEngine` y `GameDefinition` de `lib/games/types.ts` y `saveScore` con `gameId: "ranaria"`.

Tipos internos de `lib/games/ranaria.ts` (no exportados): `Lane { row, speed, dir, entities }`, `Entity { col, width, kind: "car" | "truck" | "log" | "turtle", phase? }` y `Frog { col, row, animating, animT, fromCol, fromRow, toCol, toRow }`.

---

## Plan de implementación

1. **Migración SQL** `supabase/migrations/0003_juego_ranaria.sql` con el `UPDATE` de `short`/`long` sobre `ranaria`. Si `0003` estuviera ocupado, usar el siguiente número libre. Aplicarla con el MCP de `supabase` (si está autorizado) o a mano en el SQL Editor. Verificar con `select short, long from games where id = 'ranaria'`.
2. **Esqueleto del motor** en `lib/games/ranaria.ts`: constantes, tipos, clase con el contrato completo (`start/pause/resume/reset/forceGameOver/destroy/onStateChange`), listeners, loop con `dt` acotado, `reportState()` y `endGame()`.
3. **Carriles:** `buildLanes(level)` para 5 carriles de carretera y 6 de río, con huecos atravesables (≥ 1 celda) y al menos 2 entidades por carril; movimiento con reaparición por el lado opuesto; ciclo de inmersión de las tortugas.
4. **Rana:** salto pendiente + animación de 120 ms, límites laterales, arrastre sobre troncos y tortugas.
5. **Reglas:** colisión de carretera, soporte en el río, muerte por agua/sumersión/borde/tiempo, bocas destino, `killFrog()` (vidas y reaparición en fila 13, temporizador reiniciado) y `completeRound()` (nivel, carriles, bocas vacías).
6. **Puntuación y temporizador:** puntos por fila, boca, bonus de tiempo y ronda; barra de tiempo en la fila 14.
7. **Dibujo** con primitivas, según el alcance.
8. **Registro:** entrada `ranaria` en `lib/games/registry.ts` con `controlesTactiles`.
9. **Verificación:** `npm run lint` y `npm run build` sin errores; prueba manual con `npm run dev` en `/jugar/ranaria` siguiendo los criterios de aceptación.

---

## Criterios de aceptación

- [ ] La fila `ranaria` tiene los nuevos `short`/`long` en Supabase y el resto de columnas intactas.
- [x] `/jugar/ranaria` muestra el Frogger real (no la arena decorativa) con carretera, río, zonas seguras y 5 bocas diferenciadas.
- [x] La rana aparece centrada en la fila 13 y salta exactamente una celda por pulsación, con animación de 120 ms; no sale por los bordes laterales en tierra.
- [x] Coches, camiones, troncos y tortugas se mueven en loop y reaparecen por el lado opuesto.
- [x] Las tortugas alternan 3 s visibles / 1.5 s sumergidas.
- [x] La rana muere por atropello, por caer al agua, por sumersión de la tortuga que la porta, por ser arrastrada fuera del lienzo y por tiempo agotado.
- [x] La rana viaja sobre troncos y tortugas visibles.
- [x] Llegar a una boca libre la marca y suma +50 y el bonus de tiempo; llegar a una ocupada o a un muro entre bocas mata.
- [x] Al llenar las 5 bocas suma +200, sube el nivel, vacía las bocas y aumenta la velocidad (+15 %) y reduce el tiempo (−1 s, mínimo 8 s).
- [x] +10 por cada fila nueva alcanzada; mover la rana arriba y abajo no suma puntos repetidos.
- [x] El HUD de la página refleja score, vidas (empieza en 3) y nivel en tiempo real; el canvas no dibuja HUD ni overlays de texto.
- [x] Con 0 vidas se abre el modal de fin de partida con la puntuación real y se guarda con `saveScore({ gameId: "ranaria", score, name })`.
- [x] `FIN` fuerza el mismo modal; tras el fin el motor ignora teclas y no emite `gameOver` más de una vez.
- [x] `PAUSA`/`REANUDAR` congela y reanuda sin saltos; las teclas en pausa no encolan saltos.
- [x] `JUGAR DE NUEVO` reinicia a score 0, 3 vidas, nivel 1 y bocas vacías.
- [x] Las flechas y `WASD` no hacen scroll de la página.
- [x] `SALIR` no deja listeners ni `requestAnimationFrame` activos.
- [ ] `ranaria` declara `controlesTactiles` en el registro y el gamepad virtual maneja los 4 saltos.
- [ ] La puntuación guardada aparece en `/salon` y en `/juego/ranaria`; el catálogo muestra los nuevos `short`/`long`.
- [ ] Ningún otro juego cambia de comportamiento.
- [x] `npm run lint` y `npm run build` terminan sin errores.

---

## Decisiones tomadas y descartadas

- **Reemplazar la entrada decorativa `ranaria` en vez de insertar `frogger`** — igual que las specs 05, 08, 09 y 10. Una fila nueva dejaría `ranaria` decorativa y duplicada. Descartado: `INSERT` con `id` `frogger` y color `lime` (ese color no existe en el tema).
- **Motor `GameEngine` y reproductor existente** — el HUD, la pausa, el modal y el guardado son genéricos desde la spec 07. Descartados: componente React propio, `app/games/frogger/play/page.tsx` y `av_player_name`.
- **Lienzo 800×600 con cuadrícula de 20×15** — respeta el 4:3 de `.crt-screen`. Descartado: 640×560 (o 480×640 del borrador, que se contradecía).
- **Temporizador como barra del tablero** — el contrato prohíbe HUD dentro del canvas, pero el HUD de la página no tiene un campo de tiempo y cambiarlo está fuera de alcance. La barra es parte del tablero (como en el Frogger original) y no repite ningún valor del HUD.
- **Velocidades en celdas/s con `dt` en segundos** — el borrador usaba px/frame, que depende de la tasa de refresco. Se conserva el rango relativo.
- **Puntos por fila nueva, reiniciados en cada rana nueva** — evita regalar puntos al reaparecer tras una muerte y evita cobrarlos dos veces al subir y bajar.
- **Salto discreto de 120 ms, sin movimiento continuo** — mecánica canónica; simplifica colisiones y soporte.
- **Tortugas con ciclo de inmersión por grupo** — diferencia al río de uno solo de troncos.
- **Controles táctiles mínimos incluidos** — el registro debe declararlos por la spec 12; son solo 4 botones, sin lógica nueva en el motor.
- **Primitivas de canvas, sin imágenes** — no hay assets de Frogger en el repositorio.
- **Sin tecla de pausa propia** — mismo motivo que las specs 08, 09 y 10.

## Riesgos identificados

- El arrastre sobre troncos deja `col` fraccionaria; al saltar hacia arriba/abajo hay que redondear para caer en una celda y no morir por un desfase de decimales. Se cubre con la prueba manual.
- Entre dos carriles de río consecutivos con sentidos opuestos, la rana puede quedar sin soporte si el salto cae en un hueco; es intencional, pero hay que comprobar que los huecos permiten un cruce posible en el nivel 1 y no se vuelven imposibles con la velocidad de niveles altos.
- Si `endGame()` no corta el flujo antes del siguiente frame podría emitir el estado de fin dos veces; lo cubre el criterio de una sola emisión.
