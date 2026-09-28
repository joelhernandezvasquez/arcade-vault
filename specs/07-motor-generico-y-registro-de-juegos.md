# 07 — Motor genérico de juegos y registro de motores

**Estado:** Approved
**Depende de:** SPEC 05, SPEC 06
**Fecha:** 2026-09-28
**Objetivo:** Extraer un contrato `GameEngine` compartido y un registro `id → motor` de la implementación actual de `asteroids`, para que `app/jugar/[id]/page.tsx` deje de tener una rama `if (game.id === "asteroids")` y cada juego real nuevo solo necesite agregar un motor, una línea de registro y una migración de catálogo.

## Contexto

La spec 05 portó Asteroids como el primer (y único) juego real del catálogo: `lib/games/asteroids.ts` (clase `AsteroidsGame`, agnóstica de React) + `components/games/AsteroidsGame.tsx` (wrapper de canvas con `forwardRef`/`useImperativeHandle`) + una rama fija `isAsteroids` en `app/jugar/[id]/page.tsx` que decide si se renderiza el canvas real o la arena decorativa del spec 01. Este acoplamiento 1:1 funciona con un solo juego, pero no escala: cada juego nuevo repetiría el mismo patrón agregando otra rama `if (game.id === "x")`, otro `xRef`, otro `xLevel`, etc. en la página del reproductor.

Este spec no agrega ningún juego nuevo. Generaliza lo que ya existe: convierte `AsteroidsGame` en la primera implementación de una interfaz `GameEngine` común, mueve el wrapper de canvas a un componente genérico `GameCanvas`, y agrega un registro `lib/games/registry.ts` que mapea `id` del catálogo → definición de motor. `app/jugar/[id]/page.tsx` pasa a consultar el registro en vez de tener el nombre de `asteroids` escrito en el código. Es el refactor habilitante para la skill `/add-game`, que a partir de aquí solo necesita producir specs que agreguen una entrada al registro, no que vuelvan a tocar la página del reproductor.

## Alcance

**Incluye:**

- `lib/games/types.ts` (nuevo): tipos compartidos por cualquier motor de juego.
  - `GameState`: `{ score: number; lives: number | null; level: number; gameOver: boolean }`. `lives: null` es el caso de un juego sin sistema de vidas (p. ej. Tetris); el HUD ya existente en `app/jugar/[id]/page.tsx` debe interpretarlo mostrando `"—"` en vez de `"♥ ".repeat(lives)`.
  - `GameEngine`: interfaz con `start(): void`, `pause(): void`, `resume(): void`, `reset(): void`, `forceGameOver(): void`, `destroy(): void`, `onStateChange(cb: (s: GameState) => void): void` — exactamente los métodos que ya expone `AsteroidsGame`.
  - `GameDefinition`: `{ width: number; height: number; create(canvas: HTMLCanvasElement): GameEngine }`. `width`/`height` son la resolución lógica interna del canvas (800×600 para `asteroids`, igual que hoy); cada motor declara la suya propia, no queda fija en el componente.
- `lib/games/registry.ts` (nuevo): `export const ENGINES: Record<string, GameDefinition>` con una sola entrada por ahora: `asteroids: { width: 800, height: 600, create: (canvas) => new AsteroidsGame(canvas) }`.
- `lib/games/asteroids.ts`: la clase `AsteroidsGame` pasa a declarar `implements GameEngine` (de `./types`). `AsteroidsState` se elimina como tipo propio; donde se usaba se importa `GameState` de `./types`. Ningún cambio de comportamiento del motor (física, HUD interno ya removido en spec 05, listeners, `dt`, etc.).
- `components/games/GameCanvas.tsx` (nuevo, reemplaza a `components/games/AsteroidsGame.tsx`): mismo componente `forwardRef` + `useImperativeHandle` que ya existe, generalizado:
  - Props: `{ definition: GameDefinition; paused: boolean; onStateChange: (state: GameState) => void }`.
  - El `<canvas>` usa `definition.width`/`definition.height` en vez de los literales `800`/`600` fijos.
  - El `useEffect` de montaje llama a `definition.create(canvasRef.current)` en vez de `new AsteroidsEngine(...)`.
  - El resto del ciclo de vida (`start()` al montar, `destroy()` al desmontar, `pause()`/`resume()` según la prop `paused`, `reset`/`forceGameOver` expuestos vía ref) no cambia.
  - `components/games/AsteroidsGame.tsx` se borra; nada más lo importa tras este spec.
