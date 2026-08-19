/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { jobStatusEvents, type DB } from 'db'
import { build, createTestDb, JOB1, seedJob } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import getJobEvents from './getJobEvents.js'

describe('GET /api/jobs/:id/events', () => {
  let db: DB
  let app: Awaited<ReturnType<typeof build>>

  beforeEach(async () => {
    db = createTestDb()
    app = await build(getJobEvents, { db, prefix: '/:id' })
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('returns seeded events ordered by descending occurredAt', async () => {
    const job = seedJob(db, JOB1)
    db.insert(jobStatusEvents)
      .values({
        jobId: job.id,
        status: 'applied',
        occurredAt: '2026-01-15T10:00:00Z',
        actor: 'human',
        note: null,
      })
      .run()
    db.insert(jobStatusEvents)
      .values({
        jobId: job.id,
        status: 'interviewing',
        occurredAt: '2026-01-20T14:30:00Z',
        actor: 'human',
        note: 'Phone screen scheduled',
      })
      .run()

    const res = await app.inject({ method: 'GET', url: `/${job.id}/events` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveLength(2)
    expect(body[0]).toMatchObject({
      status: 'interviewing',
      occurredAt: '2026-01-20T14:30:00Z',
      actor: 'human',
      note: 'Phone screen scheduled',
    })
    expect(body[1]).toMatchObject({
      status: 'applied',
      occurredAt: '2026-01-15T10:00:00Z',
      actor: 'human',
      note: null,
    })
  })

  it('returns an empty list for a job without events', async () => {
    const job = seedJob(db, JOB1)

    const res = await app.inject({ method: 'GET', url: `/${job.id}/events` })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })

  it('returns 404 for an unknown job', async () => {
    const res = await app.inject({ method: 'GET', url: '/999/events' })
    expect(res.statusCode).toBe(404)
  })

  it('returns 400 for a non-integer id', async () => {
    const res = await app.inject({ method: 'GET', url: '/abc/events' })
    expect(res.statusCode).toBe(400)
  })
})
