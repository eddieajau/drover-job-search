---
name: fastify-test
description: Use when writing or reviewing route handler tests (app.inject, build harness, seed data, in-memory SQLite db).
---

# Fastify Testing — Route Tests with a Minimal Harness

Test each route handler in isolation against a stripped-down Fastify
instance, with an in-memory SQLite database and deterministic fixtures. No
server process, no network, no real DB.

## Principles

### 1. Isolate the route under test

Build a minimal Fastify instance with only the plugins that handler needs
(logger off, error helpers). Register ONLY the handler under test at its
path. Do not boot the full application.

### 2. Inject, don't listen

Use `app.inject()` for requests. It exercises the full routing/serialization
pipeline without binding a port. Fast, parallel, and deterministic.

### 3. Seed at the data boundary

The route's external dependency (DB, API) is never stubbed. Instead, an
in-memory SQLite database is injected via the harness (`createTestDb()`)
and seeded from fixtures, so the route's real drizzle queries run against
real rows:

```typescript
const db = createTestDb()
seedJob(db, { providerJobId: 'abc', title: 'Engineer', ... })
const app = await build(getJobs, { db, prefix: '/' })

// then assert against the route's real response:
expect(body.count).toBe(1)
```

### 4. Deterministic fixtures, stable IDs

Fixtures use stable stubs (`JOB1`, `JOB2`, `RULE_JAVA`, `RULE_RECRUITER`) with
fixed timestamps and embedded relations (`job` references its `rule` via the
seeded row's id). Never randomise IDs or dates in fixtures.

### 5. Auth tokens (future)

Portal has no auth yet. Once route guards exist, sign valid tokens (user,
admin) and an invalid/wrong-secret token once in the harness, ahead of
time, and assert the failure cases explicitly (401/403), not just the
success path.

### 6. Reset state every test

`beforeEach`: build a fresh `createTestDb()`, seed it, and rebuild the app.
Tests must be order-independent.

### 7. Assertion order

1. Assert no error message in the body (so a 400/403 can't pass as 200)
2. Assert `statusCode`
3. Assert response structure and values
4. Assert the resulting DB state where the route mutates it

### 8. Exercise every branch

One named `it` per behaviour: success, each filter, multi-value filters,
missing/extra params, and every failure mode.

### 9. One harness, one barrel

The harness (`build(route, { db, prefix })`, `mockLogger`) and all fixtures
live in `packages/test-fixtures`, barrel-exported. Tests import everything
from one `test-fixtures` index.

## Harness shape

```typescript
// packages/test-fixtures/src/harness.ts
export async function build(route: FastifyPluginAsync, options: { db: DB; prefix?: string }): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(Sensible)
  app.decorate('db', options.db)
  if (options.prefix === undefined) {
    await app.register(route)
  } else {
    await app.register(route, { prefix: options.prefix })
  }
  await app.ready()
  return app
}
```

## Test shape

```typescript
describe('GET /api/jobs', () => {
  let db: DB
  let app: Awaited<ReturnType<typeof build>>

  beforeEach(async () => {
    db = createTestDb()
    app = await build(getJobs, { db, prefix: '/' })
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('returns jobs sorted by posted date descending', async () => {
    seedJob(db, { providerJobId: 'a', ... })
    const response = await app.inject({ method: 'GET', url: '/' })
    expect(response.json().message).toBeUndefined()
    expect(response.statusCode).toBe(200)
    expect(response.json().results.map(j => j.providerJobId)).toEqual([...])
  })
})
```

## Repo notes (drover)

- **Data boundary is `fastify.db`** (drizzle over better-sqlite3 via
  `packages/db`), decorated in `apps/portal/src/server.ts` and in the
  harness. Routes never import the DB directly — they read `fastify.db`.
- **Fixtures + harness live in `packages/test-fixtures`**: `build`,
  `mockLogger`, `createTestDb`, `seedDatabase`, the job stubs (`JOB1`,
  `JOB2`, `JOB3`) and per-model seed helpers (`seedJob`, `seedRule`,
  `seedSignal`, `seedQuery`). Reach for the stubs when a test just needs "a
  job"; spread-and-override when it needs a specific identity
  (`{ ...JOB1, providerJobId: 'custom' }`).
- **Routes live in `apps/portal/src/api/routes/`**, one `FastifyPluginAsync`
  per file, tests co-located (`*.test.ts`). A route mounts at the folder's
  URL; its handler registers `/` (e.g. `jobs/getJobs.ts` handles
  `GET /api/jobs`).
- **Portal has no auth yet** — the token principles apply once route guards
  exist.
