/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fastify, { type FastifyInstance } from 'fastify'
import { createDb, jobs, type DB } from 'db'
import getJobs from './index.js'

describe('GET /api/jobs', () => {
  let db: DB
  let app: FastifyInstance

  beforeEach(async () => {
    db = createDb(':memory:')
    app = fastify()
    await app.register(getJobs, { db })
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('returns an empty page with defaults', async () => {
    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ count: 0, limit: 50, offset: 0, results: [] })
  })

  it('returns jobs sorted by posted date descending', async () => {
    db.insert(jobs)
      .values([
        {
          providerJobId: 'a',
          title: 'A',
          companyName: 'Co',
          url: 'https://a',
          location: 'Brisbane',
          postedAt: '2026-01-01',
        },
        {
          providerJobId: 'b',
          title: 'B',
          companyName: 'Co',
          url: 'https://b',
          location: 'Brisbane',
          postedAt: '2026-03-01',
        },
        {
          providerJobId: 'c',
          title: 'C',
          companyName: 'Co',
          url: 'https://c',
          location: 'Brisbane',
          postedAt: '2026-02-01',
        },
      ])
      .run()

    const res = await app.inject({ method: 'GET', url: '/' })
    const body = res.json() as { count: number; results: Array<{ providerJobId: string }> }
    expect(body.count).toBe(3)
    expect(body.results.map(j => j.providerJobId)).toEqual(['b', 'c', 'a'])
  })

  it('paginates with limit and offset', async () => {
    db.insert(jobs)
      .values(
        [1, 2, 3, 4, 5].map(n => ({
          providerJobId: `j${n}`,
          title: `Job ${n}`,
          companyName: 'Co',
          url: `https://j${n}`,
          location: 'Brisbane',
        }))
      )
      .run()

    const res = await app.inject({ method: 'GET', url: '/?limit=2&offset=2' })
    const body = res.json()
    expect(body.limit).toBe(2)
    expect(body.offset).toBe(2)
    expect(body.results).toHaveLength(2)
    expect(body.count).toBe(5)
  })

  it('clamps limit and ignores invalid values', async () => {
    const capped = await app.inject({ method: 'GET', url: '/?limit=99999' })
    expect(capped.json().limit).toBe(200)

    const invalid = await app.inject({ method: 'GET', url: '/?limit=abc' })
    expect(invalid.json().limit).toBe(50)
  })
})
