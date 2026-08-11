/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { documents, tasks, type DB } from 'db'
import { eq } from 'drizzle-orm'
import { build, createTestDb } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import postFactsIngest from './postFactsIngest.js'

describe('POST /api/facts/ingest', () => {
  let db: DB
  let app: Awaited<ReturnType<typeof build>>

  beforeEach(async () => {
    db = createTestDb()
    app = await build(postFactsIngest, { db, prefix: '/' })
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
  })

  it('returns 202 with a taskId and enqueues a slice_resume task', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ingest',
      payload: { resume: 'Experienced TypeScript developer.' },
    })

    expect(res.statusCode).toBe(202)
    const { taskId } = res.json() as { taskId: number }
    expect(typeof taskId).toBe('number')

    const row = db.select().from(tasks).where(eq(tasks.id, taskId)).get()
    expect(row).toBeDefined()
    expect(row?.topic).toBe('slice_resume')
    expect(row?.inputDocId).toBe(`slice_resume/${taskId}/input`)
    expect(row?.completedAt).toBeNull()
  })

  it('stores the resume verbatim as the input document', async () => {
    const resume = 'Line one.\nLine two.'
    const res = await app.inject({
      method: 'POST',
      url: '/ingest',
      payload: { resume },
    })
    const { taskId } = res.json() as { taskId: number }

    const doc = db
      .select()
      .from(documents)
      .where(eq(documents.id, `slice_resume/${taskId}/input`))
      .get()
    expect(doc).toBeDefined()
    expect(doc?.payload).toBe(resume)
  })

  it('emits kick with topic slice_resume on the bus', async () => {
    let received: { topic: string } | undefined
    app.bus.on('kick', payload => {
      received = payload
    })

    const res = await app.inject({
      method: 'POST',
      url: '/ingest',
      payload: { resume: 'Some resume text' },
    })

    expect(res.statusCode).toBe(202)
    expect(received).toEqual({ topic: 'slice_resume' })
  })

  it('rejects an empty resume', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ingest',
      payload: { resume: '' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('rejects a missing resume field', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ingest',
      payload: {},
    })

    expect(res.statusCode).toBe(400)
  })
})
