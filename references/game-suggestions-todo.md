# Sugerencias de juegos — TODO

**Última actualización:** 2026-10-06

Estados: `propuesto` | `aceptado` | `rechazado` | `implementado` (spec NN). Esfuerzo: S / M / L.

## Estado actual de la plataforma

- Jugables (motor en `ENGINES`): `asteroids` (SHOOTER), `caida` (PUZZLE), `bloque-buster` (ARCADE), `serpentina` (ARCADE).
- Decorativas (en el catálogo, sin motor, puntaje simulado): `gloton` (ARCADE), `invasores` (SHOOTER), `ranaria` (ARCADE), `duelo-pixel` (VERSUS).
- Hueco principal: VERSUS no tiene ningún juego jugable. PUZZLE tiene un solo juego.
- Todas las carpetas de `references/started-games/` ya están portadas, así que los juegos nuevos se construyen desde cero.

## Propuestas

### 1. Invasores (Space Invaders) — reemplaza `invasores`

- **Estado:** propuesto
- **Categoría:** SHOOTER · **Origen:** desde cero · **Catálogo:** `UPDATE` de la fila existente · **Esfuerzo:** S–M
- **Por qué:** es el más barato de los cuatro, porque reutiliza lo ya hecho en Asteroids (disparo, colisiones, vidas) y Bloque Buster (movimiento horizontal, niveles). Tiene vidas, oleadas y un puntaje claro para el leaderboard. Da vida a una entrada decorativa.
- **Riesgos:** pocos. Hay que cuidar el ritmo de aceleración de la formación y los controles de teclado.
- **Comando:** `/add-game Invasores (Space Invaders) desde cero, reemplaza la entrada 'invasores'`

### 2. Duelo Pixel (Pong) — reemplaza `duelo-pixel`

- **Estado:** propuesto
- **Categoría:** VERSUS · **Origen:** desde cero · **Catálogo:** `UPDATE` · **Esfuerzo:** M
- **Por qué:** es el único juego que llenaría VERSUS. Mecánica mínima y reutiliza la física de pelota de Bloque Buster.
- **Riesgos:** el leaderboard encaja mal (la entrada decorativa muestra `best: 24`, así que habría que definir qué es el puntaje, por ejemplo racha de victorias contra la CPU). Necesita una IA de CPU y decidir si hay modo local a dos jugadores con un solo teclado.
- **Comando:** `/add-game Duelo Pixel (Pong) desde cero con CPU, reemplaza la entrada 'duelo-pixel'`

### 3. Glotón (Pac-Man) — reemplaza `gloton`

- **Estado:** propuesto
- **Categoría:** ARCADE · **Origen:** desde cero · **Catálogo:** `UPDATE` · **Esfuerzo:** L
- **Por qué:** es el más reconocible del catálogo y su puntaje funciona bien en el leaderboard.
- **Riesgos:** es el más caro. Necesita laberinto, IA de cuatro fantasmas con modos (persecución, dispersión, asustados) y píldoras. Ya hay dos juegos ARCADE jugables, así que no mejora el balance de categorías.
- **Comando:** `/add-game Glotón (Pac-Man) desde cero, reemplaza la entrada 'gloton'`

### 4. Ranaria (Frogger) — reemplaza `ranaria`

- **Estado:** propuesto
- **Categoría:** ARCADE · **Origen:** desde cero · **Catálogo:** `UPDATE` · **Esfuerzo:** M
- **Por qué:** mecánica distinta a las ya implementadas (cruzar carriles con obstáculos móviles y troncos).
- **Riesgos:** la mecánica de los troncos (la rana se mueve con ellos) y la colisión con el río requieren cuidado. Tercer juego ARCADE.
- **Comando:** `/add-game Ranaria (Frogger) desde cero, reemplaza la entrada 'ranaria'`

## Orden recomendado

1. Invasores (menor esfuerzo, menor riesgo).
2. Duelo Pixel (cierra el hueco de VERSUS; antes hay que definir el puntaje).
3. Ranaria.
4. Glotón (el de mayor esfuerzo).

## Ideas nuevas (no están en el catálogo)

19 ideas propuestas el 2026-10-06 por el agente `game-planner` (una instancia por categoría). Todas serían `INSERT` nuevos en `games` (`sort_order` 9 en adelante) y se construyen desde cero. Estado de todas: `propuesto`. Las notas de reutilización de código se basan en CLAUDE.md y las migraciones; los agentes no abrieron los motores, así que hay que verificarlas antes de implementar.

Los colores de acento sugeridos intentan repartir la paleta (magenta es el menos usado).

