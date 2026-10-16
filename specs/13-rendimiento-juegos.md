# 13 — Rendimiento de los juegos: medir primero, optimizar después

**Estado:** approvado
**Depende de:** SPEC 07 (motor genérico y registro de juegos), SPEC 11 (skins), SPEC 12 (controles táctiles, por el reproductor), y el juego Ranaria ([specs/game-jam/frogger/frogger-core.md](game-jam/frogger/frogger-core.md))
**Fecha:** 2026-10-16
**Objetivo:** Añadir una medición de rendimiento (`?perf=1`) al reproductor y, con esos datos, un tope de 60 fps y las optimizaciones que hagan falta, hasta que cada juego con cada skin supere los 55 fps medios en el equipo del usuario.

## Contexto

El usuario reporta bajos fps y tirones en Ranaria (Frogger) y posiblemente en los demás juegos, en escritorio y con las tres skins (clásico, neón y retro). No sabe todavía qué juegos están afectados.

El problema **no se reprodujo** al investigar la spec. Mediciones de referencia con un build de producción en Chromium, en un equipo de 120 Hz:

- Ranaria: 120 fps estables; `update` + `draw` cuestan 0.13 ms (clásico), 0.14 ms (neón) y 0.22 ms (retro) por fotograma.
- Asteroids: 0.07–0.12 ms por fotograma en las tres skins.
- Quitar el fondo animado, los `mix-blend-mode` y los overlays del CRT casi no cambió los fps en ese equipo.

El costo de JavaScript es muy pequeño, así que el cuello de botella depende del dispositivo o está fuera del motor. Esto deja cuatro hipótesis, que esta spec no da por ciertas y que la medición debe confirmar o descartar:

1. **Trabajo duplicado en pantallas de 120 Hz.** Los cinco motores (`asteroids`, `caida`, `bloque-buster`, `serpentina`, `ranaria`) llaman a `requestAnimationFrame` y ejecutan `update()` + `draw()` en cada fotograma de la pantalla, sin tope. En 120 Hz hacen el doble de trabajo que en 60 Hz, y `dt` ya está acotado, así que el tope de 60 fps no cambia la velocidad del juego.
2. **CSS global caro bajo el canvas.** En `app/globals.css`: `.av-bg::before` anima `background-position` (`gridscroll`), lo que obliga a repintar cada fotograma; `.av-bg::after` y `.crt-screen::after` usan `mix-blend-mode`; `.av-nav` usa `backdrop-filter: blur(8px)` sobre ese fondo animado; y `.av-noise` cubre toda la pantalla. El canvas se compone a 1004×753 píxeles CSS con DPR 2.
3. **Costo del dibujado en GPU o composición**, que ocurre después del callback de JavaScript y no aparece en un cronómetro alrededor de `update()` + `draw()`.
4. **Costo propio de un motor o skin concreto** (`shadowBlur` en neón, lienzo reducido en retro, el tablero de Ranaria que se vuelve a pintar entero en cada fotograma).

Por eso la spec es de **medir primero**: la optimización es condicionada a datos, no especulativa.

## Alcance

**Incluye:**

- `lib/games/perf.ts` (nuevo): clase `FramePacer`, una instancia por motor, con el estado como campos de instancia (sin estado a nivel de módulo).
  - `constructor(maxFps = Infinity)`.
  - `shouldRun(ts)`: se llama una vez por callback de `requestAnimationFrame`. Cuenta el callback para `rafFps` y devuelve `false` si el tope no se cumple (se ejecuta si han pasado al menos `1000 / maxFps − 1` ms desde el último fotograma ejecutado). Con `maxFps = Infinity` siempre devuelve `true`.
  - `begin()` / `end()`: miden el tiempo de `update` + `draw` de un fotograma ejecutado con `performance.now()`.
  - `snapshot(): PerfSnapshot`: estadísticas de la última ventana de unos 2 s, a partir de un buffer circular de 120 muestras.
