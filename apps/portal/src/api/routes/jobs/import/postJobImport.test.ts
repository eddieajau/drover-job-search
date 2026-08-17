/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { analysisQueue, jobs, type DB } from 'db'
import { eq } from 'drizzle-orm'
import { build, createTestDb } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import postJobImport from './postJobImport.js'

const seekHtml = readFileSync(resolve(import.meta.dirname, '../../../../../../../.local/examples/seek.html'), 'utf-8')

const SEEK_URL = 'https://au.seek.com/job/93971606'
const NON_SEEK_URL = 'https://example.com/job/123'
const SEEK_URL_BAD = 'https://au.seek.com/job/abc'

function mockHtmlFetch(returnValue: string): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      text: async () => returnValue,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
    }))
  )
}

describe('POST /api/jobs/import', () => {
  let db: DB
  let app: Awaited<ReturnType<typeof build>>

  beforeEach(async () => {
    db = createTestDb()
    app = await build(postJobImport, { db, prefix: '/' })
    mockHtmlFetch(seekHtml)
  })

  afterEach(async () => {
    await app.close()
    db.$client.close()
    vi.restoreAllMocks()
  })

  it('returns 400 when url is missing', async () => {
    const res = await app.inject({ method: 'POST', url: '/', payload: { status: 'applied' } })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for a non-Seek URL', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: NON_SEEK_URL, status: 'applied' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for a Seek URL with non-numeric id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: SEEK_URL_BAD, status: 'applied' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when status is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: SEEK_URL },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when status is "new"', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: SEEK_URL, status: 'new' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when status is "discovered"', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: SEEK_URL, status: 'discovered' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 201 with a valid Seek URL and applied status', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: SEEK_URL, status: 'applied' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json() as { id: number; status: string; title: string }
    expect(body.status).toBe('applied')
    expect(body.title).toBeTruthy()
    expect(body.id).toBeGreaterThan(0)
  })

  it('inserts a job with provider seek and the correct provider_job_id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: SEEK_URL, status: 'applied' },
    })
    const { id } = res.json() as { id: number }
    const row = db.select().from(jobs).where(eq(jobs.id, id)).get()
    expect(row).toBeDefined()
    expect(row?.provider).toBe('seek')
    expect(row?.providerJobId).toBe('93971606')
    expect(row?.status).toBe('applied')
    expect(row?.appliedAt).toBeTruthy()
  })

  it('sets the correct timestamp column for interviewing status', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: SEEK_URL, status: 'interviewing' },
    })
    const { id } = res.json() as { id: number }
    const row = db.select().from(jobs).where(eq(jobs.id, id)).get()
    expect(row?.status).toBe('interviewing')
    expect(row?.interviewingAt).toBeTruthy()
    expect(row?.appliedAt).toBeNull()
  })

  it('sets the correct timestamp column for skipped status', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: SEEK_URL, status: 'skipped' },
    })
    const { id } = res.json() as { id: number }
    const row = db.select().from(jobs).where(eq(jobs.id, id)).get()
    expect(row?.status).toBe('skipped')
    expect(row?.skippedAt).toBeTruthy()
  })

  it('does not set a timestamp column for blocked status', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: SEEK_URL, status: 'blocked' },
    })
    const { id } = res.json() as { id: number }
    const row = db.select().from(jobs).where(eq(jobs.id, id)).get()
    expect(row?.status).toBe('blocked')
    expect(row?.appliedAt).toBeNull()
    expect(row?.skippedAt).toBeNull()
  })

  it('uses the provided at date for the timestamp', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: SEEK_URL, status: 'applied', at: '2026-01-15' },
    })
    const { id } = res.json() as { id: number }
    const row = db.select().from(jobs).where(eq(jobs.id, id)).get()
    expect(row?.appliedAt).toBe('2026-01-15')
  })

  it('returns 409 for a duplicate Seek URL', async () => {
    await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: SEEK_URL, status: 'applied' },
    })
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: SEEK_URL, status: 'skipped' },
    })
    expect(res.statusCode).toBe(409)
  })

  it('enqueues a rank entry in analysis_queue', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: SEEK_URL, status: 'applied' },
    })
    const { id } = res.json() as { id: number }
    const row = db.select().from(analysisQueue).where(eq(analysisQueue.jobId, id)).get()
    expect(row).toBeDefined()
    expect(row?.topic).toBe('rank')
    expect(row?.completedAt).toBeNull()
  })

  it('emits a kick with topic rank on the bus', async () => {
    let received: { topic: string } | undefined
    app.bus.on('kick', payload => {
      received = payload
    })

    await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: SEEK_URL, status: 'applied' },
    })
    expect(received).toEqual({ topic: 'rank' })
  })

  it('returns 422 when htmlFetch returns empty string', async () => {
    vi.restoreAllMocks()
    mockHtmlFetch('')

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: SEEK_URL, status: 'applied' },
    })
    expect(res.statusCode).toBe(422)
  })

  it('returns 422 when parseSeekJob returns null', async () => {
    vi.restoreAllMocks()
    mockHtmlFetch('<html><body>nothing here</body></html>')

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: SEEK_URL, status: 'applied' },
    })
    expect(res.statusCode).toBe(422)
  })
})
