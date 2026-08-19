/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { analysisQueue, jobs, type DB } from 'db'
import { eq, sql } from 'drizzle-orm'
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
    expect(row?.topic).toBe('fetch_job_details')
    expect(row?.completedAt).toBeNull()
  })

  it('flips a new job status to discovered after the flag', async () => {
    const job = seedJob(db, JOB1)
    expect(job.status).toBe('new')

    const res = await app.inject({ method: 'POST', url: `/${job.id}/flag` })
    expect(res.statusCode).toBe(202)

    const row = db.select().from(jobs).where(eq(jobs.id, job.id)).get()
    expect(row?.status).toBe('discovered')
    expect(row?.updatedAt).not.toBeNull()
  })

  it('leaves a skipped job status untouched by the flag', async () => {
    const job = seedJob(db, JOB1)
    db.update(jobs)
      .set({ status: 'skipped', updatedAt: sql`(CURRENT_TIMESTAMP)` })
      .where(eq(jobs.id, job.id))
      .run()

    const res = await app.inject({ method: 'POST', url: `/${job.id}/flag` })
    expect(res.statusCode).toBe(202)

    const row = db.select().from(jobs).where(eq(jobs.id, job.id)).get()
    expect(row?.status).toBe('skipped')
  })

  it('leaves an applied job status untouched by the flag', async () => {
    const job = seedJob(db, JOB1)
    db.update(jobs)
      .set({ status: 'applied', updatedAt: sql`(CURRENT_TIMESTAMP)` })
      .where(eq(jobs.id, job.id))
      .run()

    const res = await app.inject({ method: 'POST', url: `/${job.id}/flag` })
    expect(res.statusCode).toBe(202)

    const row = db.select().from(jobs).where(eq(jobs.id, job.id)).get()
    expect(row?.status).toBe('applied')
  })

  it('emits kick with topic fetch_job_details on the bus after a successful flag', async () => {
    const job = seedJob(db, JOB1)
    let received: { topic: string } | undefined
    app.bus.on('kick', payload => {
      received = payload
    })

    const res = await app.inject({ method: 'POST', url: `/${job.id}/flag` })
    expect(res.statusCode).toBe(202)
    expect(received).toEqual({ topic: 'fetch_job_details' })
  })

  it('inserts a new fetch_job_details row on re-flag (does not affect existing rank row)', async () => {
    const job = seedJob(db, JOB1)
    db.insert(analysisQueue).values({ jobId: job.id, topic: 'rank', errorMessage: 'previous failure' }).run()

    const res = await app.inject({ method: 'POST', url: `/${job.id}/flag` })
    expect(res.statusCode).toBe(202)

    const rows = db.select().from(analysisQueue).where(eq(analysisQueue.jobId, job.id)).all()
    expect(rows).toHaveLength(2)

    const fetchRow = rows.find(r => r.topic === 'fetch_job_details')!
    expect(fetchRow.errorMessage).toBeNull()
    expect(fetchRow.completedAt).toBeNull()

    const rankRow = rows.find(r => r.topic === 'rank')!
    expect(rankRow.errorMessage).toBe('previous failure')
  })

  it('accepts a body with { topic: "rank" } and inserts a rank row', async () => {
    const job = seedJob(db, JOB1)

    const res = await app.inject({
      method: 'POST',
      url: `/${job.id}/flag`,
      payload: { topic: 'rank' },
    })
    expect(res.statusCode).toBe(202)
    expect(res.body).toBe('')

    const row = db.select().from(analysisQueue).where(eq(analysisQueue.jobId, job.id)).get()
    expect(row).toBeDefined()
    expect(row?.topic).toBe('rank')
    expect(row?.completedAt).toBeNull()
  })

  it('does not change status to discovered when topic is rank', async () => {
    const job = seedJob(db, JOB1)
    expect(job.status).toBe('new')

    const res = await app.inject({
      method: 'POST',
      url: `/${job.id}/flag`,
      payload: { topic: 'rank' },
    })
    expect(res.statusCode).toBe(202)

    const row = db.select().from(jobs).where(eq(jobs.id, job.id)).get()
    expect(row?.status).toBe('new')
  })

  it('emits kick with topic rank on the bus when rank is requested', async () => {
    const job = seedJob(db, JOB1)
    let received: { topic: string } | undefined
    app.bus.on('kick', payload => {
      received = payload
    })

    const res = await app.inject({
      method: 'POST',
      url: `/${job.id}/flag`,
      payload: { topic: 'rank' },
    })
    expect(res.statusCode).toBe(202)
    expect(received).toEqual({ topic: 'rank' })
  })

  it('treats an explicit { topic: "fetch_job_details" } body like the default', async () => {
    const job = seedJob(db, JOB1)

    const res = await app.inject({
      method: 'POST',
      url: `/${job.id}/flag`,
      payload: { topic: 'fetch_job_details' },
    })
    expect(res.statusCode).toBe(202)

    const row = db.select().from(analysisQueue).where(eq(analysisQueue.jobId, job.id)).get()
    expect(row?.topic).toBe('fetch_job_details')
  })

  it('returns 400 on an unknown topic and inserts no row, emits no kick', async () => {
    const job = seedJob(db, JOB1)
    let received: { topic: string } | undefined
    app.bus.on('kick', payload => {
      received = payload
    })

    const res = await app.inject({
      method: 'POST',
      url: `/${job.id}/flag`,
      payload: { topic: 'bogus' },
    })
    expect(res.statusCode).toBe(400)

    const rows = db.select().from(analysisQueue).where(eq(analysisQueue.jobId, job.id)).all()
    expect(rows).toHaveLength(0)
    expect(received).toBeUndefined()
  })

  it('falls back to fetch_job_details when the body is an empty object', async () => {
    const job = seedJob(db, JOB1)

    const res = await app.inject({
      method: 'POST',
      url: `/${job.id}/flag`,
      payload: {},
    })
    expect(res.statusCode).toBe(202)

    const row = db.select().from(analysisQueue).where(eq(analysisQueue.jobId, job.id)).get()
    expect(row?.topic).toBe('fetch_job_details')
  })

  it('publishes one row per topic in body.topics and flips status to discovered', async () => {
    const job = seedJob(db, JOB1)
    expect(job.status).toBe('new')

    const res = await app.inject({
      method: 'POST',
      url: `/${job.id}/flag`,
      payload: { topics: ['fetch_job_details', 'rank'] },
    })
    expect(res.statusCode).toBe(202)

    const rows = db.select().from(analysisQueue).where(eq(analysisQueue.jobId, job.id)).all()
    expect(rows).toHaveLength(2)
    const topics = rows.map(r => r.topic).sort()
    expect(topics).toEqual(['fetch_job_details', 'rank'])
    expect(rows.every(r => r.completedAt === null)).toBe(true)

    const updated = db.select().from(jobs).where(eq(jobs.id, job.id)).get()
    expect(updated?.status).toBe('discovered')
  })

  it('publishes a single topic in body.topics and still flips status to discovered', async () => {
    const job = seedJob(db, JOB1)

    const res = await app.inject({
      method: 'POST',
      url: `/${job.id}/flag`,
      payload: { topics: ['fetch_job_details'] },
    })
    expect(res.statusCode).toBe(202)

    const rows = db.select().from(analysisQueue).where(eq(analysisQueue.jobId, job.id)).all()
    expect(rows).toHaveLength(1)
    expect(rows[0].topic).toBe('fetch_job_details')

    const updated = db.select().from(jobs).where(eq(jobs.id, job.id)).get()
    expect(updated?.status).toBe('discovered')
  })

  it('returns 400 for body.topics containing run_signal_rules', async () => {
    const job = seedJob(db, JOB1)

    const res = await app.inject({
      method: 'POST',
      url: `/${job.id}/flag`,
      payload: { topics: ['run_signal_rules'] },
    })
    expect(res.statusCode).toBe(400)

    const rows = db.select().from(analysisQueue).where(eq(analysisQueue.jobId, job.id)).all()
    expect(rows).toHaveLength(0)
  })

  it('does not flip status to discovered when body.topics contains only rank', async () => {
    const job = seedJob(db, JOB1)
    expect(job.status).toBe('new')

    const res = await app.inject({
      method: 'POST',
      url: `/${job.id}/flag`,
      payload: { topics: ['rank'] },
    })
    expect(res.statusCode).toBe(202)

    const rows = db.select().from(analysisQueue).where(eq(analysisQueue.jobId, job.id)).all()
    expect(rows).toHaveLength(1)
    expect(rows[0].topic).toBe('rank')

    const updated = db.select().from(jobs).where(eq(jobs.id, job.id)).get()
    expect(updated?.status).toBe('new')
  })

  it('returns 400 when any member of body.topics is unknown and inserts no rows', async () => {
    const job = seedJob(db, JOB1)

    const res = await app.inject({
      method: 'POST',
      url: `/${job.id}/flag`,
      payload: { topics: ['fetch_job_details', 'bogus'] },
    })
    expect(res.statusCode).toBe(400)

    const rows = db.select().from(analysisQueue).where(eq(analysisQueue.jobId, job.id)).all()
    expect(rows).toHaveLength(0)
  })

  it('emits a kick per published topic when body.topics is given', async () => {
    const job = seedJob(db, JOB1)
    const received: { topic: string }[] = []
    app.bus.on('kick', payload => {
      received.push(payload)
    })

    const res = await app.inject({
      method: 'POST',
      url: `/${job.id}/flag`,
      payload: { topics: ['fetch_job_details', 'rank'] },
    })
    expect(res.statusCode).toBe(202)
    expect(received).toEqual([{ topic: 'fetch_job_details' }, { topic: 'rank' }])
  })
})
