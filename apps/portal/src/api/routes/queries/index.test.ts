/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fastify, { type FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { createDb, queries, type DB } from 'db'
import getQueries from './index.js'

describe('GET /api/queries', () => {
  let db: DB
  let app: FastifyInstance

  beforeEach(async () => {
    db = createDb(':memory:')
    app = fastify()
    await app.register(sensible)
    await app.register(getQueries, { db })
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('returns all queries with parsed options', async () => {
    db.insert(queries)
      .values([
        { queryText: 'Engineer', queryOptions: JSON.stringify({ location: 'Brisbane', workType: 'hybrid' }) },
        { queryText: 'Designer', enabled: false },
      ])
      .run()

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
    const inserted = db.insert(queries).values({ queryText: 'Engineer' }).returning().get()

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