- `app/jugar/[id]/page.tsx`:
  - Se importa `ENGINES` de `@/lib/games/registry` y `GameState` de `@/lib/games/types` en vez de `AsteroidsGame`/`AsteroidsGameHandle`/`AsteroidsState` de `@/components/games/AsteroidsGame`.
  - `const isAsteroids = game?.id === "asteroids"` se reemplaza por `const definition = game ? ENGINES[game.id] : undefined` (un motor real existe si `definition` no es `undefined`).
  - `asteroidsRef: useRef<AsteroidsGameHandle>` se reemplaza por `engineRef: useRef<GameCanvasHandle>` (el mismo shape `{ reset: () => void; forceGameOver: () => void }`, ahora exportado desde `GameCanvas.tsx` en vez de `AsteroidsGame.tsx`).
  - `asteroidsLevel`/`setAsteroidsLevel` se renombran a `engineLevel`/`setEngineLevel` (mismo comportamiento: solo se usan cuando hay `definition`).
  - `level` sigue calculándose como `definition ? engineLevel : Math.floor(score / 2500) + 1`.
  - El `useEffect` del contador simulado (`setInterval` que suma puntos falsos) pasa a condicionarse con `!definition` en vez de `!isAsteroids`.
  - `endGame`/`restart` llaman a `engineRef.current?.forceGameOver()` / `.reset()` cuando `definition` existe, igual que hoy con `asteroidsRef`.
  - En el JSX, `{isAsteroids ? <AsteroidsGame ref={asteroidsRef} .../> : <div className="game-arena">...}` pasa a `{definition ? <GameCanvas ref={engineRef} definition={definition} .../> : <div className="game-arena">...}`.
  - El bloque `"♥ ".repeat(lives).trim() || "—"` del HUD de vidas ya produce `"—"` cuando `lives` es `0`; se ajusta para que también produzca `"—"` cuando `lives` es `null` (motor sin sistema de vidas), sin cambiar el caso `lives: number` existente.
  - Ningún otro comportamiento de la página cambia: mismo modal de fin de partida, mismo `saveScore`, mismos botones.

**No incluye (explícitamente fuera de este spec):**

- Agregar ningún juego nuevo al registro (Tetris, Arkanoid u otro) — eso lo produce una spec propia generada por la skill `/add-game`, implementada por separado con `/spec-impl`.
- Cambiar la física, el balance o cualquier comportamiento visible de `asteroids` — este spec es un refactor de estructura, no de producto; el criterio de aceptación es que `/jugar/asteroids` se comporte exactamente igual que antes del refactor.
- Tocar el catálogo de Supabase (`games`/`scores`) o cualquier migración — no se agrega ni modifica ninguna fila.
- Crear la skill `/add-game` — va en un cambio separado, descrito en un plan aparte, que depende de que este refactor esté implementado (el registro debe existir para que la skill lo referencie al generar specs).
- Soporte para motores con una resolución lógica distinta de 800×600 más allá de permitir que `GameDefinition` la declare — no se introduce ningún motor que use otra resolución en este spec, solo se deja el campo listo.

## Modelo de datos

No se introduce persistencia nueva. Tipos TypeScript nuevos, en memoria:

