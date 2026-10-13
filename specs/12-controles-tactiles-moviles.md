# 12 — Controles táctiles para jugar en móviles

**Estado:** approve
**Depende de:** SPEC 07 (motor genérico y registro de juegos), SPEC 05 (Asteroids), SPEC 08 (Caída), SPEC 09 (Bloque Buster), SPEC 10 (Serpentina), SPEC 11 (skins, por el selector del HUD)
**Fecha:** 2026-10-09
**Objetivo:** Hacer que los cuatro juegos jugables (Asteroids, Caída, Bloque Buster y Serpentina) se puedan jugar completos en una pantalla táctil, con un gamepad virtual bajo el CRT y un reproductor `/jugar/[id]` usable en móvil.

## Contexto

Hoy ningún motor responde al tacto. Asteroids, Caída y Serpentina solo escuchan teclado, y Bloque Buster escucha teclado y `mousemove`, que en un móvil solo se emula con un toque aislado. En un móvil el jugador no puede ni moverse ni disparar. Además, el reproductor (`app/jugar/[id]/page.tsx`) no está pensado para pantallas angostas: HUD, botones y CRT tienen anchos de escritorio.

Los motores leen el teclado de formas distintas:

| Motor           | Evento    | Campo usado | Dónde escucha | Teclas                                        |
| --------------- | --------- | ----------- | ------------- | --------------------------------------------- |
| `asteroids`     | down/up   | `e.code`    | `window`      | `ArrowLeft`, `ArrowRight`, `ArrowUp`, `Space` |
| `caida`         | solo down | `e.code`    | `document`    | `ArrowLeft/Right/Down/Up`, `KeyX`, `Space`    |
| `bloque-buster` | down/up   | `e.key`     | `document`    | `ArrowLeft`, `ArrowRight`                     |
| `serpentina`    | down/up   | `e.key`     | `document`    | flechas y `WASD`                              |

La solución elegida no toca ningún motor: el gamepad dispara `KeyboardEvent` sintéticos sobre `document` (con `bubbles: true`, así también llegan a los listeners de `window`) con `key` **y** `code` rellenos, para satisfacer a los cuatro motores. Los eventos se disparan en `pointerdown`/`pointerup`, y cada juego declara en su `GameDefinition` qué botones muestra.

## Alcance

**Incluye:**

- `lib/games/types.ts`: nuevo tipo `ControlTactil` (`etiqueta`, `key`, `code`, `zona`, `repetirMs?`) y campo opcional `GameDefinition.controlesTactiles?: ControlTactil[]`. Los motores no cambian.
- `lib/games/registry.ts`: cada uno de los cuatro juegos declara su `controlesTactiles` (ver Modelo de datos).
- `components/games/TouchControls.tsx` (nuevo): gamepad virtual. Recibe `controles`, `deshabilitado` (pausa o fin de partida) y dispara los `KeyboardEvent` sintéticos.
  - Botón sostenido: `keydown` en `pointerdown` y `keyup` en `pointerup`, `pointercancel` y `pointerleave`. Usa `setPointerCapture` para no perder el `keyup` si el dedo se desliza fuera del botón.
  - Si el control declara `repetirMs`, repite el `keydown` con ese intervalo mientras esté presionado (para Caída, que solo reacciona a `keydown` y no usa repetición del navegador).
  - Soporta varios dedos a la vez (giro + empuje + disparo en Asteroids), un `pointerId` por botón.
  - Al desmontarse, al pausar o al terminar la partida, suelta todas las teclas presionadas (`keyup` pendientes) y limpia sus intervalos.
- `app/jugar/[id]/page.tsx`: renderiza `<TouchControls>` bajo el CRT solo si el dispositivo es táctil y el juego declara `controlesTactiles`; layout responsive del HUD, botones y modal.
- `app/globals.css`: estilos del gamepad (`.touch-controls`, `.touch-btn`, zonas izquierda/derecha) y media queries del reproductor para 360–430 px en vertical y en horizontal.
- `app/layout.tsx`: `viewport` con `width=device-width, initial-scale=1`. Si ya existe, se deja como está.
- Bloqueo de gestos del navegador sobre el área de juego: `touch-action: none` en `.crt-screen` y en el gamepad; `user-select: none`, `-webkit-touch-callout: none` y `contextmenu` bloqueado en los botones.
- Detección de dispositivo táctil con `window.matchMedia("(pointer: coarse)")`, leída tras montar (sin romper SSR) y suscrita a `change`.
- Una forma de forzar el gamepad en escritorio para pruebas: query param `?touch=1` en `/jugar/[id]`.

**No incluye (fuera de esta spec):**

