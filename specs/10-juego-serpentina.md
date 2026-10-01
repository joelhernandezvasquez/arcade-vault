# 10 — Juego real de Snake (SERPENTINA)

**Estado:** Approbado
**Depende de:** SPEC 07 (motor genérico y registro de juegos), SPEC 06 (catálogo en Supabase)
**Fecha:** 2026-09-30
**Objetivo:** Crear Snake desde cero como motor real `lib/games/serpentina.ts`, registrado bajo el `id` `serpentina`, reemplazando la arena decorativa de esa entrada del catálogo y usando las frutas pixel-art de `references/snake-assets/`.

## Contexto

La entrada `serpentina` del catálogo (ARCADE, `cover-snake`, `green`, `sort_order` 3) es la entrada decorativa de Snake: hoy `/jugar/serpentina` muestra la arena decorativa de la spec 01. No existe un Snake de referencia en `references/started-games/`; el juego se diseña desde cero en esta spec. El único material aportado está en `references/snake-assets/`: `fruits.png` (hoja de 3790×442 px con tres filas de frutas en estilos distintos, fondo transparente) y `sprites.js` (`window.SPRITE_ATLAS`, 46 líneas, con los recortes `{ x, y, w, h }` de 22 frutas de la fila central pixel-art, `y` = 136–295).

Esta spec crea el juego como una clase que `implements GameEngine` y la registra en `lib/games/registry.ts`, siguiendo la spec 07 y los precedentes de las specs 05 (Asteroids), 08 (Caída) y 09 (Bloque Buster). Como `serpentina` ya es la fila de Snake, no se agrega una entrada nueva ni una clase `cover-*` nueva, pero sí se actualizan `short` y `long`, porque el texto actual habla de "núcleos magenta" y el juego real usa frutas.

Hallazgos sobre los assets:

- `sprites.js` es un script de navegador que asigna `window.SPRITE_ATLAS` (estado global) y apunta a `snake-assets/fruits.png`, una ruta relativa del proyecto de referencia. No se puede importar tal cual: se porta a una constante TypeScript de solo lectura y la imagen se sirve desde `public/games/serpentina/`.
- Las frutas tienen tamaños distintos (de 110×160 a 170×160), así que al dibujarlas se escalan conservando la proporción dentro de la celda.
- Solo se usa la fila central pixel-art. Las otras dos filas (ilustración plana y fotográfica) quedan sin usar dentro del mismo PNG.
- No hay assets de serpiente ni de sonido: la serpiente y el tablero se dibujan con primitivas de canvas.

## Alcance

**Incluye:**

- `supabase/migrations/0002_juego_serpentina.sql`: un `UPDATE` sobre la fila existente `serpentina`. Se conservan `id`, `title`, `cat`, `cover`, `color`, `best`, `plays` y `sort_order`; solo cambian `short` y `long`:
  - `short`: `Come frutas, crece y no te muerdas la cola.`
  - `long`: `Una serpiente recorre la grilla en busca de frutas. Cada bocado la alarga y, cada cinco, la hace más veloz. Choca contra el borde o contra tu propio cuerpo y la partida termina.`