- `lib/games/types.ts`: tipo `PerfSnapshot` y método opcional `getPerf?(): PerfSnapshot` en `GameEngine` (mismo patrón que `setSkin?`).
- Los cinco motores: usan un `FramePacer` en `loop`. El gate va al principio del callback. Si `shouldRun` devuelve `false`, solo se vuelve a pedir el siguiente `requestAnimationFrame`, sin tocar `lastTime`, `update()` ni `draw()`, de modo que `dt` se calcula entre fotogramas ejecutados y la velocidad del juego no cambia. Cada motor implementa `getPerf()` con `pacer.snapshot()`.
- `components/games/GameCanvas.tsx`: expone `getPerf()` en el handle (`GameCanvasHandle`).
- `components/games/PerfOverlay.tsx` (nuevo) y `app/jugar/[id]/page.tsx`: con `?perf=1`, un recuadro pequeño en la esquina del CRT con `fps`, `rafFps`, `avgMs`, `p95Ms` y `maxMs`, el `id` del juego y la skin. Se actualiza una vez por segundo. Sin el parámetro no se monta ni se consulta nada.
- `?nocrt=1` (solo con `?perf=1`): pone `data-perf-nocrt` en `<html>` y `app/globals.css` desactiva con `html[data-perf-nocrt]` el fondo animado, los `mix-blend-mode`, los overlays del CRT, `.av-noise` y el `backdrop-filter` de `.av-nav`. Es una herramienta de diagnóstico para saber cuánto cuesta el CSS global; se retira el atributo al salir del reproductor.
- La tabla de **Resultados de medición** (al final de esta spec), rellenada durante la implementación con datos del equipo del usuario.
- Un tope de 60 fps en los cinco motores (`new FramePacer(60)`), una vez tomada la medición base.
- Optimizaciones puntuales, **solo** donde la tabla muestre un cuello de botella demostrado (ver el paso 6 del plan).

**No incluye (explícitamente fuera de esta spec):**

- Cambiar la resolución lógica de 800×600, el DPR del canvas o el tamaño del CRT.
- Mover el dibujado a Web Workers u `OffscreenCanvas`.
- Un bucle de juego compartido que reemplace los bucles de cada motor.
- Cambiar velocidades, reglas o dificultad de cualquier juego.
- Optimización específica de móvil (se puede medir con el overlay, pero no se optimiza aquí).
- El scroll horizontal de la barra de navegación a 360 px y los botones del HUD de 37 px de alto que reportó `mobile-porter`.
- Telemetría remota o guardar métricas en Supabase.
- Tests automatizados (el proyecto no tiene test runner).
- Un contador de fps visible para todos los jugadores.

## Modelo de datos

No hay datos persistentes. Tipos nuevos en `lib/games/types.ts`:

```ts
export interface PerfSnapshot {
  /** Fotogramas ejecutados (update + draw) por segundo. */
  fps: number;
  /** Callbacks de requestAnimationFrame por segundo, con o sin tope. */
  rafFps: number;
  /** Milisegundos de update + draw por fotograma ejecutado. */
  avgMs: number;
  p95Ms: number;
  maxMs: number;
}
```

`GameEngine` gana `getPerf?(): PerfSnapshot` (opcional; los motores sin implementarlo simplemente no muestran datos).

`FramePacer` (en `lib/games/perf.ts`):

```ts
export class FramePacer {
  constructor(maxFps?: number); // por defecto Infinity = sin tope
  shouldRun(ts: number): boolean;
  begin(): void;
  end(): void;
  snapshot(): PerfSnapshot;
}
```

Parámetros de URL del reproductor `/jugar/[id]` (solo diagnóstico): `perf=1` muestra el overlay; `nocrt=1` (con `perf=1`) desactiva el CSS global caro. Se leen igual que `?touch=1`.

## Plan de implementación

