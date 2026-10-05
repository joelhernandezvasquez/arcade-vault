# Implemented games

The playable games in Arcade Vault: entries in the Supabase `games` table that have an engine registered in [lib/games/registry.ts](../lib/games/registry.ts).

Snapshot date: 2026-10-05.

## Summary

There are **4** implemented games, each with a real engine registered in `ENGINES`.

| ID              | Title         | Category | Spec                                                                                                  |
| --------------- | ------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `bloque-buster` | BLOQUE BUSTER | ARCADE   | [09](../specs/09-juego-bloque-buster.md)                                                              |
| `caida`         | CAÍDA         | PUZZLE   | [08](../specs/08-juego-caida.md)                                                                      |
| `serpentina`    | SERPENTINA    | ARCADE   | [10](../specs/10-juego-serpentina.md)                                                                 |
| `asteroids`     | ASTEROIDS     | SHOOTER  | [05](../specs/05-juego-rocas-asteroides.md), [07](../specs/07-motor-generico-y-registro-de-juegos.md) |

All engines implement the shared `GameEngine` contract in [lib/games/types.ts](../lib/games/types.ts) and draw at a logical resolution of 800×600 that CSS scales to the 4:3 player screen. They don't draw their own HUD, pause screen, or game-over screen; the player page at `/jugar/<id>` provides those.

## Games

### Bloque Buster (`bloque-buster`)

> Rebota la pelota y destruye muros de neón.

Breakout/Arkanoid, ported from [started-games/04-arkanoid](started-games/04-arkanoid/).

- **Engine:** [lib/games/bloque-buster.ts](../lib/games/bloque-buster.ts) (`BloqueBusterGame`)
- **Controls:** `←` / `→` or the mouse move the paddle. `↑` and `↓` are blocked so the page doesn't scroll.
- **Lives:** 3. You lose one when the ball falls past the paddle.
- **Scoring:** 10 points per block.
- **Levels:** 5 fixed layouts, with ball speed rising from ×1.0 to ×1.46. Clearing a layout loads the next one, and clearing level 5 ends the game.
- **Assets:** [public/games/bloque-buster/spritesheet-breakout.png](../public/games/bloque-buster/spritesheet-breakout.png)

### Caída (`caida`)

> Encaja las piezas antes de que el techo te aplaste.

Tetris, ported from [started-games/03-tetris](started-games/03-tetris/).

- **Engine:** [lib/games/caida.ts](../lib/games/caida.ts) (`CaidaGame`)
- **Controls:** `←` / `→` move the piece, `↓` drops it one row, `↑` or `X` rotates it (with wall kicks), and `Space` drops it all the way.
- **Lives:** none (`lives: null`). The game ends when a new piece can't spawn.
- **Scoring:**
  - Clearing lines scores 100, 300, 500 or 800 for 1–4 lines, multiplied by the level.
  - A soft drop adds 1 point per row.
  - A hard drop adds 2 points per row.
- **Levels:** the level goes up by one every 10 lines cleared, and pieces fall faster.
- **Board:** 10×20 cells, centered on the canvas, with side panels that the canvas draws itself (such as the next piece).
- **Assets:** none.

### Serpentina (`serpentina`)

> Come frutas, crece y no te muerdas la cola.

Snake, built from scratch with the sprites in [snake-assets/](snake-assets/).

- **Engine:** [lib/games/serpentina.ts](../lib/games/serpentina.ts) (`SerpentinaGame`)
- **Controls:** the arrow keys or `W` `A` `S` `D`. Up to 2 turns are queued between moves. Keys are ignored while you're typing in a text field, such as the name field on the game-over screen.
- **Lives:** none (`lives: null`). Hitting the edge or the snake's own body ends the game.
- **Scoring:** 10 points per fruit.
- **Levels:** the level goes up every 5 fruits. The snake starts at 140 ms per move and gets 10 ms faster per level, down to a minimum of 60 ms.
- **Board:** 20×15 cells of 40 px, starting with a length of 3.
- **Assets:** [public/games/serpentina/fruits.png](../public/games/serpentina/fruits.png). If the image doesn't load, fruit is drawn as a red square.
- **Database:** migration [0002_juego_serpentina.sql](../supabase/migrations/0002_juego_serpentina.sql) rewrote this game's `short` and `long` descriptions to match the real game.

### Asteroids (`asteroids`)

> Pulveriza asteroides en gravedad cero.

Asteroids, ported from [started-games/02-asteroids](started-games/02-asteroids/). It was the first real engine, and spec 07 generalized its contract for the other games.

- **Engine:** [lib/games/asteroids.ts](../lib/games/asteroids.ts) (`AsteroidsGame`)
- **Controls:** `←` / `→` rotate the ship, `↑` thrusts, and `Space` fires (one shot per key press).
- **Lives:** 3. When the ship respawns, it does so away from nearby asteroids.
- **Scoring:** large asteroids are worth 20, medium 50, and small 100. Shooting an asteroid splits it into smaller ones.
- **Power-ups:** a destroyed asteroid has a 15% chance of dropping a triple-shot power-up. It lasts 5 s and disappears after 12 s if you don't pick it up.
- **Levels:** clearing every asteroid starts the next level, which spawns `3 + level` asteroids.
- **World:** the edges wrap around for the ship, bullets, asteroids and power-ups.
- **Assets:** none; everything is drawn as vector shapes.
