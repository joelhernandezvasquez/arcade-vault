---
name: spec-imp-game
description: Implementa una spec de juego aprobada exactamente igual que /spec-impl y, al terminar la implementación, lanza en secuencia (nunca en paralelo) los subagentes skin-designer y luego mobile-porter.
disable-model-invocation: true
argument-hint: <NN-juego-id>
allowed-tools: Read, Glob, Grep, Edit, Write, Agent, AskUserQuestion, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(git diff:*), Bash(git stash:*), Bash(cat:*), Bash(ls:*), Bash(npx tsc:*), Bash(npm run lint:*)
---

# /spec-imp-game — /spec-impl + skins + móvil

Hace lo mismo que `/spec-impl` y, al terminar, encadena los subagentes `skin-designer` y `mobile-porter`. Responde en español.

## Contexto de sesión

Estado del repositorio:
!`git status --short`

Rama actual:
!`git branch --show-current`

Specs disponibles:
!`ls specs/ 2>/dev/null || echo "No existe la carpeta specs/"`

Configuración de creación de rama:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (default, sin archivo de config)"`

---

## Instrucciones

### Fases 1 a 4 — Idénticas a /spec-impl

El argumento recibido es: `$ARGUMENTS`

1. Lee completo [.agents/skills/spec-impl/SKILL.md](../../../.agents/skills/spec-impl/SKILL.md). No lo copies ni lo resumas de memoria: ese archivo es la fuente de verdad y puede actualizarse.
2. Ejecuta sus **Fases 1 a 4** al pie de la letra, usando `$ARGUMENTS` como argumento y el contexto de sesión de arriba: identificar la spec, validar que su estado sea "Aprobado", crear/cambiar a la rama `spec-NN-slug`, mostrar el resumen y luego implementar paso a paso con pausas, sin commits automáticos.
3. Si en cualquiera de esas fases `/spec-impl` se detiene (spec no encontrada, estado distinto de Aprobado, árbol sucio sin confirmación, ambigüedad, el usuario pausa o no confirma), **detente aquí también** y **no lances ningún agente**.

### Fase 5 — Agentes posteriores (solo tras el último paso del plan)

Cuando el último paso del plan esté implementado y el usuario lo haya confirmado:

1. Anuncia: `✅ Implementación terminada. Lanzo skin-designer y, cuando termine, mobile-porter.`
2. Reúne el contexto: ruta de la spec, `id` del juego (de la spec y de `ENGINES` en `lib/games/registry.ts`), rama activa y `git diff --stat`.
3. **Agente 1 — `skin-designer`** (`subagent_type: "skin-designer"`, `run_in_background: false`). Prompt: indica el juego recién implementado (`<id>`), la ruta de la spec y la rama; pide auditar y completar sus 3 skins (clásico por default, neón y retro), reportar según su formato y **no hacer commits ni cambiar de rama**.
4. **Espera** a que termine. Muestra al usuario un resumen breve: veredicto, archivos cambiados y pendientes. Si dejó errores de `npx tsc --noEmit` o `npm run lint`, o reportó que no pudo completar su trabajo, **detente y pregunta** al usuario antes de seguir.
5. **Agente 2 — `mobile-porter`** (`subagent_type: "mobile-porter"`, `run_in_background: false`), solo después de que el paso 4 haya terminado. Prompt: indica el juego `<id>`, la spec y la rama; menciona qué cambió `skin-designer` (por ejemplo, un selector de skins en `/jugar/[id]`) para que revise también ese responsive; pide verificar `controlesTactiles` del juego en el registro y el responsive del reproductor, y **no hacer commits ni cambiar de rama**.
6. Muestra un resumen breve de su resultado.

Nunca lances los dos agentes en la misma respuesta: el segundo depende de lo que deje el primero.

### Cierre

Termina con:

- El mensaje final de `/spec-impl`: verificar uno a uno los criterios de aceptación de la spec, marcarlos, actualizar el `Estado` a "Implementado" y hacer el commit antes de fusionar la rama. El commit lo decide el usuario.
- Los pendientes y riesgos de ambos agentes, juntos.
- `git diff --stat` del trabajo total.