1. **Tipos y `FramePacer`.** Añadir `PerfSnapshot` y `getPerf?` en `lib/games/types.ts` y crear `lib/games/perf.ts`. Sin tope todavía (`maxFps = Infinity`). Verificar con `npx tsc --noEmit`.
2. **Integrar `FramePacer` en los cinco motores solo para medir.** `new FramePacer()` sin tope, gate de `shouldRun` al principio de `loop`, `begin()`/`end()` alrededor de `update()` + `draw()` y `getPerf()`. Con `maxFps = Infinity` el comportamiento del juego no cambia. Verificar que pausa, `FIN`, `JUGAR DE NUEVO` y `SALIR` siguen funcionando en los cinco.
3. **Overlay y `?nocrt=1`.** Exponer `getPerf` en `GameCanvas`, crear `PerfOverlay`, montarlo en `app/jugar/[id]/page.tsx` con `?perf=1` y añadir el atributo `data-perf-nocrt` con sus reglas en `app/globals.css`. Verificar que sin `?perf=1` el DOM es idéntico al de hoy.
4. **Medición base (el usuario, en su equipo).** Con `npm run build && npm run start` (nunca `npm run dev`), abrir `/jugar/<id>?perf=1` para cada combinación juego × skin, jugar 30 s y anotar `fps`, `rafFps`, `avgMs`, `p95Ms` y `maxMs` en la tabla, con el equipo, el navegador, la frecuencia de la pantalla y el tamaño de la ventana. Para las combinaciones que queden por debajo de 55 fps, repetir con `&nocrt=1`. Las mediciones de Playwright que aporte el agente se marcan como "referencia, no del equipo del usuario".
5. **Tope de 60 fps.** Cambiar a `new FramePacer(60)` en los cinco motores y volver a medir las mismas combinaciones. Verificar que la velocidad de juego no cambió (un vehículo del carril 12 de Ranaria, a 4.5 celdas/s, cruza el tablero en el mismo tiempo ±5 %).
6. **Optimizaciones condicionadas a la tabla.** Para cada combinación con menos de 55 fps medios tras el paso 5:
   - Si `&nocrt=1` sube los fps en 10 o más, o baja `p95Ms` de forma clara: optimizar el CSS global manteniendo el aspecto. Candidatos: dejar de animar `background-position` en `.av-bg::before` (animar `transform`), sustituir `mix-blend-mode` por un degradado equivalente, quitar o aislar `backdrop-filter` en `.av-nav`. Se comparan capturas del mismo viewport antes y después.
   - Si `avgMs` supera 8 ms en un motor o skin: optimizar ese motor. Candidatos: cachear en un canvas aparte lo estático (el tablero de Ranaria: zonas, ondas y líneas de carril), reducir el `shadowBlur` o limitarlo a menos elementos, y evitar asignaciones por fotograma.
   - Si ni el CSS ni el motor lo explican: documentar el hallazgo en la tabla y no cambiar nada más (el cuello de botella queda en GPU o composición y se tratará en otra spec).
7. **Medición final y cierre.** Repetir las mediciones, completar la tabla, correr `npm run lint` y `npm run build`, y probar de nuevo pausa, `FIN`, `JUGAR DE NUEVO` y `SALIR` en los cinco juegos.

## Resultados de medición (se rellena al implementar)

Equipo: _______ · Navegador: _______ · Pantalla (Hz): _______ · Ventana: _______ · Build: producción

| Juego         | Skin                   | fps | rafFps | avgMs | p95Ms | maxMs | fps con `nocrt` | Fase |
| ------------- | ---------------------- | --- | ------ | ----- | ----- | ----- | --------------- | ---- |
| ranaria       | clásico                |     |        |       |       |       |                 | base |
| ranaria       | neón                   |     |        |       |       |       |                 | base |
| ranaria       | retro                  |     |        |       |       |       |                 | base |
| asteroids     | clásico / neón / retro |     |        |       |       |       |                 | base |
| bloque-buster | clásico / neón / retro |     |        |       |       |       |                 | base |
| serpentina    | clásico / neón / retro |     |        |       |       |       |                 | base |
| caida         | (sin skins)            |     |        |       |       |       |                 | base |

