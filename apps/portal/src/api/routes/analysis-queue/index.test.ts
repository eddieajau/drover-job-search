/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import sensible from '@fastify/sensible'
import { analysisQueue, createDb, jobs, type DB } from 'db'
import fastify, { type FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import analysisQueueRoutes from './index.js'

describe('GET /api/analysis-queue', () => {
  let db: DB
  let app: FastifyInstance

  beforeEach(async () => {
    db = createDb(':memory:')
    app = fastify()
    await app.register(sensible)
    await app.register(analysisQueueRoutes, { db })
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('returns the queue row when the job is queued', async () => {
    const job = db
      .insert(jobs)
      .values({ providerJobId: 'abc', title: 'Engineer', companyName: 'Co', url: 'https://x', location: 'Brisbane' })
      .returning()
      .get()
    db.insert(analysisQueue).values({ jobId: job.id }).run()

    const res = await app.inject({ method: 'GET', url: '/?provider=linkedin&providerJobId=abc' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.queued).toBeUndefined()
    expect(body).toMatchObject({ jobId: job.id, completedAt: null })
    expect(body.queuedAt).toBeTruthy()
  })

  it('returns queued:false when the job is not queued', async () => {
    db.insert(jobs)
      .values({ providerJobId: 'abc', title: 'Engineer', companyName: 'Co', url: 'https://x', location: 'Brisbane' })
      .run()

    const res = await app.inject({ method: 'GET', url: '/?provider=linkedin&providerJobId=abc' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ queued: false })
  })

  it('returns 400 for a missing providerJobId', async () => {
    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/analysis-queue', () => {
  let db: DB
  let app: FastifyInstance

  beforeEach(async () => {
    db = createDb(':memory:')
    app = fastify()
    await app.register(sensible)
    await app.register(analysisQueueRoutes, { db })
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('enqueues a job by providerJobId', async () => {
    db.insert(jobs)
      .values({ providerJobId: 'abc', title: 'Engineer', companyName: 'Co', url: 'https://x', location: 'Brisbane' })
      .run()

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { provider: 'linkedin', providerJobId: 'abc' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.completedAt).toBeNull()
    expect(body.queuedAt).toBeTruthy()

    const queued = db.select().from(analysisQueue).all()
    expect(queued).toHaveLength(1)
  })

  it('resets completed_at when re-flagging a completed job', async () => {
    const job = db
      .insert(jobs)
      .values({ providerJobId: 'abc', title: 'Engineer', companyName: 'Co', url: 'https://x', location: 'Brisbane' })
      .returning()
      .get()
    db.insert(analysisQueue).values({ jobId: job.id, completedAt: '2026-01-01 00:00:00' }).run()

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { provider: 'linkedin', providerJobId: 'abc' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().completedAt).toBeNull()

    const queued = db.select().from(analysisQueue).all()
    expect(queued).toHaveLength(1)
    expect(queued[0].completedAt).toBeNull()
  })

  it('returns 404 for an unknown job', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { provider: 'linkedin', providerJobId: 'nope' },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('DELETE /api/analysis-queue', () => {
  let db: DB
  let app: FastifyInstance

  beforeEach(async () => {
    db = createDb(':memory:')
    app = fastify()
    await app.register(sensible)
    await app.register(analysisQueueRoutes, { db })
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('unflags a queued job', async () => {
    const job = db
      .insert(jobs)
      .values({ providerJobId: 'abc', title: 'Engineer', companyName: 'Co', url: 'https://x', location: 'Brisbane' })
      .returning()
      .get()
    db.insert(analysisQueue).values({ jobId: job.id }).run()

    const res = await app.inject({ method: 'DELETE', url: '/?provider=linkedin&providerJobId=abc' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ queued: false })

    const queued = db.select().from(analysisQueue).all()
    expect(queued).toHaveLength(0)
  })
})
