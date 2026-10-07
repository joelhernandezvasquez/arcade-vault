# Game Jam — Juego real de FROGGER (RANARIA)

**Estado:** Draft
**Depende de:** SPEC 07 (motor genérico y registro de juegos), SPEC 06 (catálogo en Supabase)
**Fecha:** 2026-10-07
**Objetivo:** crear el Frogger clásico desde cero como motor real `lib/games/ranaria.ts`, registrado bajo el `id` `ranaria`, reemplazando la arena decorativa de esa entrada del catálogo.

## Contexto

Tema de la jam: "Frogger: cruza la carretera y el río sin convertirte en papilla". Este juego es la lectura más fiel: una rana, cuatro carriles de tráfico, una mediana segura, cinco carriles de río con troncos y tortugas, y cinco nenúfares en la orilla opuesta.

La entrada `ranaria` del catálogo (ARCADE, `cover-rana`, `green`, `sort_order` 7) ya existe como entrada decorativa de Frogger: su texto habla de coches, troncos y nenúfares. Hoy `/jugar/ranaria` muestra la arena decorativa de la spec 01. No hay Frogger en `references/started-games/`, así que se diseña desde cero y se registra sobre esa misma fila (mismo criterio que las specs 08, 09 y 10: no se agrega una entrada duplicada). Por eso el `id` es el existente y no uno nuevo.

Hallazgos de diseño:

- El Frogger original avanza por casillas: un salto = una celda, sin inercia. Se conserva porque el tablero 16×12 de celdas de 50 px cubre exactamente 800×600 (4:3) sin paneles.
- La dificultad viene de dos sistemas distintos: en la carretera el contacto mata; en el río el agua mata y la plataforma salva. Se resuelven con dos pruebas de colisión separadas.
- Sin assets externos: rana, coches, camiones, troncos y tortugas se dibujan con primitivas de canvas.

## Alcance

**Incluye:**

- `lib/games/ranaria.ts`: clase `RanariaGame implements GameEngine`, con los tipos `GameEngine`/`GameState` de `lib/games/types.ts` (spec 07), sin redefinirlos.
  - Tablero de 16 columnas × 12 filas de celdas de 50 px (800×600). Fila 0 = orilla con 5 nenúfares; filas 1–5 = río; fila 6 = mediana segura; filas 7–10 = carretera; fila 11 = salida.
  - Rana de 36×36 px centrada en su celda. Aparece en la columna 8, fila 11. Salta una celda por pulsación; `keydown` con `e.repeat` se ignora (un salto por pulsación). No sale del tablero por los lados ni por abajo (el salto se ignora).
  - Teclas: `←`/`→`/`↑`/`↓` y `A`/`D`/`W`/`S`. Todas llaman a `preventDefault()` en `keydown`/`keyup`. En pausa, fin de partida o animación de muerte las teclas se ignoran.
  - Carretera (velocidades en px/s, positivo = derecha, a nivel 1): fila 7 coches de 50 px cada 250 px a −100; fila 8 coches de 50 px cada 300 px a +180; fila 9 camiones de 100 px cada 350 px a −80; fila 10 coches de 50 px cada 220 px a +120. Alto de vehículo 36 px. Mata el contacto rectangular entre la caja de la rana (30×30, centrada) y el vehículo.
  - Río: fila 1 troncos de 150 px cada 350 px a +70; fila 2 tortugas (grupo de 3, 150 px) cada 300 px a −80; fila 3 troncos de 250 px cada 450 px a +110; fila 4 tortugas (grupo de 2, 100 px) cada 250 px a −60; fila 5 troncos de 150 px cada 300 px a +90. Las filas 2 y 4 se sumergen: ciclo de 4 s, 1,2 s bajo el agua con parpadeo de aviso los 0,5 s previos; sumergidas no sostienen.
  - Cada fila reutiliza sus objetos con `n = ⌈(800 + w) / separación⌉` objetos y periodo `n · separación`; al salir por un lado reaparecen por el otro (envoltura sin saltos visibles).
  - Reglas del río: si el centro de la rana (en x) no está dentro de un tronco o tortuga no sumergida, se ahoga. Sobre una plataforma, la rana se desplaza con ella (`x += v · dt`). Si su centro sale de [0, 800] muere.
  - Orilla (fila 0): hay 5 nenúfares de 60 px centrados en x = 100, 250, 400, 550 y 700. Aterrizar con |cx − nenúfar| ≤ 30 en uno libre lo llena y reaparece la rana. Aterrizar en uno ocupado o en el seto (cualquier otra x) mata.
  - Tiempo: 30 s por rana. Se muestra como una barra fina en el borde inferior de la fila de salida (parte del tablero, no un HUD). Al llegar a 0 muere.
  - Muerte: se pierde 1 vida, la rana se dibuja aplastada o con burbujas 0,6 s (entradas ignoradas) y reaparece en la salida con el tiempo reiniciado y su `maxRow` en 11.
  - Puntuación: +10 por cada fila nueva alcanzada hacia adelante (se registra la fila máxima de la rana actual, no se vuelve a puntuar al retroceder); nenúfar lleno = +50 + 10 × segundos restantes (redondeo hacia arriba); tablero completo (5 nenúfares) = +1000 y se vacían los nenúfares.
  - `level` = 1 + tableros completados, sin tope. Multiplicador de velocidad de vehículos y plataformas: `1 + 0,12 · (level − 1)`, tope 2,0.
  - `dt` acotado a 0,05 s; `resume()` reinicia `lastTime` para no acumular el tiempo pausado. La pausa congela `update()` y `draw()`; el overlay "EN PAUSA" lo dibuja la página.
  - `GameState`: `{ score, lives, level, gameOver }` con `lives` de 3 a 0. `reportState()` solo emite cuando cambia alguno de esos campos, no por frame.
  - Un único camino de fin de partida (`endGame()`): perder la última vida y `forceGameOver()` ponen `gameOver = true`, emiten el estado una sola vez y detienen el loop; después se ignoran teclas y no corre más `update()`.
  - `constructor(canvas)`: crea su contexto 2D y agrega `keydown`/`keyup` en `document`. `destroy()` los remueve y cancela el `requestAnimationFrame` pendiente. Sin estado a nivel de módulo; las tablas de carriles son constantes de solo lectura.
  - Dibujo: carretera gris oscuro con líneas discontinuas, río azul profundo, mediana y salida verde, seto verde en la orilla; rana verde con ojos; coches magenta/amarillo/cyan, camiones naranja; troncos marrones, tortugas verde oscuro. Sin HUD ni textos en el canvas.
