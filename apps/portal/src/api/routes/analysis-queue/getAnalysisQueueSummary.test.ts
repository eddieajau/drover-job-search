/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, type DB } from 'db'
import { build, createTestDb, JOB1, JOB2, seedJob } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import getAnalysisQueueSummary from './getAnalysisQueueSummary.js'

describe('GET /api/analysis-queue/summary', () => {
  let db: DB
  let app: Awaited<ReturnType<typeof build>>

  beforeEach(async () => {
    db = createTestDb()
    app = await build(getAnalysisQueueSummary, { db, prefix: '/' })
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('returns an empty summary for an empty queue', async () => {
    const res = await app.inject({ method: 'GET', url: '/summary' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      pending: { fetch_job_details: 0, rank: 0 },
      done: 0,
      total: 0,
      recent: [],
    })
  })

  it('counts pending and done rows across stages', async () => {
    const jobA = seedJob(db, JOB1)
    const jobB = seedJob(db, JOB2)
    const jobC = seedJob(db, { ...JOB1, providerJobId: 'job-3' })
    db.insert(analysisQueue).values({ jobId: jobA.id, stage: 'fetch_job_details' }).run()
    db.insert(analysisQueue).values({ jobId: jobB.id, stage: 'rank' }).run()
    db.insert(analysisQueue).values({ jobId: jobC.id, stage: 'rank', completedAt: '2026-08-08T00:00:00Z' }).run()

    const res = await app.inject({ method: 'GET', url: '/summary' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      pending: { fetch_job_details: 1, rank: 1 },
      done: 1,
      total: 3,
    })
  })

  it('limits recent to 20 rows ordered by id descending', async () => {
    for (let n = 1; n <= 25; n++) {
      const job = seedJob(db, { ...JOB1, providerJobId: `job-${n}`, title: `Job ${n}` })
      db.insert(analysisQueue).values({ jobId: job.id, stage: 'fetch_job_details' }).run()
    }

    const res = await app.inject({ method: 'GET', url: '/summary' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { total: number; recent: Array<{ id: number }> }
    expect(body.total).toBe(25)
    expect(body.recent).toHaveLength(20)
    const ids = body.recent.map(r => r.id)
    expect(ids).toEqual([...ids].sort((a, b) => b - a))
  })

  it('joins job title and providerJobId into each recent row', async () => {
    const jobA = seedJob(db, JOB1)
    const jobB = seedJob(db, JOB2)
    db.insert(analysisQueue).values({ jobId: jobA.id, stage: 'fetch_job_details' }).run()
    db.insert(analysisQueue).values({ jobId: jobB.id, stage: 'rank', completedAt: '2026-08-08T00:00:00Z' }).run()

    const res = await app.inject({ method: 'GET', url: '/summary' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { recent: Array<Record<string, unknown>> }
    expect(body.recent).toHaveLength(2)
    for (const row of body.recent) {
      expect(row).toMatchObject({
        id: expect.any(Number),
        jobId: expect.any(Number),
        title: expect.any(String),
        companyName: expect.any(String),
        providerJobId: expect.any(String),
        stage: expect.stringMatching(/^(fetch_job_details|rank)$/),
        queuedAt: expect.any(String),
      })
      expect(typeof row.completedAt === 'string' || row.completedAt === null).toBe(true)
    }
    expect(body.recent.map(r => r.title)).toEqual(expect.arrayContaining([JOB1.title, JOB2.title]))
    expect(body.recent.map(r => r.providerJobId)).toEqual(
      expect.arrayContaining([JOB1.providerJobId, JOB2.providerJobId])
    )
  })
})
