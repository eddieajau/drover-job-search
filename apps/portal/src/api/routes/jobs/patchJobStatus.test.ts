/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { jobs, type DB } from 'db'
import { jobNotes } from 'db'
import { eq, sql } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'
import { build, createTestDb, JOB1, seedJob } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import getJobs from './getJobs.js'
import patchJobStatus from './patchJobStatus.js'

const routes: FastifyPluginAsync = async app => {
  await app.register(getJobs)
  await app.register(patchJobStatus)
}

describe('PATCH /api/jobs/:id/status', () => {
  let db: DB
  let app: Awaited<ReturnType<typeof build>>

  beforeEach(async () => {
    db = createTestDb()
    app = await build(routes, { db, prefix: '/' })
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('persists applied status and returns the mapped job', async () => {
    const job = seedJob(db, JOB1)

    const res = await app.inject({ method: 'PATCH', url: `/${job.id}/status`, payload: { status: 'applied' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('applied')

    const row = db.select().from(jobs).where(eq(jobs.id, job.id)).get()
    expect(row?.status).toBe('applied')
    expect(row?.appliedAt).not.toBeNull()
    expect(row?.skippedAt).toBeNull()
  })

  it('persists skipped status and timestamps', async () => {
    const job = seedJob(db, JOB1)

    const res = await app.inject({ method: 'PATCH', url: `/${job.id}/status`, payload: { status: 'skipped' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('skipped')

    const row = db.select().from(jobs).where(eq(jobs.id, job.id)).get()
    expect(row?.status).toBe('skipped')
    expect(row?.skippedAt).not.toBeNull()
    expect(row?.appliedAt).toBeNull()
  })

  it('persists discovered status and clears both applied and skipped timestamps', async () => {
    const job = seedJob(db, JOB1)
    db.update(jobs)
      .set({
        status: 'applied',
        appliedAt: sql`(CURRENT_TIMESTAMP)`,
        skippedAt: sql`(CURRENT_TIMESTAMP)`,
        updatedAt: sql`(CURRENT_TIMESTAMP)`,
      })
      .where(eq(jobs.id, job.id))
      .run()

    const res = await app.inject({ method: 'PATCH', url: `/${job.id}/status`, payload: { status: 'discovered' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('discovered')

    const row = db.select().from(jobs).where(eq(jobs.id, job.id)).get()
    expect(row?.status).toBe('discovered')
    expect(row?.appliedAt).toBeNull()
    expect(row?.skippedAt).toBeNull()
  })

  it('is reflected by a subsequent GET', async () => {
    seedJob(db, JOB1)

    await app.inject({ method: 'PATCH', url: '/1/status', payload: { status: 'applied' } })
    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.statusCode).toBe(200)
    expect(res.json().results[0].status).toBe('applied')
  })

  it('persists declined status and timestamps and preserves applied_at (pipeline history)', async () => {
    const job = seedJob(db, JOB1)
    db.update(jobs)
      .set({
        status: 'applied',
        appliedAt: sql`(CURRENT_TIMESTAMP)`,
        skippedAt: sql`(CURRENT_TIMESTAMP)`,
        updatedAt: sql`(CURRENT_TIMESTAMP)`,
      })
      .where(eq(jobs.id, job.id))
      .run()

    const res = await app.inject({ method: 'PATCH', url: `/${job.id}/status`, payload: { status: 'declined' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('declined')

    const row = db.select().from(jobs).where(eq(jobs.id, job.id)).get()
    expect(row?.status).toBe('declined')
    expect(row?.declinedAt).not.toBeNull()
    expect(row?.appliedAt).not.toBeNull()
    expect(row?.skippedAt).toBeNull()
  })

  it('back-captures the applied date when an at body is supplied', async () => {
    const job = seedJob(db, JOB1)

    const res = await app.inject({
      method: 'PATCH',
      url: `/${job.id}/status`,
      payload: { status: 'applied', at: '2026-07-01' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('applied')

    const row = db.select().from(jobs).where(eq(jobs.id, job.id)).get()
    expect(row?.appliedAt).toBe('2026-07-01')
  })

  it('inserts a job_notes row atomically when applied is saved with a note', async () => {
    const job = seedJob(db, JOB1)

    const res = await app.inject({
      method: 'PATCH',
      url: `/${job.id}/status`,
      payload: { status: 'applied', at: '2026-08-01', note: 'Sent my CV' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('applied')

    const jobRow = db.select().from(jobs).where(eq(jobs.id, job.id)).get()
    expect(jobRow?.appliedAt).toBe('2026-08-01')

    const noteRow = db.select().from(jobNotes).where(eq(jobNotes.jobId, job.id)).get()
    expect(noteRow).toMatchObject({ jobId: job.id, kind: 'applied', note: 'Sent my CV' })
  })

  it('inserts a job_notes row atomically when declined is saved with a note', async () => {
    const job = seedJob(db, JOB1)

    const res = await app.inject({
      method: 'PATCH',
      url: `/${job.id}/status`,
      payload: { status: 'declined', at: '2026-08-02', note: 'Went with another candidate' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('declined')

    const jobRow = db.select().from(jobs).where(eq(jobs.id, job.id)).get()
    expect(jobRow?.declinedAt).toBe('2026-08-02')

    const noteRow = db.select().from(jobNotes).where(eq(jobNotes.jobId, job.id)).get()
    expect(noteRow).toMatchObject({ jobId: job.id, kind: 'declined', note: 'Went with another candidate' })
  })

  it('persists interviewing status and sets interviewing_at while preserving applied_at', async () => {
    const job = seedJob(db, JOB1)
    db.update(jobs)
      .set({ status: 'applied', appliedAt: sql`(CURRENT_TIMESTAMP)`, updatedAt: sql`(CURRENT_TIMESTAMP)` })
      .where(eq(jobs.id, job.id))
      .run()

    const res = await app.inject({ method: 'PATCH', url: `/${job.id}/status`, payload: { status: 'interviewing' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('interviewing')

    const row = db.select().from(jobs).where(eq(jobs.id, job.id)).get()
    expect(row?.status).toBe('interviewing')
    expect(row?.interviewingAt).not.toBeNull()
    expect(row?.appliedAt).not.toBeNull()
    expect(row?.declinedAt).toBeNull()
  })

  it('back-captures the interviewing date when an at body is supplied', async () => {
    const job = seedJob(db, JOB1)

    const res = await app.inject({
      method: 'PATCH',
      url: `/${job.id}/status`,
      payload: { status: 'interviewing', at: '2026-07-15' },
    })
    expect(res.statusCode).toBe(200)

    const row = db.select().from(jobs).where(eq(jobs.id, job.id)).get()
    expect(row?.interviewingAt).toBe('2026-07-15')
  })

  it('inserts a job_notes row atomically when interviewing is saved with a note', async () => {
    const job = seedJob(db, JOB1)

    const res = await app.inject({
      method: 'PATCH',
      url: `/${job.id}/status`,
      payload: { status: 'interviewing', at: '2026-08-05', note: 'Phone screen scheduled' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('interviewing')

    const jobRow = db.select().from(jobs).where(eq(jobs.id, job.id)).get()
    expect(jobRow?.interviewingAt).toBe('2026-08-05')

    const noteRow = db.select().from(jobNotes).where(eq(jobNotes.jobId, job.id)).get()
    expect(noteRow).toMatchObject({ jobId: job.id, kind: 'interviewing', note: 'Phone screen scheduled' })
  })

  it('declined after interviewing preserves both applied_at and interviewing_at', async () => {
    const job = seedJob(db, JOB1)
    db.update(jobs)
      .set({
        status: 'interviewing',
        appliedAt: sql`(CURRENT_TIMESTAMP)`,
        interviewingAt: sql`(CURRENT_TIMESTAMP)`,
        updatedAt: sql`(CURRENT_TIMESTAMP)`,
      })
      .where(eq(jobs.id, job.id))
      .run()

    const res = await app.inject({ method: 'PATCH', url: `/${job.id}/status`, payload: { status: 'declined' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('declined')

    const row = db.select().from(jobs).where(eq(jobs.id, job.id)).get()
    expect(row?.status).toBe('declined')
    expect(row?.declinedAt).not.toBeNull()
    expect(row?.appliedAt).not.toBeNull()
    expect(row?.interviewingAt).not.toBeNull()
  })

  it('persists unsuccessful status and sets unsuccessful_at while preserving applied_at and interviewing_at', async () => {
    const job = seedJob(db, JOB1)
    db.update(jobs)
      .set({
        status: 'interviewing',
        appliedAt: sql`(CURRENT_TIMESTAMP)`,
        interviewingAt: sql`(CURRENT_TIMESTAMP)`,
        updatedAt: sql`(CURRENT_TIMESTAMP)`,
      })
      .where(eq(jobs.id, job.id))
      .run()

    const res = await app.inject({ method: 'PATCH', url: `/${job.id}/status`, payload: { status: 'unsuccessful' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('unsuccessful')

    const row = db.select().from(jobs).where(eq(jobs.id, job.id)).get()
    expect(row?.status).toBe('unsuccessful')
    expect(row?.unsuccessfulAt).not.toBeNull()
    expect(row?.appliedAt).not.toBeNull()
    expect(row?.interviewingAt).not.toBeNull()
    expect(row?.declinedAt).toBeNull()
    expect(row?.successfulAt).toBeNull()
  })

  it('persists successful status and sets successful_at while preserving applied_at and interviewing_at', async () => {
    const job = seedJob(db, JOB1)
    db.update(jobs)
      .set({
        status: 'interviewing',
        appliedAt: sql`(CURRENT_TIMESTAMP)`,
        interviewingAt: sql`(CURRENT_TIMESTAMP)`,
        updatedAt: sql`(CURRENT_TIMESTAMP)`,
      })
      .where(eq(jobs.id, job.id))
      .run()

    const res = await app.inject({ method: 'PATCH', url: `/${job.id}/status`, payload: { status: 'successful' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('successful')

    const row = db.select().from(jobs).where(eq(jobs.id, job.id)).get()
    expect(row?.status).toBe('successful')
    expect(row?.successfulAt).not.toBeNull()
    expect(row?.appliedAt).not.toBeNull()
    expect(row?.interviewingAt).not.toBeNull()
    expect(row?.declinedAt).toBeNull()
    expect(row?.unsuccessfulAt).toBeNull()
  })

  it('interviewing → unsuccessful → declined keeps all three milestone dates', async () => {
    const job = seedJob(db, JOB1)
    db.update(jobs)
      .set({
        status: 'interviewing',
        appliedAt: sql`(CURRENT_TIMESTAMP)`,
        interviewingAt: sql`(CURRENT_TIMESTAMP)`,
        updatedAt: sql`(CURRENT_TIMESTAMP)`,
      })
      .where(eq(jobs.id, job.id))
      .run()

    await app.inject({ method: 'PATCH', url: `/${job.id}/status`, payload: { status: 'unsuccessful' } })
    const res = await app.inject({ method: 'PATCH', url: `/${job.id}/status`, payload: { status: 'declined' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('declined')

    const row = db.select().from(jobs).where(eq(jobs.id, job.id)).get()
    expect(row?.appliedAt).not.toBeNull()
    expect(row?.interviewingAt).not.toBeNull()
    expect(row?.declinedAt).not.toBeNull()
  })

  it('inserts a job_notes row atomically when unsuccessful is saved with a note', async () => {
    const job = seedJob(db, JOB1)

    const res = await app.inject({
      method: 'PATCH',
      url: `/${job.id}/status`,
      payload: { status: 'unsuccessful', at: '2026-08-10', note: 'Did not pass the technical round' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('unsuccessful')

    const jobRow = db.select().from(jobs).where(eq(jobs.id, job.id)).get()
    expect(jobRow?.unsuccessfulAt).toBe('2026-08-10')

    const noteRow = db.select().from(jobNotes).where(eq(jobNotes.jobId, job.id)).get()
    expect(noteRow).toMatchObject({ jobId: job.id, kind: 'unsuccessful', note: 'Did not pass the technical round' })
  })

  it('inserts a job_notes row atomically when successful is saved with a note', async () => {
    const job = seedJob(db, JOB1)

    const res = await app.inject({
      method: 'PATCH',
      url: `/${job.id}/status`,
      payload: { status: 'successful', at: '2026-08-15', note: 'Received the offer' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('successful')

    const jobRow = db.select().from(jobs).where(eq(jobs.id, job.id)).get()
    expect(jobRow?.successfulAt).toBe('2026-08-15')

    const noteRow = db.select().from(jobNotes).where(eq(jobNotes.jobId, job.id)).get()
    expect(noteRow).toMatchObject({ jobId: job.id, kind: 'successful', note: 'Received the offer' })
  })

  it('rejects a general-kind note on the status route', async () => {
    const job = seedJob(db, JOB1)
    const res = await app.inject({
      method: 'PATCH',
      url: `/${job.id}/status`,
      payload: { status: 'general', note: 'x' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 for an unknown job', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/999/status', payload: { status: 'applied' } })
    expect(res.statusCode).toBe(404)
  })

  it('returns 400 for an invalid status', async () => {
    const job = seedJob(db, JOB1)
    const res = await app.inject({ method: 'PATCH', url: `/${job.id}/status`, payload: { status: 'bogus' } })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when status is missing', async () => {
    const job = seedJob(db, JOB1)
    const res = await app.inject({ method: 'PATCH', url: `/${job.id}/status`, payload: {} })
    expect(res.statusCode).toBe(400)
  })
})