- `lib/games/registry.ts`: nueva entrada `ranaria: { width: 800, height: 600, create: (canvas) => new RanariaGame(canvas) }`.

**No incluye (explícitamente fuera de esta spec):**

- Ningún cambio a otros juegos del catálogo, ni a `app/jugar/[id]/page.tsx`, `components/games/GameCanvas.tsx` o `lib/games/types.ts`.
- Enemigos extra del Frogger arcade (serpientes, nutria, cocodrilos, mosca bonus), vida extra por puntos, sonido, gamepad o táctil.
- Tecla de pausa propia (`P`/`Escape`): la pausa la cubre solo el botón `PAUSA` del reproductor (misma razón que las specs 08–10).
- Overlays propios de PAUSA o GAME OVER y HUD dibujado en el canvas.
- Tests automatizados y validación anti-trampa de puntuaciones (riesgo aceptado en la spec 06).

## Modelo de datos

No se introduce ningún modelo persistente nuevo. Se reutilizan sin cambios `GameState`, `GameEngine` y `GameDefinition` de `lib/games/types.ts` (spec 07), y `saveScore` de la spec 06 con `gameId: "ranaria"`.

Tipos internos de `lib/games/ranaria.ts` (detalle de implementación, no exportados): `LaneKind = "road" | "log" | "turtle"`, `LaneDef { row, kind, w, spacing, speed }`, `Obj { x }` (posición izquierda; el ancho viene de la fila) y las constantes `ROAD_LANES` y `RIVER_LANES`. Son estado privado de la clase: `frog { x, y }`, `maxRow`, `lanes` (objetos con posición), `bays: boolean[5]`, `timeLeft`, `deadTimer`, `score`, `lives`, `completed`, `paused`, `over`, `lastTime` y el reloj de inmersión.

## Plan de implementación