- `lib/games/serpentina.ts`: clase `SerpentinaGame implements GameEngine`, con los tipos `GameEngine`/`GameState` de `lib/games/types.ts` (spec 07), sin redefinirlos.
  - Tablero de 20×15 celdas de 40 px, que cubre exactamente el lienzo lógico de 800×600 (ya 4:3, sin paneles laterales).
  - Serpiente inicial de 3 segmentos en el centro del tablero, avanzando hacia la derecha desde el primer tick (sin estado "esperando entrada", igual que Bloque Buster lanza la pelota de inmediato).
  - Movimiento por ticks discretos: el intervalo base es 140 ms y baja 10 ms por nivel, con un mínimo de 60 ms. El loop usa `requestAnimationFrame` con un acumulador de tiempo; `dt` se acota a 0.05 s y `resume()` reinicia `lastTime` para no acumular el tiempo pausado.
  - Teclas: `←`/`→`/`↑`/`↓` y `A`/`D`/`W`/`S` cambian la dirección. Las flechas y `W`/`A`/`S`/`D` llaman a `preventDefault()` en `keydown`/`keyup` para que no hagan scroll. Se mantiene una cola de hasta 2 giros pendientes y se descarta cualquier giro que invierta la dirección actual (180°), para que dos pulsaciones rápidas dentro de un mismo tick no hagan morder a la serpiente contra su propio cuello. Mientras el juego está en pausa o terminado, las teclas se ignoran (no se encolan giros).
  - Frutas: una sola fruta en el tablero a la vez, en una celda libre al azar. Cada fruta nueva se elige al azar entre las 22 del atlas y todas valen lo mismo (+10 puntos). Comer una fruta alarga la serpiente un segmento.
  - Fin de partida: chocar contra el borde del tablero o contra el propio cuerpo (la celda donde está la cola actual no cuenta como choque, porque la cola se mueve en ese mismo tick), o llenar las 300 celdas del tablero. No hay vidas.
  - `constructor(canvas)`: crea su contexto 2D, empieza a cargar `/games/serpentina/fruits.png` con `new Image()` y agrega `keydown`/`keyup` en `document`. `destroy()` remueve ambos listeners, cancela el `requestAnimationFrame` pendiente y anula el `onload` de la imagen. El loop arranca sin esperar a la imagen: mientras no haya cargado, la fruta se dibuja como un círculo rojo de respaldo, para que una carga lenta no bloquee el juego ni cree una condición de carrera con `destroy()`.
  - `start()`, `pause()`, `resume()`, `reset()`, `forceGameOver()`, `destroy()`, `onStateChange(cb)` según el contrato. La pausa congela `update()` y `draw()`; el overlay "EN PAUSA" lo dibuja la página.
  - `GameState`: `{ score, lives: null, level, gameOver }`. `level` = 1 + ⌊frutas comidas / 5⌋, sin tope. `reportState()` solo emite cuando cambia `score`, `level` o `gameOver`, no en cada tick ni en cada movimiento.
  - Un único camino de fin de partida (`endGame()`): choque, tablero lleno y `forceGameOver()` ponen `gameOver = true`, emiten el estado una sola vez y detienen el loop. Después de eso el motor ignora teclas y no ejecuta más `update()`. La puntuación es la acumulada; no hay bonificación por llenar el tablero.
  - Dibujo: fondo de tablero de ajedrez en dos verdes claros (`#a7d948` / `#8ecc39`), serpiente de segmentos redondeados en azul (`#4675e9`) con ojos blancos en la cabeza, y la fruta del atlas escalada para caber en la celda con un margen de 4 px. Sin HUD ni overlays dibujados en el canvas.
  - El atlas de frutas y las constantes de tablero/velocidad se declaran como constantes del módulo de solo lectura (datos inmutables), no como variables globales de estado. `window.SPRITE_ATLAS` no se usa.
- `public/games/serpentina/fruits.png`: copia de `references/snake-assets/fruits.png`.
- `lib/games/registry.ts`: nueva entrada `serpentina: { width: 800, height: 600, create: (canvas) => new SerpentinaGame(canvas) }`, junto a las de `asteroids`, `caida` y `bloque-buster`.

**No incluye (explícitamente fuera de esta spec):**

- Ningún cambio a otros juegos del catálogo.
- Cambios a `app/jugar/[id]/page.tsx`, `components/games/GameCanvas.tsx`, `lib/games/types.ts` o `app/globals.css` (ya son genéricos desde la spec 07; no hay clase `cover-*` nueva).
- Sonido.
- Gamepad o controles táctiles/gestos de deslizamiento.
- Tecla de pausa propia (`P`/`Escape`, barra espaciadora): la pausa la cubre solo el botón `PAUSA` del reproductor, por la misma razón que en las specs 08 y 09.
- Overlays propios de PAUSA, GAME OVER o victoria, y HUD dibujado en el canvas.
- Recolorear el juego al color de acento `green` del catálogo más allá de los verdes del tablero (ver Decisiones).
- Variantes de Snake: modos con paredes que atraviesan, obstáculos, frutas especiales con valores distintos, animación al comer, cabeza rotada con sprites.
- Las filas de frutas de ilustración plana y fotográfica de `fruits.png`, y el recorte previo de la hoja a un PNG más pequeño.
- Tests automatizados (el proyecto no tiene test runner configurado).
- Validación anti-trampa de puntuaciones (mismo riesgo aceptado que documenta la spec 06).

## Modelo de datos

No se introduce ningún modelo persistente nuevo. Se reutilizan sin cambios `GameState`, `GameEngine` y `GameDefinition` de `lib/games/types.ts` (spec 07), y `saveScore` de la spec 06 con `gameId: "serpentina"`.

Tipos internos de `lib/games/serpentina.ts` (detalle de implementación, no exportados): `Cell { x, y }` (columna/fila de la grilla), `Dir { dx, dy }`, `FruitSprite { x, y, w, h }` (recorte dentro de `fruits.png`) y la constante `FRUITS: FruitSprite[]` con los 22 recortes de `sprites.js`. Los campos `snake`, `dir`, `pendingTurns`, `fruit`, `fruitSprite`, `eaten`, `score`, `tickAcc`, `paused`, `over` y la imagen de frutas son estado privado de la clase.

## Plan de implementación

