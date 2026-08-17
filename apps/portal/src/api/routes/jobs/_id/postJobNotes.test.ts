/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { jobNotes, type DB } from 'db'
import { eq } from 'drizzle-orm'
import { build, createTestDb, JOB1, seedJob } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import postJobNotes from './postJobNotes.js'

describe('POST /api/jobs/:id/notes', () => {
  let db: DB
  let app: Awaited<ReturnType<typeof build>>

  beforeEach(async () => {
    db = createTestDb()
    app = await build(postJobNotes, { db, prefix: '/:id' })
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('writes a general note and returns it with 201', async () => {
    const job = seedJob(db, JOB1)

    const res = await app.inject({
      method: 'POST',
      url: `/${job.id}/notes`,
      payload: { kind: 'general', note: 'Follow up after interview' },
    })
    expect(res.json().message).toBeUndefined()
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ jobId: job.id, kind: 'general', note: 'Follow up after interview' })

    const row = db.select().from(jobNotes).where(eq(jobNotes.jobId, job.id)).get()
    expect(row).toMatchObject({ kind: 'general', note: 'Follow up after interview' })
  })

  it('never mutates jobs.status', async () => {
    const job = seedJob(db, JOB1)

    await app.inject({
      method: 'POST',
      url: `/${job.id}/notes`,
      payload: { kind: 'general', note: 'Reminder' },
    })

    const row = db.select().from(jobNotes).where(eq(jobNotes.jobId, job.id)).get()
    expect(row?.kind).toBe('general')
  })

  it.each(['applied', 'declined', 'interviewing'] as const)(
    'writes a %s note and returns 201 without mutating status',
    async kind => {
      const job = seedJob(db, JOB1)

      const res = await app.inject({
        method: 'POST',
        url: `/${job.id}/notes`,
        payload: { kind, note: `Noted as ${kind}` },
      })
      expect(res.statusCode).toBe(201)
      expect(res.json()).toMatchObject({ jobId: job.id, kind, note: `Noted as ${kind}` })

      const row = db.select().from(jobNotes).where(eq(jobNotes.jobId, job.id)).get()
      expect(row).toMatchObject({ kind, note: `Noted as ${kind}` })
    }
  )

  it('returns 404 for an unknown job', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/999/notes',
      payload: { kind: 'general', note: 'Nope' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 400 for a missing note', async () => {
    const job = seedJob(db, JOB1)
    const res = await app.inject({
      method: 'POST',
      url: `/${job.id}/notes`,
      payload: { kind: 'general' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for an empty note', async () => {
    const job = seedJob(db, JOB1)
    const res = await app.inject({
      method: 'POST',
      url: `/${job.id}/notes`,
      payload: { kind: 'general', note: '' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for a note longer than 2000 characters', async () => {
    const job = seedJob(db, JOB1)
    const res = await app.inject({
      method: 'POST',
      url: `/${job.id}/notes`,
      payload: { kind: 'general', note: 'x'.repeat(2001) },
    })
    expect(res.statusCode).toBe(400)
  })
})
