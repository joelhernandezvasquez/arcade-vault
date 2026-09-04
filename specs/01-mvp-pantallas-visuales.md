# 01 — MVP pantallas visuales de Arcade Vault

**Estado:** Implementado
**Depende de:** —
**Fecha:** 2026-09-03
**Objetivo:** Portar a Next.js (App Router, TypeScript, React 19) todas las pantallas visuales del prototipo estático en `references/templates/`, sin implementar ningún juego real ni backend.

## Contexto

Este spec es **retroactivo**: el puerto ya existe en el árbol de trabajo (sin commitear) y reproduce fielmente el prototipo de `references/templates/` (`Arcade Vault.html`, `app.jsx`, `nav.jsx`, `auth.jsx`, `biblioteca.jsx`, `detalle.jsx`, `reproductor.jsx`, `salon.jsx`, `data.jsx`, `styles.css`). El spec formaliza lo construido, deja constancia de las decisiones tomadas al portarlo, y sirve de checklist de verificación — no de plan de construcción desde cero.

## Alcance

**Incluye (ya implementado, a verificar):**
- **Biblioteca** (`app/page.tsx`): grid de juegos, búsqueda por título, filtro por categoría (chips), tarjeta con tilt 3D al pasar el mouse.
- **Detalle de juego** (`app/juego/[id]/page.tsx`): portada, tags, descripción, estadísticas (partidas, mejor global, dificultad), leaderboard del juego, CTA a jugar.
- **Reproductor / partida** (`app/jugar/[id]/page.tsx`): HUD (jugador, puntuación, vidas, nivel), arena animada de mentira (sin lógica de juego real), pausa, fin de partida, guardado de puntuación con iniciales editables.
- **Autenticación** (`app/auth/page.tsx`): tabs iniciar sesión / crear cuenta, modo invitado, botones sociales decorativos.
- **Salón de la Fama** (`app/salon/page.tsx`): tabs por juego, podio (oro/plata/bronce), tabla de ranking, fila destacada con "tu marca" si hay sesión iniciada.
- **Navegación** (`components/Nav.tsx`): logo, links Biblioteca/Salón, contador de créditos decorativo, botón de sesión, menú móvil (hamburguesa + panel deslizante).
- **Datos mock** (`lib/data.ts`): catálogo `GAMES`, categorías `CATS`, generador determinista `seededScores`.
- **Sesión y puntuaciones** (`components/UserProvider.tsx`, `lib/scores.ts`): sesión de usuario y puntuaciones guardadas en `localStorage` (`av_user`, `av_scores`).
- Layout global (`app/layout.tsx`, `app/globals.css`): fondo, ruido de fondo, tipografías (Press Start 2P, JetBrains Mono vía `next/font/google`), footer.

**No incluye (explícitamente fuera de este MVP):**
- Ningún juego jugable de verdad. La "arena" del reproductor es una animación decorativa con puntuación que sube sola por temporizador — no hay mecánica de juego.
- Backend, base de datos o autenticación real. El login acepta cualquier usuario/contraseña sin validar y solo persiste en `localStorage`. Los botones de Google/GitHub son decorativos y no hacen nada.
- Conectar las puntuaciones guardadas (`av_scores`) con las tablas del Salón de la Fama o del detalle de juego — esas tablas siguen mostrando datos ficticios (`seededScores`), no las partidas reales del usuario.
- Créditos/monedas funcionales — el contador "CRÉDITOS · 03" en la nav es decorativo y fijo.
- Cualquier feature no presente en `references/templates/` (perfiles, amigos, chat, multijugador real, etc.).

## Modelo de datos

No se introduce modelo nuevo respecto al prototipo; ya está portado 1:1 a TypeScript:

- `Game` (`lib/data.ts`): `id, title, short, long, cat, cover, color, best, plays`.
- `ScoreRow` (`lib/data.ts`): `rank, name, score, date` — generado por `seededScores(seed, count)`, un PRNG determinista basado en el `id` del juego (no aleatorio real, para que el leaderboard sea estable entre renders).
- `ScoreEntry` (`lib/scores.ts`): `game, score, name` — lo que se guarda en `localStorage["av_scores"]` al terminar una partida (se le añade `at: Date.now()` al guardar).
- `User` (`components/UserProvider.tsx`): `{ name: string }` — persistido en `localStorage["av_user"]`.

## Plan de implementación

El código ya existe y compila; los pasos son de verificación y cierre, no de construcción:

