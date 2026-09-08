# 02 — Home / landing page de Arcade Vault

**Estado:** Approvado
**Depende de:** SPEC 01
**Fecha:** 2026-09-08
**Objetivo:** Portar a Next.js la pantalla de inicio (`home.jsx`) del prototipo en `references/templates/home-about/`, moviendo la Biblioteca actual de `/` a `/biblioteca` y dejando la Home como landing en `/`, sin tocar la pantalla "Acerca de".

## Contexto

Hoy `/` sirve el contenido de Biblioteca (portado en spec 01). El template de referencia (`home-about/nav.jsx`) asume dos pantallas separadas — "Inicio" y "Biblioteca" — con links propios en la navegación. Este spec introduce esa separación: la Home pasa a ser la landing en `/`, y la Biblioteca existente se reubica en `/biblioteca` sin cambios funcionales.

## Alcance

**Incluye:**
- Nueva pantalla Home en `app/page.tsx`, con las secciones de `home-about/home.jsx` en el mismo orden: hero (con silhouettes flotantes SVG y scroll indicator), "¿Por qué Arcade Vault?" (4 feature cards), vista previa de juegos (6 primeros de `GAMES`), stats, actividad en vivo (ticker de puntuaciones + top jugadores), pricing (plan único + FAQ), CTA final.
- Mover el contenido actual de `app/page.tsx` (Biblioteca) a `app/biblioteca/page.tsx`, sin cambios de comportamiento.
- Actualizar `components/Nav.tsx`: agregar link "Inicio" (apunta a `/`), cambiar el link "Biblioteca" para apuntar a `/biblioteca`, y ajustar `isActive()` para que "Inicio" solo esté activo en `/` y "Biblioteca" en `/biblioteca`, `/juego/*` y `/jugar/*` (igual lógica que hoy, solo cambia la ruta base).
- Actualizar todos los botones "volver"/"volver a la biblioteca" que hoy navegan a `"/"` (`app/salon/page.tsx`, `app/juego/[id]/page.tsx`, `app/jugar/[id]/page.tsx`, `app/auth/page.tsx` tras login/invitado) para que naveguen a `"/biblioteca"`, ya que semánticamente vuelven a la biblioteca, no a la landing.
- Los CTAs de la Home mapean 1:1 a rutas reales existentes: "Explorar juegos" / "Ver todos los juegos" / CTA final → `/biblioteca`; "Crear cuenta" / "Empezar gratis" → `/auth`; "Ver salón" → `/salon`; cada mini-card de juego → `/juego/[id]`.
- Componente `FloatingSilhouettes` y `FeatureIcon` (SVGs pixel-art decorativos) portados tal cual desde `home.jsx`, como parte de la Home (no se extraen a `components/` compartidos salvo que ya exista un patrón similar — se colocan junto a la Home).
- Animación "reveal on scroll" (`useReveal`, `IntersectionObserver` + clase `.reveal`/`.in`) portada igual que en el template. El CSS de esta pantalla (sección `HOME PAGE` de `styles.css`) ya está portado en `app/globals.css` por el spec 01 y no requiere cambios.
- Stats, ticker de "actividad en vivo" y "top jugadores" del día: se portan **hardcodeados con los mismos valores de ejemplo** del template (no se generan con `seededScores` ni se conectan a datos reales), igual que el resto de datos decorativos del proyecto.

**No incluye (explícitamente fuera de este spec):**
- La pantalla "Acerca de" (`about.jsx`) — queda fuera aunque esté en la misma carpeta de referencia.
- Conectar el ticker de actividad o el top de jugadores a datos reales o a `av_scores` (`lib/scores.ts`).
- Cualquier cambio a Biblioteca, Detalle, Reproductor, Auth o Salón más allá de las rutas de navegación mencionadas arriba.
- Créditos/monedas funcionales, backend, o nueva persistencia — nada de esto se introduce en la Home.

## Modelo de datos

No se introduce modelo nuevo. La Home reutiliza `Game` y `GAMES` de `lib/data.ts` (ya existente) para la sección de vista previa de juegos. Los valores de `stats`, el ticker de actividad y el top de jugadores son arrays literales locales dentro del componente Home (igual que en `home.jsx`), sin tipo ni archivo propio.

