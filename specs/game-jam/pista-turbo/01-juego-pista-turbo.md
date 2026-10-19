# Game Jam — Juego real de POLE POSITION (PISTA TURBO)

**Estado:** Draft
**Depende de:** SPEC 07 (motor genérico y registro de juegos), SPEC 06 (catálogo en Supabase)
**Fecha:** 2026-10-19
**Objetivo:** crear una carrera pseudo-3D contra el reloj al estilo Pole Position desde cero como motor real `lib/games/pista-turbo.ts`, registrado bajo el `id` `pista-turbo`.

## Contexto

Tema de la jam: "Bajo tierra, sobre ruedas y contra el reloj: duelos y carreras de ritmo arcade". Pista Turbo es la lectura "sobre ruedas y contra el reloj": un circuito de curvas en perspectiva donde el tiempo se acaba y solo los puntos de control lo recargan. El "duelo" son los coches rivales del carril.

Es una entrada nueva del catálogo (ARCADE, `cyan`, `cover-pista`); se diseña desde cero y no usa assets: la carretera, el coche y los rivales se dibujan con primitivas de canvas. Hallazgos de diseño:

- **Pseudo-3D por segmentos**: la pista es un arreglo de segmentos de longitud fija; cada frame se proyectan hacia el horizonte con una cámara fija. No hay motor 3D ni dependencias.
- **La sensación de manejo es el riesgo principal.** Se usan valores de partida conocidos del género (aceleración, fuerza centrífuga, límite fuera de pista) en constantes fáciles de ajustar.
- **Puntaje por distancia**: no hay vidas, solo el reloj; el leaderboard premia ir lejos y rápido.
- Solo curvas: sin colinas, para que la proyección sea una sola fórmula.

## Alcance

**Incluye:**

- `supabase/migrations/0007_juego_pista_turbo.sql`: `INSERT` de la fila nueva (spec 02 de esta carpeta).
- `lib/games/pista-turbo.ts`: clase `PistaTurboGame implements GameEngine` con los tipos de `lib/games/types.ts`, sin redefinirlos.
  - Lienzo lógico 800×600; horizonte en y = 260; el coche del jugador se dibuja fijo en la parte inferior (centro x = 400, y ≈ 520).
  - Pista: circuito cerrado de 1200 segmentos de 200 unidades (240 000 unidades por vuelta), descrito por una tabla de secciones `[segmentos, curva]`: `[100,0] [80,2] [60,0] [100,-4] [80,0] [120,6] [60,0] [100,-2] [80,4] [100,0] [120,-6] [60,0] [60,3] [40,-3] [40,0]` (suma 1200). Cada sección entra y sale de su curva con una rampa del 25 % de su longitud en cada extremo.
  - Proyección: cámara a altura 1000, `cameraDepth` 0,84, ancho de carretera 2000, distancia de dibujo 150 segmentos. Se dibuja de lejos a cerca con un recorte de la línea más baja ya dibujada (`maxY`); la curva acumula el desplazamiento horizontal de los segmentos. Cada segmento se pinta como cuatro polígonos: césped, piedras laterales (rumble), asfalto y, cada tercer bloque, las rayas centrales. El color alterna claro/oscuro por `⌊índice / 3⌋ % 2`.
  - Física: `maxSpeed` 12 000 unidades/s (60 segmentos por segundo), aceleración `maxSpeed / 5` por segundo con `↑`, freno `−maxSpeed / 2` con `↓`, desaceleración natural `−maxSpeed / 5`, y fuera de pista (|x| > 1) una desaceleración de `maxSpeed / 2` con tope de velocidad `maxSpeed / 4`. La posición lateral `x` va de −1 a 1 (bordes de la carretera); girar suma `±2 · dt · speedPercent` a `x` (con `speedPercent` = velocidad / `maxSpeed`) y la fuerza centrífuga resta `2 · dt · speedPercent · speedPercent · curva · 0,3`. `x` se acota a [−2, 2].
  - Teclas: `←`/`→` giran, `↑` (o `W`) acelera, `↓` (o `S`) frena; `A`/`D` también giran. Todas llaman a `preventDefault()` en `keydown`/`keyup`. En pausa o terminado, las teclas se ignoran; el estado de teclas se actualiza igualmente en `keyup` para no dejar una tecla "pegada".
  - Rivales: `min(6 + 2 · (nivel − 1), 14)` coches con posición `z` en la vuelta, carril `x` en {−0,6; −0,2; 0,2; 0,6} y velocidad entre 35 % y `min(70 + 3 · (nivel − 1), 75)` % de `maxSpeed`, constante. Avanzan, dan la vuelta al circuito y se dibujan como rectángulos escalados por `cameraDepth / distancia`; sin colinas, ninguno queda oculto por la pista. Colisión: si |Δz| < 400 y |Δx| < 0,35, la velocidad del jugador baja a `0,5 ·` la del rival y el jugador se recoloca 400 unidades detrás; un temporizador de 0,8 s evita golpes repetidos.
  - Reloj: empieza en 45 s. Cruzar la meta (cada 240 000 unidades) es un punto de control: suma `max(15, 25 − 2 · (nivel − 1))` s al reloj y sube el nivel. Con el reloj en 0 llama a `endGame()`. `GameState.lives` es `null`; el HUD de la página muestra `—`. El tiempo restante no está en `GameState`, así que el motor lo dibuja como un contador de tiempo pequeño en una esquina del canvas (ver Decisiones).
  - Puntuación: `score = ⌊distancia recorrida / 100⌋ + 500 · (nivel − 1)`. A velocidad máxima son 120 puntos por segundo. `level` = 1 + vueltas completadas, sin tope. `reportState()` solo emite cuando cambia `score` (como entero), `level` o `gameOver`.
  - Loop con `requestAnimationFrame`, `dt` acotado a 0,05 s, `resume()` reinicia `lastTime`; la pausa congela `update()` y `draw()`; el overlay "EN PAUSA" lo dibuja la página.
  - Un único camino de fin de partida (`endGame()`): agotar el reloj y `forceGameOver()` ponen `gameOver = true`, emiten el estado una sola vez y detienen el loop; después se ignoran teclas y no corre más `update()`.
  - `constructor(canvas)`: contexto 2D y listeners `keydown`/`keyup` en `document`; `destroy()` los remueve y cancela el `requestAnimationFrame`.
  - Dibujo: cielo en degradado `#001a3a` → `#00f5ff`, siluetas de montañas planas en el horizonte, césped `#0a2a1a`/`#0c3320`, asfalto `#303040`/`#38384a`, piedras `#ff006e`/`#ffffff`, rayas `#f5ff00`; el coche del jugador es cyan (`#00f5ff`) con cabina y ruedas negras; los rivales son magenta, amarillo y verde.