1. **Verificar paridad visual y funcional contra el prototipo**, pantalla por pantalla, comparando `references/templates/*.jsx` con su equivalente en `app/`/`components/`: biblioteca, detalle, reproductor, auth, salón, nav. (Ya revisado en este spec: coinciden en estructura, clases CSS y comportamiento.)
2. **Confirmar `npm run lint` y `npm run build` sin errores.** (Ya verificado: ambos pasan limpio; rutas generadas: `/`, `/auth`, `/juego/[id]`, `/jugar/[id]`, `/salon` + `/_not-found`.)
3. **Probar manualmente en el navegador** (`npm run dev`) el recorrido completo: buscar/filtrar en biblioteca → entrar a detalle → jugar → pausar → terminar partida → guardar puntuación con iniciales → volver al vault; iniciar sesión / modo invitado; navegar al Salón de la Fama y cambiar de tab; menú móvil (viewport angosto).
4. **Probar el caso de borde de id inválido**: visitar `/juego/no-existe` y `/jugar/no-existe` y confirmar que se muestra la 404 real de Next.js.
5. **Commitear el trabajo** una vez verificado (actualmente todo está sin trackear en git).

## Criterios de aceptación

- [x] Las 5 pantallas (biblioteca, detalle, reproductor, auth, salón) están accesibles por URL real y enlazadas entre sí sin rutas rotas.
- [x] La búsqueda y los filtros por categoría en la biblioteca funcionan y muestran el estado "NO HAY RESULTADOS" cuando corresponde.
- [x] El reproductor incrementa puntuación automáticamente, permite pausar/reanudar, y al terminar la partida permite guardar la puntuación con iniciales (persistida en `localStorage`).
- [x] El login (con cualquier usuario/contraseña) y el modo invitado navegan de vuelta a la biblioteca y reflejan el estado de sesión en la nav.
- [x] El Salón de la Fama muestra podio + tabla por cada juego del catálogo, y una fila "tu marca" adicional cuando hay sesión iniciada.
- [x] El menú móvil (hamburguesa) abre/cierra el panel lateral y navega correctamente.
- [x] Visitar un `id` de juego inexistente en `/juego/[id]` o `/jugar/[id]` muestra la página 404 de Next.js.
- [x] `npm run lint` y `npm run build` terminan sin errores.
- [x] Ningún juego real está implementado — el reproductor es puramente decorativo/animado.

## Decisiones tomadas y descartadas

- **Rutas reales de Next.js en vez de SPA por hash** — el prototipo original navegaba con una sola ruta en `location.hash` (`{name, id}` serializado). El puerto usa rutas reales del App Router (`/`, `/juego/[id]`, `/jugar/[id]`, `/auth`, `/salon`). Confirmado como decisión definitiva: es el patrón idiomático de Next.js y permite URLs compartibles y la 404 nativa.
- **Sesión y puntuaciones en `localStorage`, sin backend** — igual que el prototipo; no hay persistencia entre dispositivos ni servidor. Es consistente con el alcance "solo la parte visual".
- **Leaderboards no conectados a las puntuaciones reales guardadas** — el Salón de la Fama y el detalle de juego siguen usando `seededScores` (datos ficticios deterministas), no `av_scores`. Se deja así intencionalmente para este MVP; conectar ambas fuentes queda fuera de alcance y podría ser un spec futuro.
- **404 real de Next.js para `id` inválido** — el prototipo original simplemente no renderizaba nada (`return null`) si el juego no existía. El puerto usa `notFound()` de Next.js, que muestra una página 404 real. Se confirma como mejora intencional sobre el comportamiento original.
- **Auth completamente falso** — cualquier usuario/contraseña "inicia sesión"; los botones de Google/GitHub son decorativos sin handler. Aceptado tal cual para el MVP visual, sin estados deshabilitados adicionales.
- **Tailwind v4 (`@import "tailwindcss"` + `@theme inline`) por encima del CSS del prototipo** — `app/globals.css` es el `styles.css` original casi sin cambios, con la capa de theming de Tailwind v4 añadida encima para exponer las custom properties como tokens (`--color-*`, `--font-*`). No se reescribió el CSS a utilities de Tailwind.
- **Fuentes vía `next/font/google`** en vez de `<link>` a Google Fonts — mismo resultado visual (Press Start 2P, JetBrains Mono), pero autoalojadas y optimizadas por Next.js.

## Riesgos identificados

- Como no hay commits del trabajo hecho hasta ahora, cualquier operación destructiva de git antes de commitear perdería el puerto completo. Se recomienda commitear apenas se cierre la verificación del paso 3 del plan de implementación.
