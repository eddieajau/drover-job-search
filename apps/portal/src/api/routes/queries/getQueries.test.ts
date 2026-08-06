/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { type DB } from 'db'
import { build, createTestDb, seedQuery } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import getQueries from './getQueries.js'

describe('GET /api/queries', () => {
  let db: DB
  let app: Awaited<ReturnType<typeof build>>

  beforeEach(async () => {
    db = createTestDb()
    app = await build(getQueries, { db, prefix: '/' })
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('returns all queries with parsed options', async () => {
    seedQuery(db, { queryText: 'Engineer', queryOptions: JSON.stringify({ location: 'Brisbane', workType: 'hybrid' }) })
    seedQuery(db, { queryText: 'Designer', enabled: false })

    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveLength(2)
    expect(body[0]).toMatchObject({
      queryText: 'Engineer',
      queryOptions: { location: 'Brisbane', workType: 'hybrid' },
      enabled: true,
    })
    expect(body[1]).toMatchObject({ queryText: 'Designer', enabled: false })
    expect(body[1].queryOptions).toBeUndefined()
  })

  it('filters by id', async () => {
    const inserted = seedQuery(db, { queryText: 'Engineer' })

    const res = await app.inject({ method: 'GET', url: `/?id=${inserted.id}` })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ id: inserted.id, queryText: 'Engineer' })
  })

  it('returns 404 for an unknown id', async () => {
    const res = await app.inject({ method: 'GET', url: '/?id=999' })
    expect(res.statusCode).toBe(404)
  })

  it('returns 400 for an invalid id', async () => {
    const res = await app.inject({ method: 'GET', url: '/?id=abc' })
    expect(res.statusCode).toBe(400)
  })
})