1. Migración SQL en `supabase/migrations/0002_juego_serpentina.sql` (`update games set short = ..., long = ... where id = 'serpentina';`). Si `0002` ya estuviera ocupado al implementar, usar el siguiente número libre. Aplicarla vía el MCP de `supabase` autorizado, o a mano desde el SQL Editor del proyecto `vgppkjxuqdhjstprzotw` si el MCP no está disponible. Verificar con `select short, long from games where id = 'serpentina'`.
2. Copiar `fruits.png` a `public/games/serpentina/`.
3. Crear `lib/games/serpentina.ts` con `SerpentinaGame implements GameEngine`: todo el estado como campos de instancia, listeners en el constructor y removidos en `destroy()`, sin HUD ni overlays propios y sin `window.SPRITE_ATLAS`.
4. Agregar la entrada `serpentina` en `lib/games/registry.ts`.
5. Correr `npm run lint` y `npm run build`, y confirmar que no hay errores.
6. Probar manualmente con `npm run dev` en `/jugar/serpentina`:
   - La serpiente responde a flechas y a `WASD`; pulsar la dirección contraria a la actual no hace nada, y dos giros rápidos dentro de un tick no la hacen chocar consigo misma.
   - Comer una fruta suma 10, alarga la serpiente y coloca una fruta nueva (distinta al azar) en una celda libre que nunca cae sobre el cuerpo.
   - Cada 5 frutas el HUD sube de Nivel y la serpiente acelera; el HUD muestra `—` en vidas.
   - Chocar con cada uno de los cuatro bordes y con el propio cuerpo abre el modal de fin de partida con la puntuación real y permite guardarla con `saveScore`. Perseguir la propia cola sin comer no cuenta como choque.
   - `FIN` a mitad de partida abre el mismo modal y después de eso las teclas ya no mueven nada.
   - `PAUSA`/`REANUDAR` congela y reanuda sin salto; pulsar flechas en pausa no encola giros.
   - `JUGAR DE NUEVO` deja score 0, nivel 1, serpiente de 3 segmentos al centro y una fruta nueva.
   - Las flechas no hacen scroll de la página.
   - Con la red throttled (imagen lenta) el juego es jugable con la fruta de respaldo y las frutas pasan a sprites al cargar la imagen.
   - `SALIR` no deja listeners ni loop de `requestAnimationFrame` (las teclas no afectan nada al volver a `/juego/serpentina`). Navegar rápido antes de que cargue la imagen no deja un loop huérfano.
   - La puntuación guardada aparece en `/salon` y en la vista previa de `/juego/serpentina`, y el catálogo muestra los nuevos `short`/`long`.
   - Navegar a `/jugar/caida`, `/jugar/asteroids` y `/jugar/bloque-buster` y confirmar que no cambió su comportamiento.

## Criterios de aceptación

- [ ] `/jugar/serpentina` muestra el Snake real (tablero, serpiente, frutas del atlas) en vez de la arena decorativa.
- [ ] El HUD superior (`Puntuación`, `Vidas` como `—`, `Nivel`) refleja el estado real del motor.
- [ ] Cada fruta suma 10 puntos, alarga la serpiente y aparece siempre en una celda libre; cada 5 frutas sube el nivel y baja el intervalo de tick hasta un mínimo de 60 ms.
- [ ] Chocar con el borde o con el propio cuerpo abre el modal existente con la puntuación real y permite guardarla con `saveScore({ gameId: "serpentina", score, name })`.
- [ ] Un giro de 180° se ignora y la cola no cuenta como choque cuando se mueve en el mismo tick.
- [ ] El botón `FIN` fuerza el mismo modal de fin de partida.
- [ ] Tras el fin de partida el motor deja de aceptar entrada y no emite `gameOver` más de una vez.
- [ ] `PAUSA`/`REANUDAR` congela y reanuda el juego real.
- [ ] `JUGAR DE NUEVO` reinicia el motor a un estado limpio.
- [ ] `SALIR` u otra navegación no deja listeners de teclado activos ni un loop de `requestAnimationFrame` en segundo plano.
- [ ] `serpentina` aparece en `/salon` bajo su pestaña y en la vista previa de leaderboard de `/juego/serpentina` tras guardar una puntuación real, con `short`/`long` actualizados.
- [ ] Ningún otro juego del catálogo cambia de comportamiento.
- [ ] Usar las flechas y `WASD` no hace scroll de la página.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones tomadas y descartadas

