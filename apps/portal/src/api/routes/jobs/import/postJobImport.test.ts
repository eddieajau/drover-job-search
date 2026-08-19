/**
 * @copyright 2026 Andrew Eddie. All rights reserved.
 * @license   MIT
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { analysisQueue, jobs, jobStatusEvents, type DB } from 'db'
import { eq } from 'drizzle-orm'
import { build, createTestDb } from 'test-fixtures'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import postJobImport from './postJobImport.js'

const seekHtml = readFileSync(resolve(import.meta.dirname, '../../../../../../../.local/examples/seek.html'), 'utf-8')

const SEEK_URL = 'https://au.seek.com/job/93971606'
const NON_SEEK_URL = 'https://example.com/job/123'
const SEEK_URL_BAD = 'https://au.seek.com/job/abc'

const LINKEDIN_URL = 'https://www.linkedin.com/jobs/view/4448084368/'
const LINKEDIN_URL_NO_SLASH = 'https://www.linkedin.com/jobs/view/4448084368'

const LINKEDIN_DETAIL_HTML = `
<div class="topcard__title">Staff Software Engineer</h1>
<div class="topcard__org-name-link" href="https://www.linkedin.com/company/globex">Globex Corporation</a>
<div class="topcard__flavor topcard__flavor--bullet">Sydney, Australia</span>
<div class="show-more-less-html__markup"><h2>About the role</h2><p>We build <strong>great</strong> things.</p><ul><li>a</li><li>b</li></ul></div>
<h3 class="description__job-criteria-subheader">Employment type</h3>
<span class="description__job-criteria-text">Full-time</span>
`

function mockHtmlFetch(returnValue: string, linkedinDetailHtml: string = LINKEDIN_DETAIL_HTML): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const body = url.includes('linkedin.com/jobs-guest') ? linkedinDetailHtml : returnValue
      return {
        ok: true,
        text: async () => body,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
      }
    })
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
  })

  it('sets the correct status for interviewing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: SEEK_URL, status: 'interviewing' },
    })
    const { id } = res.json() as { id: number }
    const row = db.select().from(jobs).where(eq(jobs.id, id)).get()
    expect(row?.status).toBe('interviewing')
  })

  it('sets the correct status for skipped', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: SEEK_URL, status: 'skipped' },
    })
    const { id } = res.json() as { id: number }
    const row = db.select().from(jobs).where(eq(jobs.id, id)).get()
    expect(row?.status).toBe('skipped')
  })

  it('returns 400 when status is "blocked"', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: SEEK_URL, status: 'blocked' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('uses the provided at date for the timestamp', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: SEEK_URL, status: 'applied', at: '2026-01-15' },
    })
    const { id } = res.json() as { id: number }
    const row = db.select().from(jobs).where(eq(jobs.id, id)).get()
    expect(row?.status).toBe('applied')
  })

  it('returns 400 for a malformed at date', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: SEEK_URL, status: 'applied', at: 'not-a-date' },
    })
    expect(res.statusCode).toBe(400)
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

  it('returns 201 with a valid LinkedIn URL and applied status', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: LINKEDIN_URL, status: 'applied' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json() as { id: number; status: string; title: string }
    expect(body.status).toBe('applied')
    expect(body.title).toBe('Staff Software Engineer')
    expect(body.id).toBeGreaterThan(0)
  })

  it('inserts a job with provider linkedin for a valid LinkedIn URL', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: LINKEDIN_URL, status: 'applied' },
    })
    const { id } = res.json() as { id: number }
    const row = db.select().from(jobs).where(eq(jobs.id, id)).get()
    expect(row).toBeDefined()
    expect(row?.provider).toBe('linkedin')
    expect(row?.providerJobId).toBe('4448084368')
    expect(row?.status).toBe('applied')
    expect(row?.companyName).toBe('Globex Corporation')
    expect(row?.description).toContain('**great**')
    expect(row?.description).not.toContain('<div')
    expect(row?.employmentType).toBe('full-time')
  })

  it('works for a LinkedIn URL without a trailing slash', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: LINKEDIN_URL_NO_SLASH, status: 'skipped' },
    })
    expect(res.statusCode).toBe(201)
    const { id } = res.json() as { id: number }
    const row = db.select().from(jobs).where(eq(jobs.id, id)).get()
    expect(row?.provider).toBe('linkedin')
    expect(row?.providerJobId).toBe('4448084368')
    expect(row?.status).toBe('skipped')
  })

  it('returns 409 for a duplicate LinkedIn URL', async () => {
    await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: LINKEDIN_URL, status: 'applied' },
    })
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: LINKEDIN_URL, status: 'skipped' },
    })
    expect(res.statusCode).toBe(409)
  })

  it('returns 422 when the LinkedIn page cannot be fetched', async () => {
    vi.restoreAllMocks()
    mockHtmlFetch('', '')

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: LINKEDIN_URL, status: 'applied' },
    })
    expect(res.statusCode).toBe(422)
  })

  it('returns 422 when the LinkedIn job is closed', async () => {
    vi.restoreAllMocks()
    mockHtmlFetch(
      seekHtml,
      '<div class="topcard__flavor topcard__flavor--bullet">No longer accepting applications</div>'
    )

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: LINKEDIN_URL, status: 'applied' },
    })
    expect(res.statusCode).toBe(422)
    expect(res.body).toBe('This job is no longer accepting applications')
    const row = db.select().from(jobs).where(eq(jobs.providerJobId, '4448084368')).get()
    expect(row).toBeUndefined()
  })

  it('enqueues a rank entry in analysis_queue for a LinkedIn URL', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: LINKEDIN_URL, status: 'applied' },
    })
    const { id } = res.json() as { id: number }
    const row = db.select().from(analysisQueue).where(eq(analysisQueue.jobId, id)).get()
    expect(row).toBeDefined()
    expect(row?.topic).toBe('rank')
    expect(row?.completedAt).toBeNull()
  })

  it('creates a job_status_events row after import', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: SEEK_URL, status: 'applied', at: '2026-01-15' },
    })
    const { id } = res.json() as { id: number }
    const event = db.select().from(jobStatusEvents).where(eq(jobStatusEvents.jobId, id)).get()
    expect(event).toBeDefined()
    expect(event?.status).toBe('applied')
    expect(event?.occurredAt).toBe('2026-01-15')
    expect(event?.actor).toBe('human')
    expect(event?.note).toBeNull()
  })

  it('sets closed_at on the job when importing with a terminal status', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: SEEK_URL, status: 'skipped', at: '2026-02-20' },
    })
    const { id } = res.json() as { id: number }
    const row = db.select().from(jobs).where(eq(jobs.id, id)).get()
    expect(row?.closedAt).toBe('2026-02-20')
  })

  it('does not set closed_at when importing with a non-terminal status', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: SEEK_URL, status: 'applied', at: '2026-03-10' },
    })
    const { id } = res.json() as { id: number }
    const row = db.select().from(jobs).where(eq(jobs.id, id)).get()
    expect(row?.closedAt).toBeNull()
  })

  it('defaults occurred_at to today when at is not provided', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { url: SEEK_URL, status: 'applied' },
    })
    const { id } = res.json() as { id: number }
    const event = db.select().from(jobStatusEvents).where(eq(jobStatusEvents.jobId, id)).get()
    expect(event?.occurredAt).toBe(today)
  })
})
