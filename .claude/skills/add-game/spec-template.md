# Esqueleto de spec para un juego nuevo

Referencia que `/add-game` usa en su Fase 6 para armar el brief que le pasa a
la skill `/spec` (vía la herramienta Skill) — `/add-game` no escribe
`specs/NN-juego-<id>.md` directamente, `/spec` sí. No es texto para copiar
literal en el `args` — es la forma que debe tener el resultado final, en el
mismo estilo que las specs 05/06/07 ya existentes en este repo (español,
encabezado con líneas en negrita, sin blockquotes). Úsalo para no dejar
ninguna sección sin resolver en el brief.

```markdown
# NN — Juego real de <NOMBRE>

**Estado:** Draft
**Depende de:** SPEC 07 (motor genérico y registro de juegos)[, SPEC 06 si agrega/actualiza una fila del catálogo]
**Fecha:** YYYY-MM-DD
**Objetivo:** una sola frase — portar/crear <juego> como motor real del catálogo, en el `id` <id>.

## Contexto

De dónde sale el juego (carpeta de `references/started-games/NN-x/` con su
tamaño en líneas, o "diseñado desde cero en esta spec"), qué entrada del
catálogo ocupa (nueva o reemplazo de cuál arena decorativa) y por qué, en 1-2
párrafos — mismo tono que el "Contexto" de las specs 05/06.

## Alcance

**Incluye:**

- `lib/data.ts` / migración de catálogo: qué fila se agrega (`INSERT`) o
  actualiza (`UPDATE`) en `supabase/migrations/000N_juego_<id>.sql`, con los
  valores concretos de `id`, `title`, `short`, `long`, `cat`, `cover`,
  `color`, `best`, `plays`, `sort_order`.
- `lib/games/<id>.ts`: motor del juego, clase que `implements GameEngine`
  (de `lib/games/types.ts`, spec 07). Qué se porta del original y qué se
  remueve (HUD/overlays propios, listeners globales sin cleanup — ver
  checklist de `engine-contract.md`). Constantes/clases internas que porta.
- `lib/games/registry.ts`: la línea nueva `ENGINES["<id>"] = { width, height, create }`.
- Assets, si los hay: qué se copia a `public/games/<id>/...`.
- `app/globals.css`, solo si es una entrada nueva del catálogo: la clase
  `cover-<id>` nueva.
- Cualquier decisión de portado específica de este juego que la checklist de
  `engine-contract.md` haya sacado a la luz (aspecto no 4:3, mouse, etc.).
- Nada de esto toca `app/jugar/[id]/page.tsx`, `components/games/GameCanvas.tsx`
  ni `lib/games/types.ts` — esos ya son genéricos desde la spec 07.

**No incluye (explícitamente fuera de este spec):**

- Ningún cambio a otros juegos del catálogo.
- Lo que la Fase 5 de `/add-game` haya decidido dejar fuera con el usuario
  (sonido, gamepad, recoloreo, selector de nivel visual, etc.).
- Tests automatizados (el proyecto no tiene test runner configurado).
- Validación anti-trampa de puntuaciones (mismo riesgo aceptado que documenta
  la spec 06).

## Modelo de datos

Reutiliza `GameState`/`GameEngine`/`GameDefinition` de `lib/games/types.ts`
(spec 07) sin cambios — cítalos, no los redefinas. Si el motor necesita tipos
internos propios (entidades, constantes de física), decláralos aquí como
detalle de implementación, no exportado, igual que hizo la spec 05 con las
clases internas de `AsteroidsGame`.

## Plan de implementación

1. Migración SQL en `supabase/migrations/000N_juego_<id>.sql` (`INSERT` o
   `UPDATE` según corresponda). Aplicarla vía el MCP de `supabase`
   autorizado, o a mano desde el SQL Editor del proyecto `vgppkjxuqdhjstprzotw`
   si el MCP no está disponible. Verificar con una consulta simple.
2. Copiar assets (si los hay) a `public/games/<id>/...`.
3. Crear `lib/games/<id>.ts` portando/escribiendo la lógica del motor,
   `implements GameEngine`, sin HUD/overlays propios.
4. Agregar la entrada `<id>` en `lib/games/registry.ts`.
5. Si es una entrada nueva del catálogo: agregar la clase `cover-<id>` en
   `app/globals.css`.
6. Correr `npm run lint` y `npm run build`, confirmar que no hay errores.
7. Probar manualmente con `npm run dev` en `/jugar/<id>`: [lista concreta de
   qué probar — controles, condición de fin de partida, guardar puntuación
   con `saveScore`, que aparezca en `/salon` y en `/juego/<id>`, pausa/FIN/
   reinicio, que las teclas del juego no hagan scroll de la página, que
   `SALIR` no deje listeners/loops huérfanos]. Navegar a otro `id` del
   catálogo y confirmar que no cambió de comportamiento.

## Criterios de aceptación

- [ ] `/jugar/<id>` muestra el juego real, no la arena decorativa.
- [ ] El HUD superior (`Puntuación`, `Vidas` o `—` si no tiene, `Nivel`)
      refleja el estado real del motor.
- [ ] La condición de fin de partida del juego abre el modal existente con la
      puntuación real y permite guardarla con `saveScore({ gameId: "<id>", score, name })`.
- [ ] El botón `FIN` fuerza el mismo modal de fin de partida.
- [ ] `PAUSA`/`REANUDAR` congela y reanuda el juego real.
- [ ] `JUGAR DE NUEVO` reinicia el motor a un estado limpio.
- [ ] `SALIR` u otra navegación no deja listeners de teclado/mouse activos ni
      un loop de `requestAnimationFrame` corriendo en segundo plano.
- [ ] `<id>` aparece en `/salon` bajo su pestaña y en la vista previa de
      leaderboard de `/juego/<id>` tras guardar una puntuación real.
- [ ] Ningún otro juego del catálogo cambia de comportamiento.
- [ ] Usar las teclas del juego no hace scroll de la página.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones tomadas y descartadas

Las decisiones específicas de este juego que salieron de las Fases 4/5 de
`/add-game` (reemplazo vs. entrada nueva, recoloreo o no, qué queda fuera de
alcance, cómo se resuelve un aspecto no 4:3 si aplica), con su razón — mismo
formato que las specs 05/06.

## Riesgos identificados

Solo si hay riesgos no obvios propios de este juego (p. ej. un motor con
muchos sprites que podría pesar el bundle, una mecánica difícil de balancear).
Omitir la sección si no aplica.
```