- **Reemplazar la entrada decorativa `serpentina` en vez de agregar una entrada `snake`** — `serpentina` ya es la entrada de Snake (ARCADE, `cover-snake`, `green`, `sort_order` 3). Una entrada nueva dejaría `serpentina` decorativa y duplicada, y exigiría una clase `cover-*` nueva. Mismo criterio que las specs 05, 08 y 09.
- **`UPDATE` de `short` y `long`, conservando `id`, `title`, `cover` y `sort_order`** — a diferencia de la spec 09, aquí la descripción actual ya no describe el juego real ("núcleos magenta" frente a frutas). Descartado: dejar el catálogo sin migración, porque la tarjeta prometería algo que el juego no muestra.
- **Las paredes matan, sin vidas (`lives: null`)** — es el Snake clásico de Google, de donde salen las frutas del atlas. Descartados: atravesar paredes (quita casi todo el riesgo) y tres vidas (reiniciar la serpiente en el centro rompe la lógica de "crecer sin morderte").
- **Frutas al azar con valor único de 10 puntos** — aprovecha el atlas sin tablas de valores que balancear. Descartados: valores distintos por fruta y una sola fruta fija.
- **Nivel cada 5 frutas, sin tope** — es lo que da sentido al HUD de `Nivel` y a la velocidad creciente; el mínimo de 60 ms se alcanza en el nivel 9 y evita una velocidad injugable. Descartado: nivel fijo en 1.
- **Tablero de 20×15 celdas de 40 px** — cubre exactamente 800×600, relación 4:3 como `.crt-screen`, sin paneles laterales ni recalcular proporciones. Descartado: celdas de 20 px (grilla 40×30), porque la serpiente y las frutas se verían diminutas al escalar el lienzo a la pantalla CRT.
- **Paleta propia de Snake, sin recolorear al acento del catálogo** — el tablero usa dos verdes claros (en línea con el acento `green`) y la serpiente es azul para contrastar con ellos y con las frutas. Las frutas del atlas ya traen sus colores y recolorearlas exigiría reemplazar arte. Mismo criterio que las specs 05, 08 y 09. Nota para revisión: si se prefiere una serpiente verde, basta cambiar la constante de color, sin impacto en el resto del diseño.
- **Serpiente y tablero con primitivas de canvas, no sprites** — el material aportado solo incluye frutas. Descartado: buscar o generar sprites de cuerpo/cabeza, fuera del material de partida.
- **Cola de hasta 2 giros y bloqueo de 180°** — sin esto, dos pulsaciones rápidas en un mismo tick (p. ej. ↑ y luego ← estando en →) harían que la serpiente se invirtiera sobre su cuello y muriera por un control que el jugador percibe correcto.
- **Loop que no espera a la imagen, con fruta de respaldo** — a diferencia de la spec 09, el juego es totalmente jugable sin el PNG; esperar al `onload` solo añadiría una condición de carrera con `destroy()` y una pantalla en blanco si la carga falla.
- **Copiar el PNG completo y portar solo las 22 coordenadas a TypeScript** — `sprites.js` define `window.SPRITE_ATLAS` (global) y una ruta relativa del proyecto de referencia, incompatibles con la regla "sin estado a nivel de módulo" y con `public/games/<id>/`. Descartado: recortar el PNG a solo la fila usada (ver Riesgos).
- **Sin tecla de pausa propia** — el contrato `GameEngine` no notifica pausas hacia la página, así que pausar con `P`/`Escape`/espacio dejaría el botón `PAUSA` y el overlay "EN PAUSA" desincronizados (misma razón que las specs 08 y 09).
- **Sonido, gamepad y táctil fuera de alcance** — Asteroids, Caída y Bloque Buster no los tienen y el reproductor no ofrece control de silencio; mantener consistencia entre juegos. Pueden ser specs futuras.
- **Listeners y `requestAnimationFrame` con `destroy()` explícito, `reportState()` solo ante cambios, un solo camino de fin de partida** — mismo criterio que las specs 05, 07, 08 y 09.

## Riesgos identificados

- `fruits.png` mide 3790×442 px y contiene tres filas, pero solo se usa la central: el navegador decodifica la hoja completa (~6.7 MB en memoria sin comprimir) para dibujar 22 recortes de unos 36 px. Es aceptable para un solo juego; si el peso del PNG en red resultara notable, una spec futura puede recortar la hoja a la fila usada y actualizar las coordenadas.
- Al reducir recortes de 110–170×160 a ~32 px con pixel-art, el suavizado por defecto del canvas puede dejar los bordes borrosos. Se verifica visualmente en la prueba manual; si se ve mal, se ajusta `imageSmoothingEnabled` y/o `imageSmoothingQuality` del contexto dentro del propio motor.
- `sprites.js` indica que las imágenes provienen de The Spriters Resource (juego de Snake de Google). Son assets de terceros; conviene confirmar que su uso dentro del proyecto es aceptable antes de publicar el sitio.
- Elegir la celda de la fruta "libre al azar" debe hacerse a partir de las celdas no ocupadas y no por reintentos aleatorios: con la serpiente cerca de las 300 celdas, un bucle de reintentos podría tardar mucho o no terminar.
- Si `endGame()` no corta el flujo antes del siguiente tick, podría emitirse el estado de fin dos veces y abrir el modal duplicado; se cubre con el criterio de aceptación de una sola emisión.
