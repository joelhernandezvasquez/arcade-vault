# 03 — Acerca de + envío real de correo de contacto

**Estado:** Implementado
**Depende de:** SPEC 01, SPEC 02
**Fecha:** 2026-09-09
**Objetivo:** Portar la pantalla "Acerca de" (`about.jsx`) del prototipo en `references/templates/home-about/` a `/acerca-de`, reemplazando la animación de terminal simulada del formulario de contacto por un envío real de correo vía Resend a `joelh3386@gmail.com`.

## Contexto

El template de referencia trae `about.jsx` con dos secciones: un hero "Acerca de" y un formulario de contacto que, al enviarse, solo simula una terminal de éxito (`setSent(...)`) sin hacer ninguna llamada de red. El spec 02 dejó esta pantalla explícitamente fuera de su alcance. Este spec la incorpora y, a diferencia del template, conecta el formulario a un envío de correo real, ya que hoy no existe ninguna pieza de backend/API en el proyecto (todo — incluida la pantalla de auth — es puramente client-side y simulado).

## Alcance

**Incluye:**
- Nueva pantalla en `app/acerca-de/page.tsx`, portando `about.jsx` tal cual: hero "ACERCA DE ARCADE VAULT" con `highlight-row` (3 tarjetas: HEART/BROWSER/PLANT), divisor de píxeles animado, y sección de contacto (`contact-intro` + formulario).
- CSS de la sección `/* ===== ABOUT PAGE ===== */` de `references/templates/home-about/styles.css` (líneas ~1071–1140: `.about-hero`, `.about-title`, `.about-mission`, `.highlight-row`/`.highlight`, `.about-divider`/`.div-pixels`, `.about-contact`/`.contact-grid`/`.contact-form`, `.terminal-success`/`.term-bar`/`.term-body` y su animación `shake`/`pxblink`) portado a `app/globals.css`, igual que el resto de estilos ya portados en specs 01 y 02.
- Animación "reveal on scroll" del template (`IntersectionObserver` + clases `.reveal`/`.in`) portada igual que en `about.jsx`.
- Nuevo endpoint `app/api/contact/route.ts` (Route Handler, `POST`) que recibe `{ name, email, msg }`, valida que los tres campos no estén vacíos y que `email` tenga formato válido, y usa el SDK de **Resend** para enviar un correo a `joelh3386@gmail.com` con el remitente `onboarding@resend.dev`, asunto tipo `Nuevo mensaje de contacto — Arcade Vault` y el nombre/email/mensaje del formulario en el cuerpo. Responde `200` en éxito o `4xx/5xx` con un mensaje de error en JSON si falla (validación, falta la API key, o error de Resend).
- Dependencia nueva `resend` agregada a `package.json`.
- El formulario de `about/page.tsx` pasa de simular con `setTimeout` a hacer `fetch("/api/contact", { method: "POST", body: JSON.stringify(form) })` real:
  - Mientras la petición está en curso, el botón "ENVIAR MENSAJE" muestra un estado de carga (ej. `ENVIANDO…`) y se deshabilita.
  - Si la API responde éxito, se muestra la `terminal-success` tal como en el template (líneas `[OK] Conectando…`, `[OK] Validando…`, `[OK] Transmitiendo…`, línea final con el nombre del usuario).
  - Si la API responde error (o el `fetch` falla por red), se muestra la misma `terminal-success` pero con una línea final de error en rojo (ej. `[ERROR] NO SE PUDO ENVIAR EL MENSAJE. INTÉNTALO DE NUEVO.`) en vez de la línea de éxito, y un botón para volver al formulario sin perder lo escrito (`name`/`email`/`msg` se conservan).
  - La validación de campos vacíos (shake) se mantiene igual que en el template, corre en el cliente antes de llamar a la API.
- `RESEND_API_KEY` leída desde `process.env.RESEND_API_KEY` en el Route Handler. Se crea `.env.local.example` documentando esta variable (sin valor real). El `.env.local` real (con la key verdadera) no se crea ni se commitea — el usuario lo crea localmente con su propia key de Resend antes de probar el envío real.
- `components/Nav.tsx`: se agrega el link "Acerca de" apuntando a `/acerca-de`, tanto en el menú de escritorio como en el panel móvil, y se ajusta `isActive()` para reconocer la nueva sección.

**No incluye (explícitamente fuera de este spec):**
- Verificar un dominio propio en Resend — se usa `onboarding@resend.dev` como remitente por ahora.
- Rate limiting, protección anti-spam (captcha, honeypot) o almacenamiento de los mensajes recibidos — el mensaje solo se envía por correo, no se persiste en ningún lado.
- Cambios a Home, Biblioteca, Detalle, Reproductor, Auth o Salón más allá del link nuevo en Nav.
- Internacionalización o soporte de otro idioma en la pantalla.
- Tests automatizados del endpoint (el proyecto no tiene test runner configurado).

## Modelo de datos

No se introduce modelo de datos persistente. El único "dato" nuevo es el payload transitorio del formulario de contacto (`{ name: string, email: string, msg: string }`), que viaja del cliente al Route Handler y de ahí a Resend, sin guardarse en ningún archivo, base de datos ni `lib/`.

