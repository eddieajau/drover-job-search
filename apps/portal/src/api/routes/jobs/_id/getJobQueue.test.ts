/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, type DB } from 'db'
import { build, createTestDb, JOB1, seedJob } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import getJobQueue from './getJobQueue.js'

describe('GET /api/jobs/:id/queue', () => {
  let db: DB
  let app: Awaited<ReturnType<typeof build>>

  beforeEach(async () => {
    db = createTestDb()
    app = await build(getJobQueue, { db, prefix: '/:id' })
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('returns { queued: false } when no queue row exists', async () => {
    const job = seedJob(db, JOB1)

    const res = await app.inject({ method: 'GET', url: `/${job.id}/queue` })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ queued: false })
  })

  it('returns queue details when a queue row exists', async () => {
    const job = seedJob(db, JOB1)
    db.insert(analysisQueue).values({ jobId: job.id, topic: 'fetch_job_details' }).run()

    const res = await app.inject({ method: 'GET', url: `/${job.id}/queue` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toMatchObject({
      jobId: job.id,
      topic: 'fetch_job_details',
    })
  })

  it('returns { queued: false } for unknown job id (FK ensures no row)', async () => {
    const res = await app.inject({ method: 'GET', url: '/999/queue' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ queued: false })
  })

  it('returns 400 for a non-integer id', async () => {
    const res = await app.inject({ method: 'GET', url: '/abc/queue' })
    expect(res.statusCode).toBe(400)
  })
})