- Gestos sobre el canvas (deslizar, arrastrar paleta, tocar para disparar). Se descartaron a favor del gamepad.
- Cambios en los motores (`asteroids.ts`, `caida.ts`, `bloque-buster.ts`, `serpentina.ts`) o en `GameCanvas.tsx`.
- Responsive del resto del sitio (home, biblioteca, salón, about, auth, navbar): otra spec.
- Gamepad físico (Gamepad API), vibración háptica y sonido.
- Forzar o bloquear la orientación de la pantalla (`screen.orientation.lock`).
- PWA, pantalla completa y "agregar a inicio".
- Remapeo de controles o selector de tamaño del gamepad.
- Tests automatizados (el proyecto no tiene test runner).

## Modelo de datos

No hay datos persistentes nuevos. Tipo nuevo en `lib/games/types.ts`:

```ts
export interface ControlTactil {
  etiqueta: string; // texto del botón, p. ej. "◀", "DISPARO"
  key: string; // KeyboardEvent.key, p. ej. "ArrowLeft", " "
  code: string; // KeyboardEvent.code, p. ej. "ArrowLeft", "Space"
  zona: "izquierda" | "derecha"; // lado del gamepad donde se dibuja
  repetirMs?: number; // si existe, repite keydown mientras esté presionado
}

// GameDefinition
controlesTactiles?: ControlTactil[];
```

Mapeo por juego en `lib/games/registry.ts`:

| Juego           | Zona izquierda                                                 | Zona derecha                                       |
| --------------- | -------------------------------------------------------------- | -------------------------------------------------- |
| `asteroids`     | `◀` `▶` (`ArrowLeft`, `ArrowRight`)                            | `EMPUJE` (`ArrowUp`), `DISPARO` (`Space`)          |
| `caida`         | `◀` `▶` (`repetirMs: 120`), `▼` (`ArrowDown`, `repetirMs: 60`) | `GIRAR` (`ArrowUp`), `CAER` (`Space`)              |
| `bloque-buster` | `◀` `▶` (`ArrowLeft`, `ArrowRight`)                            | vacía (la paleta solo usa dos botones; se centran) |
| `serpentina`    | D-pad `▲` `◀` `▶` `▼` (flechas)                                | vacía                                              |

Los valores `key`/`code` de cada botón siguen exactamente lo que lee cada motor según la tabla del Contexto. Si un motor cambiara su mapeo, se actualiza aquí, en el registro.

## Plan de implementación

1. En `lib/games/types.ts`, agregar `ControlTactil` y `GameDefinition.controlesTactiles?`. Compila sin cambios de comportamiento.
2. Crear `components/games/TouchControls.tsx` con los botones, el disparo de `KeyboardEvent` y la liberación de teclas al desmontar. Aún sin usarlo.
3. Agregar los estilos `.touch-controls` y `.touch-btn` en `app/globals.css`, con áreas táctiles mínimas de 56×56 px y `touch-action: none`.
4. Declarar `controlesTactiles` en los cuatro juegos de `lib/games/registry.ts` según la tabla.
5. En `app/jugar/[id]/page.tsx`, detectar táctil con `matchMedia("(pointer: coarse)")` (o `?touch=1`) y renderizar `<TouchControls>` bajo el CRT, deshabilitado cuando `paused` o `over`. Probar con Playwright emulando un móvil en `/jugar/serpentina`.
6. Hacer responsive el reproductor en `app/globals.css`: HUD en grilla de 2 columnas, botones del HUD que envuelven, CRT al ancho disponible, y en horizontal el CRT acotado por `100dvh` con el gamepad a ambos lados. El modal de fin de partida cabe en 360 px.
7. Bloquear gestos: `touch-action: none` en `.crt-screen`, `user-select: none` y `contextmenu` bloqueado en el gamepad. Confirmar el `viewport` en `app/layout.tsx`.
8. Verificar los cuatro juegos de punta a punta con emulación táctil en vertical y horizontal (ver Criterios de aceptación).

## Criterios de aceptación

