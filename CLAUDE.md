# AGENTS.md

## Overview

Drover is a lightweight job search and tracking tool. It searches LinkedIn via a Fastify API and tracks application state in browser localStorage.

## Architecture rules

- No React, no Vue, no Svelte — Custom Elements only.
- Serve locally.
- LinkedIn provider uses regex parsing (no DOM dependencies), fetches with exponential backoff
- Routes use `@fastify/autoload` (filesystem routing from `apps/portal/src/api/routes/`); see `.claude/skills/fastify-autoload/SKILL.md`
- ESM throughout (`"type": "module"` in package.json)

## Working style

- **Never** edit `package.json` directly. Always use `npm` commands.
- One step at a time — implement, then stop for review.
- If anything is ambiguous or has meaningful trade-offs, ask first.
- Never commit unless explicitly asked.

## Code health

Before every commit, run `npm run verify` at the project root, then review the
staged diff against this checklist — refactor in the _same_ change, or say
why not. The point is to catch smells per commit so they never accumulate
into god-files needing a special clean-up pass.

## Key Files

- `src/server.ts` — Fastify entry, registers routes and static serving
- `src/main.ts` — Browser SPA (search, filter, track, export)
- `src/providers/linkedin/` — LinkedIn `jobs-guest` scraper (adapted from [linkedin-search-cli](https://github.com/MadsLorentzen/ai-job-search), MIT License)
- `src/api/routes/search/index.ts` — `GET /api/search?q=...&location=...&jobage=...`
- `src/api/routes/config/index.ts` — `GET /api/config` returns `data/queries.json`
- `data/queries.json` — search queries, categories, priorities
- `src/shared/types.ts` — `Job`, `SearchResult`, `QueriesConfig`

## Conventions

- Routes: autoloaded from `apps/portal/src/api/routes/`, folder → URL prefix; each file exports a `FastifyPluginAsync` and registers handlers on `'/'`
- Providers: `src/providers/<name>/`, each with `index.ts` as public API
- Shared types go in `src/shared/types.ts`
- Browser code bundled via esbuild to `www/js/main.js`