- `lib/games/registry.ts`: nueva entrada `"pista-turbo": { width: 800, height: 600, controlesTactiles: [flecha("Left", "◀"), flecha("Right", "▶"), flecha("Up", "ACELERAR", { zona: "derecha" }), flecha("Down", "FRENO", { zona: "derecha" })], create: (canvas) => new PistaTurboGame(canvas) }`.
- `app/globals.css`: la clase `cover-pista` (spec 02).

**No incluye (explícitamente fuera de esta spec):**

- Ningún cambio a otros juegos ni a `app/jugar/[id]/page.tsx`, `components/games/GameCanvas.tsx` o `lib/games/types.ts`.
- Colinas, cambio de marchas, derrapes, clasificación y posición en parrilla, varios circuitos y fantasma de repetición.
- Skins, sonido, gamepad físico e inclinación del dispositivo.
- Tests automatizados (el proyecto no tiene test runner configurado) y validación anti-trampa (riesgo aceptado en la spec 06).

## Modelo de datos

No hay modelo persistente nuevo salvo la fila del catálogo (spec 02). Se reutilizan `GameState`, `GameEngine` y `GameDefinition` (spec 07) y `saveScore` (spec 06) con `gameId: "pista-turbo"`. Tipos internos (no exportados): `Segmento { indice, curva, p1z, p2z }`, `Rival { z, x, velocidad, color }`, y la tabla de secciones como constante de solo lectura. Estado privado de la instancia: `posicion`, `x`, `velocidad`, `distancia`, `reloj`, `nivel`, `rivales`, `golpe`, `keys`, `paused`, `over`, `lastTime`.

## Plan de implementación