### Referencia (Playwright, no del equipo del usuario)

Chromium 150 headless-ish en macOS, 120 Hz, DPR 2, ventana 1147×522, build de producción, sin tope (`Infinity`), overlay activo, ~5 s por skin. Sirve solo de referencia; la tabla de arriba se rellena con el equipo del usuario.

| Juego         | Skin    | fps | rafFps | avgMs | p95Ms | maxMs |
| ------------- | ------- | --- | ------ | ----- | ----- | ----- |
| ranaria       | clásico | 120 | 120    | 0.12  | 0.20  | 0.30  |
| ranaria       | neón    | 120 | 120    | 0.14  | 0.20  | 0.30  |
| ranaria       | retro   | 120 | 120    | 0.19  | 0.30  | 0.40  |
| asteroids     | clásico | 120 | 120    | 0.05  | 0.10  | 0.20  |
| asteroids     | neón    | 120 | 120    | 0.05  | 0.10  | 0.20  |
| asteroids     | retro   | 119 | 119    | 0.09  | 0.20  | 0.20  |
| bloque-buster | las 3   | 120 | 120    | 0.09  | 0.20  | 0.50  |
| caida         | —       | 120 | 120    | 0.09  | 0.20  | 0.30  |

Serpentina no se midió de forma fiable: con teclas simuladas la partida terminó y las tres lecturas salieron idénticas (0.18 ms), es decir, un valor congelado. Debe medirla el usuario jugando.

Se añaden filas con las fases "tope 60" y "final" al repetir las mediciones de los pasos 5 y 7.

## Criterios de aceptación

- [ ] Con `?perf=1`, `/jugar/<id>` muestra el overlay con `fps`, `rafFps`, `avgMs`, `p95Ms` y `maxMs`, el `id` del juego y la skin, y se actualiza una vez por segundo.
- [ ] Sin `?perf=1` no se monta el overlay ni se llama a `getPerf`, y el DOM del reproductor es el de hoy.
- [ ] Con `?perf=1&nocrt=1`, el fondo animado, los `mix-blend-mode`, los overlays del CRT, `.av-noise` y el `backdrop-filter` de la barra quedan desactivados; al salir del reproductor el atributo `data-perf-nocrt` desaparece.
- [ ] Los cinco motores usan un `FramePacer` y exponen `getPerf()`; no hay estado nuevo a nivel de módulo.
- [ ] Con el tope de 60 fps en una pantalla de 120 Hz, el overlay muestra `fps` ≤ 62 y `rafFps` cerca de 120, y la velocidad de juego no cambia (el vehículo del carril 12 de Ranaria cruza el tablero en el mismo tiempo ±5 %).
- [ ] En una pantalla de 60 Hz el tope no pierde fotogramas: `fps` ≥ 58 en un juego ligero.
- [ ] Pausa, reanudar, `FIN`, `JUGAR DE NUEVO` y `SALIR` funcionan igual que antes en los cinco juegos, sin `requestAnimationFrame` huérfanos tras salir.
- [ ] La tabla de resultados tiene mediciones base y finales de todas las combinaciones juego × skin, con el equipo, el navegador y la frecuencia de la pantalla.
- [ ] En el equipo del usuario, con un build de producción, cada combinación juego × skin alcanza **55 fps medios o más**; si alguna no lo logra, la tabla explica por qué y qué se descartó.
- [ ] Si se tocó el CSS global, las capturas antes y después del mismo viewport no muestran un cambio visible del CRT.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones tomadas y descartadas

