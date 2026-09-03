@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Arcade Vault — a platform for playing games online and competing for high scores (per README, in Spanish). Currently a fresh `create-next-app` scaffold with no custom features implemented yet.

## Commands

```bash
npm run dev      # start dev server (Turbopack, per Next.js 16 default)
npm run build    # production build
npm run start    # run production build
npm run lint     # eslint
```

There is no test runner configured yet.

## Architecture

- Next.js 16 App Router, TypeScript, React 19. All routes live under [app/](app/).
- Styling is Tailwind CSS v4 via `@tailwindcss/postcss` (see [postcss.config.mjs](postcss.config.mjs)), with global styles in [app/globals.css](app/globals.css).
- Path alias `@/*` maps to the repo root (see [tsconfig.json](tsconfig.json)).
- `node_modules/next/dist/docs/` contains the full Next.js docs for the installed version — consult it for API/behavior questions rather than relying on training data, since the installed Next.js version may postdate it.

## Spec-driven workflow

Per [README.md](README.md), this project follows spec-driven design using the `/spec` and `/spec-impl` skills from the [fernando-skills](https://github.com/Klerith/fernando-skills) skill pack (installed via `npx skills@latest add Klerith/fernando-skills`). Prefer these when planning and implementing new features if they are installed.
