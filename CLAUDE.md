@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Arcade Vault — a platform for playing retro arcade games online and competing for high scores. All user-facing copy, specs, and code comments are in **Spanish**; keep new UI text and specs in Spanish.

Features implemented so far (specs 01–10 in [specs/](specs/)):

- Visual screens ported from the design templates in [references/templates/](references/templates/): home landing, library, game detail, player, hall of fame, auth, and about.
- Contact form on `/acerca-de` that sends real email via Resend.
- Supabase-backed game catalog and leaderboard.
- A generic canvas game engine contract plus four playable games: **Asteroids**, **Caída** (Tetris), **Bloque Buster** (Breakout/Arkanoid), and **Serpentina** (Snake).

## Commands

```bash
npm run dev      # start dev server (Turbopack, per Next.js 16 default)
npm run build    # production build
npm run start    # run production build
npm run lint     # eslint
npm run format   # prettier --write . (with prettier-plugin-tailwindcss)
```

There is no test runner configured. Changes are verified manually in the browser, often through the Playwright MCP (its output goes to `.playwright-mcp/`, which is gitignored).

A project hook in [.claude/settings.local.json](.claude/settings.local.json) auto-runs Prettier and `eslint --fix` on every `.tsx`/`.jsx` file Claude writes or edits, and Prettier on `.md`/`.mdx`.

## Architecture

- Next.js 16 App Router, TypeScript, React 19. Tailwind CSS v4 via `@tailwindcss/postcss`. Path alias `@/*` maps to the repo root.
- `node_modules/next/dist/docs/` contains the full Next.js docs for the installed version. Read it for API and behavior questions rather than relying on training data.

### Routes ([app/](app/))

| Route                      | Purpose                                                                  |
| -------------------------- | ------------------------------------------------------------------------ |
| `/`                        | Home landing                                                             |
| `/biblioteca`              | Game library with category filter (`CATS` in [lib/data.ts](lib/data.ts)) |
| `/juego/[id]`              | Game detail and top-10 scores                                            |
| `/jugar/[id]`              | Player: CRT frame, HUD, pause, game-over modal, score submission         |
| `/salon`                   | Hall of fame (leaderboard tabs per game)                                 |
| `/auth`                    | Local "login" by name                                                    |
| `/acerca-de`               | About page and contact form                                              |
| `POST /api/contact`        | Sends the contact form through Resend                                    |
| `GET /api/supabase-health` | Supabase connectivity check (`{ ok }`)                                   |

Pages are client components that fetch from Supabase on mount and show a `CARGANDO...` state while loading.

### Data and auth