- **Medir primero, optimizar después.** El problema no se reprodujo y el JavaScript cuesta menos de 0.25 ms por fotograma, así que cualquier optimización a ciegas sería una apuesta. Descartado: optimizar de entrada el CSS global o los motores.
- **Overlay con `?perf=1`** en vez de solo consola o de un contador permanente. Se lee mientras se juega y no ensucia la pantalla de los demás jugadores. Descartados: salida solo en consola (incómoda de leer en partida) y un contador siempre visible.
- **Tope de 60 fps en los cinco motores.** Hoy cada motor ejecuta `update()` + `draw()` en cada fotograma de la pantalla, el doble de trabajo en 120 Hz. `dt` ya está acotado, así que la velocidad del juego no cambia. Se aplica después de medir la base, para poder comparar. Descartado: dejar los bucles como están.
- **`getPerf?()` opcional en el contrato `GameEngine`**, como `setSkin?`. Descartado: parchear `window.requestAnimationFrame` desde fuera para cronometrar los callbacks (una mutación global frágil que además rompería el conteo con el tope).
- **Una instancia de `FramePacer` por motor**, no un módulo con estado compartido, para respetar la regla "sin estado a nivel de módulo" y permitir más de una partida instanciada.
- **`maxFps = Infinity` por defecto.** Así los pasos 1 a 3 no cambian el comportamiento y la medición base es limpia.
- **`rafFps` además de `fps`.** Con el tope, `fps` cae a 60 aunque la pantalla vaya a 120; `rafFps` revela la cadencia real de la pantalla y si el hilo principal se está retrasando.
- **`?nocrt=1` como interruptor de diagnóstico.** Mide el costo del CSS global sin tocar el CSS real. Descartado: quitar esos efectos a ciegas, porque cambia el aspecto del sitio.
- **Cambios visuales solo si el aspecto casi no cambia.** Es lo que el usuario autorizó; se comparan capturas antes y después. Descartado: simplificar el efecto CRT "aunque se note".
- **Meta de 55 fps medios en el equipo del usuario**, con un build de producción. Es verificable y no depende de mi hardware. Descartados: "mejora del 30 %" y "sin tirones a ojo" (subjetivo).
- **Medir en producción, no en `npm run dev`.** El modo desarrollo añade costo de React y de Turbopack que distorsiona las cifras.
- **Optimizaciones condicionadas por umbrales** (10 fps de ganancia con `nocrt`; 8 ms de `avgMs`). Evita optimizar donde no hay cuello de botella. Descartado: un refactor especulativo de los motores.
- **Sin bucle compartido.** Mantener el bucle en cada motor respeta el contrato de la spec 07; el `FramePacer` solo añade un gate y un cronómetro.

## Riesgos identificados

- **Puede que la causa no esté en JavaScript.** Los datos de referencia (0.07–0.22 ms por fotograma) sugieren que sí: en ese caso `avgMs` no lo mostrará y la causa habrá que buscarla con `?nocrt=1` o quedar documentada como GPU o composición. El overlay mide JavaScript, no el rasterizado ni la composición, que ocurren después del callback; `rafFps` solo lo delata de forma indirecta.
- **Mis mediciones no son las del usuario.** Se tomaron en otro equipo, a 120 Hz y probablemente con otra GPU. La tabla se rellena con el equipo del usuario; las cifras de Playwright o headless solo sirven como referencia.
- **Cinco motores tocados a la vez** (los bucles de `asteroids`, `caida`, `bloque-buster`, `serpentina` y `ranaria`). Un error en el gate puede romper la pausa o el cálculo de `dt` en alguno; los criterios de pausa, `FIN`, `JUGAR DE NUEVO` y `SALIR` cubren ese riesgo.
- **El tope de 60 fps en monitores variables o de 144 Hz** puede producir un ritmo irregular (cada 2.4 fotogramas). Si se nota, una spec futura puede ajustar el tope al divisor entero más cercano de la frecuencia de la pantalla.
- **El overlay añade su propio costo.** Se actualiza una vez por segundo y solo existe con `?perf=1`, pero la tabla debe medirse con el overlay activo en todos los casos para comparar sin sesgos.
- **Serpentina termina la partida en ~1.5 s si nadie la juega**, así que medir sus fps exige jugarla con el teclado o con un script; el paso 4 debe decirlo.