- [ ] Con `(pointer: coarse)` o `?touch=1`, `/jugar/asteroids`, `/jugar/caida`, `/jugar/bloque-buster` y `/jugar/serpentina` muestran el gamepad bajo el CRT.
- [ ] En escritorio sin `?touch=1`, no aparece el gamepad y el comportamiento por teclado no cambia.
- [ ] Un juego del catálogo sin motor (p. ej. `gloton`, `invasores`) no muestra gamepad.
- [ ] Asteroids: mantener `◀`/`▶` gira la nave, `EMPUJE` la acelera y `DISPARO` dispara; se pueden usar dos botones a la vez.
- [ ] Caída: `◀`/`▶` mueven la pieza una celda por toque y la repiten al mantener; `▼` baja más rápido; `GIRAR` rota; `CAER` hace caída instantánea.
- [ ] Bloque Buster: mantener `◀`/`▶` desliza la paleta y al soltar se detiene.
- [ ] Serpentina: los cuatro botones del D-pad cambian la dirección y el giro de 180° sigue ignorándose.
- [ ] Deslizar el dedo fuera de un botón sostenido lo suelta: la nave no queda girando ni la paleta moviéndose sola.
- [ ] Al pulsar `PAUSA`, al terminar la partida o al salir de la página, no queda ninguna tecla sintética presionada ni intervalo activo.
- [ ] Con el gamepad deshabilitado (pausa o fin de partida), tocar los botones no mueve el juego.
- [ ] Tocar el gamepad o el canvas no hace scroll de la página, no hace zoom por doble toque ni abre el menú contextual o de selección.
- [ ] A 360×640 y 430×932 en vertical, el HUD, el CRT, el gamepad y los botones `PAUSA`/`FIN`/`SALIR`/skin caben sin scroll horizontal.
- [ ] A 640×360 y 932×430 en horizontal, el CRT y el gamepad son visibles sin hacer scroll vertical.
- [ ] El modal de `FIN DEL JUEGO` y su campo de iniciales caben y se pueden usar a 360 px de ancho.
- [ ] Se puede guardar una puntuación con `saveScore` desde un dispositivo emulado táctil.
- [ ] Los archivos de los cuatro motores y `GameCanvas.tsx` no aparecen modificados en el diff de esta spec.
- [ ] `npm run lint` y `npm run build` terminan sin errores nuevos.

## Decisiones tomadas y descartadas

- **Gamepad virtual en vez de gestos** — una sola pieza en el reproductor cubre los cuatro juegos sin tocar sus motores. Asteroids necesita giro, empuje y disparo a la vez, algo que los gestos resuelven mal. Descartados: gestos en el canvas y enfoque híbrido (más superficie de error y trabajo por motor).
- **Eventos de teclado sintéticos en `document`** — los motores ya escuchan teclado y respetan sus reglas (cola de giros, `preventDefault`, pausa). Evita duplicar lógica. Se rellenan `key` y `code` porque Asteroids y Caída leen `code`, mientras que Bloque Buster y Serpentina leen `key`. Descartado: agregar un método `input()` al contrato `GameEngine` (obliga a modificar los cuatro motores).
- **Configuración por juego en `GameDefinition.controlesTactiles`** — mismo patrón que `skins` (SPEC 11): lo que no se declara no se muestra, así los juegos simulados quedan intactos. Descartado: tabla de controles dentro del componente, que lo acoplaría a los `id` de juego.
- **Detección por `(pointer: coarse)` y no por user agent** — cubre tablets y móviles sin listas frágiles. `?touch=1` permite probar en escritorio y con Playwright. Descartado: mostrar siempre el gamepad (estorba en escritorio).
- **`repetirMs` solo para Caída** — es el único motor que reacciona solo a `keydown`; los demás leen el estado sostenido con `keydown`/`keyup`.
- **Sin tecla ni botón de pausa nuevo** — se reutiliza el botón `PAUSA` del HUD, por la misma razón que en las specs 08, 09 y 10.
- **Solo el reproductor es responsive** — el pedido es poder correr los juegos. Responsive del resto del sitio es otra spec.
- **No bloquear la orientación** — el jugador elige; se soportan vertical y horizontal. `screen.orientation.lock` no funciona de forma fiable fuera de pantalla completa.
- **Sin vibración háptica ni sonido** — los juegos no tienen sonido y la vibración no es compatible con iOS Safari.

## Riesgos identificados

| Riesgo                                                                               | Mitigación                                                                                                                 |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Un motor cambia las teclas que lee y el gamepad deja de funcionar sin avisar.        | El mapeo vive en `registry.ts` junto a cada motor, y los criterios verifican cada botón.                                   |
| Se pierde un `pointerup` (cambio de app, llamada) y la tecla queda presionada.       | `pointercancel`, `pointerleave`, `setPointerCapture`, y liberación de todo al pausar, terminar y desmontar.                |
| Safari iOS ignora `touch-action: none` en algunos casos o hace zoom por doble toque. | Se suma `user-select: none` y se prueba en un iPhone real o emulado; si falla, se agrega `preventDefault` en `touchstart`. |
| El `KeyboardEvent` sintético no llega a los listeners de `window` de Asteroids.      | Se dispara con `bubbles: true` sobre `document`; se verifica en `/jugar/asteroids`.                                        |
| En horizontal el CRT 4:3 más el HUD no caben en 360 px de alto.                      | El CRT se limita por `100dvh`, el HUD se compacta y el gamepad va a los lados.                                             |
| El skin `retro` (render a baja resolución) pesa en móviles lentos.                   | Fuera de alcance; se anota en la validación manual si se nota lag.                                                         |

## Lo que **no** está en esta spec

- Gestos sobre el canvas (deslizar, arrastrar, tocar para disparar).
- Cambios en los motores de los juegos.
- Responsive de home, biblioteca, salón, about, auth y navbar.
- Gamepad físico, vibración, sonido, pantalla completa y PWA.
- Bloqueo de orientación y remapeo de controles.
