/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { type DB } from 'db'
import { build, createTestDb, seedQuery } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import postQuery from './postQuery.js'

describe('POST /api/queries', () => {
  let db: DB
  let app: Awaited<ReturnType<typeof build>>

  beforeEach(async () => {
    db = createTestDb()
    app = await build(postQuery, { db, prefix: '/' })
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('creates a query', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: {
        queryText: 'Staff Engineer',
        queryOptions: { location: 'Brisbane', workType: 'remote,hybrid', strictWorkType: 'remote,hybrid' },
      },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({
      queryText: 'Staff Engineer',
      queryOptions: {
        location: 'Brisbane',
        workType: 'remote,hybrid',
        strictWorkType: 'remote,hybrid',
      },
      enabled: true,
      provider: 'linkedin',
    })
  })

  it('updates an existing query', async () => {
    const inserted = seedQuery(db, { queryText: 'Engineer' })

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { id: inserted.id, queryText: 'Staff Engineer', enabled: false },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ id: inserted.id, queryText: 'Staff Engineer', enabled: false })
  })

  it('returns 404 when updating an unknown query', async () => {
    const res = await app.inject({ method: 'POST', url: '/', payload: { id: 999, queryText: 'x' } })
    expect(res.statusCode).toBe(404)
  })

  it('rejects a missing queryText', async () => {
    const res = await app.inject({ method: 'POST', url: '/', payload: {} })
    expect(res.statusCode).toBe(400)
  })
})