1. Migración `supabase/migrations/0007_juego_pista_turbo.sql` (spec 02). Si el número estuviera ocupado, usar el siguiente libre; aplicarla con el MCP de `supabase` y verificar `select id, sort_order from games where id = 'pista-turbo'`.
2. Clase `cover-pista` en `app/globals.css`.
3. Crear `lib/games/pista-turbo.ts`: construcción de segmentos desde la tabla, proyección y dibujo de la carretera, física, rivales, reloj y puntaje.
4. Agregar la entrada `pista-turbo` en `lib/games/registry.ts`.
5. Correr `npm run lint` y `npm run build`.
6. Probar manualmente con `npm run dev` en `/jugar/pista-turbo`:
   - `↑` acelera hasta ~120 pts/s sin saltos; soltarlo frena suave; `↓` frena fuerte.
   - Las curvas se ven en perspectiva y empujan el coche hacia afuera; `←`/`→` responden de forma proporcional a la velocidad (parado no gira).
   - Salirse de la carretera ensucia la velocidad (tope `maxSpeed / 4`) y se recupera al volver.
   - Los rivales se acercan y se alejan con escala correcta; chocar con uno frena sin atravesarlo ni repetir el golpe.
   - Cruzar la meta suma tiempo y sube el Nivel; el HUD refleja Puntuación y `—` en vidas.
   - Con el reloj en 0 se abre el modal con la puntuación real y se guarda con `saveScore`; `FIN` abre el mismo modal y después las teclas no hacen nada.
   - `PAUSA`/`REANUDAR` sin salto de tiempo ni de posición; `JUGAR DE NUEVO` reinicia reloj 45 s, puntuación 0 y nivel 1.
   - Las flechas no hacen scroll; `SALIR` no deja listeners ni loop.
   - La puntuación aparece en `/salon` y `/juego/pista-turbo`; los demás juegos no cambian.
   - Con la pestaña en segundo plano y de vuelta, el coche no salta (el `dt` está acotado).

## Criterios de aceptación

- [ ] `/jugar/pista-turbo` muestra la carretera en perspectiva con curvas y rivales.
- [ ] El HUD refleja `Puntuación`, `Vidas` como `—` y `Nivel` reales.
- [ ] La puntuación es `⌊distancia / 100⌋ + 500 · (nivel − 1)`.
- [ ] Cada vuelta suma tiempo al reloj y sube el nivel; el reloj en 0 termina la partida.
- [ ] Salirse de la pista y chocar con rivales frena según lo especificado.
- [ ] `saveScore({ gameId: "pista-turbo", score, name })` guarda al terminar; `FIN` fuerza el mismo modal y no hay doble emisión de `gameOver`.
- [ ] `PAUSA`/`REANUDAR` y `JUGAR DE NUEVO` funcionan sin saltos ni estado residual.
- [ ] Las teclas de juego no hacen scroll y `SALIR` no deja listeners ni `requestAnimationFrame`.
- [ ] `pista-turbo` aparece en `/salon` y `/juego/pista-turbo`; ningún otro juego cambia.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones tomadas y descartadas

- **Solo curvas, sin colinas** — la proyección queda en una fórmula y el riesgo se concentra en el manejo. Descartado: colinas con altura por segmento.
- **Física tipo "Jake Gordon" (valores de partida)** — son valores probados para este tipo de pseudo-3D. Descartado: física propia con deslizamiento, más difícil de balancear.
- **Reloj dibujado en una esquina del canvas** — el tiempo no cabe en `GameState` sin cambiar el contrato y es la mecánica central; es una excepción acotada a "sin HUD en el canvas" (un solo contador pequeño, sin overlays de fin). Descartado: ampliar `GameState`.
- **`lives: null`** — el reloj sustituye a las vidas; chocar solo frena. Descartado: vidas por choque, que castigan doble el error.
- **Puntaje por distancia más bonus por vuelta** — premia velocidad y constancia, y es entero. Descartado: puntuar por tiempo restante, que se estanca.
- **Rivales con velocidad constante** — la IA es solo "seguir en el carril"; sin esquivar ni bloquear. Descartado: rivales que reaccionan al jugador.
- **Circuito único de 1200 segmentos** — una vuelta dura ~25 s a ritmo bueno, de modo que el punto de control cae cada pocos segundos. Descartado: varios circuitos o aleatorios.
- **Sin tecla de pausa propia** — mismo criterio que las specs 08–10.

## Riesgos identificados

- **Sensación de manejo:** es lo que decide si el juego gusta. Las constantes (`centrífuga` 0,3, giro 2, `cameraDepth` 0,84) deben ajustarse jugando; deben declararse juntas y con nombre.
- **Rendimiento:** 150 segmentos × 4 polígonos por frame es aceptable, pero conviene verificar los fps a 60 en un equipo modesto y bajar la distancia de dibujo a 100 si hace falta.
- **Costuras entre segmentos:** los polígonos adyacentes pueden dejar líneas finas por redondeo; usar coordenadas redondeadas y 1 px de solape.
- **Wrap de la pista:** al cruzar la meta, `posicion` y `z` de los rivales deben usar módulo para evitar saltos y rivales que desaparecen.
- **Balance del reloj:** 45 s iniciales y +25 s por punto de control pueden permitir partidas muy largas a jugadores expertos; los bonos están en constantes.