## Plan de implementación

1. Instalar la dependencia `resend` (`npm install resend`).
2. Crear `.env.local.example` en la raíz del proyecto con la línea `RESEND_API_KEY=` y un comentario explicando que se debe copiar a `.env.local` con una API key real de Resend para que el envío funcione.
3. Crear `app/api/contact/route.ts`: valida el body (`name`, `email`, `msg` no vacíos y `email` con formato válido), instancia `Resend` con `process.env.RESEND_API_KEY`, envía el correo a `joelh3386@gmail.com` desde `onboarding@resend.dev`, y devuelve JSON `{ ok: true }` o `{ ok: false, error: string }` con el status HTTP correspondiente.
4. Crear `app/acerca-de/page.tsx` portando `about.jsx` (hero, highlight-row, divisor, sección de contacto), adaptando el `onSubmit` del formulario para llamar a `fetch("/api/contact", ...)` con estados `idle | sending | success | error`, y portando `HighlightIcon` como parte del mismo archivo (igual patrón que `FeatureIcon`/`FloatingSilhouettes` en la Home del spec 02).
5. Portar la sección `/* ===== ABOUT PAGE ===== */` completa de `references/templates/home-about/styles.css` a `app/globals.css`.
6. Actualizar `components/Nav.tsx`: agregar "Acerca de" (`/acerca-de`) a los links de escritorio y al panel móvil, y sumar el caso correspondiente en `isActive()`.
7. Correr `npm run lint` y `npm run build`, confirmar que no hay errores y que la ruta `/acerca-de` aparece entre las rutas generadas.
8. Probar manualmente en el navegador (`npm run dev`), con y sin `RESEND_API_KEY` configurada en `.env.local`:
   - Sin completar todos los campos → el formulario hace shake y no llama a la API.
   - Con campos completos y `RESEND_API_KEY` válida → el botón muestra "ENVIANDO…", luego aparece la terminal de éxito, y llega un correo real a `joelh3386@gmail.com`.
   - Con campos completos y sin `RESEND_API_KEY` (o key inválida) → aparece la terminal con la línea de error, y el botón "volver" conserva lo escrito.
   - El link "Acerca de" del Nav funciona en escritorio y en el panel móvil, y queda marcado activo en `/acerca-de`.

## Criterios de aceptación

- [x] `/acerca-de` muestra el hero, las 3 highlight-cards, el divisor animado y la sección de contacto, con el mismo diseño visual que `about.jsx`/`styles.css` del template.
- [x] El Nav (escritorio y móvil) incluye el link "Acerca de" apuntando a `/acerca-de`, marcado activo solo en esa ruta.
- [x] Enviar el formulario con campos vacíos dispara el shake y no hace ninguna petición de red.
- [x] Enviar el formulario con campos válidos y `RESEND_API_KEY` configurada envía un correo real a `joelh3386@gmail.com` con nombre, email y mensaje, y muestra la terminal de éxito.
- [x] Enviar el formulario cuando la API falla (sin key, key inválida, o error de Resend) muestra la terminal con una línea de error visible y permite reintentar sin perder lo escrito.
- [x] `.env.local.example` documenta `RESEND_API_KEY` sin exponer ningún valor real; no se commitea ningún `.env.local` con secretos.
- [x] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones tomadas y descartadas

- **Envío real vía Resend en vez de solo la animación simulada del template** — se decidió explícitamente ir más allá del prototipo (que no hace ninguna llamada de red) porque el pedido del usuario fue implementar el envío de correo, no solo portar la UI. Se prefirió Resend sobre Nodemailer+SMTP por tener un SDK más simple y no depender de credenciales de un proveedor de correo externo.
- **Remitente `onboarding@resend.dev`** — se descartó exigir un dominio propio verificado en Resend porque el proyecto no tiene uno configurado; se deja como mejora futura cuando exista un dominio real.
- **Error mostrado dentro de la misma terminal simulada** — se prefirió mantener la estética de terminal del template (agregando una línea de error) en vez de un mensaje de error genérico fuera de ella, para no romper la identidad visual retro de la pantalla.
- **Sin persistencia de los mensajes recibidos** — se descartó guardar los mensajes de contacto en algún archivo o base de datos porque no fue parte de lo pedido; el correo es el único registro del mensaje.
- **`.env.local.example` en vez de commitear la key real** — la API key de Resend es un secreto; nunca debe ir al repositorio. El archivo de ejemplo documenta la variable sin exponer ningún valor.

## Riesgos identificados

- Si el usuario no crea `.env.local` con una `RESEND_API_KEY` real antes de probar, el envío real fallará (comportamiento esperado y cubierto por el estado de error de la UI).
- Usar `onboarding@resend.dev` como remitente puede hacer que algunos clientes de correo marquen el mensaje como menos confiable o lo etiqueten "vía resend.dev"; se acepta como limitación temporal hasta verificar un dominio propio.
- Sin rate limiting, el endpoint podría recibir envíos repetidos o abusivos; se acepta el riesgo por ahora dado que el proyecto está en desarrollo y sin tráfico público real.
