/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, type DB } from 'db'
import { build, createTestDb, JOB1, seedJob } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import postAnalysisQueue from './postAnalysisQueue.js'

describe('POST /api/analysis-queue', () => {
  let db: DB
  let app: Awaited<ReturnType<typeof build>>

  beforeEach(async () => {
    db = createTestDb()
    app = await build(postAnalysisQueue, { db, prefix: '/' })
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('rejects a request without providerJobId', async () => {
    const res = await app.inject({ method: 'POST', url: '/', payload: {} })
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 when the job does not exist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { providerJobId: 'nonexistent' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('inserts a row at stage fetch_job_details with null error_message', async () => {
    seedJob(db, JOB1)

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { providerJobId: JOB1.providerJobId },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { stage: string; errorMessage: string | null; jobId: number }
    expect(body.stage).toBe('fetch_job_details')
    expect(body.errorMessage).toBeNull()
  })

  it('resets stage and clears error_message on conflict', async () => {
    const job = seedJob(db, JOB1)
    db.insert(analysisQueue).values({ jobId: job.id, stage: 'rank', errorMessage: 'previous failure' }).run()

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { providerJobId: JOB1.providerJobId },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { stage: string; errorMessage: string | null }
    expect(body.stage).toBe('fetch_job_details')
    expect(body.errorMessage).toBeNull()
  })

  it('accepts an explicit provider', async () => {
    seedJob(db, JOB1)

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { provider: 'linkedin', providerJobId: JOB1.providerJobId },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().stage).toBe('fetch_job_details')
  })
})
