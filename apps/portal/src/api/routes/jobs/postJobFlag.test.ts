/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, type DB } from 'db'
import { eq } from 'drizzle-orm'
import { build, createTestDb, JOB1, seedJob } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import postJobFlag from './postJobFlag.js'

describe('POST /api/jobs/:jobId/flag', () => {
  let db: DB
  let app: Awaited<ReturnType<typeof build>>

  beforeEach(async () => {
    db = createTestDb()
    app = await build(postJobFlag, { db, prefix: '/' })
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('returns 400 on a non-numeric jobId', async () => {
    const res = await app.inject({ method: 'POST', url: '/abc/flag' })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 on a non-positive jobId', async () => {
    const res = await app.inject({ method: 'POST', url: '/0/flag' })
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 when the job does not exist', async () => {
    const res = await app.inject({ method: 'POST', url: '/999/flag' })
    expect(res.statusCode).toBe(404)
  })

  it('returns 202 with empty body on success and inserts a queue row', async () => {
    const job = seedJob(db, JOB1)

    const res = await app.inject({ method: 'POST', url: `/${job.id}/flag` })
    expect(res.statusCode).toBe(202)
    expect(res.body).toBe('')

    const row = db.select().from(analysisQueue).where(eq(analysisQueue.jobId, job.id)).get()
    expect(row).toBeDefined()
    expect(row?.stage).toBe('fetch_job_details')
    expect(row?.completedAt).toBeNull()
  })

  it('emits flagged with jobId on the bus after a successful flag', async () => {
    const job = seedJob(db, JOB1)
    let received: { jobId: number } | undefined
    app.bus.on('flagged', payload => {
      received = payload
    })

    const res = await app.inject({ method: 'POST', url: `/${job.id}/flag` })
    expect(res.statusCode).toBe(202)
    expect(received).toEqual({ jobId: job.id })
  })

  it('resets stage and clears errorMessage on re-flag (upsert path)', async () => {
    const job = seedJob(db, JOB1)
    db.insert(analysisQueue).values({ jobId: job.id, stage: 'rank', errorMessage: 'previous failure' }).run()

    const res = await app.inject({ method: 'POST', url: `/${job.id}/flag` })
    expect(res.statusCode).toBe(202)

    const row = db.select().from(analysisQueue).where(eq(analysisQueue.jobId, job.id)).get()
    expect(row?.stage).toBe('fetch_job_details')
    expect(row?.errorMessage).toBeNull()
  })
})
