# 11 — Sistema de skins para los juegos (piloto: ASTEROIDS)

**Estado:** Implementado (pendiente de validación visual manual)
**Depende de:** SPEC 07 (motor genérico y registro de juegos), SPEC 05 (Asteroids)
**Fecha:** 2026-10-07
**Objetivo:** Crear el sistema de skins compartido (`clasico`, `neon`, `retro`) y aplicarlo a Asteroids como piloto, de forma que Caída, Bloque Buster y Serpentina puedan adoptarlo después sin tocar la infraestructura.

## Contexto

Hasta esta spec no existía ningún concepto de skin: los cuatro motores tienen colores literales dentro de su código. Todo juego jugable debe ofrecer al menos tres skins:

| Skin    | Id        | Identidad                                                                  | Rol                            |
| ------- | --------- | -------------------------------------------------------------------------- | ------------------------------ |
| clásico | `clasico` | Fiel al juego original, paleta sobria, sin efectos añadidos.               | Default                        |
| neón    | `neon`    | Colores saturados del tema (`--cyan`, `--magenta`, `--yellow`, `--green`). | Alternativa, trazos con brillo |
| retro   | `retro`   | 8-bit: paleta reducida, píxeles gruesos, sin suavizado ni degradados.      | Alternativa                    |

Esta spec crea el sistema y adopta solo Asteroids. Los demás motores no se modifican: al no declarar `skins` en su `GameDefinition`, el reproductor no muestra selector para ellos.

## Alcance

**Incluye:**

- `lib/games/types.ts`: `SkinId`, `SkinDefinition` (`id`, `nombre`, `paleta`, `brillo`, `suavizado`, `pixelado`, `grosorLinea`, `desvanecer`), `GameEngine.setSkin?(id)` opcional, `GameDefinition.skins?: SkinId[]` y `create(canvas, skin?)`.
- `lib/games/skins.ts`: paletas base de las 3 skins, `SKIN_IDS`, `DEFAULT_SKIN`, `getSkin(id)`, `grosorTrazo()`, y persistencia (`leerSkinGuardada`, `guardarSkin`) en `localStorage` bajo `av_skin`, con `try/catch` y `clasico` por defecto. Sin Supabase.
- `components/games/GameCanvas.tsx`: prop `skin`; la entrega al motor al crearlo y en caliente (`setSkin`) sin recrearlo.
- `app/jugar/[id]/page.tsx`: selector de skin (clases `chip` / `av-chips`) visible solo si el juego declara `skins`.
- `lib/games/asteroids.ts`: todos los colores y efectos salen de la skin activa; `setSkin()` en caliente.
- `lib/games/registry.ts`: `asteroids` declara `skins: SKIN_IDS`.

**No incluye:** cambios en Caída; migraciones o cambios de catálogo; skins por juego persistidas por separado (la elección es única y global); sprites nuevos (Asteroids se dibuja solo con primitivas).

## Modelo de datos

La elección vive en `localStorage["av_skin"]` (string con un `SkinId`). Cualquier valor inválido o error de almacenamiento resuelve a `clasico`. No hay estado de módulo: cada motor guarda su skin activa como campo de instancia.

## Reglas para los motores

- Con `clasico` el resultado visual es idéntico al previo a esta spec.
- `neon`: glow con `shadowBlur`, siempre dentro de `save()`/`restore()` para no filtrarlo al resto del frame.
- `retro`: `imageSmoothingEnabled = false`; se dibuja a baja resolución (lienzo lógico / `pixelado`) y se amplía sin suavizado; sin alfa en efectos (`desvanecer: false`).
- Cambiar de skin no reinicia la partida ni dispara `onStateChange`. Estando en pausa, se redibuja el frame congelado con la nueva skin.

## Criterios de aceptación

- [x] `SkinId`, `SkinDefinition`, `setSkin?` y `GameDefinition.skins?` existen en `lib/games/types.ts`.
- [x] `lib/games/skins.ts` define `clasico`, `neon` y `retro`, con `clasico` como default.
- [x] La skin se persiste en `av_skin` con `try/catch` y fallback a `clasico`.
- [x] El reproductor muestra un selector de skin solo para juegos que declaran `skins`.
- [x] Asteroids no tiene colores literales fuera de la skin activa.
- [x] Asteroids con `clasico` se ve idéntico a antes.
- [ ] Asteroids con `neon` muestra trazos con brillo y colores del tema (validación visual).
- [ ] Asteroids con `retro` muestra píxeles gruesos, sin suavizado ni degradados (validación visual).
- [ ] Cambiar de skin en caliente (jugando y en pausa) no reinicia la partida (validación manual).
- [x] Bloque Buster y Serpentina adoptaron el sistema con las 3 skins (neón y retro con tratamiento de canvas, sin assets nuevos).
- [ ] Caída sigue sin skins.
- [ ] Bloque Buster y Serpentina con `neon` y `retro` (validación visual).
- [x] `npx tsc --noEmit`, `npm run lint` y `npm run build` terminan sin errores nuevos.

## Decisiones tomadas y descartadas

- **Elección global única en `av_skin`** en vez de una por juego: más simple y coherente al adoptarse en más motores. Descartado: clave por juego.
- **`setSkin` opcional en `GameEngine`** en vez de reiniciar el motor: reiniciar perdería la partida.
- **Retro por render a baja resolución** (lienzo auxiliar escalado con `imageSmoothingEnabled = false`) en vez de recortar coordenadas: logra píxeles gruesos reales sin tocar la física.
- **Colores del tema copiados como constantes** en `skins.ts`: el canvas no lee variables CSS de forma síncrona y barata; se comenta su origen en `app/globals.css`.

## Riesgos identificados

- El antialiasing del lienzo auxiliar de retro puede dejar píxeles de borde semitransparentes; se valida visualmente.
- El texto `3x` del power-up en retro es pequeño a baja resolución; se usa una fuente mayor.
- El glow de neón con muchas partículas puede costar rendimiento en equipos lentos.
