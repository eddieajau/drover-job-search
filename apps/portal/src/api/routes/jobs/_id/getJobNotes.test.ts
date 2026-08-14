/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { jobNotes, type DB } from 'db'
import { build, createTestDb, JOB1, seedJob } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import getJobNotes from './getJobNotes.js'

describe('GET /api/jobs/:id/notes', () => {
  let db: DB
  let app: Awaited<ReturnType<typeof build>>

  beforeEach(async () => {
    db = createTestDb()
    app = await build(getJobNotes, { db, prefix: '/:id' })
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('returns notes newest-first for a job', async () => {
    const job = seedJob(db, JOB1)
    db.insert(jobNotes)
      .values([
        { jobId: job.id, kind: 'general', note: 'Older note', createdAt: '2026-08-01 09:00:00' },
        { jobId: job.id, kind: 'applied', note: 'Newer note', createdAt: '2026-08-10 09:00:00' },
        { jobId: job.id, kind: 'general', note: 'Most recent', createdAt: '2026-08-10 10:00:00' },
      ])
      .run()

    const res = await app.inject({ method: 'GET', url: `/${job.id}/notes` })
    expect(res.json().message).toBeUndefined()
    expect(res.statusCode).toBe(200)

    const notes = res.json() as Array<{ note: string }>
    expect(notes.map(n => n.note)).toEqual(['Most recent', 'Newer note', 'Older note'])
  })

  it('returns an empty list for a job without notes', async () => {
    const job = seedJob(db, JOB1)

    const res = await app.inject({ method: 'GET', url: `/${job.id}/notes` })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })

  it('returns 404 for an unknown job', async () => {
    const res = await app.inject({ method: 'GET', url: '/999/notes' })
    expect(res.statusCode).toBe(404)
  })
})
