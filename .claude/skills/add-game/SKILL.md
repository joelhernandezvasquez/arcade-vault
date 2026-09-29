---
name: add-game
description: Designs a spec for adding a new real game to Arcade Vault's catalog — ported from references/started-games/ or built from scratch — following the engine-contract pattern from specs 05/06/07. Gathers the game-specific analysis and decisions, then writes the spec file to specs/ itself. Does not write game code. Use when the user wants to add, port, or integrate a new playable game.
disable-model-invocation: true
argument-hint: "<references/started-games/NN-nombre | descripción de un juego desde cero>"
allowed-tools: Read, Glob, Grep, AskUserQuestion, Write(specs/*), Bash(ls:*), Bash(cat:*), Bash(date:*), Bash(wc:*)
---

# /add-game — Especificador de juegos nuevos

## Contexto de sesión

Fecha de hoy (úsala para el encabezado de la spec, nunca la adivines):
!`date +%F`

Specs existentes:
!`ls specs/ 2>/dev/null || echo "No existe specs/"`

Juegos de referencia disponibles:
!`ls references/started-games/ 2>/dev/null || echo "No existe references/started-games/"`

Catálogo actual sembrado en Supabase (según la última migración que lo toca):
!`grep -h "insert into games\|update games" supabase/migrations/*.sql 2>/dev/null | head -5; grep -hoE "^\s*\('[a-z0-9-]+'," supabase/migrations/*.sql 2>/dev/null`

Categorías válidas (`lib/data.ts`):
!`grep -n "CATS" lib/data.ts 2>/dev/null`

Registro de motores actual:
!`cat lib/games/registry.ts 2>/dev/null || echo "NO EXISTE — falta implementar la spec 07 (motor genérico y registro)"`

Motores existentes en `lib/games/`:
!`ls lib/games/ 2>/dev/null`

---

## Filosofía

Esta skill **no escribe código de juego**, pero **sí escribe el archivo de la spec** en `specs/`. Su trabajo es analizar el origen del juego (una carpeta en `references/started-games/` o una idea descrita por el usuario), resolver con el usuario cómo encaja en el catálogo y en el registro de motores, y redactar `specs/NN-juego-<id>.md` siguiendo `spec-template.md`. No delega en `/spec`: el análisis específico de juegos (leer un `game.js` de referencia, aplicar la checklist de portado, decidir `INSERT` vs `UPDATE` de catálogo) y la redacción de la spec quedan en un solo paso, sin perder contexto en un traspaso. El código lo escribe `/spec-impl` después, con la spec ya aprobada.

Antes de preguntarle nada al usuario, carga `engine-contract.md` (en esta misma carpeta de skill) — contiene el contrato `GameEngine`/`GameState`/`GameDefinition` y las reglas de portado que la spec debe citar y respetar. Usa `spec-template.md` (también en esta carpeta) como la forma exacta de la spec que escribes en la Fase 6.

## Fase 0 — Precondición

Si el bloque de contexto de arriba muestra que `lib/games/registry.ts` **no existe**, detente aquí. Dile al usuario:

> El registro genérico de motores (spec 07) todavía no está implementado. `/add-game` depende de él para que cada juego nuevo sea solo una entrada en `lib/games/registry.ts`, no otra rama `if` en `app/jugar/[id]/page.tsx`. Aprueba e implementa `specs/07-motor-generico-y-registro-de-juegos.md` con `/spec-impl` antes de seguir.

No continúes a las fases siguientes hasta que el registro exista.

## Fase 1 — Identificar el origen

El argumento recibido es: `$ARGUMENTS`

- Si es (o contiene) una ruta bajo `references/started-games/`, es un **port**. Ve a Fase 2.
- Si es una descripción de juego sin ruta, es un juego **desde cero**. Ve a Fase 3.
- Si `$ARGUMENTS` está vacío, pregunta al usuario cuál de las dos cosas quiere, mostrándole la lista de carpetas de `references/started-games/` del contexto de sesión como opciones, más "otro juego desde cero".

## Fase 2 — Analizar una carpeta de referencia (solo si aplica)

Lee **por completo** todos los archivos relevantes de la carpeta: `README.md`, `CLAUDE.md`, `game.js` (y cualquier otro `.js` que importe, p. ej. `levels.js`), `index.html`, `style.css`, y lista `assets/` y `specs/` si existen (léelos también si son cortos).

Con la checklist de portado de `engine-contract.md`, identifica y anota explícitamente:

- **Dependencias del DOM**: `getElementById`, elementos de HUD/overlay propios, botones de reinicio o de tema, cualquier cosa que asuma que vive en su propio `index.html`.
- **Listeners globales**: en qué target se agregan (`window`/`document`/`canvas`) y si el original los limpia (normalmente no, porque no está pensado para desmontarse).
- **Tamaño y forma del canvas**: dimensiones fijas, relación de aspecto (¿4:3 como `.crt-screen`, o distinto — p. ej. un tablero vertical de Tetris?).
- **Entrada**: teclado, mouse, o ambos; qué teclas necesitan `preventDefault`.
- **Pausa/overlays propios**: selector de nivel, menú de pausa, mensaje de "pulsa una tecla para reiniciar" — todo esto se remueve del motor (lo cubre el reproductor de Arcade Vault), igual que hizo la spec 05 con Asteroids.
- **Vidas**: si el juego tiene un contador de vidas (→ `GameState.lives: number`) o no (→ `GameState.lives: null`, HUD muestra `"—"`).
- **Assets**: sprites, spritesheets, sonidos. Si existen, van a `public/games/<id>/...` y el motor los carga desde ahí.
- **Estado global de módulo**: variables sueltas a nivel de archivo que deben quedar encapsuladas dentro de la clase del motor (mismo patrón que `AsteroidsGame`).

## Fase 3 — Juego desde cero (solo si aplica)

Pide al usuario (con preguntas concretas, no un formulario largo) lo mínimo para diseñar el motor: mecánica principal, controles, si tiene vidas o no, condición de fin de partida, y si hay algún asset (sprite/sonido) que aportará o si todo se dibuja con primitivas de canvas. No inventes mecánicas — si algo no está claro, pregúntalo con `AskUserQuestion` antes de seguir.

## Fase 4 — Decisión de catálogo

Usa `AskUserQuestion` para decidir cómo entra el juego al catálogo de Supabase:

- **Reemplazar una entrada decorativa existente** (p. ej. un port de Tetris → `caida`, un port de Arkanoid → `bloque-buster`): la migración es un `UPDATE` sobre la fila existente. Se conserva `id`, `cover` y `sort_order` tal cual (mismo criterio que la spec 05 con `rocas` → `asteroids`, donde solo cambiaron `id`/`title` y el resto del catálogo no se tocó); `title`/`short`/`long`/`color` se ajustan solo si el juego real ya no describe bien lo que decía la entrada decorativa.
- **Agregar una entrada nueva**: la migración es un `INSERT`. Se necesita `id` (slug), `title`, `short`, `long`, `cat` (una de `CATS` en `lib/data.ts`), `cover` (nueva clase `cover-<id>` a agregar en `app/globals.css`, siguiendo el patrón de las clases `cover-*` existentes), `color` (uno de los acentos ya usados: cyan/magenta/green/yellow), `best`/`plays` (valores de muestra, igual que el resto del catálogo) y el siguiente `sort_order` disponible.

Muestra la lista de `id`s existentes (del contexto de sesión) para que el usuario elija con conocimiento de causa.

## Fase 5 — Preguntas de aclaración específicas del juego

Antes de escribir la spec, resuelve con el usuario (usando `AskUserQuestion` cuando haya más de una opción razonable) lo que sea propio de este juego y no esté ya decidido por el contrato genérico:

- ¿Se recolorea el juego al `color` de acento del catálogo, o se mantiene la paleta del original (igual que la spec 05 decidió mantener Asteroids monocromo)?
- ¿Qué partes del juego de referencia quedan explícitamente fuera de alcance (sonido, gamepad, selector de nivel visual, etc.)?
- Si el original tiene una relación de aspecto distinta de 4:3, ¿cómo se resuelve dentro de `.crt-screen`? (p. ej. un tablero vertical se centra con paneles laterales dibujados en el propio canvas, siguiendo lo que indica `engine-contract.md`).

No avances a la Fase 6 con preguntas sin resolver.

## Fase 6 — Escribir la spec

Con todo lo resuelto en las Fases 1–5, escribe la spec con la herramienta Write en `specs/NN-juego-<id>.md`, siguiendo la estructura de `spec-template.md` sección por sección (sin dejar ninguna sin resolver; omite solo "Riesgos identificados" si no aplica).

- **Nombre de archivo**: revisa `specs/` (contexto de sesión) y usa el siguiente número disponible: `NN-juego-<id>.md`. Nunca sobrescribas una spec existente.
- **Formato del repo**: español, encabezado en líneas negrita (`**Estado:** Draft`, `**Depende de:**`, `**Fecha:**`, `**Objetivo:**`), sin blockquotes, igual que las specs existentes. La fecha es la del contexto de sesión.
- **Depende de**: normalmente SPEC 07, más SPEC 06 si agrega/actualiza una fila del catálogo.
- **Valores concretos**: la migración con las columnas exactas decididas en la Fase 4, la línea de `registry.ts`, assets y clase `cover-<id>` si aplican, y lo que la Fase 5 dejó fuera.
- **Contrato**: cita `GameEngine`/`GameState`/`GameDefinition` de `lib/games/types.ts` sin redefinirlos.
- **Decisiones**: vuelca las de las Fases 4 y 5, con su razón, en "Decisiones tomadas y descartadas".

Al terminar, dile al usuario dónde quedó el archivo y el siguiente paso:

> Revisa `specs/NN-juego-<id>.md`, cambia el estado a `Approved`/`Aprobado` cuando estés conforme, y ejecuta `/spec-impl NN-juego-<id>` para implementarla.
