/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { jobs, type DB } from 'db'
import { jobNotes } from 'db'
import { eq } from 'drizzle-orm'
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
  })

  it('persists skipped status', async () => {
    const job = seedJob(db, JOB1)

    const res = await app.inject({ method: 'PATCH', url: `/${job.id}/status`, payload: { status: 'skipped' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('skipped')

    const row = db.select().from(jobs).where(eq(jobs.id, job.id)).get()
    expect(row?.status).toBe('skipped')
  })

  it('persists discovered status', async () => {
    const job = seedJob(db, JOB1)

    const res = await app.inject({ method: 'PATCH', url: `/${job.id}/status`, payload: { status: 'discovered' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('discovered')

    const row = db.select().from(jobs).where(eq(jobs.id, job.id)).get()
    expect(row?.status).toBe('discovered')
  })

  it('is reflected by a subsequent GET', async () => {
    seedJob(db, JOB1)

    await app.inject({ method: 'PATCH', url: '/1/status', payload: { status: 'applied' } })
    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.statusCode).toBe(200)
    expect(res.json().results[0].status).toBe('applied')
  })

  it('persists declined status', async () => {
    const job = seedJob(db, JOB1)

    const res = await app.inject({ method: 'PATCH', url: `/${job.id}/status`, payload: { status: 'declined' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('declined')

    const row = db.select().from(jobs).where(eq(jobs.id, job.id)).get()
    expect(row?.status).toBe('declined')
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

    const noteRow = db.select().from(jobNotes).where(eq(jobNotes.jobId, job.id)).get()
    expect(noteRow).toMatchObject({ jobId: job.id, kind: 'declined', note: 'Went with another candidate' })
  })

  it('persists interviewing status', async () => {
    const job = seedJob(db, JOB1)

    const res = await app.inject({ method: 'PATCH', url: `/${job.id}/status`, payload: { status: 'interviewing' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('interviewing')

    const row = db.select().from(jobs).where(eq(jobs.id, job.id)).get()
    expect(row?.status).toBe('interviewing')
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

    const noteRow = db.select().from(jobNotes).where(eq(jobNotes.jobId, job.id)).get()
    expect(noteRow).toMatchObject({ jobId: job.id, kind: 'interviewing', note: 'Phone screen scheduled' })
  })

  it('persists unsuccessful status', async () => {
    const job = seedJob(db, JOB1)

    const res = await app.inject({ method: 'PATCH', url: `/${job.id}/status`, payload: { status: 'unsuccessful' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('unsuccessful')

    const row = db.select().from(jobs).where(eq(jobs.id, job.id)).get()
    expect(row?.status).toBe('unsuccessful')
  })

  it('persists successful status', async () => {
    const job = seedJob(db, JOB1)

    const res = await app.inject({ method: 'PATCH', url: `/${job.id}/status`, payload: { status: 'successful' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('successful')

    const row = db.select().from(jobs).where(eq(jobs.id, job.id)).get()
    expect(row?.status).toBe('successful')
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