- [lib/supabase/client.ts](lib/supabase/client.ts) (browser) and [lib/supabase/server.ts](lib/supabase/server.ts) (server, cookie-based) are `@supabase/ssr` clients.
- [lib/supabase/games.ts](lib/supabase/games.ts) has `getGames()`. [lib/supabase/scores.ts](lib/supabase/scores.ts) has `saveScore`, `getTopScores`, and `getBestScore`, and maps snake_case rows to camelCase `ScoreRow`.
- The schema lives in [supabase/migrations/](supabase/migrations/): the `games` table (catalog, ordered by `sort_order`) and the `scores` table, with RLS that allows public select and anon insert of scores. Catalog changes ship as new numbered migrations (`INSERT` for a new game, `UPDATE` to change an existing entry). The Supabase MCP is configured in [.mcp.json](.mcp.json).
- Auth is **not** Supabase Auth. [components/UserProvider.tsx](components/UserProvider.tsx) keeps a `{ name }` user in `localStorage` (`av_user`), exposed via `useUser()`. Scores are saved under that name, or under `INVITADO` for guests.
- Environment variables (see [.env.local.example](.env.local.example)): `RESEND_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### Game engines ([lib/games/](lib/games/))

- [lib/games/types.ts](lib/games/types.ts) defines the contract: `GameEngine` (`start`, `pause`, `resume`, `reset`, `forceGameOver`, `destroy`, `onStateChange`), `GameState` (`score`, `lives` where `null` means no lives system, `level`, `gameOver`), and `GameDefinition` (logical `width`/`height` plus `create(canvas)`).
- Each game is a class in `lib/games/<id>.ts` registered in `ENGINES` in [lib/games/registry.ts](lib/games/registry.ts), keyed by the Supabase `games.id`.
- [components/games/GameCanvas.tsx](components/games/GameCanvas.tsx) is the generic React bridge (canvas lifecycle, pause, and `reset`/`forceGameOver` via ref). [app/jugar/[id]/page.tsx](app/jugar/[id]/page.tsx) renders the HUD and modals. A new engine never touches either file.
- Catalog games with no registered engine (e.g. `gloton`, `invasores`) still open in the player with a simulated, randomly increasing score.
- Porting rules: fixed logical resolution scaled by CSS to the 4:3 `.crt-screen`; listeners added in the constructor and removed in `destroy()`; `preventDefault` on game keys; capped `dt`; no in-canvas HUD, pause, or game-over overlays; `onStateChange` fires only when state changes; no module-level state; assets live in `public/games/<id>/`. The full list is in [.claude/skills/add-game/engine-contract.md](.claude/skills/add-game/engine-contract.md).

### Styling

The retro neon theme lives in [app/globals.css](app/globals.css): CSS variables (`--bg`, `--ink`, `--cyan`, `--magenta`, `--yellow`, `--green`, …) exposed to Tailwind through `@theme inline`, plus hand-written `av-*` component classes ported from the templates. The fonts are Press Start 2P (`--font-pixel`) and JetBrains Mono (`--font-mono`), loaded in [app/layout.tsx](app/layout.tsx).

## Reference material ([references/](references/))

- `templates/`: the original JSX/HTML/CSS design mockups that the screens were ported from.
- `started-games/`: standalone vanilla-JS games to port (`02-asteroids`, `03-tetris`, `04-arkanoid`, all now ported).
- `snake-assets/`: the sprites used by Serpentina, which was built from scratch.

## Spec-driven workflow

Every feature is designed as a numbered spec in [specs/](specs/) (`NN-slug.md`, with an `**Estado:**` header) before any code is written.

- `/spec` and `/spec-impl` come from [Klerith/fernando-skills](https://github.com/Klerith/fernando-skills) and are installed in [.agents/skills/](.agents/skills/) (tracked in [skills-lock.json](skills-lock.json), along with `frontend-design`). `/spec` writes the spec. `/spec-impl` implements it on an auto-created `spec-NN-slug` branch (see [specs/.spec-config.yml](specs/.spec-config.yml)), and that branch is then merged into `main`.
- The project-local `/add-game` skill ([.claude/skills/add-game/](.claude/skills/add-game/)) specs a new playable game, ported from `references/started-games/` or built from scratch. It writes `specs/NN-juego-<id>.md` itself from its [spec-template.md](.claude/skills/add-game/spec-template.md) without delegating to `/spec`, and it writes no game code. The resulting spec is then implemented with `/spec-impl`.
- The project-local `game-planner` subagent ([.claude/agents/game-planner.md](.claude/agents/game-planner.md)) decides which game to add next. It compares the Supabase catalog, the registered engines, category/color balance, and unported `references/`, then returns a ranked recommendation with a ready-to-copy `/add-game` command. It writes no specs, code, or migrations. It keeps project-scoped memory of past proposals (`propuesto` / `aceptado` / `rechazado` / `implementado`) so it does not repeat rejected ideas. Use it before `/add-game` when unsure what to build.
- The project-local `game-jam` subagent ([.claude/agents/game-jam.md](.claude/agents/game-jam.md)) takes a theme and designs 3 distinct games for it. For each one it writes `specs/game-jam/<game-id>/01-juego-<game-id>.md` (engine spec, same format as specs 08–10) and `02-catalogo-<game-id>.md` (catalog `INSERT`, `cover-*` class, assets, QA checklist). It writes only inside `specs/game-jam/`: no code, migrations, or catalog changes. Once the user approves one, it is implemented with `/spec-impl`.
- The project-local `mobile-porter` subagent ([.claude/agents/mobile-porter.md](.claude/agents/mobile-porter.md)) audits and fixes how the site looks and plays in desktop and mobile browsers (no native app or PWA), using spec 12 as its contract. It checks that every registered engine declares `controlesTactiles` in the registry, audits each route at phone/landscape/desktop viewports (Playwright when a dev server is up), and implements fixes in `app/globals.css`, the pages, and `lib/games/registry.ts`, writing a spec first for big changes. It never touches the engines or `GameCanvas.tsx` and makes no commits. Use it after adding a game or changing layouts.
- When a spec is implemented, tick its acceptance-criteria checkboxes and update its `Estado`.