### ARCADE

| Juego          | Inspiración   | Esfuerzo | Color   | Notas                                                                                |
| -------------- | ------------- | -------- | ------- | ------------------------------------------------------------------------------------ |
| Cavernas       | Dig Dug       | M        | magenta | Grilla de Serpentina. La tierra mutable debe vivir en la instancia. IA de monstruos. |
| Salto Neón     | Q*bert        | M        | yellow  | Render isométrico propio. Puntaje por cubo pintado y bonus de tiempo.                |
| Pista Turbo    | Pole Position | M        | cyan    | Pseudo-3D por segmentos. El riesgo es la sensación de manejo. Puntaje por distancia. |
| Piedra Rodante | Boulder Dash  | L        | green   | Física de rocas por celdas y niveles diseñados a mano. El más grande del lote.       |

### PUZZLE

| Juego                     | Inspiración | Esfuerzo | Color   | Notas                                                                                                         |
| ------------------------- | ----------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| Gemas (`gemas`)           | Bejeweled   | M        | cyan    | Reutiliza la grilla de Caída. Necesita modo teclado (cursor + espacio). Modo de 60 s o movimientos limitados. |
| Fusión (`fusion`)         | 2048        | S–M      | yellow  | Puntaje nativo por fusiones. Poco riesgo técnico. No es estrictamente arcade.                                 |
| Eco (`eco`)               | Simon       | S        | magenta | El más barato. Teclado con flechas o QWER. Puntaje por longitud de secuencia.                                 |
| Minas Neón (`minas-neon`) | Buscaminas  | S–M      | yellow  | Mouse con alternativa de teclado. Puntaje inverso al tiempo. El primer clic nunca es mina.                    |
| Caja Neón (`caja-neon`)   | Sokoban     | M        | green   | 8–10 niveles resolubles, deshacer con Z. `lives` en `null`.                                                   |

### SHOOTER

| Juego                       | Inspiración     | Esfuerzo | Color   | Notas                                                                                    |
| --------------------------- | --------------- | -------- | ------- | ---------------------------------------------------------------------------------------- |
| Cometa Rojo (`cometa-rojo`) | Galaga          | M        | magenta | Comparte código con Invasores. Hacer Invasores primero. Difícil: trayectorias de picada. |
| Cañón Orbital               | Missile Command | M        | yellow  | Control con puntero (conversión a coordenadas lógicas 4:3). Explosiones en cadena.       |
| Tormenta Vertical           | 1942            | M–L      | cyan    | Oleadas basadas en datos, power-ups y jefes.                                             |
| Cielo Cero                  | Defender        | L        | green   | Mundo envolvente y muchas teclas. El más caro y arriesgado.                              |
| Torreta Fantasma            | Galería de tiro | S        | magenta | Puntero, carriles y munición. El menos fiel a un clásico concreto.                       |

### VERSUS

Todas deben funcionar contra CPU o en local, porque el leaderboard es individual.

| Juego                           | Inspiración     | Esfuerzo | Color   | Notas                                                                                                                                        |
| ------------------------------- | --------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Láser Tronero (`laser-tronero`) | Tron            | S–M      | green   | Reutiliza casi todo Serpentina con un rival CPU. Puntaje por segundo sobrevivido y ronda ganada. Primera opción para cerrar el hueco VERSUS. |
| Tanqueta (`tanqueta`)           | Combat          | M        | magenta | Disparos y rotación de Asteroids. Laberinto fijo e IA básica.                                                                                |
| Hockey Neón                     | Air Hockey      | M        | cyan    | Se parece a Duelo Pixel: no implementarlos seguidos. Física de disco círculo-círculo.                                                        |
| Arena de Duelistas              | Joust           | L        | yellow  | Física de aleteo e IA con varios comportamientos.                                                                                            |
| Fútbol Neón                     | Sensible Soccer | M–L      | magenta | Limitar a 1v1 o 2v2. IA de equipo.                                                                                                           |

### Observaciones

- Ciclos de Luz (propuesto para ARCADE) y Láser Tronero (VERSUS) eran el mismo juego (Tron). Se dejó solo Láser Tronero.
- Cañón Orbital, Torreta Fantasma, Gemas y Minas Neón dependen del mouse, que ningún motor actual usa. Si se elige uno, el siguiente se abarata.
- Recomendaciones: Láser Tronero (menor esfuerzo, cierra VERSUS) y Gemas (refuerza PUZZLE).

## Historial de decisiones

_Sin decisiones todavía. Actualiza el estado de cada propuesta cuando se acepte, se rechace o se implemente, con la razón._