1. Migración SQL `supabase/migrations/0003_juego_ranaria.sql` (ver la spec 02 de esta carpeta). Aplicarla vía el MCP de `supabase`; verificar con `select short, long from games where id = 'ranaria'`.
2. Crear `lib/games/ranaria.ts` con `RanariaGame implements GameEngine`: estado como campos de instancia, listeners en el constructor y removidos en `destroy()`, sin HUD ni overlays.
3. Agregar la entrada `ranaria` en `lib/games/registry.ts`.
4. Correr `npm run lint` y `npm run build`.
5. Probar manualmente con `npm run dev` en `/jugar/ranaria`:
   - La rana salta una celda por pulsación con flechas y `WASD`; mantener la tecla no la hace saltar en cadena.
   - Un vehículo la mata; la rana en la mediana y la salida está a salvo.
   - Caer al agua mata; subirse a un tronco la lleva y salir por el borde mata; las tortugas sumergidas ya no sostienen y parpadean antes.
   - Llenar un nenúfar suma `50 + 10 × segundos`; saltar a uno ocupado o al seto mata.
   - Cada fila nueva suma 10 una sola vez; retroceder y avanzar no repite el punto.
   - Se acaba el tiempo (30 s) y muere; la barra baja de forma visible.
   - Llenar los 5 nenúfares suma 1000, sube Nivel y los vehículos van más rápido.
   - Perder 3 vidas abre el modal con la puntuación real y permite guardar con `saveScore`; el HUD muestra vidas 3 → 0.
   - `FIN` abre el mismo modal y tras eso las teclas no mueven nada.
   - `PAUSA`/`REANUDAR` congela y reanuda sin salto de objetos ni del temporizador.
   - `JUGAR DE NUEVO` deja score 0, nivel 1, 3 vidas y nenúfares vacíos.
   - Las flechas no hacen scroll.
   - `SALIR` no deja listeners ni loop huérfano.
   - Navegar a `/jugar/serpentina`, `/jugar/caida` y `/jugar/bloque-buster` y confirmar que no cambiaron.

## Criterios de aceptación

- [ ] `/jugar/ranaria` muestra el Frogger real en vez de la arena decorativa.
- [ ] El HUD (`Puntuación`, `Vidas`, `Nivel`) refleja el estado real del motor.
- [ ] Los vehículos matan por contacto y el río mata si la rana no está sobre una plataforma; las plataformas la transportan.
- [ ] Los nenúfares se llenan una sola vez; el tablero completo suma 1000 y sube el nivel.
- [ ] Quedarse sin vidas abre el modal existente y permite guardar con `saveScore({ gameId: "ranaria", score, name })`.
- [ ] El botón `FIN` fuerza el mismo modal y no se emite `gameOver` más de una vez.
- [ ] `PAUSA`/`REANUDAR` y `JUGAR DE NUEVO` funcionan sobre el juego real.
- [ ] `SALIR` u otra navegación no deja listeners ni `requestAnimationFrame` activos.
- [ ] Las flechas y `WASD` no hacen scroll de la página.
- [ ] Ningún otro juego del catálogo cambia de comportamiento.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones tomadas y descartadas

- **Reemplazar la entrada decorativa `ranaria`** — ya describe el juego y un `id` nuevo la dejaría decorativa y duplicada. Descartado: agregar `frogger` como fila nueva.
- **Salto por celda sin animación intermedia** — mantiene colisiones exactas y el motor corto. Descartado: interpolar el salto (la rana sería vulnerable "en el aire" y habría que decidir su hitbox).
- **Colisión de río por centro de la rana, de carretera por caja 30×30** — es permisivo en el agua (como el arcade) y justo en la carretera. Descartado: caja completa en ambos (ahogos injustos en el borde del tronco).
- **Barra de tiempo dibujada dentro del tablero** — el HUD del reproductor no tiene temporizador y sin él la muerte por tiempo parecería arbitraria. Es un elemento de juego, no un HUD duplicado. Descartado: ampliar el HUD (tocaría la página genérica).
- **Tres vidas y sin vida extra** — alinea con `lives: number` del HUD y evita una tabla de umbrales. Descartada la vida extra a 20.000.
- **Velocidad escalada por nivel con tope 2,0** — por encima de eso los carriles de 250 px de separación se vuelven injugables.
- **Sin sonido, serpientes ni cocodrilos** — fuera del alcance S/M; pueden ser specs futuras.
- **Sin tecla de pausa propia** — el contrato no notifica pausas a la página y desincronizaría el botón.

## Riesgos identificados

- El balance de separaciones y velocidades puede dar un tablero imposible en el río a niveles altos; el tope de 2,0 y las separaciones fijas lo acotan, pero se revisa jugando hasta nivel 5.
- Una rana sobre una tortuga que se sumerge debe ahogarse solo cuando la plataforma está sumergida por completo; si se comprueba el parpadeo como "sumergida" se vuelve injusto. La spec exige usar solo los 1,2 s de inmersión real.
- Se corre el riesgo de puntuar dos veces al saltar a un nenúfar y morir en el mismo frame; el orden de resolución debe ser: aterrizar → puntuar → comprobar colisiones.
- `endGame()` debe cortar el flujo antes del siguiente frame o el modal podría abrirse dos veces.
