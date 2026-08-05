# Drover Job Search

Lightweight job search and tracking tool. Searches LinkedIn via a Fastify API, tracks state in browser localStorage.

## Quick Start

```bash
npm install
npm run dev
```

Opens at http://localhost:4000

## Architecture

- **Fastify API** (`src/server.ts`) — serves the SPA and proxies LinkedIn search
- **LinkedIn provider** (`src/providers/linkedin/`) — fetches and parses LinkedIn's public `jobs-guest` endpoints, adapted from [linkedin-search-cli](https://github.com/MadsLorentzen/ai-job-search) (MIT)
- **Browser SPA** (`www/`) — dark-theme UI with search, filter, track, export
- **State** — all tracking (seen/applied/skipped) lives in `localStorage`, no server-side DB
- **Config** — search queries, categories, and priorities defined in `data/queries.json`

## Project Structure

```
src/
  server.ts                       # Fastify entry point
  main.ts                         # Browser entry (bundled to www/js/main.js by esbuild)
  api/routes/
    search/index.ts               # GET /api/search?q=...&location=...&jobage=...
    config/index.ts               # GET /api/config → queries.json
  providers/
    linkedin/
      index.ts                    # Public API (search, detail)
      helpers.ts                  # HTML fetch with backoff, regex parsing
      search.ts                   # search() → { count, results }
      detail.ts                   # detail() → JobDetail | null
      LICENSE                     # MIT (MadsLorentzen)
      README.md                   # Attribution
  shared/types.ts                 # Shared TypeScript types
www/
  index.html                      # SPA shell
  styles.css                      # Dark theme
  js/main.js                      # Bundled browser code (generated)
data/
  queries.json                    # Search queries and categories
```

## Scripts

| Command             | Description                                        |
| ------------------- | -------------------------------------------------- |
| `npm run dev`       | Start server + watch browser bundle (concurrently) |
| `npm run build`     | Production build (tsc + esbuild)                   |
| `npm start`         | Run production build                               |
| `npm run typecheck` | Type-check server + browser                        |
| `npm test`          | Run tests                                          |

## Configuration

- `data/queries.json` — search queries, categories, priorities, location
- `.env` — `PORT` (default 4000)

## Tech Stack

- [Fastify](https://fastify.dev) v5 — HTTP server
- [tsx](https://github.com/privatenumber/tsx) — TypeScript execution (dev)
- [esbuild](https://esbuild.github.io) — browser bundle
- [dotenv](https://github.com/motdotla/dotenv) — env loading
- LinkedIn provider — regex-based HTML parsing, no DOM dependencies