## Plan de implementación

1. Crear `app/biblioteca/page.tsx` con el contenido actual de `app/page.tsx` (Biblioteca), sin modificar su lógica.
2. Reemplazar `app/page.tsx` con la nueva Home, portando `home-about/home.jsx` (hero, why-cards, preview de juegos, stats, actividad en vivo, pricing, CTA final, `FloatingSilhouettes`, `FeatureIcon`, `useReveal`), adaptando `navigate({name,...})` del prototipo a `router.push(...)` de Next.js según el mapeo de rutas descrito en Alcance.
3. Actualizar `components/Nav.tsx`: agregar "Inicio" (`/`) a los links de escritorio y al panel móvil, cambiar "Biblioteca" a `/biblioteca`, y ajustar `isActive()`.
4. Actualizar las referencias a `router.push("/")` en `app/salon/page.tsx`, `app/juego/[id]/page.tsx`, `app/jugar/[id]/page.tsx` y `app/auth/page.tsx` para que apunten a `/biblioteca`.
5. Correr `npm run lint` y `npm run build`, confirmar que no hay errores y que las rutas generadas incluyen `/` (Home) y `/biblioteca` (Biblioteca).
6. Probar manualmente en el navegador (`npm run dev`): la Home carga en `/`, sus animaciones de scroll-reveal funcionan, todos sus CTAs navegan a la ruta correcta, el Nav marca "Inicio" activo en `/` y "Biblioteca" activo en `/biblioteca` y en las pantallas de detalle/reproductor, y los botones "volver" desde salón/detalle/reproductor/auth llevan a `/biblioteca`.

## Criterios de aceptación

- [ ] `/` muestra la Home del template (`home.jsx`) con sus 7 secciones en el mismo orden, y `/biblioteca` muestra exactamente lo que hoy muestra `/`.
- [ ] El Nav muestra "Inicio" y "Biblioteca" como links separados; "Inicio" está activo solo en `/`, "Biblioteca" está activo en `/biblioteca`, `/juego/[id]` y `/jugar/[id]`.
- [ ] Todos los CTAs de la Home navegan a la ruta correcta (`/biblioteca`, `/auth`, `/salon`, `/juego/[id]`).
- [ ] Las silhouettes flotantes del hero y las feature-cards se ven y animan igual que en el prototipo (glow, hover, reveal-on-scroll al hacer scroll).
- [ ] Los botones "volver"/"volver a la biblioteca" en salón, detalle, reproductor y auth navegan a `/biblioteca`, no a `/`.
- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] La pantalla "Acerca de" no se toca ni se crea en este spec.

## Decisiones tomadas y descartadas

- **Home en `/`, Biblioteca movida a `/biblioteca`** — se prefirió sobre mantener Biblioteca en `/` y poner Home en `/inicio`, porque coincide con el patrón del template (Nav con links "Inicio"/"Biblioteca" separados) y con la convención habitual de que la landing vive en la raíz.
- **Nav actualizado como parte de este spec** — sin el link "Inicio" la nueva Home solo sería alcanzable por el logo, lo cual la deja prácticamente oculta; se decidió incluir el cambio de Nav en el alcance en vez de dejarlo para un spec aparte.
- **Stats y actividad en vivo hardcodeados, no generados** — se descartó usar `seededScores()` para el ticker y el top de jugadores porque el pedido fue seguir el template "estrictamente"; generar esos datos dinámicamente introduciría lógica ausente en la referencia. Queda como posible mejora futura conectar esta sección a datos reales.
- **Botones "volver" reapuntados a `/biblioteca`** — como la Biblioteca cambia de URL, cualquier botón que hoy vuelve a `"/"` con intención de "volver al catálogo" debe apuntar a `/biblioteca` para no aterrizar accidentalmente en la nueva landing.

## Riesgos identificados

- Cualquier enlace externo o marcador que apunte a `/` esperando ver la Biblioteca dejará de funcionar como antes (ahora verá la Home). No hay enlaces externos reales todavía (proyecto en desarrollo), así que el impacto es nulo por ahora.