```ts
// lib/games/types.ts
export interface GameState {
  score: number;
  lives: number | null;
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

```ts
// lib/games/registry.ts
export const ENGINES: Record<string, GameDefinition> = {
  asteroids: {
    width: 800,
    height: 600,
    create: (canvas) => new AsteroidsGame(canvas),
  },
};
```

## Plan de implementación

1. Crear `lib/games/types.ts` con `GameState`/`GameEngine`/`GameDefinition` tal como se describe arriba.
2. Modificar `lib/games/asteroids.ts`: importar `GameState`/`GameEngine` de `./types`, declarar `class AsteroidsGame implements GameEngine`, eliminar la interfaz local `AsteroidsState` y sustituir sus usos internos por `GameState`. Correr `npm run lint`/`npm run build` para confirmar que la clase sigue cumpliendo el contrato sin cambios de comportamiento.
3. Crear `lib/games/registry.ts` con `ENGINES` y la entrada `asteroids`.
4. Crear `components/games/GameCanvas.tsx` a partir de `components/games/AsteroidsGame.tsx`, parametrizando `definition`/`width`/`height` como se describe en Alcance; exportar el tipo del handle (p. ej. `GameCanvasHandle`) con el mismo shape que hoy tiene `AsteroidsGameHandle`. Borrar `components/games/AsteroidsGame.tsx`.
5. Actualizar `app/jugar/[id]/page.tsx` para usar `ENGINES`, `GameCanvas`, `GameCanvasHandle`, `GameState` y las variables renombradas (`definition`, `engineRef`, `engineLevel`) como se describe en Alcance, incluyendo el ajuste del HUD de vidas para `lives === null`.
6. Correr `npm run lint` y `npm run build`, confirmar que no hay errores ni referencias colgantes a `AsteroidsGame.tsx`/`AsteroidsGameHandle`/`AsteroidsState`.
7. Probar manualmente con `npm run dev`: repetir el mismo recorrido de prueba de la spec 05 en `/jugar/asteroids` (mover/rotar/disparar, dividir asteroides, perder las 3 vidas y guardar puntuación con `saveScore`, `PAUSA`/`REANUDAR`, `FIN`, `JUGAR DE NUEVO`, `SALIR` sin dejar listeners ni loop de `requestAnimationFrame` corriendo) y confirmar que se comporta idéntico a antes del refactor; navegar a `/jugar/serpentina` (u otro id sin motor) y confirmar que sigue mostrando la arena decorativa sin cambios.

## Criterios de aceptación

- [ ] `lib/games/types.ts` existe y exporta `GameState`, `GameEngine`, `GameDefinition`.
- [ ] `lib/games/registry.ts` existe y exporta `ENGINES` con la entrada `asteroids`.
- [ ] `AsteroidsGame` (`lib/games/asteroids.ts`) implementa `GameEngine` sin cambiar su lógica interna de juego.
- [ ] `components/games/GameCanvas.tsx` existe, es genérico sobre `GameDefinition`, y `components/games/AsteroidsGame.tsx` ya no existe.
- [ ] `app/jugar/[id]/page.tsx` no contiene ninguna referencia literal a `"asteroids"` para decidir si renderiza el canvas real (usa `ENGINES[game.id]` en su lugar).
- [ ] `/jugar/asteroids` se comporta exactamente igual que antes del refactor: HUD real, pausa/reanudar congela el juego, FIN y pérdida de vidas abren el mismo modal, `JUGAR DE NUEVO` reinicia el motor, `SALIR` no deja listeners ni loops huérfanos.
- [ ] Un motor cuyo `GameState.lives` sea `null` mostraría `"—"` en el HUD de vidas (verificable leyendo el código del HUD, ya que no hay todavía ningún motor así registrado).
- [ ] Ningún otro `id` del catálogo (`/jugar/serpentina`, `/jugar/caida`, etc.) cambia de comportamiento.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones tomadas y descartadas

- **Registro estático `Record<string, GameDefinition>` en vez de descubrimiento automático por convención de carpetas** — con un puñado de juegos, una entrada explícita por `id` es más simple de leer y de que la skill `/add-game` la edite de forma predecible (una línea agregada) que inventar una convención de auto-registro basada en el sistema de archivos.
- **`GameDefinition` declara `width`/`height` propios en vez de fijar 800×600 en `GameCanvas`** — dado que ya se sabe que hay motores futuros con tableros verticales (Tetris) que podrían necesitar otra resolución lógica, dejar el campo abierto ahora evita otro refactor de `GameCanvas` cuando llegue el primer motor que no sea 800×600; no se cambia ningún valor real en este spec (`asteroids` sigue en 800×600).
- **`lives: number | null` en `GameState` en vez de una unión de tipos de motor o una bandera aparte `hasLives: boolean`** — es el cambio mínimo sobre el tipo que ya existe (`AsteroidsState`) que permite representar "este juego no tiene vidas" sin que cada motor tenga que inventar un valor sentinela (`-1`, `Infinity`, etc.) para lo mismo.
- **`GameEngine` como interfaz que implementa la clase existente, no una reescritura de `AsteroidsGame`** — el objetivo es extraer el contrato que ya cumple el código actual, no rediseñar el motor; minimiza el riesgo de introducir una regresión en el único juego real que existe hoy.
- **Sin cambios en el HUD salvo el caso `lives === null`** — el resto del HUD (puntuación, nivel, nombre) ya es genérico; tocar más de lo necesario aumentaría el riesgo de este refactor sin ningún beneficio, ya que no hay todavía un segundo motor que lo ejerza.

## Riesgos identificados

- Al no existir todavía un segundo motor registrado, el caso `lives === null` del HUD queda verificado solo por lectura de código en este spec, no por una prueba manual real; se mitiga marcándolo así explícitamente en el criterio de aceptación correspondiente, y quedará ejercido en la práctica por la primera spec que registre un motor sin vidas (p. ej. un port de Tetris).
- Cualquier importación residual de `components/games/AsteroidsGame` o del tipo `AsteroidsState` que quede fuera de los archivos listados en el plan (por ejemplo, en un test o script no detectado) rompería el build; se mitiga corriendo `npm run build` como paso explícito del plan antes de dar el spec por completo.
