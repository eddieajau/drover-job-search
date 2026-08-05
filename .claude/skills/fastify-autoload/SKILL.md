---
name: fastify-autoload
description: Filesystem-based routing with @fastify/autoload. Use when creating, moving, or debugging Fastify route files, or when configuring autoload registration. Covers file→URL mapping, naming conventions, dynamic params, and common gotchas.
---

# Fastify Autoload — Routing by Folder Structure

## Config Reference

This repo registers autoload once, in `apps/portal/src/server.ts`:

```typescript
await server.register(fastifyAutoload, {
  dir: join(__dirname, 'api', 'routes'), // route directory
  routeParams: true, // _id → :id in folder names
  options: { prefix: '/api' }, // prepended to all routes
  ignoreFilter: (path: string) => path.endsWith('.test.ts'), // keep co-located tests out
})
```

- `ignoreFilter` is a function (or string/regexp) matched against the
  autoload-relative path; returning `true` skips the file. Required here so
  the co-located `*.test.ts` route tests (which import vitest at module
  scope) are never imported by the server.

- `dirNameRoutePrefix` defaults to true: folder names become URL segments.
- Changing autoload options requires a server restart — it reads at startup, not at runtime.

## File → URL Mapping

Folder path builds the URL prefix (after `/api`). Route files register paths relative to that prefix.

```
apps/portal/src/api/routes/
├── getVersion.ts                  → GET /api/
├── search/
│   └── getSearch.ts               → GET /api/search
├── notes/
│   ├── getNotes.ts                → GET /api/notes
│   └── _id/
│       ├── getNote.ts             → GET /api/notes/:id
│       └── postNote.ts            → POST /api/notes/:id
```

## Route File Pattern

Every route file must `export default` a `FastifyPluginAsync`.

Register handlers against `'/'` and let the folder tree define the URL prefix. Use an explicit subpath only when that file intentionally owns a nested endpoint (e.g. `search.ts` → `/search`).

```typescript
import type { FastifyPluginAsync } from 'fastify'

const route: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.get('/', async (request, reply) => {
    // GET /api/notes (prefix from folder)
  })
}

export default route
```

Multiple files in the same folder can register different methods on `'/'`:

- `getNote.ts` → `fastify.get('/')`
- `postNote.ts` → `fastify.post('/')`

Both resolve to `/api/notes/:id` because the folder prefix is `notes/_id`.

## Naming Conventions

| Pattern    | Role                       |
| ---------- | -------------------------- |
| `get*.ts`  | GET handler                |
| `post*.ts` | POST handler               |
| `index.ts` | Default handler for folder |

These are conventions, not runtime requirements. Autoload cares about the exported plugin shape, not filename prefixes.

## Dynamic Route Params

With `routeParams: true`, folder names starting with `_` become route params:

| Folder    | URL segment |
| --------- | ----------- |
| `_id/`    | `:id`       |
| `_token/` | `:token`    |
| `_slug/`  | `:slug`     |

## Gotchas

### 1. `index.ts` Hides Sibling Files

**The most common trap.** When a directory contains `index.ts`, autoload loads ONLY `index.ts` and subdirectories. All other files in that directory are ignored.

```
api/
├── index.ts        → loaded (GET /api/)
├── health.ts       → IGNORED — index.ts exists
└── notes/          → loaded (subdirectory)
```

Fix: move `health.ts` into `api/health/index.ts` or register it manually.

### 2. Prefix Composition

`options.prefix` is prepended to the folder-derived prefix. With `prefix: '/api'`:
`api/counter/getCounter.ts` → `GET /api/counter`.

### 3. Test Files Are Skipped Only via `ignoreFilter`

Autoload imports every matching file before checking its export shape, so a
co-located `*.test.ts` that imports vitest will crash the server at boot
("Vitest failed to access its internal state"). The `ignoreFilter` in the
Config Reference is mandatory while route tests live beside their routes.

### 4. Adding a New Route Checklist

1. Decide the URL path (e.g. `/api/notes/:id`)
2. Create the folder structure (`api/notes/_id/`)
3. Create the route file (`getNote.ts`)
4. `export default` a `FastifyPluginAsync`
5. Register the handler against `'/'` inside the plugin (explicit subpath only when the file owns a nested endpoint)
6. Check: does the parent folder have an `index.ts`? If so, your file may be hidden
7. Restart the server (autoload reads at startup, not at runtime)
