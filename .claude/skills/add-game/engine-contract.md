# Contrato de motor de juego y checklist de portado

Referencia que `/add-game` carga en su Fase 2/6. Describe el contrato `GameEngine`
que introduce la spec 07 y las reglas de portado que las specs 05/06 ya aplicaron
a Asteroids. Cualquier spec generada por `/add-game` debe citar este contrato,
no redefinirlo.

## El contrato (`lib/games/types.ts`, de la spec 07)

```ts
export interface GameState {
  score: number;
  lives: number | null; // null = el juego no tiene sistema de vidas
  level: number;
  gameOver: boolean;
}

export interface GameEngine {
  start(): void;
  pause(): void;
  resume(): void;
  reset(): void;
  forceGameOver(): void;
  destroy(): void;
  onStateChange(cb: (s: GameState) => void): void;
}

export interface GameDefinition {
  width: number;
  height: number;
  create(canvas: HTMLCanvasElement): GameEngine;
}
```

Un motor nuevo es una clase en `lib/games/<id>.ts` que `implements GameEngine`,
más una entrada en `lib/games/registry.ts`:

```ts
ENGINES["<id>"] = {
  width: 800, // resolución lógica interna del motor, no el tamaño en pantalla
  height: 600,
  create: (canvas) => new MiJuegoGame(canvas),
};
```

`components/games/GameCanvas.tsx` (genérico, de la spec 07) se encarga del
`<canvas>`, el ciclo de vida de React y el puente `onStateChange` → HUD. Un
motor nuevo nunca toca ese componente ni `app/jugar/[id]/page.tsx`.

## Reglas de portado (de las specs 05/06, aplican a todo motor nuevo)

- **Resolución lógica fija, escalado por CSS.** El `<canvas>` se dibuja en
  `width`×`height` lógicos declarados por el `GameDefinition` y se escala
  visualmente con CSS al contenedor `.crt-screen` (4:3). No se reescriben las
  físicas/velocidades del original para que quepan en otra resolución. Si el
  original es un tablero vertical (p. ej. Tetris, más angosto que 4:3), se
  centra el tablero dentro del lienzo lógico y se usa el espacio sobrante
  para paneles que el propio canvas ya dibuja (siguiente pieza, etc.), en vez
  de cambiar la relación de aspecto del contenedor.
- **Listeners con `destroy()` explícito.** El original probablemente asume que
  vive para siempre en su propio `index.html` y no limpia sus listeners. El
  puerto agrega los listeners en el constructor del motor (nunca a nivel de
  módulo) y los remueve en `destroy()`, para que navegar fuera de `/jugar/<id>`
  no deje listeners de teclado/mouse ni un `requestAnimationFrame` corriendo
  en segundo plano.
- **`preventDefault` en las teclas del juego.** Cualquier tecla que el motor
  use para jugar (flechas, espacio, etc.) llama a `preventDefault()` en
  `keydown`/`keyup` para que no haga scroll de la página del reproductor —
  el original no lo necesita porque no convive con más contenido scrolleable.
- **Coordenadas de mouse escaladas.** Si el juego usa mouse (p. ej. Arkanoid),
  las coordenadas del evento se escalan con
  `canvas.getBoundingClientRect()` + `canvas.width / rect.width` (mismo patrón
  que ya usa el `game.js` de referencia de Arkanoid), porque el canvas real en
  pantalla no mide lo mismo que su resolución lógica.
- **`dt` acotado.** El loop limita el delta de tiempo entre frames (p. ej. a
  0.05s) para evitar saltos grandes de física tras un tab en segundo plano o
  una pausa larga — mismo criterio que `AsteroidsGame`.
- **La pausa congela `update()` y `draw()`.** Mientras está en pausa no corre
  ninguno de los dos; el último frame dibujado queda estático. El overlay de
  "EN PAUSA" ya existe en `app/jugar/[id]/page.tsx` y se dibuja encima del
  canvas congelado — el motor no dibuja su propio overlay de pausa.
- **Sin HUD ni overlays de texto propios del canvas original.** `drawHUD`,
  pantallas de "GAME OVER"/"YOU WIN" dibujadas a mano, selectores de nivel en
  pantalla de pausa, "pulsa una tecla para reiniciar" — todo eso se elimina
  del motor. El HUD pixel-art y el modal de fin de partida del reproductor de
  Arcade Vault ya cubren ese rol; mantener los dos sería redundante e
  inconsistente visualmente.
- **`FIN` y "sin vidas" comparten un solo camino de fin de partida.**
  `forceGameOver()` debe producir el mismo `GameState.gameOver: true` que la
  pérdida natural de la última vida (o la condición de fin de partida del
  juego, si no tiene vidas), sin dos lógicas de cierre distintas.
- **`reportState()` solo cuando algo cambia.** El callback de
  `onStateChange` se invoca cuando cambian `score`/`lives`/`level`/`gameOver`,
  nunca en cada frame — evita forzar un re-render de React a 60fps por un HUD
  que en la práctica cambia con poca frecuencia.
- **Sin estado a nivel de módulo.** Todo el estado mutable del juego
  (posición, entidades, puntuación, etc.) vive dentro de la instancia de la
  clase del motor, nunca en variables sueltas del archivo — así puede haber
  más de una partida instanciada sin interferencia (aunque hoy el reproductor
  solo monta una a la vez).
- **Assets fuera del bundle de JS.** Sprites y sonidos se copian a
  `public/games/<id>/...` (p. ej. `public/games/arkanoid/spritesheet.png`) y
  el motor los referencia con esa ruta absoluta, en vez de intentar
  incrustarlos o depender de rutas relativas del proyecto de referencia. El
  audio se detiene al pausar y al llamar a `destroy()`.
- **`lives: null` cuando el juego no tiene sistema de vidas.** El HUD de
  `app/jugar/[id]/page.tsx` (spec 07) interpreta `null` mostrando `"—"` en
  vez de corazones. No inventes un valor sentinela numérico (`-1`, `Infinity`)
  para representar "sin vidas".

## Checklist de portado (Fase 2 de `/add-game`)

Al analizar una carpeta de `references/started-games/`, identifica y anota
explícitamente cada uno de estos puntos antes de escribir la spec:

- [ ] Dependencias del DOM (`getElementById`, botones, overlays propios).
- [ ] Dónde se agregan los listeners globales hoy y si el original los limpia.
- [ ] Dimensiones y relación de aspecto del canvas original.
- [ ] Tipo de entrada (teclado, mouse, ambos) y qué teclas necesitan
      `preventDefault`.
- [ ] Pausa/overlays/selector de nivel propios del canvas (a remover).
- [ ] ¿Tiene sistema de vidas? (`lives: number` vs `lives: null`).
- [ ] Assets (sprites, spritesheets, sonidos) y su destino en
      `public/games/<id>/...`.
- [ ] Variables de estado a nivel de módulo que hay que encapsular en la
      clase del motor.
